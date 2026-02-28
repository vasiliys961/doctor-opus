import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';
import { anonymizeText } from '@/lib/anonymization';

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
      ragExamples = []
    } = body;
    const rawText = anonymizeText(rawIncomingText);

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ success: false, error: 'Text was not provided' }, { status: 400 });
    }

    // Add specialist-specific instruction to the prompt
    const specialistDirective = universalPrompt
      ? `PROFILE-SPECIFIC INSTRUCTION (${specialistName}): ${universalPrompt}\n\n`
      : '';
    const safeRagExamples = Array.isArray(ragExamples)
      ? ragExamples
          .map((chunk: unknown) => anonymizeText(String(chunk ?? '')).trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const ragDirective = safeRagExamples.length > 0
      ? `EXAMPLES FROM PERSONAL RAG LIBRARY (use only as a style and structure reference; use facts only from the input data):
${safeRagExamples.map((chunk: string, index: number) => `--- EXAMPLE #${index + 1} ---\n${chunk}`).join('\n\n')}

`
      : '';

    const isEcgFunctionalConclusion = templateId === 'ecg-functional-conclusion';

    // ECG mode: concise formal conclusion only.
    // This prevents clinical hypotheses and management reasoning.
    const prompt = isEcgFunctionalConclusion
      ? `You are a physician specialized in functional diagnostics (ECG). Create a SHORT formal ECG conclusion based on the input text.
${specialistDirective}INPUT DATA (from ECG analysis):
${rawText}

${ragDirective}STRICT OUTPUT TEMPLATE (fill it exactly):
${customTemplate}

MANDATORY CONSTRAINTS:
1. Output ONLY the template-based conclusion. No sections like "clinical hypotheses", differential diagnosis, management strategy, verification notes, disclaimers, or reasoning.
2. Length: 4-6 lines (concise).
3. Do not invent parameters. Include values (PQ/QRS/QTc, ST in mm) only if explicitly present in the input text. If absent, write "no data".
4. Preserve ST direction exactly: if the input says "depression", do not output "elevation", and vice versa.
5. Do not diagnose ACS/MI and do not add phrases like "no ACS" unless explicitly present in the input.
6. Output language is STRICTLY English-only, regardless of the input language.
7. If any non-English text appears, rewrite it to English before finalizing the answer.
Language: English-only.`
      : `You are an experienced physician (${specialistName || 'Internal Medicine Physician'}), an expert clinical assistant with the competence of a professor of clinical medicine and broad academic-hospital experience.
${specialistDirective}You combine clinical rigor and responsibility, transforming unstructured information into a standard encounter protocol with evidence-based diagnostic and treatment recommendations.

YOUR TASK:
Create a complete and structured encounter protocol based on the following data:
${rawText}

${ragDirective}STRICT TEMPLATE TO FILL:
${customTemplate}

MANDATORY STYLE AND CONTENT RULES:
1. Start the answer IMMEDIATELY with the heading "APPOINTMENT PROTOCOL". No greetings or intro phrases.
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

Style: strictly professional, clinically and technically accurate. Language: English-only.`;

    const MODEL = model === 'opus' ? MODELS.OPUS : 
                 model === 'gpt52' ? MODELS.GPT_5_2 : 
                 (model === 'gemini' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET);
    
    if (useStreaming) {
      const stream = await sendTextRequestStreaming(prompt, [], MODEL);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    let result = await sendTextRequest(prompt, []);
    return NextResponse.json({ success: true, protocol: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Protocol generation error' }, { status: 500 });
  }
}
