'use client';

import { useRef, useState } from 'react';
import type { LocalClinicalDraft } from '@/lib/secure-protocol/types';

const STT_URL = process.env.NEXT_PUBLIC_STT_URL || 'http://localhost:8000';
const MAX_SECONDS = 30 * 60;

type Stage =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'transcribed'
  | 'drafting'
  | 'draft_ready';

export default function SecureProtocolPage() {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<LocalClinicalDraft | null>(null);
  const [objective, setObjective] = useState('');
  const [redacted, setRedacted] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      let mime = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        transcribe(new File([blob], 'recording.webm', { type: mime }));
      };
      recorder.start();
      setStage('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= MAX_SECONDS) stopRecording();
          return prev + 1;
        });
      }, 1000);
    } catch (e: any) {
      setError('Нет доступа к микрофону: ' + e.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const transcribe = async (file: File) => {
    setStage('transcribing');
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${STT_URL}/transcribe`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || 'Ошибка распознавания');
      setTranscript(data.text || '');
      setStage('transcribed');
    } catch (e: any) {
      setError(`Не удалось распознать (STT-сервис ${STT_URL}): ${e.message}`);
      setStage('idle');
    }
  };

  const buildDraft = async () => {
    setStage('drafting');
    setError(null);
    try {
      const res = await fetch('/api/secure-protocol/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Ошибка формирования черновика');
      setDraft(data.draft);
      setRedacted(data.redactedTranscript || '');
      setStage('draft_ready');
    } catch (e: any) {
      setError(e.message);
      setStage('transcribed');
    }
  };

  const reset = () => {
    setStage('idle');
    setTranscript('');
    setDraft(null);
    setObjective('');
    setRedacted('');
    setError(null);
    setSeconds(0);
  };

  const list = (items: string[]) => (items.length ? items.join('; ') : '—');

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">🔐 Secure Protocol (черновик)</h1>
      <p className="text-sm text-gray-500 mb-2">
        Параллельный режим. Запись → распознавание (локальный STT) → обезличивание → черновик
        жалоб/анамнеза (Gemini Flash). Объективные данные вы дописываете сами.
      </p>
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
        Черновик формируется автоматически и требует проверки врачом. Диагноз/лечение здесь не
        формируются — для этого передайте данные в основной анализ после заполнения «Объективно».
      </div>

      {/* Шаг 1: запись */}
      <div className="border rounded-xl p-5 mb-4">
        <div className="font-semibold mb-3">1. Запись разговора</div>
        <div className="flex items-center gap-3 flex-wrap">
          {stage !== 'recording' ? (
            <button
              onClick={startRecording}
              disabled={stage === 'transcribing' || stage === 'drafting'}
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg font-semibold"
            >
              ● Начать запись
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-5 py-2.5 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-semibold"
            >
              ■ Остановить
            </button>
          )}
          <span className="text-lg tabular-nums">{fmt(seconds)}</span>
          {stage === 'recording' && <span className="text-red-500 animate-pulse">● запись…</span>}
          {stage === 'transcribing' && <span className="text-indigo-600">⏳ распознавание…</span>}
          <button onClick={reset} className="ml-auto text-sm text-gray-500 hover:text-gray-700">
            Сбросить
          </button>
        </div>
      </div>

      {/* Шаг 2: транскрипт */}
      {(stage === 'transcribed' || stage === 'drafting' || stage === 'draft_ready') && (
        <div className="border rounded-xl p-5 mb-4">
          <div className="font-semibold mb-3">2. Транскрипт (можно поправить)</div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="w-full min-h-[140px] border rounded-lg p-3 text-sm"
            placeholder="Распознанный текст…"
          />
          <button
            onClick={buildDraft}
            disabled={!transcript.trim() || stage === 'drafting'}
            className="mt-3 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold"
          >
            {stage === 'drafting' ? 'Формирую черновик…' : 'Сформировать черновик'}
          </button>
        </div>
      )}

      {/* Шаг 3: черновик */}
      {stage === 'draft_ready' && draft && (
        <div className="border rounded-xl p-5 mb-4">
          <div className="font-semibold mb-3">3. Черновик протокола (до диагноза)</div>
          <dl className="text-sm space-y-2">
            <Field label="Жалобы" value={list(draft.complaints)} />
            <Field label="Анамнез заболевания" value={draft.anamnesisMorbi || '—'} />
            <Field label="Анамнез жизни" value={draft.anamnesisVitae || '—'} />
            <Field label="Препараты" value={list(draft.currentMedications)} />
            <Field label="Аллергии" value={list(draft.allergies)} />
            <Field label="Факторы риска" value={list(draft.riskFactors)} />
            <Field label="Витальные показатели" value={list(draft.vitalSigns)} />
          </dl>

          <div className="mt-4">
            <label className="block font-medium text-sm mb-1">
              Объективно (заполняет врач) <span className="text-gray-400">— осмотр, лаборатория</span>
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full min-h-[120px] border rounded-lg p-3 text-sm"
              placeholder="Внесите данные осмотра и лабораторию…"
            />
          </div>

          {redacted && (
            <details className="mt-4 text-xs text-gray-500">
              <summary className="cursor-pointer">Что ушло в модель (обезличенный текст)</summary>
              <pre className="mt-2 whitespace-pre-wrap bg-gray-50 border rounded p-2">{redacted}</pre>
            </details>
          )}

          <div className="mt-4 text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
            Дальше: после заполнения «Объективно» эти данные передаются в основной анализ
            (диагноз / обследование / лечение). Хендофф к существующему pipeline — следующий шаг.
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-medium text-gray-600 min-w-[170px]">{label}:</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
