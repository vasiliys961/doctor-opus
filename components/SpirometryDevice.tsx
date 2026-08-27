'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AnalysisResult from './AnalysisResult'
import { getClientLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'
import { getSpirometryMessages } from '@/lib/i18n/spirometry'
import type { DeviceStatus } from '@/lib/device-hub'

const SPIRO_PARAMS = [
  { key: 'FVC', label: 'FVC', unit: 'L' },
  { key: 'FEV1', label: 'FEV1', unit: 'L' },
  { key: 'FEV1_FVC', label: 'FEV1/FVC', unit: '%' },
  { key: 'PEF', label: 'PEF', unit: 'L/s' },
  { key: 'FEF25_75', label: 'FEF 25-75%', unit: 'L/s' },
  { key: 'MVV', label: 'MVV', unit: 'L/min' },
  { key: 'FVC_pred', label: 'FVC % predicted', unit: '%' },
  { key: 'FEV1_pred', label: 'FEV1 % predicted', unit: '%' },
] as const

type SpiroValues = Record<string, string>
type FlowVolumePoint = { volume: number; flow: number }
type Step = 'idle' | 'connecting' | 'detecting' | 'live' | 'manual' | 'ready' | 'analyzing' | 'done'

interface SpirometryDeviceProps {
  onStatusChange?: (status: DeviceStatus) => void
}

function parseSpiroLine(line: string): Partial<SpiroValues> | FlowVolumePoint | null {
  const trimmed = line.trim()
  if (!trimmed) return null

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

  const nums = trimmed.split(/[,;\t ]+/).map(Number).filter((n) => !Number.isNaN(n))
  if (nums.length === 2 && nums[0] >= 0 && nums[0] < 10 && Math.abs(nums[1]) < 20) {
    return { volume: nums[0], flow: nums[1] }
  }

  if (nums.length >= 4) {
    const keys = ['FVC', 'FEV1', 'FEV1_FVC', 'PEF', 'FEF25_75', 'MVV', 'FVC_pred', 'FEV1_pred']
    const result: SpiroValues = {}
    nums.forEach((n, i) => {
      if (keys[i]) result[keys[i]] = String(n)
    })
    return result
  }

  return null
}

function MiniCanvas({ points }: { points: FlowVolumePoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || points.length < 2) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, el.width, el.height)
    const vols = points.map((p) => p.volume)
    const flows = points.map((p) => p.flow)
    const minV = Math.min(...vols)
    const maxV = Math.max(...vols) || 1
    const minF = Math.min(...flows)
    const maxF = Math.max(...flows) || 1

    ctx.strokeStyle = '#e0e7ff'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i += 1) {
      const x = (i / 4) * el.width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, el.height)
      ctx.stroke()
    }
    for (let i = 0; i <= 3; i += 1) {
      const y = (i / 3) * el.height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(el.width, y)
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2.5
    points.forEach((p, i) => {
      const x = ((p.volume - minV) / (maxV - minV || 1)) * el.width
      const y = el.height - ((p.flow - minF) / (maxF - minF || 1)) * el.height * 0.85 - el.height * 0.075
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [points])

  return <canvas ref={ref} width={400} height={180} className="w-full rounded-lg" />
}

export default function SpirometryDevice({ onStatusChange }: SpirometryDeviceProps) {
  const [locale, setLocale] = useState<Locale>('en')
  const t = useMemo(() => getSpirometryMessages(locale), [locale])

  const [step, setStep] = useState<Step>('idle')
  const [supported, setSupported] = useState(true)
  const [detectLog, setDetectLog] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [spiroValues, setSpiroValues] = useState<SpiroValues>({})
  const [flowVolCurve, setFlowVolCurve] = useState<FlowVolumePoint[]>([])
  const [rawLines, setRawLines] = useState<string[]>([])
  const [manualValues, setManualValues] = useState<SpiroValues>({})
  const [patientInfo, setPatientInfo] = useState({ age: '', sex: 'Male', height: '', weight: '' })
  const [analysisResult, setAnalysisResult] = useState('')

  const portRef = useRef<any>(null)
  const readerRef = useRef<any>(null)

  useEffect(() => {
    setLocale(getClientLocale())
    if (typeof window !== 'undefined' && !('serial' in navigator)) {
      setSupported(false)
      onStatusChange?.('error')
      return
    }
    onStatusChange?.('idle')
  }, [onStatusChange])

  const addLog = (msg: string) => setDetectLog((prev) => [...prev, msg])

  const closePort = async () => {
    try {
      if (readerRef.current) await readerRef.current.cancel()
    } catch {}
    try {
      if (portRef.current) await portRef.current.close()
    } catch {}
    portRef.current = null
  }

  const processLines = (lines: string[]) => {
    const newValues: SpiroValues = {}
    const newCurve: FlowVolumePoint[] = []

    for (const line of lines) {
      const parsed = parseSpiroLine(line)
      if (!parsed) continue
      if ('volume' in parsed && 'flow' in parsed) newCurve.push(parsed as FlowVolumePoint)
      else Object.assign(newValues, parsed)
    }

    if (Object.keys(newValues).length > 0) setSpiroValues((prev) => ({ ...prev, ...newValues }))
    if (newCurve.length > 0) setFlowVolCurve(newCurve)
    if (Object.keys(newValues).length > 0 || newCurve.length > 0) {
      void closePort()
      setStep('ready')
    }
  }

  const startLiveReading = async (p: any, baud: number) => {
    try {
      if (!p.readable) await p.open({ baudRate: baud })
      const td = new TextDecoderStream()
      void p.readable.pipeTo(td.writable)
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

  const autoConnect = async () => {
    onStatusChange?.('connected')
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
      setErrorMsg(t.deviceNotSelected)
      setStep('idle')
      return
    }

    setStep('detecting')
    addLog(t.autoDetecting)

    const BAUDS = [9600, 19200, 38400, 115200]
    let bestBaud = 9600
    let bestLines: string[] = []

    for (const baud of BAUDS) {
      addLog(`${t.checkingBaudRate} ${baud} baud...`)
      try {
        await p.open({ baudRate: baud })
        const td = new TextDecoderStream()
        void p.readable.pipeTo(td.writable)
        const reader = td.readable.getReader()
        const lines: string[] = []
        const timer = setTimeout(async () => {
          try {
            await reader.cancel()
          } catch {}
        }, 1500)
        let buf = ''
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buf += value
            const parts = buf.split('\n')
            buf = parts.pop() || ''
            lines.push(...parts.filter((l) => l.trim()))
          }
        } catch {}
        clearTimeout(timer)
        try {
          await p.close()
        } catch {}

        const valid = lines.filter((l) => l.length > 0 && /[\d.,=]/.test(l))
        if (valid.length > bestLines.length) {
          bestLines = valid
          bestBaud = baud
        }
        if (valid.length > 5) break
      } catch {
        try {
          await p.close()
        } catch {}
      }
    }

    if (bestLines.length === 0) {
      addLog(t.noDataDetected)
      addLog(t.enterDataManually)
      setStep('manual')
      return
    }

    addLog(`${t.detectedBaudRate}: ${bestBaud} baud (${bestLines.length})`)
    setRawLines(bestLines)
    processLines(bestLines)
    setStep('live')
    onStatusChange?.('streaming')
    void startLiveReading(p, bestBaud)
  }

  const saveManual = () => {
    const filled = Object.entries(manualValues).filter(([, v]) => v.trim() !== '')
    if (filled.length === 0) {
      setErrorMsg(t.provideAtLeastOneMetric)
      return
    }
    setSpiroValues(Object.fromEntries(filled))
    setStep('ready')
  }

  const analyze = async () => {
    onStatusChange?.('streaming')
    setStep('analyzing')
    setErrorMsg('')

    try {
      const values = { ...spiroValues, ...manualValues }
      const paramText = SPIRO_PARAMS.filter((p) => values[p.key]).map((p) => `${p.label}: ${values[p.key]} ${p.unit}`).join('\n')
      const patientText = [
        patientInfo.age && `${t.age}: ${patientInfo.age}`,
        `${t.sex}: ${patientInfo.sex}`,
        patientInfo.height && `${t.heightCm}: ${patientInfo.height}`,
        patientInfo.weight && `${t.weightKg}: ${patientInfo.weight}`,
      ].filter(Boolean).join(', ')

      const prompt = [
        'Interpret spirometry findings from the provided metrics.',
        patientText ? `Patient: ${patientText}` : '',
        'Metrics:',
        paramText,
        flowVolCurve.length > 0 ? 'Flow-volume curve is also provided.' : '',
        'Include: ventilatory pattern type, severity, Tiffeneau index interpretation, suspected air trapping, and practical follow-up recommendations.',
      ].filter(Boolean).join('\n\n')

      const formData = new FormData()
      formData.append('prompt', prompt)
      formData.append('isTextOnly', 'true')

      if (flowVolCurve.length > 10) {
        const canvas = document.createElement('canvas')
        canvas.width = 700
        canvas.height = 500
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#f8fafc'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          const pad = 60
          const w = canvas.width - pad * 2
          const h = canvas.height - pad * 2

          const vols = flowVolCurve.map((p) => p.volume)
          const flows = flowVolCurve.map((p) => p.flow)
          const minV = Math.min(...vols)
          const maxV = Math.max(...vols) || 1
          const minF = Math.min(0, ...flows)
          const maxF = Math.max(...flows) || 1

          ctx.beginPath()
          ctx.strokeStyle = '#6366f1'
          ctx.lineWidth = 3
          flowVolCurve.forEach((p, i) => {
            const x = pad + ((p.volume - minV) / (maxV - minV || 1)) * w
            const y = pad + h - ((p.flow - minF) / (maxF - minF || 1)) * h * 0.9
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.stroke()
        }
        const blob = await (await fetch(canvas.toDataURL('image/png'))).blob()
        formData.append('file', blob, 'spirometry.png')
        formData.append('isTextOnly', 'false')
      }

      const resp = await fetch('/api/analyze/spirometry', { method: 'POST', body: formData })
      const data = await resp.json()

      if (data.success) {
        setAnalysisResult(data.result)
        setStep('done')
        onStatusChange?.('connected')
      } else {
        setErrorMsg(`${t.analysisError}: ${data.error}`)
        setStep('ready')
        onStatusChange?.('error')
      }
    } catch (e: any) {
      setErrorMsg(`${t.genericError}: ${e.message}`)
      setStep('ready')
      onStatusChange?.('error')
    }
  }

  const reset = () => {
    setStep('idle')
    setSpiroValues({})
    setFlowVolCurve([])
    setManualValues({})
    setAnalysisResult('')
    setDetectLog([])
    setRawLines([])
    setErrorMsg('')
    onStatusChange?.('idle')
  }

  if (!supported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center">
        <p className="text-yellow-700">{t.browserNotSupported}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {step === 'idle' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-violet-800 p-8 text-white text-center">
            <div className="text-6xl mb-4">🫁</div>
            <h2 className="text-3xl font-black mb-2">{t.title}</h2>
            <p className="text-violet-200 text-lg">{t.subtitle}</p>
          </div>
          <div className="p-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={autoConnect}
                className="p-5 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg"
              >
                {t.connectDevice}
              </button>
              <button
                onClick={() => setStep('manual')}
                className="p-5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black text-lg transition-all"
              >
                {t.manualEntry}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400">{t.supportedDevices}</p>
            {errorMsg && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{errorMsg}</div>}
          </div>
        </div>
      )}

      {(step === 'connecting' || step === 'detecting') && (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4 animate-pulse">🔍</div>
          <h3 className="text-xl font-bold mb-4">{t.autoDetecting}</h3>
          <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm text-left space-y-1 max-h-40 overflow-y-auto">
            {detectLog.map((line, i) => (
              <div key={`${line}-${i}`} className={line.startsWith('No') ? 'text-yellow-400' : 'text-gray-300'}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'live' && (
        <div className="bg-white rounded-2xl shadow-lg border border-violet-200 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="font-bold text-green-700">{t.receivingData}</span>
          </div>
          <p className="text-sm text-gray-500">{t.performManeuver}</p>
          <div className="mt-3 text-xs text-gray-400">{t.rowsReceived}: {rawLines.length}</div>
        </div>
      )}

      {step === 'manual' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-violet-50 border-b border-violet-100 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-violet-800">{t.manualEntry}</h3>
            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">{t.cancel}</button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">{t.patientData}</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[{ key: 'age', label: t.age }, { key: 'height', label: t.heightCm }, { key: 'weight', label: t.weightKg }].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                    <input
                      type="number"
                      value={(patientInfo as any)[f.key]}
                      onChange={(e) => setPatientInfo((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t.sex}</label>
                  <select
                    value={patientInfo.sex}
                    onChange={(e) => setPatientInfo((prev) => ({ ...prev, sex: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="Male">{t.male}</option>
                    <option value="Female">{t.female}</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">{t.metrics}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SPIRO_PARAMS.map((param) => (
                  <div key={param.key} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-0.5">{param.label}</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="-"
                          value={manualValues[param.key] || ''}
                          onChange={(e) => setManualValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <span className="text-xs text-gray-400 self-center w-12 shrink-0">{param.unit}</span>
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
              {t.saveAndContinue}
            </button>
          </div>
        </div>
      )}

      {step === 'ready' && (
        <div className="bg-white rounded-2xl shadow-lg border border-violet-200 overflow-hidden">
          <div className="bg-violet-50 border-b border-violet-100 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-violet-800">{t.dataReceived}</h3>
            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">{t.startOver}</button>
          </div>
          <div className="p-6 space-y-4">
            {flowVolCurve.length > 10 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">{t.flowVolumeCurve}</p>
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  <MiniCanvas points={flowVolCurve} />
                </div>
              </div>
            )}

            {Object.keys(spiroValues).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">{t.metrics}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SPIRO_PARAMS.filter((p) => spiroValues[p.key]).map((param) => (
                    <div key={param.key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="text-xs text-gray-500">{param.label}</div>
                      <div className="text-xl font-black text-gray-900">
                        {spiroValues[param.key]}
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
              🧠 {t.runAnalysis}
            </button>
          </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-5xl mb-4">🧠</div>
          <h3 className="text-xl font-bold mb-2">{t.analyzing}</h3>
          <p className="text-gray-500">{t.analyzingSubtitle}</p>
          <div className="mt-6 flex justify-center">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        </div>
      )}

      {step === 'done' && analysisResult && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">📋 {t.interpretationTitle}</h3>
            <button onClick={reset} className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-sm font-bold">
              🔄 {t.newStudy}
            </button>
          </div>
          <AnalysisResult result={analysisResult} model="openai/gpt-5.6-terra" mode="optimized" images={[]} />
        </div>
      )}
    </div>
  )
}
