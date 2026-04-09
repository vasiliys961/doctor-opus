'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AnalysisResult from './AnalysisResult'

// Референсные значения для взрослых (упрощённые, по GOLD/ATS)
// Реальные нормы зависят от пола/роста/возраста — модель учтёт это в заключении
const SPIRO_PARAMS = [
  { key: 'FVC',       label: 'ФЖЕЛ (FVC)',      unit: 'л',    desc: 'Форсированная жизненная ёмкость лёгких' },
  { key: 'FEV1',      label: 'ОФВ1 (FEV1)',     unit: 'л',    desc: 'Объём форсированного выдоха за 1 сек' },
  { key: 'FEV1_FVC',  label: 'ОФВ1/ФЖЕЛ',       unit: '%',    desc: 'Индекс Тиффно' },
  { key: 'PEF',       label: 'ПСВ (PEF)',        unit: 'л/с',  desc: 'Пиковая скорость выдоха' },
  { key: 'FEF25_75',  label: 'СОС 25-75%',       unit: 'л/с',  desc: 'Средняя объёмная скорость' },
  { key: 'MVV',       label: 'МВЛ (MVV)',        unit: 'л/мин', desc: 'Максимальная вентиляция лёгких' },
  { key: 'FVC_pred',  label: 'ФЖЕЛ % от должного', unit: '%', desc: 'Процент от нормы' },
  { key: 'FEV1_pred', label: 'ОФВ1 % от должного', unit: '%', desc: 'Процент от нормы' },
]

interface SpiroValues { [key: string]: string }
interface FlowVolumePoint { volume: number; flow: number }

// Форматы данных от спирометров
// Формат 1: "FVC=4.21,FEV1=3.45,FEV1/FVC=82,PEF=8.3"
// Формат 2: "4.21,3.45,82,8.3,5.2,120,95,88" (по порядку)
// Формат 3: поток-объём "0.12,0.45\n0.23,1.2\n..." (два числа в строке)
function parseSpiroLine(line: string): Partial<SpiroValues> | FlowVolumePoint | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Формат key=value
  if (trimmed.includes('=')) {
    const result: SpiroValues = {}
    const pairs = trimmed.split(/[,;]/)
    for (const pair of pairs) {
      const [k, v] = pair.split('=')
      if (k && v) {
        const key = k.trim().toUpperCase().replace('/', '_').replace('%', '_pred')
        result[key] = v.trim()
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }

  // Два числа — кривая поток-объём
  const nums = trimmed.split(/[,;\t ]+/).map(Number).filter(n => !isNaN(n))
  if (nums.length === 2 && nums[0] >= 0 && nums[0] < 10 && Math.abs(nums[1]) < 20) {
    return { volume: nums[0], flow: nums[1] }
  }

  // Восемь чисел подряд — все показатели по порядку FVC,FEV1,ratio,PEF,FEF,MVV,FVC%,FEV1%
  if (nums.length >= 4) {
    const keys = ['FVC', 'FEV1', 'FEV1_FVC', 'PEF', 'FEF25_75', 'MVV', 'FVC_pred', 'FEV1_pred']
    const result: SpiroValues = {}
    nums.forEach((n, i) => { if (keys[i]) result[keys[i]] = String(n) })
    return result
  }

  return null
}

function MiniCanvas({ points, color = '#6366f1', height = 120 }: { points: FlowVolumePoint[]; color?: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el || points.length < 2) return
    const ctx = el.getContext('2d')!
    ctx.clearRect(0, 0, el.width, el.height)

    const vols = points.map(p => p.volume), flows = points.map(p => p.flow)
    const minV = Math.min(...vols), maxV = Math.max(...vols) || 1
    const minF = Math.min(...flows), maxF = Math.max(...flows) || 1

    // Сетка
    ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * el.width
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, el.height); ctx.stroke()
    }
    for (let i = 0; i <= 3; i++) {
      const y = (i / 3) * el.height
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(el.width, y); ctx.stroke()
    }

    // Кривая
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5
    points.forEach((p, i) => {
      const x = ((p.volume - minV) / (maxV - minV)) * el.width
      const y = el.height - ((p.flow - minF) / (maxF - minF)) * el.height * 0.85 - el.height * 0.075
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Подписи осей
    ctx.fillStyle = '#6b7280'; ctx.font = '10px Arial'
    ctx.textAlign = 'center'; ctx.fillText('Объём (л)', el.width / 2, el.height - 2)
    ctx.save(); ctx.translate(10, el.height / 2); ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'; ctx.fillText('Поток (л/с)', 0, 0); ctx.restore()
  }, [points, color])

  return <canvas ref={ref} width={400} height={height} className="w-full rounded-lg" />
}

export default function SpirometryDevice() {
  type Step = 'idle' | 'connecting' | 'detecting' | 'live' | 'manual' | 'ready' | 'analyzing' | 'done'
  const [step, setStep] = useState<Step>('idle')
  const [supported, setSupported] = useState(true)
  const [detectLog, setDetectLog] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // Данные
  const [spiroValues, setSpiroValues] = useState<SpiroValues>({})
  const [flowVolCurve, setFlowVolCurve] = useState<FlowVolumePoint[]>([])
  const [rawLines, setRawLines] = useState<string[]>([])

  // Ввод вручную
  const [manualValues, setManualValues] = useState<SpiroValues>({})

  // Пациент
  const [patientInfo, setPatientInfo] = useState({ age: '', sex: 'М', height: '', weight: '' })

  // Анализ
  const [analysisResult, setAnalysisResult] = useState('')

  const portRef = useRef<any>(null)
  const readerRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && !('serial' in navigator)) setSupported(false)
  }, [])

  const addLog = (msg: string) => setDetectLog(prev => [...prev, msg])

  const closePort = async () => {
    try { if (readerRef.current) await readerRef.current.cancel() } catch {}
    try { if (portRef.current) await portRef.current.close() } catch {}
    portRef.current = null
  }

  // Автоподключение и чтение
  const autoConnect = async () => {
    setStep('connecting')
    setDetectLog([])
    setErrorMsg('')
    setSpiroValues({})
    setFlowVolCurve([])
    setRawLines([])

    let p: any
    try {
      p = await (navigator as any).serial.requestPort()
      portRef.current = p
    } catch {
      setErrorMsg('Устройство не выбрано.')
      setStep('idle')
      return
    }

    setStep('detecting')
    addLog('Устройство выбрано. Определяю скорость...')

    const BAUDS = [9600, 19200, 38400, 115200]
    let bestBaud = 9600
    let bestLines: string[] = []

    for (const baud of BAUDS) {
      addLog(`Проверяю ${baud} baud...`)
      try {
        await p.open({ baudRate: baud })
        const td = new TextDecoderStream()
        p.readable.pipeTo(td.writable)
        const reader = td.readable.getReader()
        const lines: string[] = []
        const timer = setTimeout(async () => { try { await reader.cancel() } catch {} }, 1500)
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
        try { await p.close() } catch {}

        const valid = lines.filter(l => {
          const t = l.trim()
          return t.length > 0 && /[\d.,=]/.test(t)
        })
        addLog(`  → ${valid.length} строк с данными`)

        if (valid.length > bestLines.length) {
          bestLines = valid
          bestBaud = baud
        }
        if (valid.length > 5) break
      } catch { try { await p.close() } catch {} }
    }

    if (bestLines.length === 0) {
      addLog('⚠️ Данные не получены автоматически.')
      addLog('Введите показатели вручную.')
      setStep('manual')
      return
    }

    addLog(`✅ Скорость: ${bestBaud} baud. Получено ${bestLines.length} строк.`)
    setRawLines(bestLines)
    processLines(bestLines)

    // Продолжаем читать в live-режиме
    setStep('live')
    startLiveReading(p, bestBaud)
  }

  const startLiveReading = async (p: any, baud: number) => {
    try {
      if (!p.readable) await p.open({ baudRate: baud })
      const td = new TextDecoderStream()
      p.readable.pipeTo(td.writable)
      const reader = td.readable.getReader()
      readerRef.current = reader
      let buf = ''
      const allLines: string[] = []

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        const parts = buf.split('\n')
        buf = parts.pop() || ''
        for (const line of parts) {
          if (!line.trim()) continue
          allLines.push(line)
          setRawLines([...allLines])
          processLines(allLines)
        }
      }
    } catch {}
  }

  const processLines = (lines: string[]) => {
    const newValues: SpiroValues = {}
    const newCurve: FlowVolumePoint[] = []

    for (const line of lines) {
      const parsed = parseSpiroLine(line)
      if (!parsed) continue
      if ('volume' in parsed && 'flow' in parsed) {
        newCurve.push(parsed as FlowVolumePoint)
      } else {
        Object.assign(newValues, parsed)
      }
    }

    if (Object.keys(newValues).length > 0) setSpiroValues(prev => ({ ...prev, ...newValues }))
    if (newCurve.length > 0) setFlowVolCurve(newCurve)
    if (Object.keys(newValues).length > 0 || newCurve.length > 0) {
      closePort()
      setStep('ready')
    }
  }

  // Сохранить ручной ввод
  const saveManual = () => {
    const filled = Object.entries(manualValues).filter(([, v]) => v.trim() !== '')
    if (filled.length === 0) { setErrorMsg('Введите хотя бы один показатель.'); return }
    setSpiroValues(Object.fromEntries(filled))
    setStep('ready')
  }

  // Анализ
  const analyze = async () => {
    setStep('analyzing')
    setErrorMsg('')

    try {
      const values = { ...spiroValues, ...manualValues }

      // Строим PNG кривой если есть, или таблицу показателей
      let imageBase64: string | null = null

      if (flowVolCurve.length > 10) {
        const canvas = document.createElement('canvas')
        canvas.width = 700; canvas.height = 500
        const ctx = canvas.getContext('2d')!

        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#1e293b'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'
        ctx.fillText('Кривая поток-объём (Спирометрия)', canvas.width / 2, 28)

        // Сетка
        const PAD = 60
        const W = canvas.width - PAD * 2, H = canvas.height - PAD * 2 - 20
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1
        for (let i = 0; i <= 5; i++) {
          const x = PAD + (i / 5) * W
          ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, PAD + H); ctx.stroke()
          ctx.fillStyle = '#94a3b8'; ctx.font = '11px Arial'; ctx.textAlign = 'center'
          ctx.fillText(String((i / 5 * 6).toFixed(1)), x, PAD + H + 16)
        }
        for (let i = 0; i <= 5; i++) {
          const y = PAD + H - (i / 5) * H
          ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(PAD + W, y); ctx.stroke()
          ctx.fillStyle = '#94a3b8'; ctx.font = '11px Arial'; ctx.textAlign = 'right'
          ctx.fillText(String((i / 5 * 12).toFixed(0)), PAD - 6, y + 4)
        }

        // Оси
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(PAD, PAD); ctx.lineTo(PAD, PAD + H); ctx.lineTo(PAD + W, PAD + H); ctx.stroke()

        // Подписи осей
        ctx.fillStyle = '#475569'; ctx.font = '13px Arial'; ctx.textAlign = 'center'
        ctx.fillText('Объём (л)', PAD + W / 2, canvas.height - 8)
        ctx.save(); ctx.translate(16, PAD + H / 2); ctx.rotate(-Math.PI / 2)
        ctx.fillText('Поток (л/с)', 0, 0); ctx.restore()

        // Кривая
        const vols = flowVolCurve.map(p => p.volume), flows = flowVolCurve.map(p => p.flow)
        const minV = Math.min(...vols), maxV = Math.max(...vols) || 1
        const minF = Math.min(0, ...flows), maxF = Math.max(...flows) || 1

        ctx.beginPath(); ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 3
        flowVolCurve.forEach((p, i) => {
          const x = PAD + ((p.volume - minV) / (maxV - minV)) * W
          const y = PAD + H - ((p.flow - minF) / (maxF - minF)) * H * 0.9
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()

        // Показатели на графике
        const params = Object.entries(values).slice(0, 6)
        ctx.fillStyle = '#1e293b'; ctx.font = '12px Arial'; ctx.textAlign = 'left'
        params.forEach(([k, v], i) => {
          const param = SPIRO_PARAMS.find(p => p.key === k)
          if (param) ctx.fillText(`${param.label}: ${v} ${param.unit}`, PAD + W + 8, PAD + 20 + i * 22)
        })

        imageBase64 = canvas.toDataURL('image/png').split(',')[1]
      }

      // Формируем промпт
      const paramText = SPIRO_PARAMS
        .filter(p => values[p.key])
        .map(p => `${p.label} (${p.key}): ${values[p.key]} ${p.unit}`)
        .join('\n')

      const unknownParams = Object.entries(values)
        .filter(([k]) => !SPIRO_PARAMS.find(p => p.key === k))
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')

      const patientText = [
        patientInfo.age && `Возраст: ${patientInfo.age} лет`,
        `Пол: ${patientInfo.sex}`,
        patientInfo.height && `Рост: ${patientInfo.height} см`,
        patientInfo.weight && `Вес: ${patientInfo.weight} кг`,
      ].filter(Boolean).join(', ')

      const prompt = [
        'Выполните интерпретацию спирометрии по результатам исследования.',
        patientText ? `\nПациент: ${patientText}` : '',
        '\nПоказатели спирометрии:',
        paramText,
        unknownParams ? `\nДополнительные данные:\n${unknownParams}` : '',
        flowVolCurve.length > 0 ? '\nПредоставлена кривая поток-объём.' : '',
        '\nУкажите:',
        '1. Тип нарушения вентиляции (норма / обструктивный / рестриктивный / смешанный)',
        '2. Степень тяжести по критериям ATS/ERS и GOLD (если применимо)',
        '3. Индекс Тиффно и его клиническое значение',
        '4. Наличие признаков воздушной ловушки',
        '5. Рекомендации (бронходилатационный тест, КТ, консультация)',
        '6. Клиническое заключение',
      ].filter(Boolean).join('\n')

      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('mode', 'optimized')
      formData.append('model', 'openai/gpt-5.4')
      formData.append('isTextOnly', 'true')

      if (imageBase64) {
        const blob = await (await fetch(`data:image/png;base64,${imageBase64}`)).blob()
        formData.append('file', blob, 'spirometry.png')
        formData.append('imageType', 'spirometry')
        formData.append('isTextOnly', 'false')
      }

      const resp = await fetch('/api/analyze/spirometry', { method: 'POST', body: formData })
      const data = await resp.json()

      if (data.success) { setAnalysisResult(data.result); setStep('done') }
      else { setErrorMsg('Ошибка анализа: ' + data.error); setStep('ready') }
    } catch (e: any) {
      setErrorMsg('Ошибка: ' + e.message)
      setStep('ready')
    }
  }

  const reset = () => {
    setStep('idle'); setSpiroValues({}); setFlowVolCurve([])
    setManualValues({}); setAnalysisResult(''); setDetectLog([])
    setRawLines([]); setErrorMsg('')
  }

  if (!supported) return (
    <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center">
      <p className="text-yellow-700">Используйте <strong>Google Chrome</strong> или <strong>Edge</strong>.</p>
    </div>
  )

  const hasData = Object.keys(spiroValues).length > 0 || Object.keys(manualValues).filter(k => manualValues[k]).length > 0
  const displayValues = { ...spiroValues }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">

      {/* ГЛАВНЫЙ ЭКРАН */}
      {step === 'idle' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-violet-800 p-8 text-white text-center">
            <div className="text-6xl mb-4">🫁</div>
            <h2 className="text-3xl font-black mb-2">Спирометрия</h2>
            <p className="text-violet-200 text-lg">Анализ функции внешнего дыхания с ИИ-интерпретацией</p>
          </div>
          <div className="p-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={autoConnect}
                className="p-5 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg"
              >
                🔌 Подключить спирометр (USB)
              </button>
              <button
                onClick={() => setStep('manual')}
                className="p-5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black text-lg transition-all"
              >
                ✏️ Ввести показатели вручную
              </button>
            </div>
            <p className="text-xs text-center text-gray-400">
              Поддерживаются: Спиро-Спектр, MicroLab, Spirobank, BTL-08, Поли-Спектр-Спиро и другие с USB Serial
            </p>
            {errorMsg && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>}
          </div>
        </div>
      )}

      {/* АВТОДЕТЕКТ */}
      {(step === 'connecting' || step === 'detecting') && (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4 animate-pulse">🔍</div>
          <h3 className="text-xl font-bold mb-4">Подключение спирометра...</h3>
          <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm text-left space-y-1 max-h-40 overflow-y-auto">
            {detectLog.map((l, i) => (
              <div key={i} className={l.startsWith('✅') ? 'text-green-400' : l.startsWith('⚠️') ? 'text-yellow-400' : 'text-gray-300'}>{l}</div>
            ))}
            {detectLog.length === 0 && <div className="text-gray-500">Инициализация...</div>}
          </div>
        </div>
      )}

      {/* LIVE ЧТЕНИЕ */}
      {step === 'live' && (
        <div className="bg-white rounded-2xl shadow-lg border border-violet-200 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="font-bold text-green-700">Получаю данные со спирометра...</span>
          </div>
          <p className="text-sm text-gray-500">Выполните дыхательный манёвр на приборе</p>
          <div className="mt-3 text-xs text-gray-400">Получено строк: {rawLines.length}</div>
        </div>
      )}

      {/* РУЧНОЙ ВВОД */}
      {step === 'manual' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-violet-50 border-b border-violet-100 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-violet-800">✏️ Ввод показателей спирометрии</h3>
            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">Отмена</button>
          </div>
          <div className="p-6 space-y-4">
            {/* Данные пациента */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Данные пациента (для расчёта должных величин):</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { key: 'age', label: 'Возраст', placeholder: '45' },
                  { key: 'height', label: 'Рост (см)', placeholder: '170' },
                  { key: 'weight', label: 'Вес (кг)', placeholder: '75' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                    <input
                      type="number"
                      placeholder={f.placeholder}
                      value={(patientInfo as any)[f.key]}
                      onChange={e => setPatientInfo(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Пол</label>
                  <select
                    value={patientInfo.sex}
                    onChange={e => setPatientInfo(prev => ({ ...prev, sex: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="М">Мужской</option>
                    <option value="Ж">Женский</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Показатели */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Показатели (введите доступные):</p>
              <div className="grid grid-cols-2 gap-3">
                {SPIRO_PARAMS.map(param => (
                  <div key={param.key} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-0.5">{param.label}</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="—"
                          value={manualValues[param.key] || ''}
                          onChange={e => setManualValues(prev => ({ ...prev, [param.key]: e.target.value }))}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <span className="text-xs text-gray-400 self-center w-10 shrink-0">{param.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>}

            <button
              onClick={saveManual}
              className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-black text-lg rounded-xl transition-all shadow-lg"
            >
              Сохранить и продолжить →
            </button>
          </div>
        </div>
      )}

      {/* ДАННЫЕ ГОТОВЫ */}
      {step === 'ready' && (
        <div className="bg-white rounded-2xl shadow-lg border border-violet-200 overflow-hidden">
          <div className="bg-violet-50 border-b border-violet-100 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-violet-800">✅ Данные получены</h3>
            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">Начать заново</button>
          </div>
          <div className="p-6 space-y-4">

            {/* Кривая поток-объём */}
            {flowVolCurve.length > 10 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Кривая поток-объём:</p>
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  <MiniCanvas points={flowVolCurve} height={180} />
                </div>
              </div>
            )}

            {/* Таблица показателей */}
            {Object.keys(displayValues).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Показатели:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SPIRO_PARAMS.filter(p => displayValues[p.key]).map(param => (
                    <div key={param.key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="text-xs text-gray-500">{param.label}</div>
                      <div className="text-xl font-black text-gray-900">
                        {displayValues[param.key]}
                        <span className="text-xs font-normal text-gray-400 ml-1">{param.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorMsg && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>}

            <button
              onClick={analyze}
              className="w-full py-5 bg-violet-600 hover:bg-violet-700 text-white text-xl font-black rounded-2xl transition-all shadow-xl"
            >
              🧠 Получить второе мнение ИИ
            </button>
          </div>
        </div>
      )}

      {/* АНАЛИЗ */}
      {step === 'analyzing' && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-5xl mb-4">🧠</div>
          <h3 className="text-xl font-bold mb-2">Анализирую спирометрию...</h3>
          <p className="text-gray-500">GPT-5.4 интерпретирует по критериям ATS/ERS и GOLD</p>
          <div className="mt-6 flex justify-center">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* РЕЗУЛЬТАТ */}
      {step === 'done' && analysisResult && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">📋 Аналитический разбор по спирометрии</h3>
            <button onClick={reset} className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-sm font-bold">
              🔄 Новое исследование
            </button>
          </div>
          <AnalysisResult result={analysisResult} model="openai/gpt-5.4" mode="optimized" images={[]} />
        </div>
      )}

    </div>
  )
}
