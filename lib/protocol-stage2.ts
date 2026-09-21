import { STAGE2_SOAP_HEADINGS } from './prompts'
import { finalizeProtocolDocument, hasUnresolvedHeadingPlaceholder } from './protocol-presentation'

const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_]{1,40}\]/
const FORBIDDEN_PHRASE_RE =
  /not documented|remain undocumented|was not established|have not yet been characterized|pending exam|missing\s*\/\s*to clarify|red flags to exclude|arguments for|verification recommendation|verified by physician|draft clinical output|medical consultative report/i
const ICD_RE = /\b[A-TV-Z]\d{2}(?:\.\d{1,4})?[A-Z]?\b/g
const SOURCE_RE = /\b(?:NICE|ACP|VA\/DoD|AAFP|ESC|GOLD|KDIGO|UpToDate|Cochrane)\b/gi

export type Stage2ValidationIssue = {
  code: 'placeholder' | 'forbidden_phrase' | 'duplicate_icd' | 'duplicate_source' | 'missing_heading'
  detail: string
}

export function extractRepeatedTokens(text: string, pattern: RegExp): string[] {
  const counts = new Map<string, number>()
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const matches = String(text || '').matchAll(new RegExp(pattern.source, flags))
  for (const match of matches) {
    const token = String(match[0] || '').toUpperCase()
    if (!token) continue
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([token]) => token)
}

export function validateStage2Note(text: string): Stage2ValidationIssue[] {
  const source = String(text || '').trim()
  const issues: Stage2ValidationIssue[] = []

  if (!source) {
    issues.push({ code: 'missing_heading', detail: 'Final note is empty' })
    return issues
  }

  if (PLACEHOLDER_RE.test(source) || hasUnresolvedHeadingPlaceholder(source)) {
    issues.push({ code: 'placeholder', detail: 'Unresolved placeholder token' })
  }

  if (FORBIDDEN_PHRASE_RE.test(source)) {
    issues.push({ code: 'forbidden_phrase', detail: 'Forbidden draft phrasing in final note' })
  }

  for (const heading of STAGE2_SOAP_HEADINGS) {
    const headingRe = new RegExp(`^\\s*(?:\\*\\*)?${heading}:?(?:\\*\\*)?\\s*$`, 'im')
    if (!headingRe.test(source)) {
      issues.push({ code: 'missing_heading', detail: `Missing heading: ${heading}` })
    }
  }

  const repeatedIcd = extractRepeatedTokens(source, ICD_RE)
  if (repeatedIcd.length > 0) {
    issues.push({ code: 'duplicate_icd', detail: repeatedIcd.join(', ') })
  }

  const repeatedSources = extractRepeatedTokens(source, SOURCE_RE)
  if (repeatedSources.length > 0) {
    issues.push({ code: 'duplicate_source', detail: repeatedSources.join(', ') })
  }

  return issues
}

export function isValidStage2Note(text: string): boolean {
  return validateStage2Note(text).length === 0
}

export function finalizeStage2Note(text: string): string {
  const soapTemplate = STAGE2_SOAP_HEADINGS.map((heading) => `**${heading}:**`).join('\n')
  return finalizeProtocolDocument(text, soapTemplate)
}
