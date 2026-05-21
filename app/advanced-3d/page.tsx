'use client'

import { useState } from 'react'
import Dicom3DViewer from '@/components/Dicom3DViewer'
import FileUpload from '@/components/FileUpload'

export default function Advanced3DPage() {
  const [files, setFiles] = useState<File[]>([])
  const [showViewer, setShowViewer] = useState(false)

  const handleUpload = (uploadedFiles: File[]) => {
    // Фильтруем только DICOM или изображения (для упрощения)
    const dicomFiles = uploadedFiles.filter(f => 
      f.name.toLowerCase().endsWith('.dcm') || 
      f.name.toLowerCase().endsWith('.dicom') ||
      f.type === 'application/dicom'
    )
    
    if (dicomFiles.length > 0) {
      setFiles(dicomFiles)
      setShowViewer(true)
    } else {
      alert('Пожалуйста, загрузите серию DICOM-файлов (папку или несколько файлов).')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            Advanced 3D Engine <span className="text-primary-600">v2.0</span>
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Профессиональная система объемного рендеринга для МРТ и КТ. 
            Поддержка Cinematic-режима, клинических пресетов и аппаратного ускорения Apple M1.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12">
          <div className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
              <span className="text-3xl mb-3">🧊</span>
              <h3 className="font-bold text-slate-800 text-sm mb-1">Volume Rendering</h3>
              <p className="text-slate-500 text-[11px]">Честная 3D-реконструкция из серии 2D-срезов.</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
              <span className="text-3xl mb-3">✨</span>
              <h3 className="font-bold text-slate-800 text-sm mb-1">Cinematic Mode</h3>
              <p className="text-slate-500 text-[11px]">Фотореалистичное освещение и мягкие тени.</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
              <span className="text-3xl mb-3">🫀</span>
              <h3 className="font-bold text-slate-800 text-sm mb-1">Vessel Highlight</h3>
              <p className="text-slate-500 text-[11px]">Выделение сосудов и контрастных зон.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 flex items-start gap-4">
              <span className="text-2xl">💡</span>
              <div className="text-sm text-primary-800">
                <p className="font-bold mb-1">Как использовать:</p>
                <ul className="list-disc list-inside space-y-1 opacity-80">
                  <li>Загрузите всю папку с DICOM-снимками МРТ/КТ</li>
                  <li>Дождитесь завершения сборки 3D-модели</li>
                  <li>Переключайтесь между Clinical и Cinematic режимами</li>
                </ul>
              </div>
            </div>

            <FileUpload 
              onUpload={handleUpload}
              accept=".dcm,.dicom,application/dicom"
              multiple={true}
              bridgePullTarget="image_analysis"
            />
          </div>
        </div>

        {showViewer && (
          <Dicom3DViewer 
            files={files}
            onClose={() => setShowViewer(false)}
            presentation="fullscreen"
          />
        )}
      </div>
  )
}
