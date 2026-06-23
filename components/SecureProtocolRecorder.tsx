'use client'

import { useRef, useState } from 'react'
import type { LocalClinicalDraft } from '@/lib/secure-protocol/types'

const MAX_SECONDS = 30 * 60

type Stage = 'idle' | 'recording' | 'transcribing' | 'transcribed' | 'drafting' | 'ready'

interface SecureProtocolRecorderProps {
  /** Вставить готовый черновик в поле протокола. */
  onInsert: (text: string) => void
  disabled?: boolean
}

/**
 * Запись беседы с пациентом для раздела «Протокол».
 * Поток (как на тестовой странице): запись → локальное распознавание (Whisper) →
 * врач читает/правит транскрипт → по команде «Сформировать черновик» обезличивание + Gemini Flash →
 * черновик жалоб/анамнеза → «Отправить в протокол».
 * Диагноз/лечение здесь не формируются — это делает основной pipeline.
 */
export default function SecureProtocolRecorder({ onInsert, disabled }: SecureProtocolRecorderProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [draft, setDraft] = useState<LocalClinicalDraft | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const startRecording = async () => {
    setError(null)
    setDraft(null)
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      let mime = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mime })
        transcribe(new File([blob], 'recording.webm', { type: mime }))
      }
      recorder.start()
      setStage('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= MAX_SECONDS) stopRecording()
          return prev + 1
        })
      }, 1000)
    } catch (e: any) {
      setError('Нет доступа к микрофону: ' + e.message)
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const transcribe = async (file: File) => {
    setStage('transcribing')
    try {
      // Ambient использует локальный Whisper через серверный прокси приложения (same-origin).
      // Старый ручной поток остаётся на /api/transcribe (AssemblyAI) — здесь не задействован.
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/secure-protocol/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Ошибка распознавания')
      setTranscript(data.transcript || '')
      setStage('transcribed')
    } catch (e: any) {
      setError(`Не удалось распознать: ${e.message}`)
      setStage('idle')
    }
  }

  const buildDraft = async () => {
    const text = transcript.trim()
    if (!text) {
      setError('Пустая транскрипция — нечего обрабатывать')
      return
    }
    setError(null)
    setStage('drafting')
    try {
      const res = await fetch('/api/secure-protocol/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Ошибка формирования черновика')
      setDraft(data.draft)
      setStage('ready')
    } catch (e: any) {
      setError(e.message)
      setStage('transcribed')
    }
  }

  const assembleText = (d: LocalClinicalDraft): string => {
    const j = (arr: string[]) => (arr.length ? arr.join('; ') : '—')
    return [
      `ЖАЛОБЫ: ${j(d.complaints)}`,
      `АНАМНЕЗ ЗАБОЛЕВАНИЯ: ${d.anamnesisMorbi || '—'}`,
      `АНАМНЕЗ ЖИЗНИ: ${d.anamnesisVitae || '—'}`,
      `ОБЪЕКТИВНО (ИЗ РЕЧИ): ${d.objective || '—'}`,
      `ТЕКУЩИЕ ПРЕПАРАТЫ: ${j(d.currentMedications)}`,
      `АЛЛЕРГИИ: ${j(d.allergies)}`,
      `ФАКТОРЫ РИСКА: ${j(d.riskFactors)}`,
      `ВИТАЛЬНЫЕ ПОКАЗАТЕЛИ: ${j(d.vitalSigns)}`,
    ].join('\n')
  }

  const insert = () => {
    if (!draft) return
    onInsert(assembleText(draft))
    setStage('idle')
    setDraft(null)
    setTranscript('')
    setSeconds(0)
  }

  const list = (arr: string[]) => (arr.length ? arr.join('; ') : '—')
  const busy = stage === 'transcribing' || stage === 'drafting'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {stage !== 'recording' ? (
          <button
            onClick={startRecording}
            disabled={disabled || busy}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            ● {transcript ? 'Записать заново' : 'Начать запись'}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold"
          >
            ■ Остановить
          </button>
        )}
        <span className="text-sm tabular-nums text-gray-700">{fmt(seconds)}</span>
        {stage === 'recording' && <span className="text-red-500 text-sm animate-pulse">● идёт запись…</span>}
        {stage === 'transcribing' && <span className="text-indigo-600 text-sm">⏳ распознавание…</span>}
        {stage === 'drafting' && <span className="text-indigo-600 text-sm">⏳ формирую черновик…</span>}
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Шаг 1: транскрипция — врач читает и при необходимости правит */}
      {(stage === 'transcribed' || stage === 'drafting' || stage === 'ready') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Транскрипция беседы (проверьте текст):</span>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 min-h-[140px]"
            placeholder="Распознанный текст беседы…"
          />
          {stage !== 'ready' && (
            <button
              onClick={buildDraft}
              disabled={busy || !transcript.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              📝 Сформировать черновик
            </button>
          )}
        </div>
      )}

      {/* Шаг 2: черновик жалоб/анамнеза — врач проверяет и отправляет в протокол */}
      {stage === 'ready' && draft && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1.5">
          <div className="font-semibold text-gray-700 mb-1">Черновик (до диагноза) — проверьте:</div>
          <Row label="Жалобы" value={list(draft.complaints)} />
          <Row label="Анамнез заболевания" value={draft.anamnesisMorbi || '—'} />
          <Row label="Анамнез жизни" value={draft.anamnesisVitae || '—'} />
          <Row label="Объективно (из речи)" value={draft.objective || '—'} />
          <Row label="Препараты" value={list(draft.currentMedications)} />
          <Row label="Аллергии" value={list(draft.allergies)} />
          <Row label="Факторы риска" value={list(draft.riskFactors)} />
          <Row label="Витальные" value={list(draft.vitalSigns)} />
          <button
            onClick={insert}
            className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
          >
            ➡️ Отправить в протокол
          </button>
          <p className="text-[11px] text-gray-500 pt-1">
            Объективные данные допишите в поле протокола ниже. Черновик требует проверки врачом.
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium text-gray-600 min-w-[150px]">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}
