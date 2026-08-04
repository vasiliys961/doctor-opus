import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { anonymizeText } from '@/lib/anonymization';
import { buildStrictOutputLanguageRule } from '@/lib/language-policy';

const INTERNATIONAL_RX_POLICY = `INTERNATIONAL PRESCRIPTION STANDARD (MANDATORY):
- Use INN/generic names only (English or Latin script).
- Do NOT use Russian/Cyrillic drug names and do NOT use local trade names by default.
- If a trade name is clinically necessary, add only one globally known brand in parentheses after INN.
- Format each medication line as: "INN - dose, route, frequency, duration".`;

const STRICT_FAST_RAWTEXT_THRESHOLD = 12000;
const STRICT_FAST_TEMPLATE_THRESHOLD = 6000;
const STRICT_CORRECTION_TIMEOUT_MS = Number(process.env.PROTOCOL_STRICT_CORRECTION_TIMEOUT_MS || 55000);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function buildProtocolCorrectionPrompt(params: {
  rawText: string;
  template: string;
  draft: string;
}): string {
  const { rawText, template, draft } = params;
  return `You are a senior clinical documentation quality reviewer.

REVIEW AND CORRECT THE DRAFT PROTOCOL:
1) Keep template structure 1:1 (sections, order, tables).
2) Clinical facts must come ONLY from the current case.
3) If the draft keeps legacy values from the template, replace them with current-case values.
4) If clinical fields are not explicitly provided, fill with clinically neutral normal findings (not stale template data).
5) Diagnosis and management plan are mandatory.
6) Return only corrected final document. No explanations.

CURRENT CASE:
${rawText}

TEMPLATE (STRUCTURE):
${template}

DRAFT TO CORRECT:
${draft}`;
}

function trimToTemplateStart(text: string, template: string): string {
  const safeText = String(text ?? '').trim();
  if (!safeText) return '';
  const firstTemplateLine = String(template ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstTemplateLine) return safeText;

  const index = safeText.toLowerCase().indexOf(firstTemplateLine.toLowerCase());
  if (index <= 0) return safeText;
  return safeText.slice(index).trim();
}

function isStructuredProtocolOutputValid(text: string, template: string): boolean {
  const candidate = String(text ?? '').trim();
  if (!candidate) return false;

  const templateLines = String(template ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (templateLines.length === 0) return candidate.length > 80;

  const firstLine = templateLines[0];
  if (firstLine && !candidate.toLowerCase().includes(firstLine.toLowerCase())) {
    return false;
  }

  const headingCount = templateLines.filter((line) => /[:#]/.test(line)).length;
  if (headingCount >= 2) {
    const foundHeadings = templateLines
      .filter((line) => /[:#]/.test(line))
      .slice(0, 6)
      .filter((line) => candidate.toLowerCase().includes(line.toLowerCase()))
      .length;
    if (foundHeadings < Math.max(2, Math.floor(Math.min(headingCount, 6) / 2))) {
      return false;
    }
  }

  return candidate.length > 120;
}

function sanitizeProtocolSse(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let streamCompleted = false;

  const sanitizeEventBlock = (block: string): { text: string; hasDone: boolean } => {
    const lines = block.split('\n');
    let hasDone = false;
    const sanitizedLines = lines.map((line) => {
      if (!line.startsWith('data: ')) return line;

      const payload = line.slice(6).trim();
      if (payload === '[DONE]') {
        hasDone = true;
        return '';
      }

      try {
        const parsed = JSON.parse(payload);
        const content = parsed?.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content.length > 0) {
          parsed.choices[0].delta.content = anonymizeText(content);
        }
        return `data: ${JSON.stringify(parsed)}`;
      } catch {
        return line;
      }
    });
    return {
      text: sanitizedLines.filter(Boolean).join('\n'),
      hasDone,
    };
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let delimiterIndex = buffer.indexOf('\n\n');
          while (delimiterIndex !== -1) {
            const eventBlock = buffer.slice(0, delimiterIndex);
            buffer = buffer.slice(delimiterIndex + 2);
            const sanitized = sanitizeEventBlock(eventBlock);
            if (sanitized.text) {
              controller.enqueue(encoder.encode(`${sanitized.text}\n\n`));
            }
            if (sanitized.hasDone && !streamCompleted) {
              streamCompleted = true;
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
            delimiterIndex = buffer.indexOf('\n\n');
          }
        }

        if (buffer.length > 0) {
          const sanitized = sanitizeEventBlock(buffer);
          if (sanitized.text) {
            controller.enqueue(encoder.encode(`${sanitized.text}\n\n`));
          }
          if (sanitized.hasDone && !streamCompleted) {
            streamCompleted = true;
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function buildDeferredStrictProtocolSse(params: {
  initialModel: string;
  generate: () => Promise<{ text: string; model: string }>;
}): ReadableStream<Uint8Array> {
  const { initialModel, generate } = params;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (payload: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(payload));
      };
      const closeStream = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const keepAliveInterval = setInterval(() => {
        safeEnqueue(': keep-alive\n\n');
      }, 10000);

      void (async () => {
        try {
          safeEnqueue(': strict-protocol-processing\n\n');
          const result = await generate();
          const now = Math.floor(Date.now() / 1000);
          const chunk = {
            id: 'protocol-strict-final',
            object: 'chat.completion.chunk',
            created: now,
            model: result.model || initialModel,
            choices: [
              {
                index: 0,
                delta: { content: result.text },
                finish_reason: null,
              },
            ],
          };
          const doneChunk = {
            id: 'protocol-strict-final',
            object: 'chat.completion.chunk',
            created: now,
            model: result.model || initialModel,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };

          safeEnqueue(`data: ${JSON.stringify(chunk)}\n\n`);
          safeEnqueue(`data: ${JSON.stringify(doneChunk)}\n\n`);
          safeEnqueue('data: [DONE]\n\n');
        } catch (error: any) {
          const message = typeof error?.message === 'string' && error.message.trim()
            ? error.message
            : 'Protocol generation error';
          safeEnqueue(`data: ${JSON.stringify({ error: { message } })}\n\n`);
          safeEnqueue('data: [DONE]\n\n');
        } finally {
          clearInterval(keepAliveInterval);
          closeStream();
        }
      })();
    },
  });
}

async function enforceStrictTemplateOutput(params: {
  rawText: string;
  template: string;
  draft: string;
  primaryModel: string;
  primaryPrompt: string;
  useFastStrict: boolean;
}): Promise<{ text: string; model: string }> {
  const { rawText, template, draft, primaryModel, primaryPrompt, useFastStrict } = params;
  let bestEffortText = trimToTemplateStart(draft, template);

  const primaryCorrectionPrompt = buildProtocolCorrectionPrompt({
    rawText,
    template,
    draft,
  });
  try {
    let corrected = await withTimeout(
      sendTextRequest(primaryCorrectionPrompt, [], primaryModel),
      STRICT_CORRECTION_TIMEOUT_MS,
      'Strict correction timeout'
    );
    corrected = trimToTemplateStart(corrected, template);
    bestEffortText = corrected;
    if (isStructuredProtocolOutputValid(corrected, template)) {
      return { text: corrected, model: primaryModel };
    }

    if (useFastStrict) {
      return { text: corrected, model: primaryModel };
    }
  } catch (error: any) {
    if (useFastStrict) {
      console.warn(`[PROTOCOL] Fast strict correction timeout/error on ${primaryModel}: ${String(error?.message || error)}`);
      return { text: bestEffortText, model: primaryModel };
    }
  }

  const fallbackModel = MODELS.SONNET;
  console.warn(`[PROTOCOL] Strict template guard: output invalid on ${primaryModel}, retry on ${fallbackModel}`);
  try {
    const fallbackDraft = await withTimeout(
      sendTextRequest(primaryPrompt, [], fallbackModel),
      STRICT_CORRECTION_TIMEOUT_MS,
      'Strict fallback draft timeout'
    );
    const fallbackCorrectionPrompt = buildProtocolCorrectionPrompt({
      rawText,
      template,
      draft: fallbackDraft,
    });
    let fallbackCorrected = await withTimeout(
      sendTextRequest(fallbackCorrectionPrompt, [], fallbackModel),
      STRICT_CORRECTION_TIMEOUT_MS,
      'Strict fallback correction timeout'
    );
    fallbackCorrected = trimToTemplateStart(fallbackCorrected, template);
    return { text: fallbackCorrected, model: fallbackModel };
  } catch (error: any) {
    console.warn(`[PROTOCOL] Strict fallback timeout/error on ${fallbackModel}: ${String(error?.message || error)}`);
    return { text: bestEffortText, model: primaryModel };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      rawText: rawIncomingText, 
      useStreaming = true, 
      model = 'sonnet',
      templateId,
      customTemplate,
      specialistName,
      universalPrompt = '',
      ragExamples = [],
      strictTemplateMode = true,
      speedProfile = 'standard'
    } = body;
    const rawText = anonymizeText(String(rawIncomingText ?? ''));
    const safeTemplate = anonymizeText(String(customTemplate ?? '')).trim();
    const isStrictTemplateMode = strictTemplateMode !== false;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ success: false, error: 'Text was not provided' }, { status: 400 });
    }
    if (!safeTemplate) {
      return NextResponse.json({ success: false, error: 'Template was not provided' }, { status: 400 });
    }

    // Add specialist-specific instruction to the prompt
    const specialistDirective = universalPrompt
      ? `PROFILE-SPECIFIC INSTRUCTION (${specialistName}): ${universalPrompt}\n\n`
      : '';
    const forceFastProfile = speedProfile === 'fast';
    const safeRagExamples = Array.isArray(ragExamples)
      ? ragExamples
          .map((chunk: unknown) => anonymizeText(String(chunk ?? '')).trim())
          .filter(Boolean)
          .slice(0, forceFastProfile ? 4 : 8)
      : [];
    const ragDirective = safeRagExamples.length > 0
      ? `EXAMPLES FROM PERSONAL RAG LIBRARY (use as structure/style reference only; medical facts must come ONLY from current case):
${safeRagExamples.map((chunk: string, index: number) => `--- EXAMPLE #${index + 1} ---\n${chunk}`).join('\n\n')}

`
      : '';

    const isEcgFunctionalConclusion = templateId === 'ecg-functional-conclusion';
    const useFastStrict =
      (isStrictTemplateMode || forceFastProfile) &&
      !isEcgFunctionalConclusion &&
      (
        forceFastProfile ||
        rawText.length >= STRICT_FAST_RAWTEXT_THRESHOLD ||
        safeTemplate.length >= STRICT_FAST_TEMPLATE_THRESHOLD
      );
    const hasDiagnosisSection = /(diagnosis|assessment|icd|conclusion)/i.test(safeTemplate);
    const hasTreatmentSection = /(treatment|therapy|recommendation|plan|management)/i.test(safeTemplate);
    const templateHasMarkdownTable = /\|.+\|\s*\n\|[\s:-]+\|/m.test(safeTemplate);
    const requiredClinicalBlockDirective =
      !isEcgFunctionalConclusion && (!hasDiagnosisSection || !hasTreatmentSection)
        ? `\n10. If template has no explicit diagnosis/treatment sections, append two short sections at the end: "Diagnostic Conclusion" and "Treatment and Recommendations".`
        : '';
    const strictTemplateDirective = isStrictTemplateMode
      ? `\nSTRICT TEMPLATE FILL MODE:
- Keep section order and section titles 1:1 with template.
- Fill EVERY template section.
- Do not leave empty fields.
- Do not add arbitrary new sections (except rule #10).`
      : `\nFLEX MODE:
- Use template as the primary structure, but you may lightly adapt wording for clinical clarity.`;
    const tableDirective = templateHasMarkdownTable
      ? `\nTABLES (MANDATORY):
- If template contains tables, output tables in Markdown format.
- Preserve column count and column order.
- Never flatten a table into plain text.`
      : '';
    const diagnosisDirective = !isEcgFunctionalConclusion
      ? `\nDIAGNOSIS AND PLAN (MANDATORY):
- Diagnosis section(s) must always be filled.
- Formulate primary diagnosis from current-case evidence.
- Add ICD-10 code: if explicit in input, keep it; if absent, provide the most clinically justified code.
- Treatment/recommendation block must be filled within template structure (or added by rule #10).`
      : '';
    const refreshFromCurrentCaseDirective = `\nDATA PRIORITY (CRITICAL):
- Use uploaded template and RAG examples as STRUCTURE only.
- If template already contains old clinical values (complaints, history, vitals, ECG, diagnosis, treatment), REPLACE them with current-case values.
- Do not rewrite old case from template.
- In any conflict, CURRENT CASE input always wins.`;
    const clinicalDefaultsDirective = !isEcgFunctionalConclusion
      ? `\nDEFAULT NORMALS FOR MISSING CLINICAL DETAILS:
- For clinical fields (objective exam, systems review, local status), if no pathology is provided, fill with clinically neutral normal findings.
- Never import old abnormalities from template unless present in current case.
- Use "NO DATA" only for administrative/signature/document fields, or unknown exact numeric values that cannot be safely inferred.
- If clinician reports abnormalities (e.g., BP 180, headache, nausea), they must be explicitly reflected in matching sections.`
      : '';
    const clinicalReasoningDirective = !isEcgFunctionalConclusion
      ? `\nCLINICAL INTELLIGENCE (MANDATORY, DO NOT OUTPUT REASONING):
- Internally validate coherence: symptoms -> objective findings -> diagnosis -> management.
- Diagnosis must explain key complaints and objective findings from current case.
- Management must fit severity and vital signs.
- Avoid contradictions.
- If data is sparse, choose safe conservative management and add monitoring/follow-up cues.
- Output only final protocol, no chain-of-thought.`
      : '';
    const evidencePriorityDirective = `\nSOURCE PRIORITY:
1) Current clinician input (primary truth).
2) Uploaded template structure.
3) RAG samples for style/format only.
Never substitute current facts with template/RAG content.`;

    // ECG mode: concise formal conclusion only.
    // This prevents clinical hypotheses and management reasoning.
    const englishOnlyPolicy = buildStrictOutputLanguageRule('english');
    const prompt = isEcgFunctionalConclusion
      ? `You are a physician specialized in functional diagnostics (ECG). Create a SHORT formal ECG conclusion based on the input text.
${specialistDirective}INPUT DATA (from ECG analysis):
${rawText}

${ragDirective}STRICT OUTPUT TEMPLATE (fill it exactly):
${safeTemplate}

MANDATORY CONSTRAINTS:
1. Output ONLY the template-based conclusion. No sections like "clinical hypotheses", differential diagnosis, management strategy, verification notes, disclaimers, or reasoning.
2. Length: 4-6 lines (concise).
3. Do not invent parameters. Include values (PQ/QRS/QTc, ST in mm) only if explicitly present in the input text. If absent, write "no data".
4. Preserve ST direction exactly: if the input says "depression", do not output "elevation", and vice versa.
5. Do not diagnose ACS/MI and do not add phrases like "no ACS" unless explicitly present in the input.
6. ${englishOnlyPolicy}
${refreshFromCurrentCaseDirective}
Language policy: strict English-only.`
      : `You are an experienced physician (${specialistName || 'Internal Medicine Physician'}), an expert clinical assistant with the competence of a professor of clinical medicine and broad academic-hospital experience.
${specialistDirective}You combine clinical rigor and responsibility, transforming unstructured information into a standard encounter protocol with evidence-based diagnostic and treatment recommendations.

YOUR TASK:
Create a complete and structured encounter protocol based on the following data:
${rawText}

${ragDirective}STRICT TEMPLATE TO FILL:
${safeTemplate}

MANDATORY STYLE AND CONTENT RULES:
1. Start strictly from the first line of the template. No greetings or intro phrases.
2. Formatting: inside each section (complaints, history, examination), write as continuous prose with no extra blank lines.
3. Physical exam: do not use phrases like "not performed". If pathology details are absent, provide clinically neutral normal findings for major systems.
4. Diagnosis: use international ICD-10 coding conventions where applicable.
5. Recommendations: use numbered points 1., 2., etc. Keep phrasing concise and practical.
6. Medications: use international nonproprietary names (INN/generic). Add brand examples only when clinically justified and region-neutral.
7. Length: keep the protocol compact and practical (about up to 2 A4 pages equivalent).
8. Footer note: include a brief informed-consent acknowledgment at the end (can be plain text).
9. References: cite trusted international sources (UpToDate, PubMed, Cochrane, NCCN, ESC, WHO, etc.), preferably recent (<=5 years), for key management decisions.
10. ${englishOnlyPolicy}
11. ${INTERNATIONAL_RX_POLICY}
${requiredClinicalBlockDirective}
${strictTemplateDirective}
${tableDirective}
${diagnosisDirective}
${refreshFromCurrentCaseDirective}
${clinicalDefaultsDirective}
${clinicalReasoningDirective}
${evidencePriorityDirective}

Style: strictly professional, clinically and technically accurate. Language policy: strict English-only.`;

    const allowGpt52Protocol = process.env.ALLOW_GPT52_PROTOCOL === 'true';
    const effectiveModel = model === 'gpt52' && !allowGpt52Protocol ? 'sonnet' : model;
    const MODEL = effectiveModel === 'opus' ? MODELS.OPUS : 
                 effectiveModel === 'gpt52' ? MODELS.GPT_5_2 : 
                 (effectiveModel === 'gemini' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET);
    
    const protocolFallbackModel = MODEL !== MODELS.SONNET ? MODELS.SONNET : null;

    if (useStreaming && isStrictTemplateMode && !isEcgFunctionalConclusion) {
      const deferredStrictStream = buildDeferredStrictProtocolSse({
        initialModel: MODEL,
        generate: async () => {
          let resolvedModel = MODEL;
          let draft: string;
          try {
            draft = await sendTextRequest(prompt, [], MODEL);
          } catch (primaryError) {
            if (!protocolFallbackModel) throw primaryError;
            console.warn(`[PROTOCOL] Primary model ${MODEL} failed, fallback to ${protocolFallbackModel}`);
            resolvedModel = protocolFallbackModel;
            draft = await sendTextRequest(prompt, [], resolvedModel);
          }

          const strictResult = await enforceStrictTemplateOutput({
            rawText,
            template: safeTemplate,
            draft,
            primaryModel: resolvedModel,
            primaryPrompt: prompt,
            useFastStrict,
          });

          return {
            text: anonymizeText(strictResult.text),
            model: strictResult.model,
          };
        },
      });

      return new Response(deferredStrictStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Resolved-Model': MODEL,
        },
      });
    }

    if (useStreaming) {
      const stream = await sendTextRequestStreaming(prompt, [], MODEL);
      const sanitizedStream = sanitizeProtocolSse(stream);
      return new Response(sanitizedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    let resolvedModel = MODEL;
    let result = '';
    try {
      result = await sendTextRequest(prompt, [], MODEL);
    } catch (primaryError) {
      if (!protocolFallbackModel) throw primaryError;
      console.warn(`[PROTOCOL] Primary model ${MODEL} failed, fallback to ${protocolFallbackModel}`);
      resolvedModel = protocolFallbackModel;
      result = await sendTextRequest(prompt, [], resolvedModel);
    }

    if (!isEcgFunctionalConclusion && isStrictTemplateMode) {
      const strictResult = await enforceStrictTemplateOutput({
        rawText,
        template: safeTemplate,
        draft: result,
        primaryModel: resolvedModel,
        primaryPrompt: prompt,
        useFastStrict,
      });
      result = strictResult.text;
      resolvedModel = strictResult.model;
    }
    result = anonymizeText(result);
    return NextResponse.json({ success: true, protocol: result, model: resolvedModel });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Protocol generation error' }, { status: 500 });
  }
}
