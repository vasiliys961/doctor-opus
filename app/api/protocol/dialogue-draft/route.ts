import { NextRequest, NextResponse } from 'next/server'
import { MODELS, sendTextRequest } from '@/lib/openrouter'
import { anonymizeText } from '@/lib/anonymization'

const DEFAULT_DRAFT_MODEL = process.env.PROTOCOL_DIALOGUE_DRAFT_MODEL?.trim() || MODELS.HAIKU
const FALLBACK_DRAFT_MODEL = MODELS.GEMINI_3_FLASH

function buildDialogueDraftPrompt(params: { transcript: string; specialistName?: string }): string {
  const { transcript, specialistName } = params
  return `You are a medical assistant for initial structuring of visit data.
Task: from a physician-patient conversation transcript, produce a draft for further protocol completion.
Physician specialty: ${specialistName || 'general practitioner'}.

IMPORTANT:
- This is only a draft from complaints/history; no final diagnosis and no definitive treatment plan.
- If data is missing, explicitly write "NO DATA" so the physician can quickly complete it.
- Do not invent facts. Use only information present in the conversation.
- Write in English, plain text only, no markdown, no "*" list formatting.

Return text strictly in this structure:
Complaints:
...

History of present illness:
...

Past medical/social history:
...

Medications/allergies from the conversation:
...

Objective findings (already present in conversation):
...

What the physician still needs to document objectively:
1. ...
2. ...

Raw conversation text:
${transcript}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const transcriptRaw = String(body?.transcript || '')
    const specialistName = String(body?.specialistName || '')
    const transcript = anonymizeText(transcriptRaw).trim()

    if (!transcript) {
      return NextResponse.json({ success: false, error: 'Transcript is empty' }, { status: 400 })
    }

    const prompt = buildDialogueDraftPrompt({ transcript, specialistName })
    let modelUsed = DEFAULT_DRAFT_MODEL
    let draft = ''

    try {
      draft = await sendTextRequest(prompt, [], modelUsed)
    } catch (primaryError) {
      modelUsed = FALLBACK_DRAFT_MODEL
      draft = await sendTextRequest(prompt, [], modelUsed)
    }

    draft = anonymizeText(String(draft || '')).trim()
    if (!draft) {
      return NextResponse.json({ success: false, error: 'Failed to generate draft' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      draft,
      modelUsed,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Draft generation failed' },
      { status: 500 }
    )
  }
}

