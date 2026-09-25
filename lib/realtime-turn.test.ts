import { describe, expect, it } from 'vitest'
import { TurnGuard } from './realtime-turn'

describe('translator turn guard', () => {
  it('drops a warning that arrives after the speaker changes', () => {
    const turns = new TurnGuard()
    const spoken = turns.capturedEpoch()
    expect(turns.startHandoff()).not.toBeNull()
    expect(turns.acceptsFidelity(spoken)).toBe(false)
  })

  it('ignores a second press while the first handoff is still waiting', () => {
    const turns = new TurnGuard()
    const first = turns.startHandoff()
    expect(turns.startHandoff()).toBeNull()
    expect(first).not.toBeNull()
    turns.finishHandoff(first as number)
    expect(turns.startHandoff()).not.toBeNull()
  })

  it('drops a slow transcript after End and after a new connection', () => {
    const turns = new TurnGuard()
    const first = turns.capturedEpoch()
    turns.close()
    expect(turns.acceptsFidelity(first)).toBe(false)

    const second = turns.capturedEpoch()
    const handoff = turns.startHandoff()
    turns.close()
    expect(turns.isHandoff(handoff as number)).toBe(false)
    expect(turns.acceptsFidelity(second)).toBe(false)
    expect(turns.startHandoff()).not.toBeNull()
  })
})
