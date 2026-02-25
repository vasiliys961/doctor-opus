'use client'

import React, { useState, useRef, useEffect } from 'react'

interface Point {
  x: number
  y: number
}

interface EcgCaliperProps {
  imageUrl: string
  containerWidth: number
}

export default function EcgCaliper({ imageUrl, containerWidth }: EcgCaliperProps) {
  const [point1, setPoint1] = useState<Point>({ x: 100, y: 150 })
  const [point2, setPoint2] = useState<Point>({ x: 200, y: 150 })
  const [isDragging, setIsDragging] = useState<'p1' | 'p2' | 'both' | null>(null)
  const [calibration, setCalibration] = useState<number>(100) // pixels per 1 second (default)
  const [speed, setSpeed] = useState<25 | 50>(25) // mm/s
  const containerRef = useRef<HTMLDivElement>(null)

  // Расчет расстояния в мс
  // При 25 мм/с: 1 мм = 40 мс. Обычно на ЭКГ 1 большая клетка = 5 мм = 200 мс.
  // Нам нужно знать масштаб. Давай добавим "Калибровочный режим" или просто ползунок.
  // Упростим: дадим пользователю возможность задать "ширину одной секунды" или просто показывать в пикселях и долях.
  
  const distancePx = Math.abs(point2.x - point1.x)
  const timeMs = Math.round((distancePx / calibration) * 1000)

  const handleMouseDown = (e: React.MouseEvent, type: 'p1' | 'p2' | 'both') => {
    e.preventDefault()
    setIsDragging(type)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

    if (isDragging === 'p1') {
      setPoint1({ x, y })
    } else if (isDragging === 'p2') {
      setPoint2({ x, y })
    } else if (isDragging === 'both') {
      const dx = x - (point1.x + point2.x) / 2
      const dy = y - (point1.y + point2.y) / 2
      setPoint1(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      setPoint2(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(null)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div className="relative flex flex-col items-center select-none">
      <div className="w-full mb-4 flex gap-4 items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-blue-600 uppercase">Interval Measurement</span>
          <span className="text-xl font-mono font-bold text-blue-800">{timeMs} <span className="text-sm">ms</span></span>
        </div>
        
        <div className="h-8 w-px bg-blue-200 mx-2"></div>
        
        <div className="flex flex-col flex-grow">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Calibration (px/sec)</span>
          <input 
            type="range" 
            min="50" 
            max="1000" 
            value={calibration} 
            onChange={(e) => setCalibration(parseInt(e.target.value))}
            className="w-full h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Speed</span>
          <div className="flex bg-white rounded border overflow-hidden">
            <button 
              onClick={() => setSpeed(25)}
              className={`px-2 py-0.5 text-[10px] font-bold ${speed === 25 ? 'bg-blue-500 text-white' : 'text-gray-600'}`}
            >25</button>
            <button 
              onClick={() => setSpeed(50)}
              className={`px-2 py-0.5 text-[10px] font-bold ${speed === 50 ? 'bg-blue-500 text-white' : 'text-gray-600'}`}
            >50</button>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative border shadow-xl rounded-lg overflow-hidden bg-white cursor-crosshair"
        style={{ width: '100%', height: 'auto' }}
      >
        <img 
          src={imageUrl} 
          alt="ECG for measurement" 
          className="w-full h-auto pointer-events-none"
          onDragStart={(e) => e.preventDefault()}
        />
        
        {/* SVG Overlay for Caliper */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line 
            x1={point1.x} y1={point1.y} 
            x2={point2.x} y2={point2.y} 
            stroke="#2563eb" strokeWidth="2" strokeDasharray="4 2"
          />
          {/* Вертикальные засечки */}
          <line x1={point1.x} y1={point1.y - 15} x2={point1.x} y2={point1.y + 15} stroke="#2563eb" strokeWidth="3" />
          <line x1={point2.x} y1={point2.y - 15} x2={point2.x} y2={point2.y + 15} stroke="#2563eb" strokeWidth="3" />
          
          {/* Текст над линией */}
          <text 
            x={(point1.x + point2.x) / 2} 
            y={Math.min(point1.y, point2.y) - 20} 
            textAnchor="middle" 
            fill="#1e40af" 
            fontSize="14" 
            fontWeight="bold"
            className="drop-shadow-sm"
          >
            {timeMs} ms
          </text>
        </svg>

        {/* Drag handles */}
        <div 
          className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-blue-500/20 border-2 border-blue-600 cursor-move pointer-events-auto flex items-center justify-center hover:bg-blue-500/40 transition-colors"
          style={{ left: point1.x, top: point1.y }}
          onMouseDown={(e) => handleMouseDown(e, 'p1')}
        >
          <div className="w-2 h-2 rounded-full bg-blue-600"></div>
        </div>
        
        <div 
          className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-blue-500/20 border-2 border-blue-600 cursor-move pointer-events-auto flex items-center justify-center hover:bg-blue-500/40 transition-colors"
          style={{ left: point2.x, top: point2.y }}
          onMouseDown={(e) => handleMouseDown(e, 'p2')}
        >
          <div className="w-2 h-2 rounded-full bg-blue-600"></div>
        </div>
      </div>
      
      <p className="mt-2 text-[10px] text-gray-500 italic">
        💡 Drag the blue markers to measure intervals. Calibrate using the ECG grid (1 sec = 5 large cells at 25 mm/s).
      </p>
    </div>
  )
}
