import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { sendTextRequestWithFiles, sendTextRequestStreamingWithFiles } from '@/lib/openrouter-files';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText, anonymizeObject } from '@/lib/anonymization';
import { checkRateLimit, RATE_LIMIT_CHAT, getRateLimitKey } from '@/lib/rate-limiter';
import { checkAndDeductBalance } from '@/lib/server-billing';
import { searchPubMedEvidence, buildPubMedContextBlock } from '@/lib/pubmed-rag';
import { resolveOpenAccessLinks } from '@/lib/unpaywall';
import {
  buildAutoResponseLanguageInstruction,
  buildForcedResponseLanguageInstruction,
  type ResponseLanguageCode,
} from '@/lib/language-policy';

// Максимальное время выполнения запроса (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const MAX_CHAT_FILES_PER_REQUEST = 4;
const MAX_CHAT_TOTAL_BYTES_PER_REQUEST = 16 * 1024 * 1024;
const MIN_CHAT_COST = 0.7;
const MAX_CHAT_COST = 6;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

type ChatHistoryItem = { role: string; content: string };
type ResponseLanguagePreference = 'auto' | ResponseLanguageCode;
type LanguageHint = 'auto' | 'ru' | 'ar' | 'hi';

function normalizeResponseLanguagePreference(input: unknown): ResponseLanguagePreference {
  if (typeof input !== 'string') return 'auto';
  const value = input.toLowerCase();
  switch (value) {
    case 'en':
    case 'ru':
    case 'ar':
    case 'hi':
    case 'es':
    case 'fr':
    case 'zh':
    case 'ms':
    case 'id':
    case 'pt-br':
    case 'tr':
      return value;
    default:
      return 'auto';
  }
}

function detectLanguageHint(message: string, history: any[]): LanguageHint {
  const recentUserText = history
    .filter((item: any) => item?.role === 'user' && typeof item?.content === 'string')
    .slice(-4)
    .map((item: any) => item.content)
    .join('\n');

  const combinedText = `${message}\n${recentUserText}`;
  if (/[\u0600-\u06FF]/.test(combinedText)) return 'ar';
  if (/[\u0900-\u097F]/.test(combinedText)) return 'hi';
  if (/[\u0400-\u04FF]/.test(combinedText)) return 'ru';
  return 'auto';
}

function buildLanguageInstruction(hint: LanguageHint): string {
  if (hint === 'ru') return buildAutoResponseLanguageInstruction('Russian');
  if (hint === 'ar') return buildAutoResponseLanguageInstruction('Arabic');
  if (hint === 'hi') return buildAutoResponseLanguageInstruction('Hindi');
  return buildAutoResponseLanguageInstruction();
}

function buildForcedLanguageInstruction(language: Exclude<ResponseLanguagePreference, 'auto'>): string {
  return buildForcedResponseLanguageInstruction(language);
}

function parseStatusFromError(error: unknown): number | null {
  const text = String((error as any)?.message || '');
  const statusMatch = text.match(/\b(\d{3})\b/);
  if (!statusMatch) return null;
  const status = Number(statusMatch[1]);
  return Number.isFinite(status) ? status : null;
}

function isOpenRouterAccessDenied(error: unknown): boolean {
  const status = parseStatusFromError(error);
  const message = String((error as any)?.message || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    message.includes('access denied by security policy') ||
    message.includes('permission_denied') ||
    message.includes('provider returned error')
  );
}

function logProviderAccessDiagnostics(params: {
  request: NextRequest;
  selectedModel: string;
  useStreaming: boolean;
  stage: 'streaming' | 'non-streaming';
  error: unknown;
}): void {
  const { request, selectedModel, useStreaming, stage, error } = params;
  const errMessage = String((error as any)?.message || 'unknown').slice(0, 500);
  const status = parseStatusFromError(error);
  const llmKeyPresent = Boolean(process.env.LLM_API_KEY?.trim());
  const openrouterKeyPresent = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const anthropicKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  console.warn('[CHAT PROVIDER ACCESS] OpenRouter request failed', {
    stage,
    status,
    selectedModel,
    useStreaming,
    host: request.headers.get('host') || 'n/a',
    origin: request.headers.get('origin') || 'n/a',
    xForwardedFor: request.headers.get('x-forwarded-for') || 'n/a',
    userAgent: request.headers.get('user-agent') || 'n/a',
    llmKeyPresent,
    openrouterKeyPresent,
    anthropicKeyPresent,
    errorSnippet: errMessage,
  });
}

function mapOpenRouterToAnthropicModel(selectedModel: string): string {
  const explicitFallback = process.env.ANTHROPIC_FALLBACK_MODEL?.trim();
  if (explicitFallback) return explicitFallback;
  if (selectedModel.includes('opus')) return 'claude-opus-5';
  if (selectedModel.includes('sonnet')) return 'claude-sonnet-5';
  return 'claude-sonnet-5';
}

function hasAnthropicFallbackKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function buildAnthropicMessages(history: ChatHistoryItem[], finalMessage: string) {
  const normalizedHistory = history
    .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

  return [
    ...normalizedHistory,
    { role: 'user' as const, content: finalMessage },
  ];
}

async function sendAnthropicFallbackText(params: {
  finalMessage: string;
  history: ChatHistoryItem[];
  selectedModel: string;
  systemPrompt?: string;
}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured for fallback');
  }

  const model = mapOpenRouterToAnthropicModel(params.selectedModel);
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.1,
      system: params.systemPrompt || 'You are a medical AI assistant. Reply in clear, structured clinical English.',
      messages: buildAnthropicMessages(params.history, params.finalMessage),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic fallback error: ${response.status} - ${errorText.slice(0, 400)}`);
  }

  const data = await response.json();
  const text = (data?.content || [])
    .filter((part: any) => part?.type === 'text')
    .map((part: any) => String(part.text || ''))
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Anthropic fallback returned empty response');
  }

  return { text, model };
}

function createSseStreamFromText(text: string, model: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const payload = {
        id: 'anthropic-fallback',
        model,
        choices: [{ delta: { content: text } }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

function estimateChatCost(params: {
  selectedModel: string;
  messageLength: number;
  historyLength: number;
  filesCount: number;
  totalFileBytes: number;
}): number {
  const modelBase =
    (params.selectedModel === 'anthropic/claude-fable-5.1' || params.selectedModel === 'anthropic/claude-fable-5') ? 4.4 :
    (params.selectedModel === MODELS.OPUS || params.selectedModel === MODELS.OPUS_VALIDATED) ? 2.2 :
    params.selectedModel === MODELS.SONNET ? 1.3 :
    params.selectedModel === MODELS.GPT_5_2 ? 1.4 : 0.9;
  const textFactor = Math.min(1.4, params.messageLength / 3000);
  const historyFactor = Math.min(1.8, params.historyLength * 0.12);
  const filesFactor = params.filesCount > 0 ? (0.6 + Math.min(1.5, params.totalFileBytes / (8 * 1024 * 1024))) : 0;
  const estimated = modelBase + textFactor + historyFactor + filesFactor;
  return Number(Math.min(MAX_CHAT_COST, Math.max(MIN_CHAT_COST, estimated)).toFixed(2));
}

/**
 * На некоторых Node runtime глобальный File отсутствует, из-за чего
 * request.formData() может падать с ReferenceError: File is not defined.
 */
async function ensureFileGlobalForFormData(): Promise<void> {
  if (typeof File !== 'undefined') return;

  try {
    const { File: BufferFile } = await import('buffer');
    if (typeof BufferFile !== 'undefined') {
      (globalThis as any).File = BufferFile;
    }
  } catch {
    // Если полифилл недоступен, оставляем дефолтное поведение и
    // возвращаем исходную ошибку из request.formData().
  }
}

/**
 * API endpoint для ИИ-ассистента
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rlKey = getRateLimitKey(request, session.user.email);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_CHAT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please wait.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    
    let message: string;
    let history: any[] = [];
    let useStreaming = false;
    let model: string | undefined;
    let files: File[] = [];
    let specialty: string | undefined;
    let systemPrompt: string | undefined;
    let responseStyle: 'brief' | 'detailed' = 'detailed';
    let responseLanguagePreference: ResponseLanguagePreference = 'auto';

    // Проверяем, является ли запрос FormData (с файлами) или JSON
    if (contentType.includes('multipart/form-data')) {
      await ensureFileGlobalForFormData();
      const formData = await request.formData();
      message = anonymizeText((formData.get('message') as string) || '');
      specialty = formData.get('specialty') as string | undefined;
      systemPrompt = formData.get('systemPrompt') as string | undefined;
      const historyStr = formData.get('history') as string;
      if (historyStr) {
        try {
          history = anonymizeObject(JSON.parse(historyStr));
        } catch (e) {
          console.warn('Failed to parse history:', e);
        }
      }
      useStreaming = formData.get('useStreaming') === 'true';
      model = formData.get('model') as string | undefined;
      responseStyle = ((formData.get('responseStyle') as string) === 'brief' ? 'brief' : 'detailed');
      responseLanguagePreference = normalizeResponseLanguagePreference(formData.get('responseLanguage'));
      
      // Получаем файлы. На некоторых Node runtimes глобальный File отсутствует,
      // поэтому нельзя использовать instanceof File.
      const fileEntries = formData.getAll('files');
      const isFileLike = (value: unknown): value is File => {
        return !!value &&
          typeof value === 'object' &&
          typeof (value as any).name === 'string' &&
          typeof (value as any).size === 'number' &&
          typeof (value as any).arrayBuffer === 'function' &&
          typeof (value as any).type === 'string';
      };
      files = fileEntries.filter(isFileLike).filter(f => f.size > 0);
    } else {
      const body = await request.json();
      message = anonymizeText(body.message || body.prompt || '');
      history = anonymizeObject(body.history || []);
      useStreaming = body.useStreaming !== undefined ? body.useStreaming : true; // Default to true for chat
      model = body.model;
      specialty = body.specialty;
      systemPrompt = body.systemPrompt;
      responseStyle = body.responseStyle === 'brief' ? 'brief' : 'detailed';
      responseLanguagePreference = normalizeResponseLanguagePreference(body.responseLanguage);
    }

    if (files.length > 0) {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      if (files.length > MAX_CHAT_FILES_PER_REQUEST || totalBytes > MAX_CHAT_TOTAL_BYTES_PER_REQUEST) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many files for one request. Maximum: ${MAX_CHAT_FILES_PER_REQUEST} files and ${(MAX_CHAT_TOTAL_BYTES_PER_REQUEST / (1024 * 1024)).toFixed(0)} MB total.`,
            details: {
              files: files.length,
              totalBytes
            }
          },
          { status: 413 }
        );
      }
    }

    // Terra включена по умолчанию; для быстрого отката можно выставить ALLOW_GPT52_CHAT=false.
    const allowGpt52Chat = process.env.ALLOW_GPT52_CHAT !== 'false';
    const selectedModel = (model === 'gpt52' || model === MODELS.GPT_5_2)
      ? (allowGpt52Chat ? MODELS.GPT_5_2 : MODELS.SONNET)
      : (model === 'sonnet' || model === MODELS.SONNET) 
        ? MODELS.SONNET 
        : (model === 'fable' || model === 'anthropic/claude-fable-5' || model === 'anthropic/claude-fable-5.1')
          ? 'anthropic/claude-fable-5.1'
        : (model && (model === 'gemini' || model.includes('gemini')))
          ? MODELS.GEMINI_3_FLASH
      : MODELS.OPUS_VALIDATED;

    const totalFileBytes = files.reduce((sum, file) => sum + file.size, 0);
    const estimatedCost = estimateChatCost({
      selectedModel,
      messageLength: message.length,
      historyLength: history.length,
      filesCount: files.length,
      totalFileBytes,
    });
    const billing = await checkAndDeductBalance(
      session.user.email,
      estimatedCost,
      'AI Assistant chat',
      {
        model: selectedModel,
        historyLength: history.length,
        filesCount: files.length,
        totalFileBytes,
        useStreaming,
        specialty: specialty || null,
      }
    );
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Insufficient balance for chat request' },
        { status: 402 }
      );
    }

    const isClaudeAssistantModel =
      selectedModel === MODELS.SONNET ||
      selectedModel === MODELS.OPUS ||
      selectedModel === MODELS.OPUS_VALIDATED;
    const assistantFormattingInstruction = `
RESPONSE FORMAT:
- Write in clean Markdown with clear structure.
- If tabular data is needed, use standard Markdown tables with | and a separator row |---|.
- Do not use one-line pseudo tables with double pipes ||.
- Do not wrap tables in code blocks.
- Leave a blank line before and after each table.
`;
    const preparedMessage = isClaudeAssistantModel
      ? `${message}\n\n${assistantFormattingInstruction}`
      : message;
    const languageHint = detectLanguageHint(message, history);
    const languageInstruction = responseLanguagePreference === 'auto'
      ? buildLanguageInstruction(languageHint)
      : buildForcedLanguageInstruction(responseLanguagePreference);
    // If the client did not provide a custom system prompt, keep it undefined so that
    // sendTextRequest*/sendTextRequestStreaming fall back to the full default prompt
    // (SYSTEM_PROMPT / DIALOGUE_SYSTEM_PROMPT), which already contains the mandatory
    // disclaimer and the evidence/sources section. The language instruction is still
    // enforced via `finalMessage` below, so it is not lost.
    const effectiveSystemPrompt = systemPrompt
      ? `${systemPrompt}\n\n${languageInstruction}`
      : undefined;
    const styleInstruction = responseStyle === 'brief'
      ? 'RESPONSE STYLE: Compact but not shallow. Keep the answer shorter than full mode, but include clinical rationale, key differential checkpoints, practical next steps, and safety red flags (typically 6-10 concise bullets with short explanations).'
      : 'RESPONSE STYLE: Detailed and comprehensive. Provide a full structured answer with clinical reasoning, prioritized differential, practical management options, monitoring, and escalation criteria.';

    if (!message && files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No message or files provided' },
        { status: 400 }
      );
    }

    // Формируем историю для контекста
    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    const hasDialogueContext = formattedHistory.length > 0;
    const dialogueInstruction = hasDialogueContext
      ? 'DIALOGUE MODE: Continue the current conversation. Address the latest user request directly and avoid repeating full long sections unless explicitly asked.'
      : 'DIALOGUE MODE: Provide a clear primary response to the request.';
    let pubMedContext = '';
    let pubMedRuntimeInstruction = '';
    let pubMedStatusInstruction = '';
    const LIBRARY_CONTEXT_MARKERS = [
      '### LIBRARY CONTEXT:',
      '### КОНТЕКСТ ИЗ БИБЛИОТЕКИ:',
      '### LIBRARY IMAGE MATCHES:',
      '### СОВПАДЕНИЯ ИЗОБРАЖЕНИЙ БИБЛИОТЕКИ:',
    ];
    const libraryMarker = LIBRARY_CONTEXT_MARKERS.find((marker) => message.includes(marker));
    const pubMedQuery = libraryMarker
      ? message.split(libraryMarker)[0].trim()
      : message.trim();
    const enableMedicalBrowsing = process.env.ENABLE_MEDICAL_BROWSING === 'true';
    const evidenceQueryPattern = /(pubmed|pmid|doi|meta-anal|meta analysis|метаанализ|систематич|guideline|клиническ\w*\s+рекомендац|amr|antibiotic|resistance|стать[яи]|исследован)/i;
    const looksLikeEvidenceQuery = evidenceQueryPattern.test(pubMedQuery);
    const isAcademicSearch =
      specialty === 'openevidence' ||
      model === 'perplexity' ||
      model === 'perplexity/sonar' ||
      looksLikeEvidenceQuery;

    console.log(`[PUBMED RAG] gate enabled=${enableMedicalBrowsing} specialty=${specialty || 'n/a'} model=${model || 'n/a'} evidenceQuery=${looksLikeEvidenceQuery} academic=${isAcademicSearch} queryLength=${pubMedQuery.length}`);

    if (enableMedicalBrowsing && isAcademicSearch) {
      const maxResults = Number(process.env.PUBMED_TOP_K || 5);
      const timeoutMs = Number(process.env.PUBMED_TIMEOUT_MS || 3500);
      try {
        const articles = await searchPubMedEvidence(pubMedQuery, { maxResults, timeoutMs });
        // Europe PMC уже отдаёт open-access ссылку в самом ответе поиска для
        // части статей (article.openAccessUrl) — Unpaywall дозапрашиваем только
        // для тех, где Europe PMC такую ссылку не нашёл (например, полный текст
        // лежит в стороннем университетском репозитории, а не в PMC).
        const doisNeedingUnpaywall = articles.filter((a) => !a.openAccessUrl).map((a) => a.doi);
        const openAccessLinks = await resolveOpenAccessLinks(doisNeedingUnpaywall);
        pubMedContext = buildPubMedContextBlock(articles, openAccessLinks);
        console.log(`[PUBMED RAG] enabled=${enableMedicalBrowsing} academic=${isAcademicSearch} specialty=${specialty || 'n/a'} model=${model || 'n/a'} results=${articles.length} openAccessLinks=${openAccessLinks.size}`);
        pubMedRuntimeInstruction = articles.length > 0
          ? 'SERVER-SIDE ONLINE SEARCH ALREADY COMPLETED via PubMed. Do not claim you lack live access. Use the retrieved sources and include PMID in the "Sources (PubMed)" section.'
          : 'PubMed online search has already been executed server-side, but no relevant sources were found for the current query/filter set. Do not claim lack of live access; state that no sources were found and suggest refining the query.';
        pubMedStatusInstruction = articles.length > 0
          ? `In the first line, write exactly: "🔎 PubMed: ${articles.length} sources found."`
          : 'In the first line, write exactly: "🔎 PubMed: no sources found for the current query."';
      } catch (error) {
        // Безопасный fallback: чат продолжает работу без online retrieval.
        console.warn('PubMed retrieval failed, fallback to default chat mode:', error);
        console.log(`[PUBMED RAG] enabled=${enableMedicalBrowsing} academic=${isAcademicSearch} specialty=${specialty || 'n/a'} model=${model || 'n/a'} results=error`);
        pubMedRuntimeInstruction = 'Server-side PubMed retrieval was attempted but failed due to a temporary technical error. Do not claim lack of live access; briefly report temporary search unavailability and continue with expert guidance.';
        pubMedStatusInstruction = 'In the first line, write exactly: "🔎 PubMed: online search temporarily unavailable."';
      }
    }

    // Жёсткий RAG-гейт: если врачу отвечаем с опорой на источники (библиотека и/или
    // PubMed), явно требуем помечать те части ответа, которые источники НЕ покрывают —
    // иначе модель может незаметно подмешать общие знания под видом обоснованного ответа
    // ("тихая" галлюцинация — самый опасный класс ошибок в клинических рекомендациях).
    const hasLibraryContext = LIBRARY_CONTEXT_MARKERS.some((marker) => message.includes(marker));
    const hasRagContext = hasLibraryContext || pubMedContext.length > 0;
    const ragGateInstruction = hasRagContext
      ? '\nSTRICT SOURCE RULE (RAG gate): external context is provided (physician library and/or PubMed). Use it wherever relevant. If context is insufficient for any statement and you rely on model prior knowledge, explicitly tag that statement with "⚠️ not confirmed by provided sources". Do not mask missing evidence with confident tone. IMPORTANT: Never claim that a specific book/document is absent from the physician library. You only see retrieved excerpts, not full library inventory.'
      : '';

    const finalMessage = `${preparedMessage}\n\n${languageInstruction}\n${styleInstruction}\n${dialogueInstruction}${ragGateInstruction}${pubMedRuntimeInstruction ? `\n${pubMedRuntimeInstruction}` : ''}${pubMedStatusInstruction ? `\n${pubMedStatusInstruction}` : ''}${pubMedContext ? `\n\n${pubMedContext}` : ''}`;

    // Обработка стриминга с логированием
    const handleStreaming = async (stream: ReadableStream) => {
      const decoder = new TextDecoder();
      const { formatCostLog } = await import('@/lib/cost-calculator');
      
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Сразу пробрасываем для минимизации задержек
          controller.enqueue(chunk);
          
          const text = decoder.decode(chunk, { stream: true });
          
          // Ищем статистику использования
          if (text.includes('"usage":')) {
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.includes('"usage":')) {
                try {
                  const jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();
                  if (jsonStr === '[DONE]') continue;
                  const data = JSON.parse(jsonStr);
                  if (data.usage) {
                    const usageModel = data.model || selectedModel;
                    console.log(formatCostLog(
                      usageModel,
                      data.usage.prompt_tokens,
                      data.usage.completion_tokens,
                      data.usage.total_tokens
                    ));
                  }
                } catch (e) {}
              }
            }
          }
        }
      });

      return new Response(stream.pipeThrough(transformStream), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Content-Encoding': 'none',
        },
      });
    };

    // Если есть файлы, используем функции с поддержкой файлов
    if (files.length > 0) {
      if (useStreaming) {
        const stream = await sendTextRequestStreamingWithFiles(finalMessage, formattedHistory, files, selectedModel, specialty as any);
        return handleStreaming(stream);
      } else {
        const result = await sendTextRequestWithFiles(finalMessage, formattedHistory, files, selectedModel, specialty as any);
        const { calculateCost } = await import('@/lib/cost-calculator');
        const costInfo = calculateCost(2000, 1500, selectedModel); // Оценочно для non-streaming
        
        return NextResponse.json({
          success: true,
          result: result,
          cost: costInfo.totalCostUnits,
          model: selectedModel
        });
      }
    }

    // Если запрошен streaming без файлов, возвращаем поток
    if (useStreaming) {
      try {
        const stream = await sendTextRequestStreaming(finalMessage, formattedHistory, selectedModel, specialty as any, effectiveSystemPrompt);
        return handleStreaming(stream);
      } catch (error) {
        if (!isOpenRouterAccessDenied(error)) {
          throw error;
        }

        logProviderAccessDiagnostics({
          request,
          selectedModel,
          useStreaming,
          stage: 'streaming',
          error,
        });

        if (!hasAnthropicFallbackKey()) {
          throw error;
        }
        const fallback = await sendAnthropicFallbackText({
          finalMessage,
          history: formattedHistory,
          selectedModel,
          systemPrompt: effectiveSystemPrompt,
        });
        console.warn(`[CHAT FALLBACK] OpenRouter blocked, using Anthropic direct API (${fallback.model})`);
        return handleStreaming(createSseStreamFromText(fallback.text, fallback.model));
      }
    }

    // Обычный режим - полный ответ
    console.log('🚀 [CHAT API] Sending request to OpenRouter...');
    let result: string;
    let modelUsed = selectedModel;
    try {
      result = await sendTextRequest(finalMessage, formattedHistory, selectedModel, specialty as any, effectiveSystemPrompt);
      console.log('✅ [CHAT API] OpenRouter response received.');
    } catch (error) {
      if (!isOpenRouterAccessDenied(error)) {
        throw error;
      }

      logProviderAccessDiagnostics({
        request,
        selectedModel,
        useStreaming,
        stage: 'non-streaming',
        error,
      });

      if (!hasAnthropicFallbackKey()) {
        throw error;
      }
      const fallback = await sendAnthropicFallbackText({
        finalMessage,
        history: formattedHistory,
        selectedModel,
        systemPrompt: effectiveSystemPrompt,
      });
      result = fallback.text;
      modelUsed = fallback.model;
      console.warn(`[CHAT FALLBACK] OpenRouter blocked, using Anthropic direct API (${modelUsed})`);
    }
    
    const { calculateCost } = await import('@/lib/cost-calculator');
    const costInfo = calculateCost(1000, 1000, modelUsed);

    return NextResponse.json({
      success: true,
      result: result,
      cost: costInfo.totalCostUnits,
      model: modelUsed
    });
  } catch (error: any) {
    console.error('🔴 [CHAT API ERROR]:', error);
    console.error('🔴 [STACK]:', error.stack);
    const { safeErrorMessage } = await import('@/lib/safe-error');
    return NextResponse.json(
      { success: false, error: safeErrorMessage(error, 'Request processing failed') },
      { status: 500 }
    );
  }
}

