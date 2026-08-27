import { NextRequest, NextResponse } from 'next/server'

type SourceKey = 'pubmed' | 'europepmc' | 'arxiv' | 'doaj' | 'all-web'

type LinkItem = {
  source: string
  title: string
  url: string
  snippet?: string
  year?: string
}

function withTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

async function searchEuropePmc(query: string, medlineOnly: boolean, limit: number): Promise<LinkItem[]> {
  const base = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search'
  const finalQuery = medlineOnly ? `${query} AND SRC:MED` : query
  const url = `${base}?query=${encodeURIComponent(finalQuery)}&format=json&pageSize=${limit}&resultType=core`
  const response = await withTimeout(url, 6500)
  if (!response.ok) return []
  const data = await response.json()
  const rows = Array.isArray(data?.resultList?.result) ? data.resultList.result : []
  return rows
    .filter((row: any) => row?.title)
    .map((row: any) => {
      const pmid = row?.pmid ? String(row.pmid) : null
      const doi = row?.doi ? String(row.doi) : null
      const pubYear = row?.pubYear ? String(row.pubYear) : undefined
      const url = pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        : doi
          ? `https://doi.org/${doi}`
          : row?.id
            ? `https://europepmc.org/article/MED/${row.id}`
            : 'https://europepmc.org'
      return {
        source: medlineOnly ? 'PubMed' : 'Europe PMC',
        title: String(row.title).replace(/\s+/g, ' ').trim(),
        url,
        snippet: String(row?.journalTitle || row?.journalInfo?.journal?.title || '').trim() || undefined,
        year: pubYear,
      } satisfies LinkItem
    })
}

async function searchArxiv(query: string, limit: number): Promise<LinkItem[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`
  const response = await withTimeout(url, 6500)
  if (!response.ok) return []
  const xml = await response.text()
  const entries = xml.split('<entry>').slice(1)
  return entries.map((entry) => {
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/i)
    const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/i)
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/i)
    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/i)
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'arXiv article'
    const articleUrl = idMatch ? idMatch[1].trim() : 'https://arxiv.org'
    const snippet = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim().slice(0, 240) : undefined
    const year = publishedMatch ? publishedMatch[1].slice(0, 4) : undefined
    return {
      source: 'arXiv',
      title,
      url: articleUrl,
      snippet,
      year,
    } satisfies LinkItem
  })
}

async function searchDoaj(query: string, limit: number): Promise<LinkItem[]> {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=${limit}`
  const response = await withTimeout(url, 6500)
  if (!response.ok) return []
  const data = await response.json()
  const rows = Array.isArray(data?.results) ? data.results : []
  return rows
    .map((row: any) => {
      const bib = row?.bibjson || {}
      const links = Array.isArray(bib.link) ? bib.link : []
      const fullText = links.find((item: any) => String(item?.type || '').toLowerCase().includes('fulltext'))
      const articleUrl = fullText?.url || links[0]?.url || null
      if (!articleUrl) return null
      return {
        source: 'DOAJ',
        title: String(bib?.title || 'DOAJ article'),
        url: String(articleUrl),
        snippet: String(bib?.journal?.title || '').trim() || undefined,
        year: bib?.year ? String(bib.year) : undefined,
      } satisfies LinkItem
    })
    .filter(Boolean) as LinkItem[]
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchAllWeb(query: string, limit: number): Promise<LinkItem[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await withTimeout(url, 6500)
  if (!response.ok) return []
  const html = await response.text()

  const blocks = html.split('<div class="result results_links').slice(1)
  const out: LinkItem[] = []

  for (const block of blocks) {
    if (out.length >= limit) break
    const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/i)
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/i)
    if (!urlMatch || !titleMatch) continue

    const rawUrl = decodeHtmlEntities(urlMatch[1])
    let finalUrl = rawUrl
    if (rawUrl.startsWith('//')) {
      finalUrl = `https:${rawUrl}`
    } else if (rawUrl.startsWith('/')) {
      continue
    }
    if (!/^https?:\/\//i.test(finalUrl)) continue

    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i)

    out.push({
      source: 'All Web',
      title: stripHtml(titleMatch[1]) || finalUrl,
      url: finalUrl,
      snippet: snippetMatch ? stripHtml(snippetMatch[1]).slice(0, 260) : undefined,
    })
  }

  return out
}

export async function GET(request: NextRequest) {
  try {
    const query = String(request.nextUrl.searchParams.get('q') || '').trim()
    const sourceParam = String(request.nextUrl.searchParams.get('source') || 'all').toLowerCase()
    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 })
    }

    const allowedSources: SourceKey[] = ['pubmed', 'europepmc', 'arxiv', 'doaj', 'all-web']
    const sources: SourceKey[] = sourceParam === 'all'
      ? ['pubmed', 'europepmc', 'arxiv', 'doaj']
      : (allowedSources.includes(sourceParam as SourceKey) ? [sourceParam as SourceKey] : ['pubmed'])

    const limitPerSource = sourceParam === 'all' ? 4 : sourceParam === 'all-web' ? 12 : 10
    const out: LinkItem[] = []

    for (const source of sources) {
      try {
        if (source === 'pubmed') {
          out.push(...await searchEuropePmc(query, true, limitPerSource))
        } else if (source === 'europepmc') {
          out.push(...await searchEuropePmc(query, false, limitPerSource))
        } else if (source === 'arxiv') {
          out.push(...await searchArxiv(query, limitPerSource))
        } else if (source === 'doaj') {
          out.push(...await searchDoaj(query, limitPerSource))
        } else if (source === 'all-web') {
          out.push(...await searchAllWeb(query, limitPerSource))
        }
      } catch {
        // one source failing should not break the whole response
      }
    }

    const dedup = new Map<string, LinkItem>()
    out.forEach((item) => {
      const key = item.url.trim()
      if (!key) return
      if (!dedup.has(key)) dedup.set(key, item)
    })

    return NextResponse.json({
      success: true,
      items: Array.from(dedup.values()).slice(0, 30),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: String(error?.message || 'Search failed') },
      { status: 500 }
    )
  }
}

