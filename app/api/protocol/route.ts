import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequestWithUsage, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { addModelUsage, emptyTokenUsage, formatCostLog } from '@/lib/cost-calculator';
import { anonymizeText } from '@/lib/anonymization';
import { getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language';
import { STAGE1_PROTOCOL_SYSTEM_PROMPT } from '@/lib/prompts';
import {
  buildDiagnosticReportUserPrompt,
  finalizeDiagnosticReport,
  getDiagnosticReportSystemPrompt,
  resolveDiagnosticKindFromTemplateId,
} from '@/lib/diagnostic-report';
import {
  finalizeProtocolDocument,
  hasUnresolvedHeadingPlaceholder,
} from '@/lib/protocol-presentation';

function buildProtocolCorrectionPrompt(params: {
  rawText: string;
  template: string;
  draft: string;
  languageInstruction: string;
}): string {
  const { rawText, template, draft, languageInstruction } = params;
  return `${languageInstruction}
You are a senior clinical documentation quality reviewer.

REVIEW AND CORRECT THE DRAFT PROTOCOL:
1) Keep template structure 1:1 (sections, order, tables).
2) Clinical facts must come ONLY from the current case.
3) If the draft keeps legacy values from the template, replace them with current-case values.
4) If the visit was documented but routine exam negatives were omitted, use clinically neutral normal findings. If the input is only a conversation or incomplete notes, do not invent a performed exam; keep unknowns in one "Missing / To Clarify" block.
5) Diagnosis and management plan are mandatory. ICD codes only in the final diagnosis section, marked provisional if exam is incomplete.
6) Remove any "MEDICAL CONSULTATIVE REPORT", "VERIFIED BY PHYSICIAN", signature lines, branding, AI disclaimer, or "Draft Clinical Output".
7) Do not repeat red flags, missing-data sentences, or the same evidence source across sections.
8) Keep every section heading exactly as in the template. Never replace a heading with [NAME], [PLACEHOLDER], or any other token.
9) A list section must start with its heading line, then the list.
10) Return only corrected final document. No explanations.

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
          parsed.choices[0].delta.content = content;
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
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();
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
    const safeTemplate = String(customTemplate ?? '').trim();
    const isStrictTemplateMode = strictTemplateMode !== false;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ success: false, error: 'Text was not provided' }, { status: 400 });
    }
    if (!safeTemplate) {
      return NextResponse.json({ success: false, error: 'Template was not provided' }, { status: 400 });
    }

    // Add specialist-specific instruction to the prompt
    const specialistDirective = universalPrompt
      ? `PROFILE-SPECIFIC INSTRUCTION (${specialistName}): ${universalPrompt}

If the current input is a conversation transcript or incomplete notes without a documented exam, ignore any profile instruction to invent normal examination phrases. Use one "Missing / To Clarify" block instead.

`
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

    const diagnosticKind = resolveDiagnosticKindFromTemplateId(templateId);
    const isDiagnosticReport = Boolean(diagnosticKind);
    const hasDiagnosisSection = /(diagnosis|assessment|icd|conclusion)/i.test(safeTemplate);
    const hasTreatmentSection = /(treatment|therapy|recommendation|plan|management)/i.test(safeTemplate);
    const templateHasMarkdownTable = /\|.+\|\s*\n\|[\s:-]+\|/m.test(safeTemplate);
    const requiredClinicalBlockDirective =
      !isDiagnosticReport && (!hasDiagnosisSection || !hasTreatmentSection)
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
    const diagnosisDirective = !isDiagnosticReport
      ? `\nDIAGNOSIS AND PLAN (MANDATORY):
- Diagnosis section(s) must always be filled.
- Formulate primary diagnosis from current-case evidence.
- ICD-10/11 codes appear only in the final diagnosis/assessment section. If objective exam is missing, mark them "provisional, pending exam".
- Do not put ICD codes inside a differential/hypothesis list.
- Treatment/recommendation block must be filled within template structure (or added by rule #10).
- Exact numeric drug doses only if key contraindications are documented as absent; otherwise write "standard guideline dose if no contraindications; see dosing protocol" plus one source.`
      : '';
    const refreshFromCurrentCaseDirective = `\nDATA PRIORITY (CRITICAL):
- Use uploaded template and RAG examples as STRUCTURE only.
- If template already contains old clinical values (complaints, history, vitals, ECG, diagnosis, treatment), REPLACE them with current-case values.
- Do not rewrite old case from template.
- In any conflict, CURRENT CASE input always wins.`;
    const clinicalDefaultsDirective = !isDiagnosticReport
      ? `\nMISSING DATA AND RED FLAGS:
- If the physician documented a performed visit and omitted routine negatives, fill those exam items with clinically neutral normal findings.
- If the input is only a conversation/complaints draft without a documented exam, do not invent a complete normal examination.
- Put all undocumented items in one "Missing / To Clarify" block. Do not repeat "not documented" in Complaints, HPI, PMH, and Exam.
- If red-flag exclusion matters, list flags once under "Red Flags to Exclude" and refer to that block later.
- Never import old abnormalities from template unless present in current case.
- Use "NO DATA" only for administrative fields or unknown exact numeric values that cannot be safely inferred.
- If clinician reports abnormalities (e.g., BP 180, headache, nausea), they must be explicitly reflected in matching sections.`
      : '';
    const clinicalReasoningDirective = !isDiagnosticReport
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

    const prompt = isDiagnosticReport && diagnosticKind
      ? `${buildDiagnosticReportUserPrompt({
          languageInstruction: responseLanguageInstruction,
          kind: diagnosticKind,
          sourceText: rawText,
        })}

STRICT OUTPUT TEMPLATE:
${safeTemplate}
`
      : `${responseLanguageInstruction}
You are an experienced physician (${specialistName || 'Internal Medicine Physician'}), an expert clinical assistant with the competence of a professor of clinical medicine and broad academic-hospital experience.
${specialistDirective}You combine clinical rigor and responsibility, transforming unstructured information into a standard encounter protocol with evidence-based diagnostic and treatment recommendations.

YOUR TASK:
Create a complete and structured encounter protocol based on the following data:
${rawText}

${ragDirective}STRICT TEMPLATE TO FILL:
${safeTemplate}

MANDATORY STYLE AND CONTENT RULES:
1. Copy every template heading verbatim as **Heading:**. Fill only the body under it. Never output [NAME], [PLACEHOLDER], [SECTION], or similar tokens.
2. Formatting: inside each section (complaints, history, examination), write as continuous prose with no extra blank lines. List sections must have their heading immediately before the list.
3. Physical exam: do not use phrases like "not performed". If pathology details are absent, provide clinically neutral normal findings for major systems.
4. Diagnosis: use international ICD-10 coding conventions where applicable.
5. Recommendations: use numbered points 1., 2., etc. Keep phrasing concise and practical. Put verification tests in this plan only, not under each differential item.
6. Medications: use international nonproprietary names (INN/generic). Add brand examples only when clinically justified and region-neutral. No numeric doses unless key contraindications are documented as absent.
7. Length: keep the protocol compact and practical (about up to 2 A4 pages equivalent).
8. Do not generate "VERIFIED BY PHYSICIAN", signature lines, product branding, or legal disclaimers.
9. References: if included, use a Markdown table with columns Query | Date | Source | Title | DOI/URL | Used | Comment. Each source once; if already cited, write "see above".
${requiredClinicalBlockDirective}
${strictTemplateDirective}
${tableDirective}
${diagnosisDirective}
${refreshFromCurrentCaseDirective}
${clinicalDefaultsDirective}
${clinicalReasoningDirective}
${evidencePriorityDirective}

Style: strictly professional, clinically and technically accurate.`;

    const MODEL = isDiagnosticReport
      ? MODELS.HAIKU
      : (model === 'opus' ? MODELS.OPUS : 
                 model === 'gpt52' ? MODELS.GPT_5_2 : 
                 (model === 'gemini' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET));
    const systemPrompt = isDiagnosticReport && diagnosticKind
      ? getDiagnosticReportSystemPrompt(diagnosticKind)
      : STAGE1_PROTOCOL_SYSTEM_PROMPT;
    
    if (useStreaming) {
      const stream = await sendTextRequestStreaming(
        prompt,
        [],
        MODEL,
        undefined,
        systemPrompt,
        { skipDisclaimer: true }
      );
      const sanitizedStream = sanitizeProtocolSse(stream);
      return new Response(sanitizedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const protocolLlmOptions = { skipDisclaimer: true };
    let usage = emptyTokenUsage();
    const firstPass = await sendTextRequestWithUsage(prompt, [], MODEL, undefined, systemPrompt, protocolLlmOptions);
    usage = addModelUsage(usage, firstPass.modelUsed, firstPass.usage);
    let result = firstPass.content;
    if (!isDiagnosticReport && isStrictTemplateMode) {
      const correctionPrompt = buildProtocolCorrectionPrompt({
        rawText,
        template: safeTemplate,
        draft: result,
        languageInstruction: responseLanguageInstruction,
      });
      const correction = await sendTextRequestWithUsage(correctionPrompt, [], MODEL, undefined, systemPrompt, protocolLlmOptions);
      usage = addModelUsage(usage, correction.modelUsed, correction.usage);
      result = correction.content;
    }
    result = isDiagnosticReport
      ? finalizeDiagnosticReport(result)
      : finalizeProtocolDocument(result, safeTemplate);
    if (!isDiagnosticReport && hasUnresolvedHeadingPlaceholder(result)) {
      const headingRepairPrompt = buildProtocolCorrectionPrompt({
        rawText,
        template: safeTemplate,
        draft: result,
        languageInstruction: responseLanguageInstruction,
      });
      const repaired = await sendTextRequestWithUsage(headingRepairPrompt, [], MODEL, undefined, systemPrompt, protocolLlmOptions);
      usage = addModelUsage(usage, repaired.modelUsed, repaired.usage);
      result = finalizeProtocolDocument(repaired.content, safeTemplate);
    }
    if (usage.total_tokens > 0) {
      console.log(formatCostLog(MODEL, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens));
    }
    return NextResponse.json({ success: true, protocol: result, usage });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Protocol generation error' }, { status: 500 });
  }
}
