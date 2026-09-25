import { describe, expect, it } from 'vitest'
import { fidelityLineText, reportForTurn } from './fidelity-notice'

describe('fidelity notice', () => {
  it('prints both fragments only when both sides are known', () => {
    expect(fidelityLineText('Dose needs a check', '5 mg', '50 мг')).toBe('Dose needs a check: 5 mg ↔ 50 мг')
    expect(fidelityLineText('Negation did not match')).toBe('Negation did not match')
  })

  it('drops a warning that belongs to the previous speaker', () => {
    const report = { findings: [{ severity: 'critical' as const, code: 'number' as const, detail: '5 mg' }] }
    expect(reportForTurn(report, 1, 1)).toBe(report)
    expect(reportForTurn(report, 1, 2)).toBeNull()
  })
})
