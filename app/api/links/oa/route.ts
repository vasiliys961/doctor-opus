import { NextRequest, NextResponse } from 'next/server'

type OaHit = {
  url: string
  source: 'Unpaywall' | 'OpenAlex'
}

function withTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

function cleanDoi(value: string): string {
  return value.replace(/[)\].,;:]+$/g, '').trim()
}

function extractDoi(text: string): string | null {
  const normalized = decodeURIComponent(String(text || ''))
  const directMatch = normalized.match(/doi\.org\/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i)
  if (directMatch?.[1]) return cleanDoi(directMatch[1])

  const genericMatch = normalized.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i)
  if (genericMatch?.[1]) return cleanDoi(genericMatch[1])
  return null
}

async function searchUnpaywall(doi: string): Promise<OaHit | null> {
  const email = process.env.UNPAYWALL_EMAIL || process.env.CONTACT_EMAIL || 'support@doctor-opus.online'
  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`
  const response = await withTimeout(url, 7000)
  if (!response.ok) return null
  const data = await response.json()

  const best = data?.best_oa_location || null
  if (best?.url_for_pdf) {
    return { url: String(best.url_for_pdf), source: 'Unpaywall' }
  }
  if (best?.url) {
    return { url: String(best.url), source: 'Unpaywall' }
  }

  const locations = Array.isArray(data?.oa_locations) ? data.oa_locations : []
  for (const loc of locations) {
    if (loc?.url_for_pdf) return { url: String(loc.url_for_pdf), source: 'Unpaywall' }
    if (loc?.url) return { url: String(loc.url), source: 'Unpaywall' }
  }
  return null
}

function parseOpenAlexHit(work: any): OaHit | null {
  const candidates = [
    work?.best_oa_location?.pdf_url,
    work?.best_oa_location?.landing_page_url,
    work?.primary_location?.pdf_url,
    work?.primary_location?.landing_page_url,
  ].filter(Boolean)

  if (Array.isArray(work?.locations)) {
    for (const loc of work.locations) {
      if (loc?.pdf_url) candidates.push(loc.pdf_url)
      if (loc?.landing_page_url) candidates.push(loc.landing_page_url)
    }
  }

  const first = candidates.find((item) => /^https?:\/\//i.test(String(item)))
  if (!first) return null
  return { url: String(first), source: 'OpenAlex' }
}

async function searchOpenAlexByDoi(doi: string): Promise<OaHit | null> {
  const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`
  const response = await withTimeout(url, 7000)
  if (!response.ok) return null
  const data = await response.json()
  return parseOpenAlexHit(data)
}

async function searchOpenAlexByTitle(title: string): Promise<OaHit | null> {
  const cleanTitle = title.trim()
  if (!cleanTitle) return null
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(cleanTitle)}&per-page=5`
  const response = await withTimeout(url, 7000)
  if (!response.ok) return null
  const data = await response.json()
  const works = Array.isArray(data?.results) ? data.results : []
  for (const work of works) {
    const hit = parseOpenAlexHit(work)
    if (hit) return hit
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const articleUrl = String(request.nextUrl.searchParams.get('url') || '').trim()
    const title = String(request.nextUrl.searchParams.get('title') || '').trim()
    if (!articleUrl && !title) {
      return NextResponse.json({ success: false, error: 'url or title is required' }, { status: 400 })
    }

    const doi = extractDoi(`${articleUrl} ${title}`)
    if (doi) {
      const unpaywallHit = await searchUnpaywall(doi)
      if (unpaywallHit) return NextResponse.json({ success: true, found: true, item: unpaywallHit })

      const openAlexByDoiHit = await searchOpenAlexByDoi(doi)
      if (openAlexByDoiHit) return NextResponse.json({ success: true, found: true, item: openAlexByDoiHit })
    }

    const openAlexByTitleHit = await searchOpenAlexByTitle(title || articleUrl)
    if (openAlexByTitleHit) return NextResponse.json({ success: true, found: true, item: openAlexByTitleHit })

    return NextResponse.json({ success: true, found: false })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: String(error?.message || 'OA lookup failed') },
      { status: 500 }
    )
  }
}
