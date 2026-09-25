/**
 * Standalone realtime speech translation via gpt-realtime-translate.
 *
 * The model auto-detects the spoken language and speaks one target language.
 * It does not accept custom instructions, so this module never sends a medical
 * prompt. A finished transcript is checked afterwards for doses, numbers,
 * negations, and clinical terms. That check does not rewrite the audio or the
 * session. The browser never calls OpenAI: the server exchanges the WebRTC
 * offer and returns only the SDP answer.
 *
 * Output languages are the 13 the translation guide can speak. Languages below
 * with outputCode null are in the published input list (the model can hear
 * them) and must not be selected as the voice target.
 */

import { assessMedicalFidelity, type MedicalFidelityReport } from './medical-translate/fidelity'

export type { MedicalFidelityReport }

export const SPEAKABLE_OUTPUT_CODES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ru',
  'zh',
  'ja',
  'ko',
  'hi',
  'id',
  'vi',
] as const

export type SpeakableOutputCode = (typeof SPEAKABLE_OUTPUT_CODES)[number]

export type TranslatorLanguage = {
  code: string
  label: string
  outputCode: SpeakableOutputCode | null
}

export const TRANSLATOR_LANGUAGES: readonly TranslatorLanguage[] = [
  { code: 'ru', label: 'Русский', outputCode: 'ru' },
  { code: 'en', label: 'English', outputCode: 'en' },
  { code: 'es', label: 'Español', outputCode: 'es' },
  { code: 'fr', label: 'Français', outputCode: 'fr' },
  { code: 'de', label: 'Deutsch', outputCode: 'de' },
  { code: 'it', label: 'Italiano', outputCode: 'it' },
  { code: 'pt', label: 'Português', outputCode: 'pt' },
  { code: 'zh', label: '中文', outputCode: 'zh' },
  { code: 'ja', label: '日本語', outputCode: 'ja' },
  { code: 'ko', label: '한국어', outputCode: 'ko' },
  { code: 'hi', label: 'हिन्दी', outputCode: 'hi' },
  { code: 'id', label: 'Bahasa Indonesia', outputCode: 'id' },
  { code: 'vi', label: 'Tiếng Việt', outputCode: 'vi' },
  { code: 'ar', label: 'العربية', outputCode: null },
  { code: 'tr', label: 'Türkçe', outputCode: null },
  { code: 'uk', label: 'Українська', outputCode: null },
  { code: 'ms', label: 'Bahasa Melayu', outputCode: null },
  { code: 'pl', label: 'Polski', outputCode: null },
] as const

export type TranslatePhase =
  | 'ready'
  | 'connecting'
  | 'listening'
  | 'translating'
  | 'stopped'
  | 'error'

export type TranslatorErrorCode =
  | 'microphone_denied'
  | 'microphone_missing'
  | 'missing_api_key'
  | 'client_secret'
  | 'unauthorized'
  | 'webrtc'
  | 'unspeakable_target'
  | 'same_language'
  | 'unknown_language'
  | 'session'

export class TranslatorError extends Error {
  readonly code: TranslatorErrorCode

  constructor(code: TranslatorErrorCode, message: string) {
    super(message)
    this.name = 'TranslatorError'
    this.code = code
  }
}

export interface RealtimeTranslateOptions {
  sourceLanguage: string
  targetLanguage: string
  onPhase?: (phase: TranslatePhase) => void
  onSourceTranscript?: (text: string) => void
  onTranslatedTranscript?: (text: string) => void
  onVoiceOutput?: (playing: boolean) => void
  onFidelity?: (report: MedicalFidelityReport | null) => void
  onError?: (error: TranslatorError) => void
}

const TRANSLATING_IDLE_MS = 1600
const WEBRTC_LOST_MS = 2500

export function findTranslatorLanguage(code: string): TranslatorLanguage | undefined {
  return TRANSLATOR_LANGUAGES.find((language) => language.code === code)
}

export function inputOnlyLanguages(): TranslatorLanguage[] {
  return TRANSLATOR_LANGUAGES.filter((language) => !language.outputCode)
}

function waitForIce(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout)
      peer.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    const onChange = () => {
      if (peer.iceGatheringState === 'complete') finish()
    }
    const timeout = setTimeout(finish, 2500)
    peer.addEventListener('icegatheringstatechange', onChange)
  })
}

type ParsedEvent = {
  type: string
  delta: string
  transcript: string
  errorMessage: string
}

function parseEvent(raw: string): ParsedEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const event = parsed as Record<string, unknown>
  const error = event.error
  let errorMessage = ''
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') errorMessage = message
  }
  return {
    type: typeof event.type === 'string' ? event.type : '',
    delta: typeof event.delta === 'string' ? event.delta : '',
    transcript: typeof event.transcript === 'string' ? event.transcript : '',
    errorMessage,
  }
}

function sanitizePublicText(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 200)
}

function asTranslatorError(error: unknown): TranslatorError {
  if (error instanceof TranslatorError) return error
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return new TranslatorError('microphone_denied', 'Microphone permission denied')
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return new TranslatorError('microphone_missing', 'Microphone not found')
  }
  if (error instanceof Error && error.message) {
    return new TranslatorError('webrtc', sanitizePublicText(error.message))
  }
  return new TranslatorError('webrtc', 'Translation connection failed')
}

export class RealtimeTranslator {
  private generation = 0
  private peer: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private audio: HTMLAudioElement | null = null
  private abort: AbortController | null = null
  private sourceText = ''
  private translatedText = ''
  private completedSources: string[] = []
  private outputOpen = false
  private listenTimer: ReturnType<typeof setTimeout> | null = null
  private lostTimer: ReturnType<typeof setTimeout> | null = null
  private fidelityTimer: ReturnType<typeof setTimeout> | null = null
  private lastOutputAt = 0

  async connect(options: RealtimeTranslateOptions): Promise<void> {
    const invalid = this.validate(options)
    if (invalid) {
      options.onPhase?.('error')
      options.onError?.(invalid)
      throw invalid
    }

    this.disconnect()
    const generation = this.generation
    const alive = () => generation === this.generation
    options.onPhase?.('connecting')
    this.sourceText = ''
    this.translatedText = ''
    this.completedSources = []
    this.outputOpen = false
    this.lastOutputAt = 0

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new TranslatorError('microphone_missing', 'Microphone API is unavailable')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (!alive()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.localStream = stream

      const peer = new RTCPeerConnection()
      this.peer = peer
      const events = peer.createDataChannel('oai-events')
      this.watchConnection(peer, options, alive)

      for (const track of stream.getAudioTracks()) {
        peer.addTrack(track, stream)
      }

      const audio = new Audio()
      audio.autoplay = true
      audio.setAttribute('playsinline', 'true')
      this.audio = audio
      peer.ontrack = ({ streams }) => {
        if (!alive()) return
        const [remote] = streams
        if (!remote) return
        audio.srcObject = remote
        void audio.play().then(
          () => {
            if (alive()) options.onVoiceOutput?.(true)
          },
          () => {
            if (alive()) options.onVoiceOutput?.(false)
          }
        )
      }

      events.onmessage = ({ data }) => {
        this.handleEvent(String(data), options, alive)
      }

      const offer = await peer.createOffer()
      if (!alive()) return
      await peer.setLocalDescription(offer)
      await waitForIce(peer)
      if (!alive()) return

      this.abort = new AbortController()
      const sessionResponse = await fetch('/api/realtime-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLanguage: options.sourceLanguage,
          targetLanguage: options.targetLanguage,
          sdp: offer.sdp,
        }),
        signal: this.abort.signal,
      })
      const session = await sessionResponse.json().catch(() => ({}))
      if (!alive()) return
      const answerSdp = typeof session?.answerSdp === 'string' ? session.answerSdp : ''
      if (!sessionResponse.ok || !answerSdp.startsWith('v=')) {
        throw this.errorFromSession(sessionResponse.status, session)
      }

      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      if (!alive()) return
      options.onPhase?.('listening')
    } catch (error) {
      if (!alive()) return
      const wrapped = asTranslatorError(error)
      this.disconnect()
      options.onPhase?.('error')
      options.onError?.(wrapped)
      throw wrapped
    }
  }

  disconnect(): void {
    this.generation += 1
    this.release()
  }

  muteInput(): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = false
    })
  }

  async whenQuiet(timeoutMs = 8000): Promise<void> {
    const generation = this.generation
    const started = Date.now()
    if (this.lastOutputAt === 0) return
    while (this.generation === generation && Date.now() - this.lastOutputAt < TRANSLATING_IDLE_MS) {
      if (Date.now() - started >= timeoutMs) return
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  async resumePlayback(): Promise<boolean> {
    if (!this.audio) return false
    try {
      await this.audio.play()
      return true
    } catch {
      return false
    }
  }

  private validate(options: RealtimeTranslateOptions): TranslatorError | null {
    const source = findTranslatorLanguage(options.sourceLanguage)
    const target = findTranslatorLanguage(options.targetLanguage)
    if (!source || !target) {
      return new TranslatorError('unknown_language', 'Unknown language')
    }
    if (!target.outputCode) {
      return new TranslatorError('unspeakable_target', 'Target language cannot be spoken')
    }
    if (source.code === target.code) {
      return new TranslatorError('same_language', 'Choose two different languages')
    }
    return null
  }

  private errorFromSession(status: number, session: { code?: unknown; error?: unknown }): TranslatorError {
    const code = typeof session?.code === 'string' ? session.code : ''
    if (status === 401 || code === 'unauthorized' || code === 'UNAUTHORIZED') {
      return new TranslatorError('unauthorized', 'Authorization required')
    }
    if (code === 'missing_api_key') {
      return new TranslatorError('missing_api_key', 'API key is not configured')
    }
    if (code === 'unspeakable_target') {
      return new TranslatorError('unspeakable_target', 'Target language cannot be spoken')
    }
    if (code === 'webrtc') {
      const detail = typeof session?.error === 'string' ? session.error : 'WebRTC answer failed'
      return new TranslatorError('webrtc', detail)
    }
    const detail = typeof session?.error === 'string' ? session.error : 'Client secret was not issued'
    return new TranslatorError('client_secret', detail)
  }

  private watchConnection(
    peer: RTCPeerConnection,
    options: RealtimeTranslateOptions,
    alive: () => boolean
  ): void {
    let established = false
    const clearLostTimer = () => {
      if (this.lostTimer) clearTimeout(this.lostTimer)
      this.lostTimer = null
    }
    const fail = () => {
      if (!alive()) return
      clearLostTimer()
      const error = new TranslatorError('webrtc', 'WebRTC connection lost')
      options.onPhase?.('error')
      options.onError?.(error)
      this.disconnect()
    }
    const schedule = () => {
      if (!alive() || !established) return
      clearLostTimer()
      this.lostTimer = setTimeout(() => {
        const state = peer.connectionState
        const ice = peer.iceConnectionState
        if (state === 'disconnected' || state === 'failed' || ice === 'disconnected' || ice === 'failed') {
          fail()
        }
      }, WEBRTC_LOST_MS)
    }

    peer.onconnectionstatechange = () => {
      if (!alive()) return
      if (peer.connectionState === 'connected') {
        established = true
        clearLostTimer()
        return
      }
      if (peer.connectionState === 'failed') fail()
      if (peer.connectionState === 'disconnected') schedule()
    }
    peer.oniceconnectionstatechange = () => {
      if (!alive()) return
      if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
        established = true
        clearLostTimer()
        return
      }
      if (peer.iceConnectionState === 'failed') fail()
      if (peer.iceConnectionState === 'disconnected') schedule()
    }
  }

  private release(): void {
    if (this.listenTimer) clearTimeout(this.listenTimer)
    if (this.lostTimer) clearTimeout(this.lostTimer)
    if (this.fidelityTimer) clearTimeout(this.fidelityTimer)
    this.listenTimer = null
    this.lostTimer = null
    this.fidelityTimer = null
    this.abort?.abort()
    this.abort = null
    this.localStream?.getTracks().forEach((track) => track.stop())
    this.localStream = null
    if (this.audio) {
      this.audio.pause()
      this.audio.srcObject = null
      this.audio = null
    }
    const peer = this.peer
    this.peer = null
    if (peer) {
      peer.onconnectionstatechange = null
      peer.oniceconnectionstatechange = null
      peer.ontrack = null
      peer.close()
    }
  }

  private markTranslating(options: RealtimeTranslateOptions, alive: () => boolean): void {
    if (!alive()) return
    this.lastOutputAt = Date.now()
    options.onPhase?.('translating')
    if (this.listenTimer) clearTimeout(this.listenTimer)
    this.listenTimer = setTimeout(() => {
      if (!alive() || !this.peer) return
      options.onPhase?.('listening')
    }, TRANSLATING_IDLE_MS)
  }

  private handleEvent(raw: string, options: RealtimeTranslateOptions, alive: () => boolean): void {
    if (!alive()) return
    const event = parseEvent(raw)
    if (!event) return

    if (event.type === 'error' || event.type.endsWith('.error')) {
      const message = sanitizePublicText(event.errorMessage || 'Translation session error')
      options.onError?.(new TranslatorError('session', message))
      return
    }

    if (event.type === 'session.input_transcript.delta' && event.delta) {
      this.sourceText += event.delta
      options.onSourceTranscript?.(this.sourceText)
    }
    if (event.type === 'session.input_transcript.done' && event.transcript) {
      this.sourceText = event.transcript
      options.onSourceTranscript?.(this.sourceText)
    }

    const outputDelta = event.type === 'session.output_transcript.delta' && event.delta
    const outputAudio = event.type.startsWith('session.output_audio') && !event.type.endsWith('.done')
    if (outputDelta) {
      if (!this.outputOpen) {
        this.outputOpen = true
        options.onFidelity?.(null)
      }
      this.translatedText += event.delta
      options.onTranslatedTranscript?.(this.translatedText)
      this.markTranslating(options, alive)
    } else if (outputAudio) {
      this.markTranslating(options, alive)
    }

    if (event.type === 'session.output_transcript.done' && event.transcript) {
      this.translatedText = event.transcript
      options.onTranslatedTranscript?.(this.translatedText)
      this.markTranslating(options, alive)
      this.outputOpen = false
      this.queueFidelity(options, alive)
    }
  }

  private queueFidelity(options: RealtimeTranslateOptions, alive: () => boolean): void {
    if (this.fidelityTimer) clearTimeout(this.fidelityTimer)
    const source = this.sourceText
    const translation = this.translatedText
    const priorSources = this.completedSources.slice(-6)
    this.fidelityTimer = setTimeout(() => {
      this.fidelityTimer = null
      if (!alive()) return
      try {
        const report = assessMedicalFidelity({ source, translation, priorSources })
        options.onFidelity?.(report.findings.length > 0 ? report : null)
      } catch {
        options.onFidelity?.(null)
      }
    }, 0)
    if (source && this.completedSources[this.completedSources.length - 1] !== source) {
      this.completedSources.push(source)
      if (this.completedSources.length > 8) this.completedSources.shift()
    }
  }
}
