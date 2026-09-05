import { NextRequest, NextResponse } from 'next/server';
import { formatCostLog } from '@/lib/cost-calculator';
import { MODELS } from '@/lib/openrouter';
import { postLlmChatCompletionsWithFallback } from '@/lib/llm-provider';
import { getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language';
import { getRequestLocale } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/config';

function localeToLanguageLabel(locale: Locale): string {
  switch (locale) {
    case 'fr':
      return 'French';
    case 'es':
      return 'Spanish';
    case 'ar':
      return 'Arabic';
    case 'hi':
      return 'Hindi';
    case 'pt-BR':
      return 'Brazilian Portuguese';
    case 'id':
      return 'Indonesian';
    case 'ms':
      return 'Malay';
    case 'tr':
      return 'Turkish';
    case 'zh-CN':
      return 'Simplified Chinese';
    case 'en':
    default:
      return 'English';
  }
}

async function translateGuidelinesContent(content: string, locale: Locale): Promise<string> {
  if (!content || locale === 'en') return content;
  const targetLanguage = localeToLanguageLabel(locale);
  const translationModel = process.env.MODEL_TRANSLATOR?.trim() || MODELS.GEMINI_3_FLASH;

  const response = await postLlmChatCompletionsWithFallback({
    model: translationModel,
    temperature: 0,
    max_tokens: 12000,
    messages: [
      {
        role: 'system',
        content:
          `Translate the medical guideline review into ${targetLanguage}. ` +
          'Preserve structure, numbering, bullet points, and guideline names/acronyms. ' +
          'Return only the translated text.',
      },
      {
        role: 'user',
        content,
      },
    ],
  });

  if (!response.ok) return content;
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || content;
}

function streamSingleSseText(content: string, model: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const payload = { model, choices: [{ delta: { content } }] };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

/**
 * API endpoint for searching current international clinical guidelines
 * Uses Gemini via OpenRouter
 * Based on international evidence-based guidelines (ESC, AHA/ACC, WHO, KDIGO, NCCN, NICE, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const locale = await getRequestLocale();
    const body = await request.json();
    const { query, specialty = '', useStreaming = true, modelMode = 'standard' } = body;
    const requestedStreaming = Boolean(useStreaming);
    const requiresPostTranslation = locale !== 'en';
    const upstreamStreaming = requestedStreaming && !requiresPostTranslation;
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Query cannot be empty' },
        { status: 400 }
      );
    }

    // EXPANDED PROMPT: focus on management tactics, differential analysis, and clinical scales
    const searchPrompt = `CRITICAL: Your response MUST START IMMEDIATELY with section "1. GUIDELINE NAMES". Do NOT write anything before it.

Find current international clinical guidelines on: ${query}
${specialty ? `Specialty: ${specialty}` : ''}

Provide a comprehensive expert review using the following structure:

1. GUIDELINE NAMES:
   - 2-3 major international guidelines [INTERNATIONAL] (ESC, AHA/ACC, WHO, KDIGO, NCCN, NICE, etc.)
   - Year of publication required (priority: 2023-2025)
   - DO NOT include country-specific national guidelines

2. DIFFERENTIAL DIAGNOSIS ALGORITHM:
   - Conditions most commonly confused with this pathology.
   - Key distinguishing features (symptoms, biomarkers) to rule out alternative diagnoses.

3. DIAGNOSTIC CRITERIA AND PROGNOSTIC SCORES:
   - Gold standard diagnostics (laboratory/imaging).
   - Required clinical scales (e.g., CHA2DS2-VASc, CURB-65, qSOFA, NYHA, etc.).
   - Score interpretation and impact on management decisions.

4. STEP-BY-STEP MANAGEMENT ALGORITHM:
   - Physician action algorithm from the time of diagnosis.
   - Setting determination (outpatient vs. hospitalization vs. ICU).
   - Sequential workup and treatment steps.

5. EVIDENCE-BASED TREATMENT REGIMENS:
   - Drug classes, specific names, dosages, and dosing schedules.
   - Levels of evidence (Class I/IIa/IIb, Level A/B/C) for key recommendations.
   - Non-pharmacologic interventions and surgery (if applicable).

6. MONITORING AND RED FLAGS:
   - Follow-up visit and laboratory timelines.
   - Efficacy and safety criteria.
   - Red flag signs requiring immediate escalation or hospitalization.

CRITICAL REQUIREMENTS:
- Be academically rigorous and clinically detailed.
- Do NOT fabricate references.
- Base all recommendations on international guidelines only (ESC, AHA, WHO, NICE, KDIGO, NCCN, IDSA, etc.)
- If no specific scales or management algorithm exists for this topic, state so explicitly.

LANGUAGE COMPLIANCE (HIGHEST PRIORITY):
${responseLanguageInstruction}
- Translate section headings and all narrative text into the required language.
- Keep official guideline names in original language when needed, but explain them in the required language.`;

    // Model selection based on mode: standard (Gemini), detailed (GPT), or online (Perplexity)
    let MODEL = MODELS.GEMINI_3_FLASH;
    let MAX_TOKENS = 10000;

    if (modelMode === 'online') {
      MODEL = 'perplexity/sonar';
      MAX_TOKENS = 4000;
    } else if (modelMode === 'detailed') {
      MODEL = MODELS.GPT_5_2;
      MAX_TOKENS = 12000;
    }

    // Dynamic system prompt
    let systemPrompt = '';
    if (modelMode === 'online') {
      systemPrompt = 'You are a leading medical expert. Your task is to find the most current international clinical guidelines (2024-2025) and provide a deep review of patient management tactics. Focus on diagnostic criteria, required clinical scores, and step-by-step management algorithms. Do NOT write introductions — start immediately with the sections.';
    } else if (modelMode === 'detailed') {
      systemPrompt = 'You are an expert medical AI assistant with the competence of a professor of medicine. Your task is to provide a comprehensive, academically rigorous review of the topic. Always include a detailed differential diagnosis analysis, prognostic scores, step-by-step patient management, and evidence-based treatment regimens with levels of evidence. Your answer should be detailed and clinically deep. Do NOT write introductions — start immediately with the sections.';
    } else {
      systemPrompt = 'You are an expert physician assistant. You search for current international clinical guidelines. Focus on management tactics and diagnostic criteria. ALWAYS start your answer IMMEDIATELY with section "1. GUIDELINE NAMES". Do NOT write introductions.';
    }
    systemPrompt = `${responseLanguageInstruction}\n${systemPrompt}`;
    
    console.log('');
    console.log('🔍 [CLINICAL RECS] ========== SEARCHING CLINICAL GUIDELINES ==========');
    console.log('🔍 [CLINICAL RECS] Query:', `"${query}"`);
    console.log('🔍 [CLINICAL RECS] Mode:', modelMode);
    console.log('🤖 [MODEL] Model:', MODEL);
    console.log('🤖 [AI] Max tokens:', MAX_TOKENS);
    console.log('🤖 [AI] Prompt size:', `${searchPrompt.length} chars`);
    console.log('🤖 [AI] Mode:', upstreamStreaming ? 'streaming' : 'standard');
    console.log('');

    // Using selected model via OpenRouter
    const payload = {
      model: MODEL,
      messages: [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        {
          role: 'user' as const,
          content: searchPrompt
        }
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      stream: upstreamStreaming,
      stream_options: upstreamStreaming ? { include_usage: true } : undefined
    };

    const response = await postLlmChatCompletionsWithFallback(payload, {
      headers: {
        'HTTP-Referer': 'https://doctor-opus.online',
        'X-Title': 'Doctor Opus'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [AI] API error: ${response.status}`, errorText);
      
      if (response.status === 402) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient OpenRouter balance. Please top up your account.'
        }, { status: 402 });
      }
      
      return NextResponse.json({
        success: false,
        error: `API error: ${response.status} - ${errorText.substring(0, 200)}`
      }, { status: response.status });
    }

    // If streaming is enabled, return SSE stream
    if (upstreamStreaming && response.body) {
    console.log(`📡 [${modelMode.toUpperCase()}] Starting streaming mode...`);
    console.log('📡 [MODEL] Model:', MODEL);
      console.log('');
      
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          let buffer = '';
          let chunkCount = 0;
          let totalContentLength = 0;
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log('');
                console.log(`✅ [${modelMode.toUpperCase()}] ========== STREAMING COMPLETE (READER DONE) ==========`);
                
                const approxInputTokens = Math.ceil(searchPrompt.length / 4);
                const approxOutputTokens = Math.ceil(totalContentLength / 4);
                console.log(formatCostLog(MODEL, approxInputTokens, approxOutputTokens, approxInputTokens + approxOutputTokens));
                console.log('');

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                break;
              }
              
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              // Process lines from buffer
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6).trim();
                  
                  if (dataStr === '[DONE]') {
                    console.log('');
                    console.log(`✅ [${modelMode.toUpperCase()}] ========== STREAMING COMPLETE ==========`);
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    return;
                  }
                  
                  try {
                    const json = JSON.parse(dataStr);
                    
                    // If usage chunk received, attach cost info and forward
                    if (json.usage) {
                      const { calculateCost } = await import('@/lib/cost-calculator');
                      const costInfo = calculateCost(json.usage.prompt_tokens, json.usage.completion_tokens, MODEL);
                      json.usage.total_cost = costInfo.totalCostUnits;
                      json.model = MODEL;
                      
                      console.log(formatCostLog(MODEL, json.usage.prompt_tokens, json.usage.completion_tokens, json.usage.total_tokens));
                      
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`));
                      continue;
                    }

                    const content = json.choices?.[0]?.delta?.content || '';
                    if (content) {
                      chunkCount++;
                      totalContentLength += content.length;
                      controller.enqueue(encoder.encode(`data: ${dataStr}\n\n`));
                    }
                  } catch (e) {
                    console.debug('⚠️ [AI] SSE chunk parse error:', e);
                  }
                }
              }
            }
            
            console.log('📡 [STREAMING] Read loop complete.');
          } catch (error) {
            console.error('❌ [AI] Streaming error:', error);
            controller.error(error);
          } finally {
            reader.releaseLock();
          }
        }
      });
      
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Standard mode without streaming
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = await translateGuidelinesContent(content, locale);
    const usage = data.usage || {};
    const tokensUsed = usage.total_tokens || 0;

    console.log('');
    console.log('✅ [AI] ========== RESPONSE RECEIVED ==========');
    console.log(formatCostLog(MODEL, usage.prompt_tokens || 0, usage.completion_tokens || 0, tokensUsed));
    console.log('');

    if (requestedStreaming && requiresPostTranslation) {
      return new Response(streamSingleSseText(content, MODEL), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return NextResponse.json({
      success: true,
      content: content,
      tokensUsed: tokensUsed,
      model: modelMode === 'online' ? 'Perplexity Sonar (Online Search)' :
             modelMode === 'detailed' ? 'GPT-5.4 (Detailed)' :
             'Gemini 3.8 Flash (Standard)'
    });

  } catch (error: any) {
    console.error('❌ [AI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Clinical guidelines search error'
      },
      { status: 500 }
    );
  }
}

