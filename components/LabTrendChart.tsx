'use client'

import React from 'react'

interface DataPoint {
  date: string
  value: number
}

interface LabTrendChartProps {
  data: DataPoint[]
  label: string
  unit: string
  color?: string
}

export default function LabTrendChart({ data, label, unit, color = '#0d9488' }: LabTrendChartProps) {
  if (data.length < 2) return null

  // Сортируем данные по дате
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  const values = sortedData.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1
  
  const padding = 40
  const width = 400
  const height = 200
  
  const points = sortedData.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / (sortedData.length - 1)
    const y = height - padding - ((d.value - minVal) * (height - 2 * padding)) / range
    return { x, y, val: d.value, date: d.date }
  })

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-gray-700">{label}</h4>
        <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
          {unit}
        </span>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Сетка */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
        
        {/* Линия графика */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Точки и подписи */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>
              {p.val}
            </text>
            <text x={p.x} y={height - padding + 15} textAnchor="middle" fontSize="8" fill="#94a3b8" transform={`rotate(15, ${p.x}, ${height - padding + 15})`}>
              {new Date(p.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
