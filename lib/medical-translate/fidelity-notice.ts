import type { FidelityCode, FidelityFinding, MedicalFidelityReport } from './fidelity'

const MAX_FRAGMENT = 48

export type FidelityDisplayLine = {
  severity: 'critical' | 'important'
  code: FidelityCode
  sourceFragment?: string
  translationFragment?: string
}

function cleanFragment(value: string | undefined): string | undefined {
  if (!value) return undefined
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text || text.length > MAX_FRAGMENT) return undefined
  return text
}

export function fidelityDisplayLines(report: MedicalFidelityReport | null | undefined): FidelityDisplayLine[] {
  if (!report) return []
  return report.findings.map((finding) => lineFromFinding(finding))
}

function lineFromFinding(finding: FidelityFinding): FidelityDisplayLine {
  const sourceFragment = cleanFragment(finding.sourceFragment)
  const translationFragment = cleanFragment(finding.translationFragment)
  if (sourceFragment && translationFragment) {
    return { severity: finding.severity, code: finding.code, sourceFragment, translationFragment }
  }
  return { severity: finding.severity, code: finding.code }
}

export function fidelityLineText(title: string, sourceFragment?: string, translationFragment?: string): string {
  if (sourceFragment && translationFragment) return `${title}: ${sourceFragment} ↔ ${translationFragment}`
  return title
}

export function reportForTurn<T>(report: T | null, reportTurn: number, activeTurn: number): T | null {
  if (reportTurn !== activeTurn) return null
  return report
}
