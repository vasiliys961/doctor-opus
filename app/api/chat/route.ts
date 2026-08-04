import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { sendTextRequestWithFiles, sendTextRequestStreamingWithFiles } from '@/lib/openrouter-files';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText, anonymizeObject } from '@/lib/anonymization';
import { checkRateLimit, RATE_LIMIT_CHAT, getRateLimitKey } from '@/lib/rate-limiter';
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
  // Arabic script
  if (/[\u0600-\u06FF]/.test(combinedText)) return 'ar';
  // Devanagari (Hindi)
  if (/[\u0900-\u097F]/.test(combinedText)) return 'hi';
  // Cyrillic (Russian)
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
      
      // Получаем файлы. На некоторых Node runtime глобальный File может отсутствовать,
      // поэтому используем runtime-safe file-like проверку вместо instanceof File.
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

    const selectedModel = (model === 'gpt52' || model === MODELS.GPT_5_2)
      ? MODELS.GPT_5_2
      : (model === 'sonnet' || model === MODELS.SONNET) 
        ? MODELS.SONNET 
        : (model === 'fable' || model === MODELS.FABLE_5)
          ? MODELS.FABLE_5
        : (model && (model === 'gemini' || model.includes('gemini')))
          ? MODELS.GEMINI_3_FLASH
          : MODELS.OPUS;

    const languageHint = detectLanguageHint(message, history);
    const languageInstruction = responseLanguagePreference === 'auto'
      ? buildLanguageInstruction(languageHint)
      : buildForcedLanguageInstruction(responseLanguagePreference);
    const isClaudeAssistantModel =
      selectedModel === MODELS.SONNET || selectedModel === MODELS.OPUS || selectedModel === MODELS.FABLE_5;
    const assistantFormattingInstruction = `
RESPONSE FORMAT:
- Use clean Markdown with readable structure.
- If table data exists, use standard Markdown tables with | and a separator row |---|.
- Do not use pseudo-tables in one line with double pipes ||.
- Do not wrap tables into code blocks.
- Leave a blank line before and after each table.
`;
    const preparedMessageBase = isClaudeAssistantModel
      ? `${message}\n\n${assistantFormattingInstruction}`
      : message;
    const preparedMessage = `${preparedMessageBase}\n\n${languageInstruction}`;
    const effectiveSystemPrompt = systemPrompt
      ? `${systemPrompt}\n\n${languageInstruction}`
      : languageInstruction;
    const styleInstruction = responseStyle === 'brief'
      ? 'RESPONSE STYLE: Brief. Give only the essentials without long explanations. Prefer 3-6 concise bullet points and a short conclusion.'
      : 'RESPONSE STYLE: Detailed. Provide a full structured answer with reasoning and practical next steps.';

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
      ? 'DIALOGUE MODE: Continue the current conversation. Address new clinician remarks directly and avoid repeating the full structure of the first response unless explicitly requested.'
      : 'DIALOGUE MODE: Provide a clear initial baseline response for this request.';
    const finalMessage = `${preparedMessage}\n\n${styleInstruction}\n${dialogueInstruction}`;

    let pubMedContext = '';
    let pubMedRuntimeInstruction = '';
    const enableMedicalBrowsing = process.env.ENABLE_MEDICAL_BROWSING === 'true';
    const evidenceQueryPattern = /(pubmed|pmid|doi|meta-anal|meta analysis|метаанализ|систематич|guideline|клиническ\w*\s+рекомендац|antibiotic|resistance|стать[яи]|исследован)/i;
    const looksLikeEvidenceQuery = evidenceQueryPattern.test(message);
    const isAcademicSearch =
      specialty === 'openevidence' ||
      model === 'perplexity' ||
      model === 'perplexity/sonar' ||
      looksLikeEvidenceQuery;

    if (enableMedicalBrowsing && isAcademicSearch) {
      const maxResults = Number(process.env.PUBMED_TOP_K || 5);
      const timeoutMs = Number(process.env.PUBMED_TIMEOUT_MS || 3500);
      try {
        const articles = await searchPubMedEvidence(message, { maxResults, timeoutMs });
        const openAccessLinks = await resolveOpenAccessLinks(articles.map((a) => a.doi));
        pubMedContext = buildPubMedContextBlock(articles, openAccessLinks);
        pubMedRuntimeInstruction = articles.length > 0
          ? 'Online PubMed/Europe PMC evidence was already retrieved server-side. Use these sources and include PMID in your "Sources (PubMed)" section.'
          : 'Online PubMed/Europe PMC search was already executed but no relevant sources were found for this query. State that no sources were found for the current scope and suggest refining the query.';
      } catch (e: any) {
        console.warn('[PUBMED RAG] failed:', e?.message || e);
      }
    }

    const finalMessageWithEvidence = [finalMessage, pubMedContext, pubMedRuntimeInstruction]
      .filter(Boolean)
      .join('\n\n');

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
        const stream = await sendTextRequestStreamingWithFiles(finalMessageWithEvidence, formattedHistory, files, selectedModel, specialty as any);
        return handleStreaming(stream);
      } else {
        const result = await sendTextRequestWithFiles(finalMessageWithEvidence, formattedHistory, files, selectedModel, specialty as any);
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
      const stream = await sendTextRequestStreaming(
        finalMessageWithEvidence,
        formattedHistory,
        selectedModel,
        specialty as any,
        effectiveSystemPrompt
      );
      return handleStreaming(stream);
    }

    // Обычный режим - полный ответ
    console.log('🚀 [CHAT API] Начало запроса к OpenRouter...');
    const result = await sendTextRequest(finalMessageWithEvidence, formattedHistory, selectedModel, specialty as any);
    console.log('✅ [CHAT API] Ответ от OpenRouter получен успешно.');
    
    const { calculateCost } = await import('@/lib/cost-calculator');
    const costInfo = calculateCost(1000, 1000, selectedModel);

    return NextResponse.json({
      success: true,
      result: result,
      cost: costInfo.totalCostUnits,
      model: selectedModel
    });
  } catch (error: any) {
    console.error('🔴 [CHAT API ERROR]:', error);
    console.error('🔴 [STACK]:', error.stack);
    const { safeErrorMessage } = await import('@/lib/safe-error');
    return NextResponse.json(
      { success: false, error: safeErrorMessage(error, 'Ошибка обработки запроса') },
      { status: 500 }
    );
  }
}

