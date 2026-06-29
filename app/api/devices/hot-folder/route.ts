import { NextRequest, NextResponse } from 'next/server'
import {
  HotFolderModality,
  getHotFolderEventsSince,
  pushHotFolderEvent,
} from '@/lib/device-hub/hot-folder-store'

export const runtime = 'nodejs'

const MAX_FILES = 8
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_TOTAL_SIZE = 30 * 1024 * 1024

const ALLOWED_MODALITIES: HotFolderModality[] = ['xray', 'ct', 'mri']

const normalizeModality = (value: string): HotFolderModality | null => {
  const normalized = value.trim().toLowerCase()
  return ALLOWED_MODALITIES.includes(normalized as HotFolderModality)
    ? (normalized as HotFolderModality)
    : null
}

const inferModality = (title: string, notes: string, fileNames: string[]): HotFolderModality | null => {
  const haystack = `${title} ${notes} ${fileNames.join(' ')}`.toLowerCase()
  if (/(рентген|xray|x-ray|rx|cxr)/.test(haystack)) return 'xray'
  if (/(компьютерн|томограф|кт|\bct\b)/.test(haystack)) return 'ct'
  if (/(магнитн|мрт|\bmri\b)/.test(haystack)) return 'mri'
  return null
}

const isAllowedMime = (mime: string): boolean => {
  const lower = mime.toLowerCase()
  return (
    lower.startsWith('image/') ||
    lower === 'application/dicom' ||
    lower === 'application/octet-stream'
  )
}

const requireToken = (request: NextRequest): NextResponse | null => {
  const expected = process.env.HOT_FOLDER_INGEST_TOKEN?.trim()
  if (!expected) return null
  const provided = request.headers.get('x-hot-folder-token')?.trim()
  if (provided === expected) return null
  return NextResponse.json({ success: false, error: 'unauthorized hot-folder token' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const tokenError = requireToken(request)
  if (tokenError) return tokenError

  const sinceRaw = request.nextUrl.searchParams.get('since') || '0'
  const since = Number.parseInt(sinceRaw, 10)
  const safeSince = Number.isFinite(since) && since >= 0 ? since : 0
  const events = getHotFolderEventsSince(safeSince)
  return NextResponse.json({ success: true, events })
}

export async function POST(request: NextRequest) {
  const tokenError = requireToken(request)
  if (tokenError) return tokenError

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ success: false, error: 'invalid form-data payload' }, { status: 400 })
  }

  const modalityRaw = String(formData.get('modality') || '')
  const explicitModality = normalizeModality(modalityRaw)
  const title = String(formData.get('title') || 'hot-folder-study').trim().slice(0, 140)
  const notes = String(formData.get('notes') || '').trim().slice(0, 10_000)
  const seriesCountRaw = Number.parseInt(String(formData.get('seriesCount') || '1'), 10)
  const seriesCount = Number.isFinite(seriesCountRaw) && seriesCountRaw > 0 ? seriesCountRaw : 1

  const inputFiles = formData.getAll('files').filter((item): item is File => item instanceof File)
  if (inputFiles.length === 0) {
    return NextResponse.json({ success: false, error: 'no files provided' }, { status: 400 })
  }
  if (inputFiles.length > MAX_FILES) {
    return NextResponse.json({ success: false, error: `too many files (max ${MAX_FILES})` }, { status: 400 })
  }

  let totalSize = 0
  const dataUrls: string[] = []
  const fileNames: string[] = []
  let payloadType: 'dicom' | 'image' = 'image'

  for (const file of inputFiles) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `file "${file.name}" exceeds ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB` },
        { status: 400 }
      )
    }
    totalSize += file.size
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { success: false, error: `total payload exceeds ${(MAX_TOTAL_SIZE / 1024 / 1024).toFixed(0)}MB` },
        { status: 400 }
      )
    }

    const mimeType = file.type || 'application/octet-stream'
    if (!isAllowedMime(mimeType)) {
      return NextResponse.json({ success: false, error: `unsupported mime type: ${mimeType}` }, { status: 400 })
    }

    const isDicomFile =
      mimeType === 'application/dicom' ||
      file.name.toLowerCase().endsWith('.dcm') ||
      file.name.toLowerCase().endsWith('.dicom')
    if (isDicomFile) {
      payloadType = 'dicom'
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    dataUrls.push(`data:${mimeType};base64,${bytes.toString('base64')}`)
    fileNames.push(file.name || 'hot-folder-file')
  }

  const modality = explicitModality || inferModality(title, notes, fileNames)
  if (!modality) {
    return NextResponse.json(
      {
        success: false,
        error: 'unable to infer modality',
        message: 'Передайте modality (xray|ct|mri) или добавьте модальность в title/имя файла.',
      },
      { status: 400 }
    )
  }

  const event = pushHotFolderEvent({
    modality,
    payloadType,
    title,
    notes: notes || undefined,
    dataUrls,
    fileNames,
    seriesCount,
  })

  return NextResponse.json({ success: true, event })
}
