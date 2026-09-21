import { describe, expect, it } from 'vitest'
import {
  finalizeProtocolDocument,
  hasUnresolvedHeadingPlaceholder,
  repairProtocolHeadingPlaceholders,
} from './protocol-presentation'

const template = `**Complaints:**
...
**History of Present Illness (HPI):**
...
**Differential Diagnosis:**
...`

describe('protocol presentation', () => {
  it('repairs heading placeholders from the template', () => {
    const draft = `**[NAME]:**
Back pain for 3 days.

[NAME]:
Acute onset after lifting.

**[NAME]:**
1. Mechanical back pain
2. Radiculopathy`

    const repaired = repairProtocolHeadingPlaceholders(draft, template)

    expect(repaired).toContain('**Complaints:**')
    expect(repaired).toContain('**History of Present Illness (HPI):**')
    expect(repaired).toContain('**Differential Diagnosis:**')
    expect(hasUnresolvedHeadingPlaceholder(repaired)).toBe(false)
  })

  it('strips AI disclaimer from the document body', () => {
    const draft = `**Complaints:**
Back pain

---
**Draft Clinical Output (Beta)**
AI output may be incomplete or inaccurate and depends on third-party LLM capabilities.
Mandatory independent physician verification is required before any clinical use.
Not for patient self-diagnosis.`

    const result = finalizeProtocolDocument(draft, template)

    expect(result).toContain('**Complaints:**')
    expect(result).not.toContain('Draft Clinical Output')
    expect(result).not.toContain('third-party LLM')
  })
})
