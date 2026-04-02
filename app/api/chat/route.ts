import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { sendTextRequestWithFiles, sendTextRequestStreamingWithFiles } from '@/lib/openrouter-files';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText, anonymizeObject } from '@/lib/anonymization';
import { checkRateLimit, RATE_LIMIT_CHAT, getRateLimitKey } from '@/lib/rate-limiter';
import { buildFhirInteropSummary } from '@/lib/hackathon/fhir';
import { dispatchA2ATask } from '@/lib/hackathon/a2a';
import { executeHackathonMcpTool } from '@/lib/hackathon/mcp';
import { FhirBundleBuildInput, HackathonA2ATask, HackathonMcpToolCall } from '@/lib/hackathon/types';

// Максимальное время выполнения запроса (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const MAX_CHAT_FILES_PER_REQUEST = 4;
const MAX_CHAT_TOTAL_BYTES_PER_REQUEST = 16 * 1024 * 1024;

type ResponseLanguage = 'en' | 'ru';

function detectResponseLanguage(message: string, history: any[]): ResponseLanguage {
  const recentUserText = history
    .filter((item: any) => item?.role === 'user' && typeof item?.content === 'string')
    .slice(-4)
    .map((item: any) => item.content)
    .join('\n');

  const combinedText = `${message}\n${recentUserText}`;
  return /[\u0400-\u04FF]/.test(combinedText) ? 'ru' : 'en';
}

function buildLanguageInstruction(language: ResponseLanguage): string {
  if (language === 'ru') {
    return `RESPONSE LANGUAGE:
- Reply in Russian.
- Keep wording professional and concise.
- Preserve standard international medical terminology where appropriate.`;
  }

  return `RESPONSE LANGUAGE:
- Reply in English.
- Keep wording professional and concise.
- Preserve standard international medical terminology.`;
}

interface ChatInteropPayload {
  fhirData?: FhirBundleBuildInput;
  a2aTask?: HackathonA2ATask;
  mcpToolCall?: HackathonMcpToolCall;
}

function buildInteropInstruction(interop?: ChatInteropPayload): string {
  if (!interop) return '';

  const sections: string[] = ['INTEROPERABILITY CONTEXT (MVP HACKATHON):'];

  if (interop.fhirData?.patient) {
    sections.push(buildFhirInteropSummary(interop.fhirData));
  }

  if (interop.a2aTask) {
    const a2aResult = dispatchA2ATask(interop.a2aTask);
    sections.push(
      [
        'A2A CONTEXT:',
        `- taskId: ${a2aResult.taskId}`,
        `- assignedAgent: ${a2aResult.assignedAgent}`,
        `- status: ${a2aResult.status}`,
        `- summary: ${a2aResult.summary}`
      ].join('\n')
    );
  }

  if (interop.mcpToolCall?.tool) {
    try {
      const mcpResult = executeHackathonMcpTool(interop.mcpToolCall);
      sections.push(
        [
          'MCP TOOL RESULT:',
          `- tool: ${mcpResult.tool as string}`,
          `- result: ${JSON.stringify(mcpResult.result)}`
        ].join('\n')
      );
    } catch {
      sections.push('MCP TOOL RESULT:\n- tool execution failed, ignore MCP context.');
    }
  }

  if (sections.length === 1) {
    return '';
  }

  sections.push('Use this context as additional evidence, but keep clinical safety priority.');
  return sections.join('\n\n');
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
    let interop: ChatInteropPayload | undefined;

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
      const interopPayload = formData.get('interop') as string | null;
      if (interopPayload) {
        try {
          interop = anonymizeObject(JSON.parse(interopPayload));
        } catch (e) {
          console.warn('Failed to parse interop payload:', e);
        }
      }
      
      // Получаем файлы
      const fileEntries = formData.getAll('files') as File[];
      files = fileEntries.filter(f => f instanceof File && f.size > 0);
    } else {
      const body = await request.json();
      message = anonymizeText(body.message || body.prompt || '');
      history = anonymizeObject(body.history || []);
      useStreaming = body.useStreaming !== undefined ? body.useStreaming : true; // Default to true for chat
      model = body.model;
      specialty = body.specialty;
      systemPrompt = body.systemPrompt;
      responseStyle = body.responseStyle === 'brief' ? 'brief' : 'detailed';
      interop = anonymizeObject(body.interop || undefined);
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

    const responseLanguage = detectResponseLanguage(message, history);
    const languageInstruction = buildLanguageInstruction(responseLanguage);
    const isClaudeAssistantModel = selectedModel === MODELS.SONNET || selectedModel === MODELS.OPUS;
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
    const interopInstruction = buildInteropInstruction(interop);
    const finalMessage = interopInstruction
      ? `${preparedMessage}\n\n${styleInstruction}\n${dialogueInstruction}\n\n${interopInstruction}`
      : `${preparedMessage}\n\n${styleInstruction}\n${dialogueInstruction}`;

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
                    console.log(formatCostLog(
                      selectedModel,
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
      const stream = await sendTextRequestStreaming(
        finalMessage,
        formattedHistory,
        selectedModel,
        specialty as any,
        effectiveSystemPrompt
      );
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

