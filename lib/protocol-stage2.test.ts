import { describe, expect, it } from 'vitest'
import { finalizeStage2Note, isValidStage2Note, validateStage2Note } from './protocol-stage2'

const validNote = `**Subjective:**
3-day lumbar pain after lifting. Denies fever, weight loss, saddle anesthesia, bowel/bladder dysfunction, bilateral leg weakness.

**Objective:**
Exam deferred pending in-person evaluation.

**Assessment:**
Acute mechanical low back pain, likely lumbar strain vs. early disc-related pain, ICD-10 M54.50.

**Plan:**
- Diagnostics: no imaging if red-flag screen remains negative.
- Activity as tolerated; avoid prolonged bed rest.
- Analgesia deferred pending contraindication screening.
- Follow-up 3-7 days if not improving.
- Return sooner for retention, saddle numbness, or progressive weakness.`

describe('stage 2 SOAP validation', () => {
  it('accepts a compact SOAP note', () => {
    expect(validateStage2Note(validNote)).toEqual([])
    expect(isValidStage2Note(validNote)).toBe(true)
  })

  it('rejects placeholders and draft leftovers', () => {
    const invalid = `**Subjective:**
Pain [NAME]
**Objective:**
not documented
**Assessment:**
Strain, pending exam, ICD-10 M54.50 and ICD-10 M54.50
**Plan:**
See ACP and ACP.`

    const codes = validateStage2Note(invalid).map((issue) => issue.code)
    expect(codes).toContain('placeholder')
    expect(codes).toContain('forbidden_phrase')
    expect(codes).toContain('duplicate_icd')
    expect(codes).toContain('duplicate_source')
  })

  it('strips presentation leftovers from a SOAP note', () => {
    const result = finalizeStage2Note(`${validNote}\n\n---\n**Draft Clinical Output (Beta)**\nAI output`)
    expect(result).toContain('**Subjective:**')
    expect(result).not.toContain('Draft Clinical Output')
  })
})
