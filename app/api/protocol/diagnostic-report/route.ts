import { NextRequest, NextResponse } from 'next/server'
import { MODELS, sendTextRequestWithUsage } from '@/lib/openrouter'
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming'
import { anonymizeText } from '@/lib/anonymization'
import { getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language'
import {
  buildDiagnosticReportUserPrompt,
  finalizeDiagnosticReport,
  getDiagnosticReportSystemPrompt,
  isDiagnosticReportKind,
  isValidDiagnosticReport,
  resolveDiagnosticReportKind,
} from '@/lib/diagnostic-report'

function resolveModel(model: string): string {
  if (model === 'opus') return MODELS.OPUS
  if (model === 'gpt52') return MODELS.GPT_5_2
  if (model === 'gemini') return MODELS.GEMINI_3_FLASH
  return MODELS.HAIKU
}

export async function POST(request: NextRequest) {
  try {
    const languageInstruction = await getForcedLanguageInstructionForRequest()
    const body = await request.json()
    const kind = resolveDiagnosticReportKind(String(body?.kind || '')) || String(body?.kind || 'ecg')
    const sourceText = anonymizeText(String(body?.sourceText || '')).trim()
    const model = resolveModel(String(body?.model || 'haiku'))
    const useStreaming = body?.useStreaming !== false

    if (!isDiagnosticReportKind(kind)) {
      return NextResponse.json({ success: false, error: 'Unsupported diagnostic report type' }, { status: 400 })
    }
    if (!sourceText) {
      return NextResponse.json({ success: false, error: 'Source analysis is empty' }, { status: 400 })
    }

    const systemPrompt = getDiagnosticReportSystemPrompt(kind)
    const prompt = buildDiagnosticReportUserPrompt({ languageInstruction, kind, sourceText })
    const llmOptions = { skipDisclaimer: true }

    if (useStreaming) {
      const stream = await sendTextRequestStreaming(
        prompt,
        [],
        model,
        undefined,
        systemPrompt,
        llmOptions
      )
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    const first = await sendTextRequestWithUsage(
      prompt,
      [],
      model,
      undefined,
      systemPrompt,
      llmOptions
    )
    let report = finalizeDiagnosticReport(first.content)

    if (!isValidDiagnosticReport(kind, report)) {
      const retry = await sendTextRequestWithUsage(
        `${prompt}\n\nPREVIOUS OUTPUT USED ENCOUNTER SECTIONS OR MISSED REQUIRED HEADINGS. Rewrite as a diagnostic ${kind} test report only.`,
        [],
        model,
        undefined,
        systemPrompt,
        llmOptions
      )
      report = finalizeDiagnosticReport(retry.content)
    }

    if (!isValidDiagnosticReport(kind, report)) {
      return NextResponse.json({ success: false, error: 'Diagnostic report failed validation' }, { status: 422 })
    }

    return NextResponse.json({ success: true, report, kind, usage: first.usage })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Diagnostic report generation failed' },
      { status: 500 }
    )
  }
}
