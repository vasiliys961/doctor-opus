import { NextRequest, NextResponse } from 'next/server'
import { pushMobileBridgeEvent } from '@/lib/mobile-bridge-store'

export const runtime = 'nodejs'

const MAX_DATA_URL_LENGTH = 35 * 1024 * 1024

type RouteTarget =
  | 'auto_route'
  | 'chat'
  | 'protocol'
  | 'library'
  | 'clinical_context'
  | 'patient_db'
  | 'image_analysis'
  | 'ecg_analysis'
  | 'xray_analysis'
  | 'ct_analysis'
  | 'mri_analysis'
  | 'ultrasound_analysis'
  | 'lab_analysis'
  | 'video_analysis'
  | 'document_scan'

type ConcreteTarget = Exclude<RouteTarget, 'auto_route'>

const ALLOWED_TARGETS: RouteTarget[] = [
  'auto_route',
  'chat',
  'protocol',
  'library',
  'clinical_context',
  'patient_db',
  'image_analysis',
  'ecg_analysis',
  'xray_analysis',
  'ct_analysis',
  'mri_analysis',
  'ultrasound_analysis',
  'lab_analysis',
  'video_analysis',
  'document_scan',
]

function normalizeTarget(value: string): RouteTarget | null {
  const normalized = value.trim() as RouteTarget
  return ALLOWED_TARGETS.includes(normalized) ? normalized : null
}

function inferTargetFromPayload(payload: {
  title: string
  text?: string
  mimeType: string
}): { target: ConcreteTarget | null; confidence: 'high' | 'low'; candidates: ConcreteTarget[] } {
  const haystack = `${payload.title} ${payload.text || ''}`.toLowerCase()
  const mime = payload.mimeType.toLowerCase()

  if (mime.startsWith('video/')) {
    return { target: 'video_analysis', confidence: 'high', candidates: ['video_analysis'] }
  }
  if (mime.includes('pdf')) {
    if (/(analysis|lab|гемоглоб|лейкоц|тромбоц|глюкоз|биохим|holter|холтер|смад|спиром)/.test(haystack)) {
      return { target: 'lab_analysis', confidence: 'high', candidates: ['lab_analysis'] }
    }
    if (/(мрт|mri)/.test(haystack)) return { target: 'mri_analysis', confidence: 'high', candidates: ['mri_analysis'] }
    if (/(кт|ct)/.test(haystack)) return { target: 'ct_analysis', confidence: 'high', candidates: ['ct_analysis'] }
    if (/(рентген|xray|x-ray)/.test(haystack)) return { target: 'xray_analysis', confidence: 'high', candidates: ['xray_analysis'] }
    if (/(узи|ultrasound|sonograph)/.test(haystack)) return { target: 'ultrasound_analysis', confidence: 'high', candidates: ['ultrasound_analysis'] }
    if (/(экг|ecg|qrs|st\\s*segment)/.test(haystack)) return { target: 'ecg_analysis', confidence: 'high', candidates: ['ecg_analysis'] }
    return { target: null, confidence: 'low', candidates: ['document_scan', 'lab_analysis', 'library'] }
  }
  if (mime.startsWith('image/')) {
    if (/(экг|ecg|qrs|st\\s*segment)/.test(haystack)) return { target: 'ecg_analysis', confidence: 'high', candidates: ['ecg_analysis'] }
    if (/(рентген|xray|x-ray|флюор)/.test(haystack)) return { target: 'xray_analysis', confidence: 'high', candidates: ['xray_analysis'] }
    if (/(мрт|mri)/.test(haystack)) return { target: 'mri_analysis', confidence: 'high', candidates: ['mri_analysis'] }
    if (/(кт|ct)/.test(haystack)) return { target: 'ct_analysis', confidence: 'high', candidates: ['ct_analysis'] }
    if (/(узи|ultrasound|sonograph)/.test(haystack)) return { target: 'ultrasound_analysis', confidence: 'high', candidates: ['ultrasound_analysis'] }
    if (/(analysis|lab|лаборатор|гемоглоб|лейкоц|тромбоц|глюкоз|биохим)/.test(haystack)) return { target: 'lab_analysis', confidence: 'high', candidates: ['lab_analysis'] }
    return { target: null, confidence: 'low', candidates: ['image_analysis', 'document_scan', 'lab_analysis'] }
  }

  if ((payload.text || '').trim().length > 0) {
    if (/(analysis|lab|лаборатор)/.test(haystack)) return { target: 'lab_analysis', confidence: 'high', candidates: ['lab_analysis'] }
    return { target: 'clinical_context', confidence: 'high', candidates: ['clinical_context'] }
  }

  return { target: null, confidence: 'low', candidates: ['document_scan', 'chat', 'library'] }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'invalid payload' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const target = normalizeTarget(typeof body.target === 'string' ? body.target : '')
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 140) : 'mobile-upload'
  const mimeType = typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim().slice(0, 80) : 'text/plain'
  const text = typeof body.text === 'string' ? body.text.slice(0, 20_000) : undefined
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : undefined

  if (!token || !target) {
    return NextResponse.json({ success: false, error: 'token and target are required' }, { status: 400 })
  }
  if (dataUrl && dataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ success: false, error: 'file is too large for bridge transfer' }, { status: 413 })
  }

  let resolvedTarget: ConcreteTarget | null = target === 'auto_route' ? null : target
  if (target === 'auto_route') {
    const inferred = inferTargetFromPayload({ title, text, mimeType })
    if (!inferred.target || inferred.confidence === 'low') {
      return NextResponse.json(
        {
          success: false,
          error: 'route_uncertain',
          message: 'Could not confidently detect destination. Please select manually.',
          candidates: inferred.candidates,
        },
        { status: 409 },
      )
    }
    resolvedTarget = inferred.target
  }

  if (!resolvedTarget) {
    return NextResponse.json(
      { success: false, error: 'route_uncertain', message: 'Destination could not be resolved.' },
      { status: 409 },
    )
  }

  const event = pushMobileBridgeEvent(token, {
    target: resolvedTarget,
    title,
    mimeType,
    text,
    dataUrl,
  })

  return NextResponse.json({ success: true, eventId: event.id, routedTarget: resolvedTarget })
}
