import { NextRequest, NextResponse } from 'next/server'
import { MODELS, sendTextRequest } from '@/lib/openrouter'

type PrescriptionForm = 'Tab.' | 'Sol.' | 'Ung.' | 'Caps.' | 'Supp.' | 'Gtt.'
type SourceType = 'mnn' | 'brand' | 'unknown'

type MedicationInput = {
  drugDisplayName: string
  dosage: string
  form: PrescriptionForm
  signa: string
  sourceType: SourceType
  sourceLine: string
}

type MedicationOutput = {
  drugDisplayName: string
  dosage: string
  form: PrescriptionForm
  signa: string
}

const ALLOWED_FORMS: PrescriptionForm[] = ['Tab.', 'Sol.', 'Ung.', 'Caps.', 'Supp.', 'Gtt.']

function extractJsonObject(raw: string): any {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || raw
  const objectMatch = candidate.match(/\{[\s\S]*\}/)
  const payload = objectMatch ? objectMatch[0] : candidate
  return JSON.parse(payload)
}

function sanitizeMedication(item: any, fallback: MedicationInput): MedicationOutput {
  const form: PrescriptionForm = ALLOWED_FORMS.includes(item?.form) ? item.form : fallback.form
  const drugDisplayName =
    typeof item?.drugDisplayName === 'string' && item.drugDisplayName.trim()
      ? item.drugDisplayName.trim()
      : fallback.drugDisplayName
  const dosage =
    typeof item?.dosage === 'string' && item.dosage.trim()
      ? item.dosage.trim()
      : fallback.dosage
  let signa =
    typeof item?.signa === 'string' && item.signa.trim()
      ? item.signa.trim()
      : fallback.signa

  const sanitizeDosageByForm = (rawDosage: string, targetForm: PrescriptionForm) => {
    const normalized = (rawDosage || '').replace(/\s+/g, ' ').trim()
    const low = normalized.toLowerCase()

    if (targetForm !== 'Sol.') {
      return normalized || '____'
    }

    const mgPerMl = low.match(/(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*ml/i)
    const percent = low.match(/(\d+(?:[.,]\d+)?)\s*%/i)
    const ml = low.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i)
    const mgOnly = low.match(/(\d+(?:[.,]\d+)?)\s*mg\b/i)

    if (mgPerMl) {
      const conc = `${mgPerMl[1].replace('.', ',')} mg/ml`
      const vol = ml ? `${ml[1].replace('.', ',')} ml` : '____ ml'
      return `${conc} — ${vol}`
    }
    if (percent) {
      const conc = `${percent[1].replace('.', ',')}%`
      const vol = ml ? `${ml[1].replace('.', ',')} ml` : '____ ml'
      return `${conc} — ${vol}`
    }
    if (mgOnly && ml) {
      return `${mgOnly[1].replace('.', ',')} mg/ml — ${ml[1].replace('.', ',')} ml`
    }

    // Для растворов не допускаем формат "в граммах" в итоговом Rp.
    return ml ? `____% — ${ml[1].replace('.', ',')} ml` : '____% — ____ ml'
  }

  if (!signa.toLowerCase().startsWith('s.:')) {
    signa = `S.: ${signa}`
  }

  return {
    drugDisplayName,
    dosage: sanitizeDosageByForm(dosage, form),
    form,
    signa
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items = Array.isArray(body?.items) ? (body.items as MedicationInput[]) : []
    if (!items.length) {
      return NextResponse.json({ success: true, items: [] })
    }

    const cappedItems = items.slice(0, 18)
    const model = process.env.PRESCRIPTION_NORMALIZER_MODEL?.trim() || MODELS.HAIKU

    const systemPrompt = `Ты клинический фармаколог и врач, оформляющий рецепты по форме 107-1/у.
Твоя цель: нормализовать строки назначений в формат Rp./S. для печати рецепта.
Ориентируйся на общепринятые фарм-справочные нормы (уровень Vidal/РЛС), без выдумывания редких доз.

Требования:
1) drugDisplayName:
- если sourceType="mnn" -> латинь в родительном падеже;
- если sourceType="brand" -> оставь торговое название, не латинизируй принудительно.
- исправляй орфографию латинского названия (без фантазии и без добавления лишних слов).
2) dosage:
- формат краткий, для Rp. (например: "0,55 g", "0,1% — 1 ml", "5 mcg/kg", "40 mg");
- не добавляй лишних комментариев.
3) form: одно из Tab.|Sol.|Ung.|Caps.|Supp.|Gtt.
4) signa:
- начинай с "S.:";
- по возможности возьми кратность/путь из sourceLine;
- если данных мало, ставь безопасную среднетерапевтическую общую формулировку без экстремальных доз.
5) Никогда не превращай в препарат немедикаментозные назначения (физиотерапия, ЛФК, массаж и т.п.).
6) Не добавляй препараты, которых нет во входе.

Ответ ТОЛЬКО JSON в виде:
{
  "items": [
    { "drugDisplayName": "...", "dosage": "...", "form": "Tab.", "signa": "S.: ..." }
  ]
}`

    const userPrompt = `Нормализуй записи рецепта.
Вход (JSON):
${JSON.stringify(cappedItems, null, 2)}`

    const content = await sendTextRequest(userPrompt, [], model, undefined, systemPrompt)
    const parsed = extractJsonObject(content)
    const aiItems = Array.isArray(parsed?.items) ? parsed.items : []

    const normalized = cappedItems.map((fallback, idx) => sanitizeMedication(aiItems[idx], fallback))
    return NextResponse.json({ success: true, items: normalized })
  } catch (error: any) {
    console.error('❌ [PRESCRIPTION NORMALIZE]', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'normalize_failed' },
      { status: 500 }
    )
  }
}
