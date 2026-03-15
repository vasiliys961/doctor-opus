'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import AnalysisResult from './AnalysisResult'

// ─── Типы ───────────────────────────────────────────────────────────────────

interface GlucosePoint {
  timestamp: Date
  glucose: number   // ммоль/л
  mealTag?: string  // еда / инсулин / событие
}

interface GlucoseStats {
  avg: number
  min: number
  max: number
  cv: number          // коэф. вариации %
  tir: number         // Time In Range 3.9-10 %
  tar: number         // Time Above Range >10 %
  tbr: number         // Time Below Range <3.9 %
  gmi: number         // Glucose Management Indicator (≈HbA1c)
  hypoCount: number   // эпизоды <3.9
  hyperCount: number  // эпизоды >10
  nightAvg: number    // средняя ночью 00-06
  dayAvg: number      // средняя днём 06-24
}

// ─── Парсер CSV ──────────────────────────────────────────────────────────────

// Поддерживаем форматы:
// FreeStyle Libre: "Device Timestamp","Record Type","Historic Glucose mmol/L"
// Dexcom:          "Timestamp (YYYY-MM-DDThh:mm:ss)","Glucose Value (mmol/L)"
// Континента/RU:   дата;время;глюкоза (простой формат)

function parseGlucoseCSV(text: string): GlucosePoint[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const points: GlucosePoint[] = []

  // Определяем разделитель
  const sep = lines[0]?.includes(';') ? ';' : ','

  // Ищем строку-заголовок
  let headerIdx = -1
  let tsCol = -1, glCol = -1, tagCol = -1

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = lines[i].toLowerCase().split(sep).map(c => c.replace(/"/g, '').trim())
    const tsIdx = cols.findIndex(c =>
      c.includes('timestamp') || c.includes('time') || c.includes('дата') || c.includes('date')
    )
    const glIdx = cols.findIndex(c =>
      c.includes('glucose') || c.includes('глюкоза') || c.includes('historic') || c.includes('mmol') || c.includes('ммоль')
    )
    if (tsIdx !== -1 && glIdx !== -1) {
      headerIdx = i; tsCol = tsIdx; glCol = glIdx
      tagCol = cols.findIndex(c => c.includes('type') || c.includes('record') || c.includes('тип') || c.includes('event') || c.includes('note'))
      break
    }
  }

  // Если заголовок не найден — пробуем позиционный разбор
  const startIdx = headerIdx === -1 ? 0 : headerIdx + 1

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(sep).map(c => c.replace(/"/g, '').trim())

    // Если заголовок не нашли — пробуем угадать
    const effectiveTsCol = tsCol !== -1 ? tsCol : 0
    const effectiveGlCol = glCol !== -1 ? glCol : (cols.length >= 3 ? 2 : 1)

    const rawTs = cols[effectiveTsCol] || ''
    const rawGl = cols[effectiveGlCol] || ''
    const rawTag = tagCol !== -1 ? cols[tagCol] : ''

    // Парсим дату
    let ts: Date | null = null
    try {
      // Форматы: "2024-01-15 08:00", "15.01.2024 08:00", ISO 8601
      const normalized = rawTs
        .replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1')
        .replace(' ', 'T')
      ts = new Date(normalized)
      if (isNaN(ts.getTime())) ts = null
    } catch {}

    if (!ts) continue

    // Парсим глюкозу
    const gl = parseFloat(rawGl.replace(',', '.'))
    if (isNaN(gl) || gl < 0.5 || gl > 35) continue

    // Конвертируем мг/дл → ммоль/л если нужно
    const glucose = gl > 35 ? parseFloat((gl / 18.02).toFixed(1)) : gl

    points.push({ timestamp: ts, glucose, mealTag: rawTag || undefined })
  }

  return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

// ─── Расчёт статистики ───────────────────────────────────────────────────────

function calcStats(points: GlucosePoint[]): GlucoseStats {
  if (points.length === 0) return {} as GlucoseStats

  const values = points.map(p => p.glucose)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)

  const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length
  const sd = Math.sqrt(variance)
  const cv = (sd / avg) * 100

  const tir = (values.filter(v => v >= 3.9 && v <= 10).length / values.length) * 100
  const tar = (values.filter(v => v > 10).length / values.length) * 100
  const tbr = (values.filter(v => v < 3.9).length / values.length) * 100
  const gmi = 3.31 + 0.02392 * (avg * 18.02) // формула GMI

  // Подсчёт эпизодов (минимум 15 мин)
  let hypoCount = 0, hyperCount = 0
  let inHypo = false, inHyper = false
  for (const v of values) {
    if (v < 3.9) { if (!inHypo) { hypoCount++; inHypo = true } } else { inHypo = false }
    if (v > 10)  { if (!inHyper) { hyperCount++; inHyper = true } } else { inHyper = false }
  }

  const night = points.filter(p => { const h = p.timestamp.getHours(); return h >= 0 && h < 6 })
  const day   = points.filter(p => { const h = p.timestamp.getHours(); return h >= 6 })
  const nightAvg = night.length ? night.reduce((a, b) => a + b.glucose, 0) / night.length : 0
  const dayAvg   = day.length   ? day.reduce((a, b) => a + b.glucose, 0) / day.length : 0

  return {
    avg: +avg.toFixed(1), min: +min.toFixed(1), max: +max.toFixed(1),
    cv: +cv.toFixed(1), tir: +tir.toFixed(1), tar: +tar.toFixed(1), tbr: +tbr.toFixed(1),
    gmi: +gmi.toFixed(1), hypoCount, hyperCount,
    nightAvg: +nightAvg.toFixed(1), dayAvg: +dayAvg.toFixed(1),
  }
}

// ─── Построение AGP-изображения ──────────────────────────────────────────────

function buildAGPCanvas(points: GlucosePoint[]): HTMLCanvasElement {
  const W = 900, H = 420, PAD = { top: 50, right: 30, bottom: 50, left: 55 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Фон
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, H)

  // Заголовок
  ctx.fillStyle = '#1e293b'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'
  ctx.fillText('Амбулаторный профиль гликемии (AGP)', W / 2, 28)

  const stats = calcStats(points)
  ctx.fillStyle = '#64748b'; ctx.font = '11px Arial'
  ctx.fillText(
    `Данных: ${points.length} · Период: ${points[0]?.timestamp.toLocaleDateString('ru-RU')} – ${points[points.length-1]?.timestamp.toLocaleDateString('ru-RU')} · Ср: ${stats.avg} ммоль/л · GMI: ${stats.gmi}%`,
    W / 2, 44
  )

  // Зоны
  const yScale = (v: number) => PAD.top + plotH - ((v - 2) / 16) * plotH
  const timeToX = (date: Date) => {
    const minutes = date.getHours() * 60 + date.getMinutes()
    return PAD.left + (minutes / 1440) * plotW
  }

  // Зона гипогликемии (< 3.9) — красная
  ctx.fillStyle = 'rgba(254,226,226,0.7)'
  ctx.fillRect(PAD.left, yScale(3.9), plotW, yScale(2) - yScale(3.9))

  // Целевой диапазон (3.9–10) — зелёная
  ctx.fillStyle = 'rgba(220,252,231,0.6)'
  ctx.fillRect(PAD.left, yScale(10), plotW, yScale(3.9) - yScale(10))

  // Зона гипергликемии (> 10) — желтая
  ctx.fillStyle = 'rgba(254,249,195,0.6)'
  ctx.fillRect(PAD.left, PAD.top, plotW, yScale(10) - PAD.top)

  // Сетка
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5
  for (let v = 2; v <= 18; v += 2) {
    const y = yScale(v)
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke()
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px Arial'; ctx.textAlign = 'right'
    ctx.fillText(`${v}`, PAD.left - 5, y + 4)
  }
  for (let h = 0; h <= 24; h += 3) {
    const x = PAD.left + (h / 24) * plotW
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + plotH); ctx.stroke()
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px Arial'; ctx.textAlign = 'center'
    ctx.fillText(`${String(h).padStart(2, '0')}:00`, x, PAD.top + plotH + 14)
  }

  // Оси
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + plotH); ctx.lineTo(PAD.left + plotW, PAD.top + plotH); ctx.stroke()

  // Подписи осей
  ctx.fillStyle = '#475569'; ctx.font = '11px Arial'; ctx.textAlign = 'center'
  ctx.fillText('Время суток', PAD.left + plotW / 2, H - 8)
  ctx.save(); ctx.translate(14, PAD.top + plotH / 2); ctx.rotate(-Math.PI / 2)
  ctx.fillText('Глюкоза (ммоль/л)', 0, 0); ctx.restore()

  // Линии целевых значений
  const drawHLine = (v: number, color: string, label: string) => {
    const y = yScale(v)
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3])
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = color; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'left'
    ctx.fillText(label, PAD.left + 4, y - 3)
  }
  drawHLine(10, '#f59e0b', '10 ммоль/л')
  drawHLine(3.9, '#ef4444', '3.9 ммоль/л')

  // Группируем точки по часу и рисуем персентили
  const byMinute: Record<number, number[]> = {}
  for (const p of points) {
    const min = Math.round((p.timestamp.getHours() * 60 + p.timestamp.getMinutes()) / 5) * 5
    if (!byMinute[min]) byMinute[min] = []
    byMinute[min].push(p.glucose)
  }

  const percentile = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = (p / 100) * (sorted.length - 1)
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }

  const mins = Object.keys(byMinute).map(Number).sort((a, b) => a - b)

  // Диапазон 10-90%
  ctx.fillStyle = 'rgba(99,102,241,0.15)'
  ctx.beginPath()
  mins.forEach((m, i) => {
    const x = PAD.left + (m / 1440) * plotW
    const y = yScale(percentile(byMinute[m], 90))
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ;[...mins].reverse().forEach(m => {
    const x = PAD.left + (m / 1440) * plotW
    const y = yScale(percentile(byMinute[m], 10))
    ctx.lineTo(x, y)
  })
  ctx.closePath(); ctx.fill()

  // Диапазон 25-75%
  ctx.fillStyle = 'rgba(99,102,241,0.25)'
  ctx.beginPath()
  mins.forEach((m, i) => {
    const x = PAD.left + (m / 1440) * plotW
    const y = yScale(percentile(byMinute[m], 75))
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ;[...mins].reverse().forEach(m => {
    const x = PAD.left + (m / 1440) * plotW
    const y = yScale(percentile(byMinute[m], 25))
    ctx.lineTo(x, y)
  })
  ctx.closePath(); ctx.fill()

  // Медиана
  ctx.beginPath(); ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2.5; ctx.setLineDash([])
  mins.forEach((m, i) => {
    const x = PAD.left + (m / 1440) * plotW
    const y = yScale(percentile(byMinute[m], 50))
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()

  // Легенда
  const legend = [
    { color: 'rgba(99,102,241,0.15)', label: '10–90%' },
    { color: 'rgba(99,102,241,0.35)', label: '25–75%' },
    { color: '#4f46e5', label: 'Медиана (50%)' },
  ]
  legend.forEach((l, i) => {
    const x = PAD.left + plotW - 180 + i * 0
    ctx.fillStyle = l.color; ctx.fillRect(PAD.left + 8, PAD.top + 8 + i * 16, 14, 10)
    ctx.fillStyle = '#475569'; ctx.font = '10px Arial'; ctx.textAlign = 'left'
    ctx.fillText(l.label, PAD.left + 26, PAD.top + 17 + i * 16)
  })

  return canvas
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function GlucoseProfile() {
  const [points, setPoints] = useState<GlucosePoint[]>([])
  const [stats, setStats] = useState<GlucoseStats | null>(null)
  const [agpDataUrl, setAgpDataUrl] = useState<string>('')
  const [patientInfo, setPatientInfo] = useState({ age: '', sex: 'М', diabetesType: '2', hba1c: '' })
  const [analysisResult, setAnalysisResult] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [daysCount, setDaysCount] = useState(0)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  const handleFile = useCallback((file: File) => {
    setError(''); setAnalysisResult(''); setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      try {
        const parsed = parseGlucoseCSV(text)
        if (parsed.length < 10) {
          setError('Не удалось распознать данные. Убедитесь что файл из FreeStyle Libre, Dexcom или совместимого глюкометра.')
          return
        }
        setPoints(parsed)
        const s = calcStats(parsed)
        setStats(s)

        // Количество дней
        const ms = parsed[parsed.length - 1].timestamp.getTime() - parsed[0].timestamp.getTime()
        setDaysCount(Math.round(ms / 86400000) + 1)

        // Строим AGP
        const agpCanvas = buildAGPCanvas(parsed)
        setAgpDataUrl(agpCanvas.toDataURL('image/png'))
      } catch (err: any) {
        setError('Ошибка парсинга: ' + err.message)
      }
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const analyze = async () => {
    if (!stats || points.length === 0) return
    setIsAnalyzing(true); setError('')

    try {
      const formData = new FormData()

      // Отправляем AGP-изображение
      if (agpDataUrl) {
        const blob = await (await fetch(agpDataUrl)).blob()
        formData.append('file', blob, 'agp.png')
      }

      formData.append('stats', JSON.stringify(stats))
      formData.append('daysCount', String(daysCount))
      formData.append('pointsCount', String(points.length))
      formData.append('patientInfo', JSON.stringify(patientInfo))

      // Добавляем суточные паттерны (по часам)
      const hourlyAvg: Record<number, number[]> = {}
      points.forEach(p => {
        const h = p.timestamp.getHours()
        if (!hourlyAvg[h]) hourlyAvg[h] = []
        hourlyAvg[h].push(p.glucose)
      })
      const hourlyStats = Object.entries(hourlyAvg).map(([h, vals]) => ({
        hour: Number(h),
        avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
        min: +Math.min(...vals).toFixed(1),
        max: +Math.max(...vals).toFixed(1),
      })).sort((a, b) => a.hour - b.hour)
      formData.append('hourlyStats', JSON.stringify(hourlyStats))

      const resp = await fetch('/api/analyze/glucose', { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.success) setAnalysisResult(data.result)
      else setError('Ошибка анализа: ' + data.error)
    } catch (e: any) {
      setError('Ошибка: ' + e.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const reset = () => {
    setPoints([]); setStats(null); setAgpDataUrl('')
    setAnalysisResult(''); setError(''); setFileName(''); setDaysCount(0)
  }

  // TIR цвет
  const tirColor = (tir: number) => tir >= 70 ? 'text-green-600' : tir >= 50 ? 'text-yellow-600' : 'text-red-600'
  const tirBg    = (tir: number) => tir >= 70 ? 'bg-green-50 border-green-200' : tir >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ЗАГРУЗКА ФАЙЛА */}
      {points.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-white text-center">
            <div className="text-6xl mb-3">🩸</div>
            <h2 className="text-3xl font-black mb-2">Глюкозный профиль</h2>
            <p className="text-emerald-100 text-lg">Анализ данных непрерывного мониторинга глюкозы</p>
          </div>
          <div className="p-8">
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 hover:border-emerald-400 rounded-2xl p-12 text-center transition-all cursor-pointer group"
              onClick={() => document.getElementById('glucose-file-input')?.click()}
            >
              <input
                id="glucose-file-input"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
              />
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📂</div>
              <p className="text-lg font-bold text-gray-700 mb-2">Перетащите CSV-файл или нажмите для выбора</p>
              <p className="text-sm text-gray-400">FreeStyle Libre, Dexcom, Contour, Accu-Chek и другие</p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
              {[
                { icon: '📱', name: 'FreeStyle Libre', hint: 'LibreView → Экспорт → CSV' },
                { icon: '📡', name: 'Dexcom Clarity', hint: 'Clarity → Отчёты → Экспорт' },
                { icon: '📊', name: 'Другие CGM', hint: 'Любой CSV с датой и глюкозой' },
              ].map(d => (
                <div key={d.name} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="text-2xl mb-1">{d.icon}</div>
                  <div className="font-bold text-gray-700">{d.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{d.hint}</div>
                </div>
              ))}
            </div>

            {error && <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
          </div>
        </div>
      )}

      {/* ДАННЫЕ ЗАГРУЖЕНЫ */}
      {points.length > 0 && stats && (
        <>
          {/* Шапка */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-800">📂 {fileName}</h3>
              <p className="text-sm text-gray-500">{points.length} измерений · {daysCount} дней · {points[0].timestamp.toLocaleDateString('ru-RU')} – {points[points.length-1].timestamp.toLocaleDateString('ru-RU')}</p>
            </div>
            <button onClick={reset} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold text-gray-600 transition-all">
              ✕ Загрузить другой файл
            </button>
          </div>

          {/* Ключевые метрики */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Среднее', value: `${stats.avg}`, unit: 'ммоль/л', color: 'blue' },
              { label: 'GMI (≈HbA1c)', value: `${stats.gmi}`, unit: '%', color: stats.gmi < 7 ? 'green' : stats.gmi < 8 ? 'yellow' : 'red' },
              { label: 'Вариабельность (CV)', value: `${stats.cv}`, unit: '%', color: stats.cv < 36 ? 'green' : 'yellow' },
              { label: 'Мин / Макс', value: `${stats.min} / ${stats.max}`, unit: 'ммоль/л', color: 'gray' },
            ].map(m => (
              <div key={m.label} className={`bg-white rounded-xl p-4 border shadow-sm border-${m.color}-200`}>
                <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                <div className={`text-2xl font-black text-${m.color}-600`}>{m.value}</div>
                <div className="text-xs text-gray-400">{m.unit}</div>
              </div>
            ))}
          </div>

          {/* TIR-столбик */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800">Время в диапазоне (TIR)</h3>
              <span className={`text-lg font-black ${tirColor(stats.tir)}`}>{stats.tir}% в цели</span>
            </div>
            <div className="flex h-10 rounded-xl overflow-hidden w-full">
              <div style={{ width: `${stats.tbr}%` }} className="bg-red-500 flex items-center justify-center text-white text-xs font-bold transition-all" title="Гипо <3.9">
                {stats.tbr > 5 ? `${stats.tbr}%` : ''}
              </div>
              <div style={{ width: `${stats.tir}%` }} className="bg-green-500 flex items-center justify-center text-white text-xs font-bold" title="Цель 3.9-10">
                {stats.tir}%
              </div>
              <div style={{ width: `${stats.tar}%` }} className="bg-amber-400 flex items-center justify-center text-white text-xs font-bold" title="Гипер >10">
                {stats.tar > 5 ? `${stats.tar}%` : ''}
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span className="text-red-500 font-medium">Гипо &lt;3.9: {stats.tbr}% ({stats.hypoCount} эп.)</span>
              <span className="text-green-600 font-medium">Цель 3.9–10: {stats.tir}%</span>
              <span className="text-amber-500 font-medium">Гипер &gt;10: {stats.tar}% ({stats.hyperCount} эп.)</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-xs text-gray-500">Ночью (00:00–06:00)</div>
                <div className="text-xl font-bold text-gray-800">{stats.nightAvg} <span className="text-xs font-normal text-gray-400">ммоль/л</span></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="text-xs text-gray-500">Днём (06:00–24:00)</div>
                <div className="text-xl font-bold text-gray-800">{stats.dayAvg} <span className="text-xs font-normal text-gray-400">ммоль/л</span></div>
              </div>
            </div>
          </div>

          {/* AGP-график */}
          {agpDataUrl && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
              <h3 className="font-bold text-gray-800 mb-3">📈 Амбулаторный профиль гликемии (AGP)</h3>
              <img src={agpDataUrl} alt="AGP" className="w-full rounded-xl border border-gray-100" />
              <div className="flex gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                <span>■ <span className="text-indigo-400">Медиана (50%)</span></span>
                <span>■ <span className="text-indigo-300">25–75 персентиль</span></span>
                <span>■ <span className="text-indigo-200">10–90 персентиль</span></span>
              </div>
            </div>
          )}

          {/* Данные пациента */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-3">👤 Данные пациента (для точного заключения)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'age', label: 'Возраст', type: 'number', placeholder: '52' },
                { key: 'hba1c', label: 'HbA1c последний (%)', type: 'number', placeholder: '7.8' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(patientInfo as any)[f.key]}
                    onChange={e => setPatientInfo(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Пол</label>
                <select value={patientInfo.sex} onChange={e => setPatientInfo(prev => ({ ...prev, sex: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  <option value="М">Мужской</option>
                  <option value="Ж">Женский</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Тип диабета</label>
                <select value={patientInfo.diabetesType} onChange={e => setPatientInfo(prev => ({ ...prev, diabetesType: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                  <option value="1">СД 1 типа</option>
                  <option value="2">СД 2 типа</option>
                  <option value="гестационный">Гестационный</option>
                  <option value="неизвестен">Неизвестен</option>
                </select>
              </div>
            </div>
          </div>

          {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {/* Кнопка анализа */}
          {!analysisResult && (
            <button
              onClick={analyze}
              disabled={isAnalyzing}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xl font-black rounded-2xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isAnalyzing ? (
                <><div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />Анализирую гликемический профиль...</>
              ) : (
                <>🧠 Получить клиническое заключение (GPT-5.4)</>
              )}
            </button>
          )}

          {/* Результат */}
          {analysisResult && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">📋 Клиническое заключение</h3>
                <button onClick={() => setAnalysisResult('')} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">
                  🔄 Повторный анализ
                </button>
              </div>
              <AnalysisResult result={analysisResult} model="openai/gpt-5.4" mode="optimized" images={agpDataUrl ? [agpDataUrl] : []} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
