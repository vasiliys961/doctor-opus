import type { TranslatePhase } from '@/lib/realtime-translate'

/** A cue marks the spoken translation, not the Start or End button. */
export function translationCue(previous: TranslatePhase, next: TranslatePhase): 'start' | 'end' | null {
  if (next === 'translating' && previous !== 'translating') return 'start'
  if (previous === 'translating' && next === 'listening') return 'end'
  return null
}

let shared: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!shared) shared = new AudioContext()
  return shared
}

/** Call from the Start click, before any await, so later cues are allowed to play. */
export function unlockTranslateCue(): void {
  const audio = audioContext()
  if (audio && audio.state === 'suspended') void audio.resume()
}

function tone(audio: AudioContext, frequency: number, when: number, duration: number): void {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = frequency
  osc.connect(gain)
  gain.connect(audio.destination)
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(0.2, when + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.start(when)
  osc.stop(when + duration)
}

export function playTranslateCue(kind: 'start' | 'end', retried = false): void {
  const audio = audioContext()
  if (!audio) return
  if (audio.state !== 'running') {
    if (!retried) void audio.resume().then(() => playTranslateCue(kind, true))
    return
  }
  const now = audio.currentTime
  if (kind === 'start') {
    tone(audio, 880, now, 0.07)
    tone(audio, 1175, now + 0.09, 0.07)
    return
  }
  tone(audio, 660, now, 0.28)
}
