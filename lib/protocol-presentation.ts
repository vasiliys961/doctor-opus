const HEADING_PLACEHOLDER_RE =
  /^\s*(?:#{1,4}\s*|\*\*)?\[(?:NAME|PLACEHOLDER|SECTION|TITLE|HEADING)\]:?\*?\*?\s*$/i

const DRAFT_DISCLAIMER_RE =
  /\n{0,2}---\s*\n+\*\*Draft Clinical Output \(Beta\)\*\*[\s\S]*$/i

export function extractTemplateHeadings(template: string): string[] {
  return String(template || '')
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s*(?:\*\*|#{1,4}\s*)([^*[\n][^:\n]{2,120}?):?(?:\*\*)?\s*$/)
      return match?.[1]?.trim() || ''
    })
    .filter((heading) => heading && !/^\(\s*$/.test(heading))
}

export function hasUnresolvedHeadingPlaceholder(text: string): boolean {
  return String(text || '')
    .split('\n')
    .some((line) => HEADING_PLACEHOLDER_RE.test(line))
}

export function repairProtocolHeadingPlaceholders(text: string, template: string): string {
  const headings = extractTemplateHeadings(template)
  if (!headings.length) return text

  let index = 0
  return String(text || '')
    .split('\n')
    .map((line) => {
      if (!HEADING_PLACEHOLDER_RE.test(line)) return line
      const heading = headings[index]
      index += 1
      return heading ? `**${heading}:**` : line
    })
    .join('\n')
}

export function stripProtocolPresentationLayer(text: string): string {
  return String(text || '')
    .replace(/^\s*#{0,3}\s*MEDICAL CONSULTATIVE REPORT\s*/i, '')
    .replace(/\n{0,2}#{0,3}\s*VERIFIED BY PHYSICIAN[\s\S]*$/i, '')
    .replace(/\n{0,2}>\s*\*\*Disclaimer:\*\*[\s\S]*$/i, '')
    .replace(DRAFT_DISCLAIMER_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function finalizeProtocolDocument(text: string, template?: string): string {
  const stripped = stripProtocolPresentationLayer(text)
  const repaired = template ? repairProtocolHeadingPlaceholders(stripped, template) : stripped
  return stripProtocolPresentationLayer(repaired)
}
