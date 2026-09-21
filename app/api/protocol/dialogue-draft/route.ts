import { NextRequest, NextResponse } from 'next/server'
import { MODELS, sendTextRequestWithUsage } from '@/lib/openrouter'
import { addModelUsage, emptyTokenUsage } from '@/lib/cost-calculator'
import { anonymizeText } from '@/lib/anonymization'
import { getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language'

const DEFAULT_DRAFT_MODEL = process.env.PROTOCOL_DIALOGUE_DRAFT_MODEL?.trim() || MODELS.HAIKU
const FALLBACK_DRAFT_MODEL = MODELS.GEMINI_3_FLASH

function buildDialogueDraftPrompt(params: { transcript: string; specialistName?: string; languageInstruction: string }): string {
  const { transcript, specialistName, languageInstruction } = params
  return `${languageInstruction}
You are a medical assistant for initial structuring of visit data.
Task: from a physician-patient conversation transcript, produce a draft for further protocol completion.
Physician specialty: ${specialistName || 'general practitioner'}.

IMPORTANT:
- This is only a draft from complaints/history; no final diagnosis and no definitive treatment plan.
- If data is missing, explicitly write "NO DATA" so the physician can quickly complete it.
- Do not invent facts. Use only information present in the conversation.
- Plain text only, no markdown, no "*" list formatting.

Return plain text in this exact section order.
Important: section titles MUST be written in the required response language.

1) Complaints
2) History of present illness
3) Past medical/social history
4) Medications/allergies from the conversation
5) Objective findings (already present in conversation)
6) What the physician still needs to document objectively (numbered list)

Raw conversation text:
${transcript}`
}

export async function POST(request: NextRequest) {
  try {
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest()
    const body = await request.json()
    const transcriptRaw = String(body?.transcript || '')
    const specialistName = String(body?.specialistName || '')
    const transcript = anonymizeText(transcriptRaw).trim()

    if (!transcript) {
      return NextResponse.json({ success: false, error: 'Transcript is empty' }, { status: 400 })
    }

    const prompt = buildDialogueDraftPrompt({ transcript, specialistName, languageInstruction: responseLanguageInstruction })
    let modelUsed = DEFAULT_DRAFT_MODEL
    let usage = emptyTokenUsage()
    let draft = ''

    try {
      const primary = await sendTextRequestWithUsage(prompt, [], modelUsed)
      usage = addModelUsage(usage, primary.modelUsed, primary.usage)
      modelUsed = primary.modelUsed
      draft = primary.content
    } catch (primaryError) {
      modelUsed = FALLBACK_DRAFT_MODEL
      const fallback = await sendTextRequestWithUsage(prompt, [], modelUsed)
      usage = addModelUsage(usage, fallback.modelUsed, fallback.usage)
      modelUsed = fallback.modelUsed
      draft = fallback.content
    }

    draft = anonymizeText(String(draft || '')).trim()
    if (!draft) {
      return NextResponse.json({ success: false, error: 'Failed to generate draft' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      draft,
      modelUsed,
      usage,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Draft generation failed' },
      { status: 500 }
    )
  }
}

