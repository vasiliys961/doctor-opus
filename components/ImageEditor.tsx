'use client'

import { useState, useRef, useEffect } from 'react'

interface ImageEditorProps {
  image: string // Принимает либо URL, либо base64
  onSave: (editedImage: string) => void // Возвращает base64
  onCancel: () => void
}

export default function ImageEditor({ image, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(40)
  const [history, setHistory] = useState<ImageData[]>([])
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const img = new Image()
    img.src = image
    img.onload = () => {
      imageRef.current = img
      canvas.width = img.width
      canvas.height = img.height
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        // Сохраняем начальное состояние
        saveToHistory(ctx)
      }
    }
  }, [image])

  const saveToHistory = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory(prev => [...prev.slice(-9), imageData]) // Храним последние 10 состояний
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) {
      const rect = canvas!.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (canvas!.width / rect.width)
      const y = (e.clientY - rect.top) * (canvas!.height / rect.height)
      
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) * (canvas.width / rect.width)
      const y = (e.clientY - rect.top) * (canvas.height / rect.height)
      
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'black'
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        saveToHistory(ctx)
      }
    }
  }

  const handleUndo = () => {
    if (history.length <= 1) return // Не удаляем начальное состояние
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) {
      const newHistory = history.slice(0, -1)
      const previousState = newHistory[newHistory.length - 1]
      ctx.putImageData(previousState, 0, 0)
      setHistory(newHistory)
    }
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const editedImage = canvas.toDataURL('image/jpeg', 0.9)
    onSave(editedImage)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Точная анонимизация</h3>
          <p className="text-sm text-gray-600 mt-1">
            Закрасьте черной кистью области с персональными данными
          </p>
        </div>

        <div className="p-4">
          {/* Панель инструментов */}
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Размер кисти:
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-gray-600 w-12">{brushSize}px</span>
            </div>

            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              ↶ Отменить
            </button>
          </div>

          {/* Canvas для рисования */}
          <div className="border-2 border-gray-300 rounded overflow-auto max-h-[60vh] bg-gray-100">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="max-w-full h-auto cursor-crosshair"
              style={{ display: 'block', margin: '0 auto' }}
            />
          </div>

          {/* Кнопки действий */}
          <div className="mt-4 flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
            >
              ✓ Применить и сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
