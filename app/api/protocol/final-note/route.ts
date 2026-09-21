import { NextRequest, NextResponse } from 'next/server'
import { MODELS, sendTextRequestWithUsage } from '@/lib/openrouter'
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming'
import { addModelUsage, emptyTokenUsage } from '@/lib/cost-calculator'
import { anonymizeText } from '@/lib/anonymization'
import { getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language'
import { STAGE2_SOAP_SYSTEM_PROMPT } from '@/lib/prompts'
import { finalizeStage2Note, isValidStage2Note, validateStage2Note } from '@/lib/protocol-stage2'

function resolveProtocolModel(model: string): string {
  if (model === 'opus') return MODELS.OPUS
  if (model === 'gpt52') return MODELS.GPT_5_2
  if (model === 'gemini') return MODELS.GEMINI_3_FLASH
  return MODELS.SONNET
}

function buildStage2UserPrompt(params: {
  languageInstruction: string
  draft: string
  physicianAdditions: string
  specialistName: string
}): string {
  const additions = params.physicianAdditions
    ? `\n\nPHYSICIAN ADDITIONS (vitals / exam / ROS):\n${params.physicianAdditions}`
    : ''

  return `${params.languageInstruction}
Convert the Diagnostic Reasoning Draft into a final SOAP chart note.
Physician specialty: ${params.specialistName || 'Internal Medicine Physician'}.
Return only the SOAP note.

DIAGNOSTIC REASONING DRAFT:
${params.draft}${additions}`
}

export async function POST(request: NextRequest) {
  try {
    const languageInstruction = await getForcedLanguageInstructionForRequest()
    const body = await request.json()
    const draft = anonymizeText(String(body?.draft || '')).trim()
    const physicianAdditions = anonymizeText(String(body?.physicianAdditions || '')).trim()
    const specialistName = String(body?.specialistName || '').trim()
    const model = resolveProtocolModel(String(body?.model || 'sonnet'))
    const useStreaming = body?.useStreaming !== false

    if (!draft) {
      return NextResponse.json({ success: false, error: 'Diagnostic draft is empty' }, { status: 400 })
    }

    const llmOptions = { skipDisclaimer: true }
    const prompt = buildStage2UserPrompt({
      languageInstruction,
      draft,
      physicianAdditions,
      specialistName,
    })

    if (useStreaming) {
      const stream = await sendTextRequestStreaming(
        prompt,
        [],
        model,
        undefined,
        STAGE2_SOAP_SYSTEM_PROMPT,
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

    let usage = emptyTokenUsage()
    const firstPass = await sendTextRequestWithUsage(prompt, [], model, undefined, STAGE2_SOAP_SYSTEM_PROMPT, llmOptions)
    usage = addModelUsage(usage, firstPass.modelUsed, firstPass.usage)
    let finalNote = finalizeStage2Note(firstPass.content)

    if (!isValidStage2Note(finalNote)) {
      const issues = validateStage2Note(finalNote)
        .map((issue) => `${issue.code}: ${issue.detail}`)
        .join('; ')
      const retryPrompt = `${prompt}

PREVIOUS SOAP FAILED VALIDATION: ${issues}
Rewrite the SOAP note so it passes validation. Keep only Subjective, Objective, Assessment, Plan.`
      const retry = await sendTextRequestWithUsage(retryPrompt, [], model, undefined, STAGE2_SOAP_SYSTEM_PROMPT, llmOptions)
      usage = addModelUsage(usage, retry.modelUsed, retry.usage)
      finalNote = finalizeStage2Note(retry.content)
    }

    if (!isValidStage2Note(finalNote)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Final note failed validation',
          issues: validateStage2Note(finalNote),
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ success: true, finalNote, usage })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Final note generation failed' },
      { status: 500 }
    )
  }
}
