/**
 * Binds a fidelity warning and a speaker handoff to one turn.
 * A newer End, handoff, or reconnect makes the older result stale.
 * This does not open or close the WebRTC session.
 */
export class TurnGuard {
  private epoch = 0
  private handoff = 0
  private busy = false

  capturedEpoch(): number {
    return this.epoch
  }

  acceptsFidelity(captured: number): boolean {
    return captured === this.epoch
  }

  /** End, reload, or a dropped connection. In-flight warnings and handoffs stop matching. */
  close(): void {
    this.handoff += 1
    this.epoch += 1
    this.busy = false
  }

  /**
   * Starts one speaker change. A second call while the first is unfinished returns null.
   * The fidelity epoch moves immediately, so a warning from the previous utterance cannot land.
   */
  startHandoff(): number | null {
    if (this.busy) return null
    this.busy = true
    this.handoff += 1
    this.epoch += 1
    return this.handoff
  }

  isHandoff(token: number): boolean {
    return token === this.handoff
  }

  finishHandoff(token: number): void {
    if (token === this.handoff) this.busy = false
  }
}
