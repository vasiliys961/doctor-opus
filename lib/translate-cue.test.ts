import { describe, expect, it } from 'vitest'
import { translationCue } from './translate-cue'

describe('translation cue', () => {
  it('marks the start and the end of a spoken translation', () => {
    expect(translationCue('listening', 'translating')).toBe('start')
    expect(translationCue('translating', 'listening')).toBe('end')
  })

  it('does not beep again while the same phrase is still being spoken', () => {
    expect(translationCue('translating', 'translating')).toBeNull()
  })

  it('does not treat connecting, stopping, or an error as the end of a phrase', () => {
    expect(translationCue('ready', 'connecting')).toBeNull()
    expect(translationCue('connecting', 'listening')).toBeNull()
    expect(translationCue('translating', 'connecting')).toBeNull()
    expect(translationCue('translating', 'stopped')).toBeNull()
    expect(translationCue('translating', 'error')).toBeNull()
  })
})