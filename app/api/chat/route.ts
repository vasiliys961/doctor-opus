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

// Максимальное время выполнения запроса (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const MAX_CHAT_FILES_PER_REQUEST = 4;
const MAX_CHAT_TOTAL_BYTES_PER_REQUEST = 16 * 1024 * 1024;
const MIN_CHAT_COST = 0.7;
const MAX_CHAT_COST = 6;

function estimateChatCost(params: {
  selectedModel: string;
  messageLength: number;
  historyLength: number;
  filesCount: number;
  totalFileBytes: number;
}): number {
  const modelBase =
    params.selectedModel === MODELS.OPUS ? 2.2 :
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
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rlKey = getRateLimitKey(request, session.user.email);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_CHAT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Превышен лимит запросов. Подождите.' },
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
        : (model && (model === 'gemini' || model.includes('gemini')))
          ? MODELS.GEMINI_3_FLASH
          : MODELS.OPUS;

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
        { success: false, error: billing.error || 'Недостаточно единиц для запроса в чат' },
        { status: 402 }
      );
    }

    const isClaudeAssistantModel = selectedModel === MODELS.SONNET || selectedModel === MODELS.OPUS;
    const assistantFormattingInstruction = `
ФОРМАТ ОТВЕТА:
- Пиши в чистом Markdown, структурно и читаемо.
- Если есть табличные данные, оформляй только стандартной Markdown-таблицей с символом | и строкой разделителей |---|.
- Не используй псевдо-таблицы в одну строку с двойными вертикальными чертами ||.
- Не помещай таблицы в блоки кода.
- Перед и после таблицы оставляй пустую строку.
`;
    const preparedMessage = isClaudeAssistantModel
      ? `${message}\n\n${assistantFormattingInstruction}`
      : message;
    const styleInstruction = responseStyle === 'brief'
      ? 'СТИЛЬ ОТВЕТА: Кратко. Дай только суть, без длинных объяснений. По возможности 3-6 пунктов и короткое заключение.'
      : 'СТИЛЬ ОТВЕТА: Развернуто. Дай полный структурированный ответ с обоснованием и практическими шагами.';

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
      ? 'РЕЖИМ ДИАЛОГА: Отвечай как продолжение текущей беседы. Учитывай входящие замечания пользователя и отвечай точечно по новому вопросу. Не повторяй полностью структуру и длинные блоки из первого ответа, если пользователь явно не попросил повторить.'
      : 'РЕЖИМ ДИАЛОГА: Сформируй базовый первичный ответ по запросу.';
    let pubMedContext = '';
    let pubMedRuntimeInstruction = '';
    const enableMedicalBrowsing = process.env.ENABLE_MEDICAL_BROWSING === 'true';
    const evidenceQueryPattern = /(pubmed|pmid|doi|meta-anal|meta analysis|метаанализ|систематич|guideline|клиническ\w*\s+рекомендац|amr|antibiotic|resistance|стать[яи]|исследован)/i;
    const looksLikeEvidenceQuery = evidenceQueryPattern.test(message);
    const isAcademicSearch =
      specialty === 'openevidence' ||
      model === 'perplexity' ||
      model === 'perplexity/sonar' ||
      looksLikeEvidenceQuery;

    console.log(`[PUBMED RAG] gate enabled=${enableMedicalBrowsing} specialty=${specialty || 'n/a'} model=${model || 'n/a'} evidenceQuery=${looksLikeEvidenceQuery} academic=${isAcademicSearch}`);

    if (enableMedicalBrowsing && isAcademicSearch) {
      const maxResults = Number(process.env.PUBMED_TOP_K || 5);
      const timeoutMs = Number(process.env.PUBMED_TIMEOUT_MS || 3500);
      try {
        const articles = await searchPubMedEvidence(message, { maxResults, timeoutMs });
        pubMedContext = buildPubMedContextBlock(articles);
        console.log(`[PUBMED RAG] enabled=${enableMedicalBrowsing} academic=${isAcademicSearch} specialty=${specialty || 'n/a'} model=${model || 'n/a'} results=${articles.length}`);
        pubMedRuntimeInstruction = articles.length > 0
          ? 'ONLINE-ПОИСК УЖЕ ВЫПОЛНЕН на сервере через PubMed. Не пиши, что у тебя нет live-доступа. Используй найденные источники и укажи PMID в разделе "Источники (PubMed)".'
          : 'ONLINE-ПОИСК PubMed уже выполнен на сервере, но релевантных источников не найдено по текущему запросу/фильтрам. Не пиши, что у тебя нет live-доступа; сообщи, что по текущему поиску источники не найдены и предложи уточнить запрос.';
      } catch (error) {
        // Безопасный fallback: чат продолжает работу без online retrieval.
        console.warn('PubMed retrieval failed, fallback to default chat mode:', error);
        console.log(`[PUBMED RAG] enabled=${enableMedicalBrowsing} academic=${isAcademicSearch} specialty=${specialty || 'n/a'} model=${model || 'n/a'} results=error`);
        pubMedRuntimeInstruction = 'Попытка онлайн-поиска PubMed была выполнена на сервере, но завершилась технической ошибкой retrieval. Не пиши, что у тебя нет live-доступа; кратко сообщи о временной недоступности поиска и продолжи экспертный ответ.';
      }
    }

    const finalMessage = `${preparedMessage}\n\n${styleInstruction}\n${dialogueInstruction}${pubMedRuntimeInstruction ? `\n${pubMedRuntimeInstruction}` : ''}${pubMedContext ? `\n\n${pubMedContext}` : ''}`;

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
      const stream = await sendTextRequestStreaming(finalMessage, formattedHistory, selectedModel, specialty as any, systemPrompt);
      return handleStreaming(stream);
    }

    // Обычный режим - полный ответ
    console.log('🚀 [CHAT API] Начало запроса к OpenRouter...');
    const result = await sendTextRequest(finalMessage, formattedHistory, selectedModel, specialty as any);
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

