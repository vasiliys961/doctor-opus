'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AnalysisResult from './AnalysisResult'

const LEAD_NAMES = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']
const LEAD_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#14b8a6', '#6366f1', '#d97706'
]

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200]

// Группы отведений по количеству каналов
const GROUPS_BY_CH: Record<number, { label: string; indices: number[] }[]> = {
  1:  LEAD_NAMES.map((n, i) => ({ label: n, indices: [i] })),
  3:  [
    { label: 'I + II + III',         indices: [0,1,2] },
    { label: 'aVR + aVL + aVF',      indices: [3,4,5] },
    { label: 'V1 + V2 + V3',         indices: [6,7,8] },
    { label: 'V4 + V5 + V6',         indices: [9,10,11] },
  ],
  4:  [
    { label: 'I + II + III + aVR',   indices: [0,1,2,3] },
    { label: 'aVL + aVF + V1 + V2',  indices: [4,5,6,7] },
    { label: 'V3 + V4 + V5 + V6',    indices: [8,9,10,11] },
  ],
  6:  [
    { label: 'I II III aVR aVL aVF', indices: [0,1,2,3,4,5] },
    { label: 'V1 V2 V3 V4 V5 V6',   indices: [6,7,8,9,10,11] },
  ],
  12: [{ label: 'Все 12 отведений',  indices: [0,1,2,3,4,5,6,7,8,9,10,11] }],
}

interface LeadData { name: string; points: number[]; capturedAt: Date }

interface DetectResult {
  baudRate: number
  channels: number
  separator: string
  samplesPerSec: number
}

// Мини-canvas для отображения одного канала
function MiniLeadCanvas({ points, color, height = 70 }: { points: number[]; color: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ctx = el.getContext('2d')!
    ctx.clearRect(0, 0, el.width, el.height)
    const pts = points.slice(-300); if (pts.length < 2) return
    const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5
    pts.forEach((p, i) => {
      const x = (i / pts.length) * el.width
      const y = el.height - ((p - min) / range) * el.height * 0.8 - el.height * 0.1
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [points, color])
  return <canvas ref={ref} width={400} height={height} className="w-full" />
}

// ===== ГЛАВНЫЙ КОМПОНЕНТ =====
export default function SerialDeviceManager() {
  // Шаги: idle → detecting → recording → captured → analyzing → done
  type Step = 'idle' | 'detecting' | 'recording' | 'captured' | 'analyzing' | 'done'
  const [step, setStep] = useState<Step>('idle')
  const [supported, setSupported] = useState(true)

  // Автодетект
  const [detectLog, setDetectLog] = useState<string[]>([])
  const [detected, setDetected] = useState<DetectResult | null>(null)

  // Соединение
  const [port, setPort] = useState<any>(null)
  const portRef = useRef<any>(null)
  const readerRef = useRef<any>(null)

  // Буферы сигнала
  const liveMultiRef = useRef<number[][]>(Array(12).fill(null).map(() => []))
  const livePointsRef = useRef<number[]>([])
  const [liveMulti, setLiveMulti] = useState<number[][]>(Array(12).fill([]))
  const [livePoints, setLivePoints] = useState<number[]>([])

  // Запись отведений
  const [savedLeads, setSavedLeads] = useState<(LeadData | null)[]>(Array(12).fill(null))
  const [currentGroupIdx, setCurrentGroupIdx] = useState(0)
  const savedLeadsRef = useRef<(LeadData | null)[]>(Array(12).fill(null))

  // Выбор модели анализа
  type EcgAnalysisPreset = 'fast' | 'best' | 'expert'
  const [analysisPreset, setAnalysisPreset] = useState<EcgAnalysisPreset>('best')
  const [analysisModelUsed, setAnalysisModelUsed] = useState('')

  // Результат анализа
  const [analysisResult, setAnalysisResult] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Расширенный режим (для продвинутых)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [manualBaud, setManualBaud] = useState(9600)
  const [manualChannels, setManualChannels] = useState(1)

  useEffect(() => {
    if (typeof window !== 'undefined' && !('serial' in navigator)) setSupported(false)
  }, [])

  const addLog = (msg: string) => setDetectLog(prev => [...prev, msg])

  const resetAll = () => {
    setStep('idle')
    setDetected(null)
    setDetectLog([])
    setSavedLeads(Array(12).fill(null))
    savedLeadsRef.current = Array(12).fill(null)
    liveMultiRef.current = Array(12).fill(null).map(() => [])
    livePointsRef.current = []
    setLiveMulti(Array(12).fill([]))
    setLivePoints([])
    setCurrentGroupIdx(0)
    setAnalysisResult('')
    setErrorMsg('')
  }

  // Закрыть порт
  const closePort = async () => {
    try { if (readerRef.current) await readerRef.current.cancel() } catch {}
    try { if (portRef.current) await portRef.current.close() } catch {}
    portRef.current = null
    setPort(null)
  }

  // Открыть порт с заданным baud rate и читать N секунд
  const samplePort = (p: any, baud: number, durationMs: number): Promise<string[]> => {
    return new Promise(async (resolve) => {
      const lines: string[] = []
      try {
        await p.open({ baudRate: baud })
        const td = new TextDecoderStream()
        p.readable.pipeTo(td.writable)
        const reader = td.readable.getReader()
        const timer = setTimeout(async () => {
          try { await reader.cancel() } catch {}
          resolve(lines)
        }, durationMs)
        let buf = ''
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buf += value
            const parts = buf.split('\n')
            buf = parts.pop() || ''
            lines.push(...parts.filter(l => l.trim()))
          }
        } catch {}
        clearTimeout(timer)
        resolve(lines)
      } catch {
        resolve(lines)
      } finally {
        try { await p.close() } catch {}
      }
    })
  }

  // Автодетект протокола
  const autoDetect = async () => {
    setStep('detecting')
    setDetectLog([])
    setErrorMsg('')

    let p: any
    try {
      p = await (navigator as any).serial.requestPort()
    } catch {
      setErrorMsg('Устройство не выбрано. Подключите прибор и попробуйте снова.')
      setStep('idle')
      return
    }

    addLog('Устройство выбрано. Определяю настройки...')

    let bestBaud = 9600
    let bestLines: string[] = []

    for (const baud of BAUD_RATES) {
      addLog(`Проверяю скорость ${baud} baud...`)
      const lines = await samplePort(p, baud, 1500)
      const valid = lines.filter(l => /^[\d,;.\s-]+$/.test(l.trim()) && l.trim().length > 0)
      addLog(`  → получено ${valid.length} строк с данными`)
      if (valid.length > bestLines.length) {
        bestLines = valid
        bestBaud = baud
      }
      if (valid.length > 20) break // Достаточно данных
    }

    if (bestLines.length < 3) {
      addLog('⚠️ Не удалось получить данные автоматически.')
      addLog('Возможно, аппарат использует бинарный протокол.')
      addLog('Попробуйте ручной режим ниже.')
      setShowAdvanced(true)
      setStep('idle')
      return
    }

    // Определяем разделитель и количество каналов
    const sample = bestLines[0].trim()
    let sep = ','
    let channels = 1

    if (sample.includes(',')) {
      sep = ','
      channels = sample.split(',').filter(s => !isNaN(parseFloat(s))).length
    } else if (sample.includes(';')) {
      sep = ';'
      channels = sample.split(';').filter(s => !isNaN(parseFloat(s))).length
    } else if (sample.includes('\t')) {
      sep = '\t'
      channels = sample.split('\t').filter(s => !isNaN(parseFloat(s))).length
    } else if (sample.includes(' ') && sample.trim().split(/\s+/).length > 1) {
      sep = ' '
      channels = sample.trim().split(/\s+/).filter(s => !isNaN(parseFloat(s))).length
    }

    // Ограничиваем до поддерживаемых значений
    const supportedCh = [1, 3, 4, 6, 12]
    channels = supportedCh.includes(channels) ? channels : supportedCh.reduce((prev, cur) =>
      Math.abs(cur - channels) < Math.abs(prev - channels) ? cur : prev
    )

    // Частота дискретизации (строк в секунду)
    const samplesPerSec = Math.round(bestLines.length / 1.5)

    const result: DetectResult = { baudRate: bestBaud, channels, separator: sep, samplesPerSec }
    setDetected(result)
    portRef.current = p
    setPort(p)

    addLog(`✅ Определено: ${channels} канал(а), скорость ${bestBaud} baud, ~${samplesPerSec} Гц`)
    addLog('Готово! Нажмите "Начать запись".')

    setStep('recording')
    startReading(p, bestBaud, sep, channels)
  }

  // Запуск чтения данных
  const startReading = async (p: any, baud: number, sep: string, channels: number) => {
    try {
      if (p.readable === null) await p.open({ baudRate: baud })
      const td = new TextDecoderStream()
      p.readable.pipeTo(td.writable)
      const reader = td.readable.getReader()
      readerRef.current = reader

      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim(); if (!trimmed) continue
          const parts = trimmed.split(sep === ' ' ? /\s+/ : sep).map(s => parseFloat(s)).filter(n => !isNaN(n))
          if (parts.length === 0) continue
          parts.forEach((val, i) => {
            if (i < 12) {
              liveMultiRef.current[i] = [...(liveMultiRef.current[i] || []).slice(-1000), val]
            }
          })
          livePointsRef.current = [...livePointsRef.current.slice(-1000), parts[0]]
          setLivePoints([...livePointsRef.current])
          setLiveMulti(liveMultiRef.current.map(ch => [...ch]))
        }
      }
    } catch {}
  }

  // Подключение вручную (расширенный режим)
  const connectManual = async () => {
    setErrorMsg('')
    let p: any
    try {
      p = await (navigator as any).serial.requestPort()
      portRef.current = p
      setPort(p)
    } catch {
      setErrorMsg('Устройство не выбрано.')
      return
    }
    const result: DetectResult = { baudRate: manualBaud, channels: manualChannels, separator: ',', samplesPerSec: 0 }
    setDetected(result)
    setStep('recording')
    startReading(p, manualBaud, ',', manualChannels)
  }

  // Сохранить текущую группу отведений
  const saveGroup = useCallback(() => {
    if (!detected) return
    const groups = GROUPS_BY_CH[detected.channels] || GROUPS_BY_CH[1]
    const group = groups[currentGroupIdx]
    if (!group) return

    const hasData = group.indices.some(i => (liveMultiRef.current[i]?.length ?? 0) >= 10)
    if (!hasData && livePointsRef.current.length < 10) {
      setErrorMsg('Нет данных. Убедитесь что прибор передаёт сигнал.')
      return
    }

    const newLeads = [...savedLeadsRef.current]
    group.indices.forEach((leadIdx, chIdx) => {
      const pts = liveMultiRef.current[leadIdx]?.length >= 10
        ? [...liveMultiRef.current[leadIdx]]
        : [...livePointsRef.current]
      newLeads[leadIdx] = { name: LEAD_NAMES[leadIdx], points: pts, capturedAt: new Date() }
    })
    savedLeadsRef.current = newLeads
    setSavedLeads([...newLeads])

    // Сброс буферов
    liveMultiRef.current = Array(12).fill(null).map(() => [])
    livePointsRef.current = []
    setLivePoints([])
    setLiveMulti(Array(12).fill([]))

    const groups2 = GROUPS_BY_CH[detected.channels] || GROUPS_BY_CH[1]
    if (currentGroupIdx < groups2.length - 1) {
      setCurrentGroupIdx(prev => prev + 1)
    } else {
      // Все группы записаны
      setStep('captured')
      closePort()
    }
  }, [detected, currentGroupIdx])

  // Проверяем сохранены ли все нужные отведения
  const savedCount = savedLeads.filter(Boolean).length
  const allGroupsDone = detected
    ? (() => {
        const groups = GROUPS_BY_CH[detected.channels] || GROUPS_BY_CH[1]
        return groups.every(g => g.indices.every(i => savedLeads[i]))
      })()
    : false

  // Собрать финальный PNG и отправить на анализ
  const buildAndAnalyze = async () => {
    const leads = savedLeadsRef.current.filter(Boolean) as LeadData[]
    if (leads.length === 0) { setErrorMsg('Нет записанных отведений.'); return }

    setStep('analyzing')
    setErrorMsg('')

    try {
      const COLS = Math.min(leads.length, 3)
      const ROWS = Math.ceil(leads.length / COLS)
      const LW = 560, LH = 110, PAD = 30, LABEL_H = 20

      const canvas = document.createElement('canvas')
      canvas.width = COLS * LW + PAD * 2
      canvas.height = ROWS * (LH + LABEL_H) + PAD * 2 + 50
      const ctx = canvas.getContext('2d')!

      // Фон
      ctx.fillStyle = '#fffdf7'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Заголовок
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'
      ctx.fillText('ЭКГ — прямая запись с прибора', canvas.width / 2, 28)
      ctx.fillStyle = '#64748b'; ctx.font = '12px Arial'
      ctx.fillText(`${leads.length} отведений · ${new Date().toLocaleString('ru-RU')}${detected ? ` · ${detected.baudRate} baud` : ''}`, canvas.width / 2, 46)

      leads.forEach((lead, idx) => {
        const col = idx % COLS, row = Math.floor(idx / COLS)
        const ox = PAD + col * LW, oy = PAD + 50 + row * (LH + LABEL_H)
        const leadIdx = LEAD_NAMES.indexOf(lead.name)
        const color = LEAD_COLORS[leadIdx] || '#10b981'

        // Метка
        ctx.fillStyle = color; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'left'
        ctx.fillText(lead.name, ox + 5, oy + 14)

        // Рамка
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1
        ctx.strokeRect(ox, oy + LABEL_H, LW, LH)

        // Миллиметровая сетка (светло-жёлтая)
        ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = 0.4
        for (let x = ox; x < ox + LW; x += 20) { ctx.beginPath(); ctx.moveTo(x, oy + LABEL_H); ctx.lineTo(x, oy + LABEL_H + LH); ctx.stroke() }
        for (let y = oy + LABEL_H; y < oy + LABEL_H + LH; y += 20) { ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + LW, y); ctx.stroke() }

        // Изолиния
        const midY = oy + LABEL_H + LH / 2
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.moveTo(ox, midY); ctx.lineTo(ox + LW, midY); ctx.stroke()

        // Сигнал
        const pts = lead.points.slice(-400); if (pts.length < 2) return
        const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5
        pts.forEach((p, i) => {
          const x = ox + (i / pts.length) * LW
          const y = oy + LABEL_H + LH - ((p - min) / range) * LH * 0.8 - LH * 0.1
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
      })

      const blob = await (await fetch(canvas.toDataURL('image/png'))).blob()

      // Выбираем модели по пресету
      const presetConfig = {
        fast:   { mode: 'fast',      model: 'google/gemini-3-flash-preview',    extractor: 'google/gemini-3-flash-preview' },
        best:   { mode: 'optimized', model: 'openai/gpt-5.4',                   extractor: 'google/gemini-3-pro-preview' },
        expert: { mode: 'validated', model: 'anthropic/claude-opus-4.6',         extractor: 'google/gemini-3-pro-preview' },
      }
      const cfg = presetConfig[analysisPreset]
      setAnalysisModelUsed(cfg.model)

      const formData = new FormData()
      formData.append('file', blob, 'ecg_direct.png')
      formData.append('imageType', 'ecg')
      formData.append('mode', cfg.mode)
      formData.append('model', cfg.model)
      formData.append('prompt',
        `Это ЭКГ, записанная напрямую с медицинского прибора через USB. ` +
        `Отведения: ${leads.map(l => l.name).join(', ')}. ` +
        `Проанализируйте ритм, ЧСС, электрическую ось, наличие блокад, ишемии, гипертрофий, аритмий. Дайте клиническое заключение.`
      )

      const resp = await fetch('/api/analyze/image', { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.success) { setAnalysisResult(data.result); setStep('done') }
      else { setErrorMsg('Ошибка анализа: ' + data.error); setStep('captured') }
    } catch (e: any) {
      setErrorMsg('Ошибка: ' + e.message)
      setStep('captured')
    }
  }

  // ===================== UI =====================

  if (!supported) return (
    <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center">
      <h3 className="text-lg font-bold text-yellow-800 mb-2">Нужен другой браузер</h3>
      <p className="text-yellow-700">Используйте <strong>Google Chrome</strong> или <strong>Microsoft Edge</strong> на ПК/Mac.</p>
    </div>
  )

  const groups = detected ? (GROUPS_BY_CH[detected.channels] || GROUPS_BY_CH[1]) : []
  const currentGroup = groups[currentGroupIdx]

  return (
    <div className="space-y-4 max-w-4xl mx-auto">

      {/* ШАГ 0: ГЛАВНЫЙ ЭКРАН */}
      {step === 'idle' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 text-white text-center">
            <div className="text-6xl mb-4">🫀</div>
            <h2 className="text-3xl font-black mb-2">Анализ ЭКГ с прибора</h2>
            <p className="text-indigo-200 text-lg">Подключите ЭКГ-аппарат по USB и получите заключение ИИ</p>
          </div>

          <div className="p-8">
            {/* Инструкция */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { step: '1', icon: '🔌', text: 'Подключите прибор к USB' },
                { step: '2', icon: '🤖', text: 'Нажмите кнопку — система сама настроится' },
                { step: '3', icon: '📋', text: 'Получите заключение ИИ' },
              ].map(s => (
                <div key={s.step} className="text-center p-4 bg-indigo-50 rounded-xl">
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <div className="text-xs font-bold text-indigo-400 uppercase mb-1">Шаг {s.step}</div>
                  <div className="text-sm text-gray-700 font-medium">{s.text}</div>
                </div>
              ))}
            </div>

            <button
              onClick={autoDetect}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xl font-black rounded-2xl transition-all shadow-xl hover:shadow-2xl"
            >
              🔗 Подключить прибор и начать
            </button>

            {errorMsg && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>
            )}

            {/* Расширенный режим */}
            <div className="mt-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
              >
                ⚙️ {showAdvanced ? 'Скрыть' : 'Ручные настройки (для специалистов)'}
              </button>
              {showAdvanced && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex gap-3 flex-wrap">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Скорость (baud)</label>
                      <select value={manualBaud} onChange={e => setManualBaud(+e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm bg-white outline-none">
                        {BAUD_RATES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Каналов</label>
                      <select value={manualChannels} onChange={e => setManualChannels(+e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm bg-white outline-none">
                        {[1,3,4,6,12].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button onClick={connectManual}
                        className="px-5 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-bold text-sm transition-all">
                        Подключить вручную
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Данные должны передаваться числами, разделёнными запятой.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ШАГ 1: АВТОДЕТЕКТ */}
      {step === 'detecting' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4 animate-pulse">🔍</div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Определяю настройки прибора...</h3>
          <div className="text-left bg-gray-900 rounded-xl p-4 font-mono text-sm space-y-1 max-h-48 overflow-y-auto">
            {detectLog.map((log, i) => (
              <div key={i} className={log.startsWith('✅') ? 'text-green-400' : log.startsWith('⚠️') ? 'text-yellow-400' : 'text-gray-300'}>
                {log}
              </div>
            ))}
            {detectLog.length === 0 && <div className="text-gray-500">Инициализация...</div>}
          </div>
        </div>
      )}

      {/* ШАГ 2: ЗАПИСЬ */}
      {step === 'recording' && detected && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Статус */}
          <div className="bg-green-600 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-white font-bold">LIVE · {detected.channels} канал(а) · {detected.baudRate} baud</span>
            </div>
            <button onClick={resetAll} className="text-green-200 hover:text-white text-sm">✕ Отмена</button>
          </div>

          <div className="p-6 space-y-4">
            {/* Прогресс по группам */}
            <div className="flex items-center gap-2 flex-wrap">
              {groups.map((g, idx) => {
                const done = g.indices.every(i => savedLeads[i])
                const active = idx === currentGroupIdx
                return (
                  <div key={idx} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    done ? 'bg-green-100 text-green-700 border border-green-300' :
                    active ? 'bg-indigo-600 text-white shadow-md' :
                    'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}>
                    {done ? '✓ ' : active ? '● ' : ''}{g.label}
                  </div>
                )
              })}
            </div>

            {/* Живой монитор */}
            <div className="bg-gray-900 rounded-xl overflow-hidden border-2 border-gray-800">
              {detected.channels === 1 ? (
                <div className="p-1">
                  <div className="px-2 pt-1 text-xs font-bold" style={{ color: currentGroup ? LEAD_COLORS[currentGroup.indices[0]] : '#10b981' }}>
                    {currentGroup?.label || 'Сигнал'}
                  </div>
                  <MiniLeadCanvas points={livePoints} color={currentGroup ? LEAD_COLORS[currentGroup.indices[0]] : '#10b981'} height={120} />
                </div>
              ) : (
                <div className={`grid gap-1 p-2`} style={{ gridTemplateColumns: `repeat(${Math.min(detected.channels, 6)}, 1fr)` }}>
                  {(currentGroup?.indices || []).map((leadIdx, chIdx) => (
                    <div key={leadIdx}>
                      <div className="text-xs font-bold px-1" style={{ color: LEAD_COLORS[leadIdx] }}>{LEAD_NAMES[leadIdx]}</div>
                      <MiniLeadCanvas points={liveMulti[leadIdx] || []} color={LEAD_COLORS[leadIdx]} height={80} />
                    </div>
                  ))}
                </div>
              )}
              <div className="px-3 py-1 text-xs text-gray-500 border-t border-gray-800">
                Точек получено: {livePoints.length}
              </div>
            </div>

            {/* Большая кнопка сохранения */}
            <button
              onClick={saveGroup}
              disabled={livePoints.length < 10}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-lg font-black rounded-xl transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {detected.channels >= 12
                ? '💾 Записать все 12 отведений'
                : `💾 Сохранить: ${currentGroup?.label} (${currentGroupIdx + 1} из ${groups.length})`
              }
            </button>

            {/* Мини-превью сохранённых */}
            {savedCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {savedLeads.map((lead, i) => lead ? (
                  <span key={i} className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-300">
                    ✓ {lead.name}
                  </span>
                ) : null)}
              </div>
            )}

            {errorMsg && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>}
          </div>
        </div>
      )}

      {/* ШАГ 3: ВСЁ ЗАПИСАНО */}
      {(step === 'captured' || (step === 'recording' && allGroupsDone)) && (
        <div className="bg-white rounded-2xl shadow-lg border border-green-200 overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-green-800">✅ Запись завершена</h3>
              <p className="text-sm text-green-600">Записано {savedCount} отведений: {savedLeads.filter(Boolean).map(l => l!.name).join(', ')}</p>
            </div>
            <button onClick={resetAll} className="text-sm text-gray-400 hover:text-gray-600">Начать заново</button>
          </div>
          <div className="p-6 space-y-4">

            {/* Выбор модели */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Выберите режим анализа:</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  {
                    id: 'fast',
                    icon: '⚡',
                    label: 'Быстрый',
                    desc: 'Gemini Flash',
                    sub: 'Скрининг, быстрый ответ',
                    color: 'yellow',
                  },
                  {
                    id: 'best',
                    icon: '⭐',
                    label: 'Лучший',
                    desc: 'Gemini Pro → GPT-5.4',
                    sub: 'Рекомендуется для ЭКГ',
                    color: 'indigo',
                  },
                  {
                    id: 'expert',
                    icon: '🧠',
                    label: 'Экспертный',
                    desc: 'Gemini Pro → Opus 4.6',
                    sub: 'Сложные и критические случаи',
                    color: 'purple',
                  },
                ] as { id: EcgAnalysisPreset; icon: string; label: string; desc: string; sub: string; color: string }[]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setAnalysisPreset(opt.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      analysisPreset === opt.id
                        ? opt.color === 'indigo' ? 'border-indigo-500 bg-indigo-50'
                          : opt.color === 'purple' ? 'border-purple-500 bg-purple-50'
                          : 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className={`font-bold text-sm ${
                      analysisPreset === opt.id
                        ? opt.color === 'indigo' ? 'text-indigo-700'
                          : opt.color === 'purple' ? 'text-purple-700'
                          : 'text-yellow-700'
                        : 'text-gray-700'
                    }`}>{opt.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={buildAndAnalyze}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-black rounded-2xl transition-all shadow-xl"
            >
              🧠 Получить заключение ИИ
            </button>
          </div>
        </div>
      )}

      {/* ШАГ 4: АНАЛИЗ */}
      {step === 'analyzing' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">🧠</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Анализирую ЭКГ...</h3>
          <p className="text-gray-500">
            {analysisPreset === 'fast'   && 'Gemini Flash обрабатывает и формирует заключение'}
            {analysisPreset === 'best'   && 'Gemini Pro извлекает данные → GPT-5.4 формирует заключение'}
            {analysisPreset === 'expert' && 'Gemini Pro извлекает данные → Claude Opus формирует заключение'}
          </p>
          <div className="mt-6 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* РЕЗУЛЬТАТ */}
      {step === 'done' && analysisResult && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">📋 Заключение ИИ</h3>
            <button onClick={resetAll} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold transition-all">
              🔄 Новая запись
            </button>
          </div>
          <AnalysisResult
            result={analysisResult}
            model={analysisModelUsed || 'openai/gpt-5.4'}
            mode={analysisPreset === 'fast' ? 'fast' : analysisPreset === 'expert' ? 'validated' : 'optimized'}
            images={[]}
          />
        </div>
      )}

    </div>
  )
}
