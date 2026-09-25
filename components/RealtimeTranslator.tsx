'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import { translatorUi, type TranslatorUi } from '@/lib/i18n/translator-ui'
import { REALTIME_TRANSLATION_CREDITS_PER_MINUTE } from '@/lib/cost-calculator'
import { recordUsageCost } from '@/lib/simple-logger'
import {
  RealtimeTranslator,
  TRANSLATOR_LANGUAGES,
  TranslatorError,
  findTranslatorLanguage,
  inputOnlyLanguages,
  type MedicalFidelityReport,
  type TranslatePhase,
} from '@/lib/realtime-translate'

function describeError(error: unknown, copy: TranslatorUi): string {
  if (!(error instanceof TranslatorError)) return copy.errors.generic
  const fallback = copy.errors[error.code] ?? copy.errors.generic
  if ((error.code === 'webrtc' || error.code === 'client_secret') && error.message && error.message !== fallback) {
    return error.message
  }
  return fallback
}

function formatCredits(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

function phaseClass(phase: TranslatePhase): string {
  switch (phase) {
    case 'listening':
      return 'bg-teal-50 text-teal-900 ring-teal-200'
    case 'translating':
      return 'bg-sky-50 text-sky-900 ring-sky-200'
    case 'connecting':
      return 'bg-amber-50 text-amber-900 ring-amber-200'
    case 'error':
      return 'bg-red-50 text-red-800 ring-red-200'
    case 'stopped':
      return 'bg-slate-100 text-slate-700 ring-slate-200'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-200'
  }
}

export default function RealtimeTranslatorPanel({ locale }: { locale: Locale }) {
  const copy = translatorUi[locale]
  const clientRef = useRef<RealtimeTranslator | null>(null)
  if (!clientRef.current) clientRef.current = new RealtimeTranslator()

  const [doctorLanguage, setDoctorLanguage] = useState('ru')
  const [patientLanguage, setPatientLanguage] = useState('en')
  const languagesRef = useRef({ doctor: 'ru', patient: 'en' })
  const [phase, setPhase] = useState<TranslatePhase>('ready')
  const [error, setError] = useState('')
  const [sourceTranscript, setSourceTranscript] = useState('')
  const [translatedTranscript, setTranslatedTranscript] = useState('')
  const [fidelity, setFidelity] = useState<MedicalFidelityReport | null>(null)
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [voiceBlocked, setVoiceBlocked] = useState(false)
  const [sessionCredits, setSessionCredits] = useState(0)
  const [speaker, setSpeaker] = useState<'doctor' | 'patient' | null>(null)
  const [handingOver, setHandingOver] = useState(false)
  const speakerRef = useRef<'doctor' | 'patient' | null>(null)
  const handoffToken = useRef(0)
  const accruedMs = useRef(0)
  const runningSince = useRef<number | null>(null)
  const billedMs = useRef(0)
  const billingLock = useRef(false)
  const billingBlocked = useRef(false)
  const billingGeneration = useRef(0)
  const countedTranslatorCall = useRef(false)
  const copyRef = useRef(copy)
  copyRef.current = copy

  const doctor = useMemo(
    () => findTranslatorLanguage(doctorLanguage),
    [doctorLanguage]
  )
  const patient = useMemo(
    () => findTranslatorLanguage(patientLanguage),
    [patientLanguage]
  )
  const heardOnly = useMemo(() => inputOnlyLanguages(), [])

  const active = phase === 'connecting' || phase === 'listening' || phase === 'translating'
  const sameLanguage = doctorLanguage === patientLanguage
  const patientCanSpeak = Boolean(patient?.outputCode)
  const doctorCanSpeak = Boolean(doctor?.outputCode)
  const canStart = !active && patientCanSpeak && !sameLanguage

  const liveMs = () => {
    const running = runningSince.current != null ? Date.now() - runningSince.current : 0
    return accruedMs.current + running
  }

  const stopForBilling = (message: string) => {
    billingBlocked.current = true
    clientRef.current?.disconnect()
    setPhase('error')
    setVoicePlaying(false)
    setVoiceBlocked(false)
    setError(message)
  }

  const billUnbilled = async () => {
    if (billingLock.current || billingBlocked.current) return
    const delta = liveMs() - billedMs.current
    if (delta < 1000) return
    const generation = billingGeneration.current
    billingLock.current = true
    const seconds = delta / 1000
    try {
      const response = await fetch('/api/realtime-translate/usage', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      })
      const payload = await response.json().catch(() => ({}))
      if (generation !== billingGeneration.current) return
      if (!response.ok) {
        stopForBilling(copyRef.current.billingStopped)
        return
      }
      billedMs.current += delta
      const charged = Number(payload?.charged) || 0
      if (charged > 0) {
        recordUsageCost({
          section: 'translator',
          model: 'gpt-realtime-translate',
          costUnits: charged,
          countCall: !countedTranslatorCall.current,
        })
        countedTranslatorCall.current = true
        window.dispatchEvent(new Event('balanceUpdated'))
      }
    } catch {
      if (generation === billingGeneration.current) stopForBilling(copyRef.current.billingStopped)
    } finally {
      billingLock.current = false
    }
  }

  useEffect(() => {
    if (!active) {
      if (runningSince.current != null) {
        accruedMs.current += Date.now() - runningSince.current
        runningSince.current = null
        setSessionCredits((accruedMs.current / 60_000) * REALTIME_TRANSLATION_CREDITS_PER_MINUTE)
      }
      void billUnbilled()
      return
    }
    if (runningSince.current == null) runningSince.current = Date.now()
    const tick = () => {
      const live = Date.now() - (runningSince.current ?? Date.now())
      setSessionCredits(((accruedMs.current + live) / 60_000) * REALTIME_TRANSLATION_CREDITS_PER_MINUTE)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    const billingTimer = window.setInterval(() => {
      void billUnbilled()
    }, 20000)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(billingTimer)
    }
  }, [active])

  useEffect(() => {
    const flush = () => {
      void billUnbilled()
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
      clientRef.current?.disconnect()
    }
  }, [])

  const rememberSpeaker = (next: 'doctor' | 'patient' | null) => {
    speakerRef.current = next
    setSpeaker(next)
  }

  const end = () => {
    handoffToken.current += 1
    rememberSpeaker(null)
    setHandingOver(false)
    clientRef.current?.disconnect()
    setPhase('stopped')
    setVoicePlaying(false)
    setVoiceBlocked(false)
    setFidelity(null)
  }

  const begin = async (source: string, target: string) => {
    setError('')
    setSourceTranscript('')
    setTranslatedTranscript('')
    setFidelity(null)
    setVoicePlaying(false)
    setVoiceBlocked(false)
    try {
      await clientRef.current?.connect({
        sourceLanguage: source,
        targetLanguage: target,
        onPhase: setPhase,
        onSourceTranscript: setSourceTranscript,
        onTranslatedTranscript: setTranslatedTranscript,
        onFidelity: setFidelity,
        onVoiceOutput: (playing) => {
          setVoicePlaying(playing)
          setVoiceBlocked(!playing)
        },
        onError: (connectError) => setError(describeError(connectError, copy)),
      })
    } catch (connectError) {
      setPhase('error')
      setError(describeError(connectError, copy))
      setVoicePlaying(false)
      throw connectError
    }
  }

  const start = async () => {
    setError('')
    try {
      const response = await fetch('/api/realtime-translate/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: 0 }),
      })
      if (!response.ok) {
        setError(response.status === 401 ? copy.errors.unauthorized : copy.billingStopped)
        return
      }
    } catch {
      setError(copy.billingStopped)
      return
    }
    billingGeneration.current += 1
    accruedMs.current = 0
    runningSince.current = null
    billedMs.current = 0
    billingBlocked.current = false
    countedTranslatorCall.current = false
    setSessionCredits(0)
    rememberSpeaker('doctor')
    setHandingOver(false)
    void begin(languagesRef.current.doctor, languagesRef.current.patient).catch(() => {
      rememberSpeaker(null)
    })
  }

  const passTurn = async () => {
    if (handingOver) return
    if (phase !== 'listening' && phase !== 'translating') return
    const current = speakerRef.current === 'patient' ? 'patient' : 'doctor'
    const next = current === 'doctor' ? 'patient' : 'doctor'
    const { doctor, patient } = languagesRef.current
    const source = next === 'doctor' ? doctor : patient
    const target = next === 'doctor' ? patient : doctor
    if (!findTranslatorLanguage(target)?.outputCode) {
      setError(copy.turnUnspeakable)
      return
    }
    const token = handoffToken.current + 1
    handoffToken.current = token
    setHandingOver(true)
    setError('')
    clientRef.current?.muteInput()
    try {
      await clientRef.current?.whenQuiet()
      if (token !== handoffToken.current) return
      await begin(source, target)
      if (token !== handoffToken.current) return
      rememberSpeaker(next)
    } catch {
      if (token === handoffToken.current) rememberSpeaker(current)
    } finally {
      if (token === handoffToken.current) setHandingOver(false)
    }
  }

  const swap = () => {
    if (active) return
    if (!doctorCanSpeak) return
    languagesRef.current = { doctor: patientLanguage, patient: doctorLanguage }
    setDoctorLanguage(patientLanguage)
    setPatientLanguage(doctorLanguage)
    setError('')
  }

  const enableSound = async () => {
    const playing = await clientRef.current?.resumePlayback()
    setVoicePlaying(Boolean(playing))
    setVoiceBlocked(!playing)
  }

  const voiceLive = active && (voicePlaying || phase === 'listening' || phase === 'translating')
  const patientTurn = speaker === 'patient'
  const canPassTurn = (phase === 'listening' || phase === 'translating') && !handingOver && (patientTurn || doctorCanSpeak)
  const heardLanguage = patientTurn ? patient : doctor
  const spokenLanguage = patientTurn ? doctor : patient

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{copy.subtitle}</p>
        </div>
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${phaseClass(phase)}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              phase === 'translating' || phase === 'listening' ? 'bg-current animate-pulse' : 'bg-current'
            }`}
            aria-hidden
          />
          {copy.phase[phase]}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">{copy.intro}</p>

      <div className="mt-6 grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <label className="block text-sm font-medium text-slate-800">
          {copy.doctorLanguage}
          <span className="mt-0.5 block text-xs font-normal text-slate-500">{copy.doctorHint}</span>
          <select
            value={doctorLanguage}
            disabled={active}
            onChange={(event) => {
              languagesRef.current.doctor = event.target.value
              setDoctorLanguage(event.target.value)
              setError('')
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
          >
            {TRANSLATOR_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={swap}
          disabled={active || !doctorCanSpeak}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
          aria-label={copy.swapAria}
          title={doctorCanSpeak ? copy.swapTitle : copy.voiceOnly}
        >
          {copy.swap}
        </button>

        <label className="block text-sm font-medium text-slate-800">
          {copy.patientLanguage}
          <span className="mt-0.5 block text-xs font-normal text-slate-500">{copy.patientHint}</span>
          <select
            value={patientLanguage}
            disabled={active}
            onChange={(event) => {
              const next = findTranslatorLanguage(event.target.value)
              if (!next?.outputCode) return
              languagesRef.current.patient = next.code
              setPatientLanguage(next.code)
              setError('')
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
          >
            {TRANSLATOR_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code} disabled={!language.outputCode}>
                {language.outputCode ? language.label : `${language.label} — ${copy.noVoice}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950">
        {heardOnly.map((language) => language.label).join(', ')}: {copy.voiceOnly}
      </p>

      {sameLanguage && (
        <p className="mt-2 text-sm text-amber-800">{copy.sameLanguage}</p>
      )}

      {(active || handingOver) && (
        <p className="mt-6 rounded-lg bg-teal-700 px-4 py-3 text-base font-semibold text-white" role="status">
          {handingOver ? copy.handingOver : patientTurn ? copy.patientSpeaking : copy.doctorSpeaking}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={!canStart || handingOver}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {copy.start}
        </button>
        <button
          type="button"
          onClick={() => void passTurn()}
          disabled={!canPassTurn}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          title={!doctorCanSpeak ? copy.turnUnspeakable : undefined}
        >
          {patientTurn ? copy.nowDoctor : copy.nowPatient}
        </button>
        <button
          type="button"
          onClick={end}
          disabled={!active && !handingOver}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {copy.end}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{copy.turnHint}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">
        {copy.costRate.replace('{rate}', formatCredits(REALTIME_TRANSLATION_CREDITS_PER_MINUTE))}
        {active || sessionCredits > 0
          ? ` · ${copy.costSession.replace('{credits}', formatCredits(sessionCredits))}`
          : ''}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div
        className={`mt-6 flex flex-col gap-2 rounded-xl px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
          voiceLive ? 'bg-teal-50 text-teal-950 ring-1 ring-teal-200' : 'bg-slate-50 text-slate-600'
        }`}
      >
        <p className="font-medium">
          {voiceBlocked && active ? (
            copy.voiceBlocked
          ) : (
            <>
              <span className={phase === 'translating' ? 'inline-block animate-pulse' : ''} aria-hidden>
                🔊{' '}
              </span>
              {patientTurn ? copy.voiceForDoctor : copy.voiceSpoken}
              {phase === 'translating' ? ` ${copy.voiceNow}` : ''}
            </>
          )}
        </p>
        {voiceBlocked && active && (
          <button
            type="button"
            onClick={enableSound}
            className="w-fit rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-teal-900 ring-1 ring-teal-300"
          >
            {copy.enableSound}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">{copy.headphones}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            {patientTurn ? copy.patientSaid : copy.sourceSpeech}
            {heardLanguage ? ` · ${heardLanguage.label}` : ''}
          </h2>
          <p className="mt-2 min-h-28 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
            {sourceTranscript || (patientTurn ? copy.patientSourceEmpty : copy.sourceEmpty)}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            {patientTurn ? copy.doctorHears : copy.translation}
            {spokenLanguage ? ` · ${spokenLanguage.label}` : ''}
          </h2>
          <p className="mt-2 min-h-28 whitespace-pre-wrap rounded-lg bg-teal-50/60 p-3 text-sm text-slate-800">
            {translatedTranscript || (patientTurn ? copy.doctorHearsEmpty : copy.translationEmpty)}
          </p>
          {fidelity && (
            <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950">
              {copy.fidelityWarning}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
