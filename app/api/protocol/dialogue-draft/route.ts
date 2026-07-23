import { NextRequest, NextResponse } from 'next/server'
import { MODELS, sendTextRequest } from '@/lib/openrouter'
import { anonymizeText } from '@/lib/anonymization'

const DEFAULT_DRAFT_MODEL = process.env.PROTOCOL_DIALOGUE_DRAFT_MODEL?.trim() || MODELS.HAIKU
const FALLBACK_DRAFT_MODEL = MODELS.GEMINI_3_FLASH

function buildDialogueDraftPrompt(params: { transcript: string; specialistName?: string }): string {
  const { transcript, specialistName } = params
  return `Ты медицинский ассистент по первичному структурированию данных приёма.
Задача: из транскрипта беседы "врач-пациент" собрать черновик для дальнейшего заполнения протокола.
Специальность врача: ${specialistName || 'терапевт'}.

ВАЖНО:
- Это только черновик из жалоб/анамнеза, без финального диагноза и без назначения окончательной терапии.
- Если данных нет — явно пиши "НЕТ ДАННЫХ", чтобы врач быстро дополнил.
- Не придумывай факты. Используй только то, что есть в беседе.
- Пиши на русском, без markdown, без списков с "*", только обычный текст.

Верни текст строго по структуре:
Жалобы:
...

Анамнез заболевания:
...

Анамнез жизни:
...

Лекарства/аллергии из беседы:
...

Объективные данные (что уже есть в беседе):
...

Что врачу нужно дозаполнить объективно:
1. ...
2. ...

Сырой текст беседы:
${transcript}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const transcriptRaw = String(body?.transcript || '')
    const specialistName = String(body?.specialistName || '')
    const transcript = anonymizeText(transcriptRaw).trim()

    if (!transcript) {
      return NextResponse.json({ success: false, error: 'Транскрипт пуст' }, { status: 400 })
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
      return NextResponse.json({ success: false, error: 'Не удалось сформировать черновик' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      draft,
      modelUsed,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка формирования черновика' },
      { status: 500 }
    )
  }
}

