import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';
import { anonymizeText } from '@/lib/anonymization';

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

function sanitizeProtocolSse(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const sanitizeEventBlock = (block: string): string => {
    const lines = block.split('\n');
    const sanitizedLines = lines.map((line) => {
      if (!line.startsWith('data: ')) return line;

      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return line;

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
    return sanitizedLines.join('\n');
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
            controller.enqueue(encoder.encode(`${sanitized}\n\n`));
            delimiterIndex = buffer.indexOf('\n\n');
          }
        }

        if (buffer.length > 0) {
          const sanitized = sanitizeEventBlock(buffer);
          controller.enqueue(encoder.encode(sanitized));
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
      strictTemplateMode = true
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
    const safeRagExamples = Array.isArray(ragExamples)
      ? ragExamples
          .map((chunk: unknown) => anonymizeText(String(chunk ?? '')).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    const ragDirective = safeRagExamples.length > 0
      ? `EXAMPLES FROM PERSONAL RAG LIBRARY (use as structure/style reference only; medical facts must come ONLY from current case):
${safeRagExamples.map((chunk: string, index: number) => `--- EXAMPLE #${index + 1} ---\n${chunk}`).join('\n\n')}

`
      : '';

    const isEcgFunctionalConclusion = templateId === 'ecg-functional-conclusion';
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
6. Output language is STRICTLY English-only, regardless of the input language.
7. If any non-English text appears, rewrite it to English before finalizing the answer.
${refreshFromCurrentCaseDirective}
Language: English-only.`
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
10. Output language is STRICTLY English-only, regardless of the input language.
11. Ignore non-English wording in user input and RAG examples for output language choice.
12. If any non-English text appears, rewrite it to English before finalizing the answer.
${requiredClinicalBlockDirective}
${strictTemplateDirective}
${tableDirective}
${diagnosisDirective}
${refreshFromCurrentCaseDirective}
${clinicalDefaultsDirective}
${clinicalReasoningDirective}
${evidencePriorityDirective}

Style: strictly professional, clinically and technically accurate. Language: English-only.`;

    const MODEL = model === 'opus' ? MODELS.OPUS : 
                 model === 'gpt52' ? MODELS.GPT_5_2 : 
                 (model === 'gemini' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET);
    
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

    let result = await sendTextRequest(prompt, []);
    if (!isEcgFunctionalConclusion && isStrictTemplateMode) {
      const correctionPrompt = buildProtocolCorrectionPrompt({
        rawText,
        template: safeTemplate,
        draft: result,
      });
      result = await sendTextRequest(correctionPrompt, []);
    }
    result = anonymizeText(result);
    return NextResponse.json({ success: true, protocol: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Protocol generation error' }, { status: 500 });
  }
}
