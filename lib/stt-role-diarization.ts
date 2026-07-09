import { MODELS, sendTextRequest } from './openrouter'

function extractJsonObject(raw: string): any {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || raw
  const objectMatch = candidate.match(/\{[\s\S]*\}/)
  return JSON.parse(objectMatch ? objectMatch[0] : candidate)
}

export async function maybeApplyRoleDiarization(transcript: string): Promise<string> {
  if (!transcript?.trim()) return transcript
  const enabled = String(process.env.STT_ROLE_DIARIZATION_ENABLED || '').toLowerCase() === 'true'
  if (!enabled) return transcript

  const model = process.env.STT_ROLE_DIARIZATION_MODEL?.trim() || MODELS.HAIKU
  const systemPrompt = `Ты медицинский ассистент по расстановке ролей в расшифровке приема.
Верни строго JSON:
{
  "transcript": "..."
}

Правила:
- Никаких новых фактов и фраз не добавляй.
- Сохраняй исходный порядок реплик.
- Каждую реплику начинай с "Врач:" или "Пациент:".
- Если роль неочевидна, выбирай наиболее вероятную по контексту медицинского приема.
- Никакого markdown, только JSON.`

  const userPrompt = `Преобразуй транскрипт в формат Врач/Пациент.

Исходный транскрипт:
${transcript}`

  try {
    const content = await sendTextRequest(userPrompt, [], model, undefined, systemPrompt)
    const parsed = extractJsonObject(content)
    const normalized = String(parsed?.transcript || '').trim()
    return normalized || transcript
  } catch (error) {
    console.warn('⚠️ [STT ROLE DIARIZATION] fallback to original transcript:', error)
    return transcript
  }
}

