'use client'

import { useEffect, useRef, useState } from 'react'
import * as cornerstone from 'cornerstone-core'
import { initCornerstone } from '@/lib/dicom-client-processor'
import * as cornerstoneTools from 'cornerstone-tools'
import * as cornerstoneMath from 'cornerstone-math'

interface DicomViewerProps {
  file: File
  onAnalysisImageReady?: (dataUrl: string) => void
}

export default function DicomViewer({ file, onAnalysisImageReady }: DicomViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [ww, setWw] = useState(400) // Window Width
  const [wc, setWc] = useState(40)  // Window Center
  const [image, setImage] = useState<any>(null)
  const [activeTool, setActiveTool] = useState<string>('Wwwc')

  useEffect(() => {
    if (!viewerRef.current || !file) return

    // Инициализация Cornerstone
    initCornerstone()
    
    // Инициализация инструментов
    if (typeof window !== 'undefined' && !cornerstoneTools.external.cornerstone) {
      cornerstoneTools.external.cornerstone = cornerstone
      cornerstoneTools.external.cornerstoneMath = cornerstoneMath
      cornerstoneTools.init()
    }

    const element = viewerRef.current
    cornerstone.enable(element)

    // Добавляем инструменты
    const WwwcTool = cornerstoneTools.WwwcTool
    const PanTool = cornerstoneTools.PanTool
    const ZoomTool = cornerstoneTools.ZoomTool
    const MagnifyTool = cornerstoneTools.MagnifyTool
    const LengthTool = cornerstoneTools.LengthTool

    cornerstoneTools.addTool(WwwcTool)
    cornerstoneTools.addTool(PanTool)
    cornerstoneTools.addTool(ZoomTool)
    cornerstoneTools.addTool(MagnifyTool)
    cornerstoneTools.addTool(LengthTool)

    cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 })
    cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 2 })
    cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 4 })

    const loadDicom = async () => {
      try {
        setLoading(true)
        const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file)
        const loadedImage = await cornerstone.loadImage(imageId)
        setImage(loadedImage)
        cornerstone.displayImage(element, loadedImage)
        
        setWw(loadedImage.windowWidth)
        setWc(loadedImage.windowCenter)
        
        setLoading(false)
      } catch (err) {
        console.error('DICOM loading error:', err)
        setLoading(false)
      }
    }

    loadDicom()

    // Обработчик изменения окна для синхронизации ползунков
    const onImageRendered = (e: any) => {
      const viewport = cornerstone.getViewport(e.target)
      setWw(Math.round(viewport.voi.windowWidth))
      setWc(Math.round(viewport.voi.windowCenter))
    }
    element.addEventListener('cornerstoneimagerendered', onImageRendered)

    return () => {
      element.removeEventListener('cornerstoneimagerendered', onImageRendered)
      cornerstone.disable(element)
    }
  }, [file])

  const setTool = (toolName: string) => {
    setActiveTool(toolName)
    cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 })
    // Другие инструменты делаем пассивными для левой кнопки
    const tools = ['Wwwc', 'Pan', 'Zoom', 'Magnify', 'Length']
    tools.filter(t => t !== toolName).forEach(t => {
      cornerstoneTools.setToolPassive(t, { mouseButtonMask: 1 })
    })
  }

  const handleWindowChange = (newWc: number, newWw: number) => {
    if (!viewerRef.current || !image) return
    
    setWc(newWc)
    setWw(newWw)
    
    const viewport = cornerstone.getViewport(viewerRef.current)
    viewport.voi.windowWidth = newWw
    viewport.voi.windowCenter = newWc
    cornerstone.setViewport(viewerRef.current, viewport)
  }

  const captureImage = () => {
    if (!viewerRef.current) return
    const canvas = viewerRef.current.querySelector('canvas')
    if (canvas && onAnalysisImageReady) {
      onAnalysisImageReady(canvas.toDataURL('image/png'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden bg-black aspect-square max-h-[600px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
        <div ref={viewerRef} className="w-full h-full" />
      </div>

      <div className="bg-gray-100 p-4 rounded-lg space-y-4">
        <div className="flex flex-wrap gap-2 mb-2">
          <button 
            onClick={() => setTool('Wwwc')} 
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${activeTool === 'Wwwc' ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
          >
            🖱️ Window (LMB)
          </button>
          <button 
            onClick={() => setTool('Pan')} 
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${activeTool === 'Pan' ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
          >
            ✋ Pan
          </button>
          <button 
            onClick={() => setTool('Zoom')} 
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${activeTool === 'Zoom' ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
          >
            🔍 Zoom
          </button>
          <button 
            onClick={() => setTool('Magnify')} 
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${activeTool === 'Magnify' ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
          >
            🔎 Magnify
          </button>
          <button 
            onClick={() => setTool('Length')} 
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${activeTool === 'Length' ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
          >
            📏 Ruler
          </button>
        </div>

        <h4 className="font-bold text-gray-800">Window Settings (Windowing)</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Center (WC): {wc}</label>
            <input 
              type="range" 
              min="-1000" max="2000" 
              value={wc} 
              onChange={(e) => handleWindowChange(parseInt(e.target.value), ww)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Width (WW): {ww}</label>
            <input 
              type="range" 
              min="1" max="4000" 
              value={ww} 
              onChange={(e) => handleWindowChange(wc, parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => handleWindowChange(40, 400)} 
            className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50"
          >
            Soft tissue (40/400)
          </button>
          <button 
            onClick={() => handleWindowChange(400, 1800)} 
            className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50"
          >
            Bone (400/1800)
          </button>
          <button 
            onClick={() => handleWindowChange(-600, 1500)} 
            className="px-3 py-1 bg-white border rounded text-xs hover:bg-gray-50"
          >
            Lung (-600/1500)
          </button>
        </div>

        <button 
          onClick={captureImage}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md"
        >
          ✅ Confirm view and send for analysis
        </button>
      </div>
    </div>
  )
}

