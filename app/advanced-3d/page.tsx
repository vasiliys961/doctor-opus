'use client'

import { useState } from 'react'
import Dicom3DViewer from '@/components/Dicom3DViewer'
import FileUpload from '@/components/FileUpload'

export default function Advanced3DPage() {
  const [files, setFiles] = useState<File[]>([])
  const [showViewer, setShowViewer] = useState(false)

  const isLikelyDicomFile = async (file: File): Promise<boolean> => {
    const fileName = file.name.toLowerCase()
    const fileType = (file.type || '').toLowerCase()

    if (fileName.endsWith('.dcm') || fileName.endsWith('.dicom')) return true
    if (fileType === 'application/dicom') return true

    try {
      const header = new Uint8Array(await file.slice(0, 512).arrayBuffer())
      if (header.length >= 132) {
        const signature = String.fromCharCode(...Array.from(header.slice(128, 132)))
        if (signature === 'DICM') return true
      }

      // Часть DICOM-серий не содержит "DICM" и начинается сразу с tag-группы 0002/0008.
      if (header.length >= 2) {
        const littleEndianGroup = header[0] | (header[1] << 8)
        const bigEndianGroup = (header[0] << 8) | header[1]
        if (
          littleEndianGroup === 0x0002 ||
          littleEndianGroup === 0x0008 ||
          bigEndianGroup === 0x0002 ||
          bigEndianGroup === 0x0008
        ) {
          return true
        }
      }
    } catch (error) {
      console.warn('Не удалось проверить сигнатуру файла как DICOM:', error)
    }

    return false
  }

  const handleUpload = async (uploadedFiles: File[]) => {
    const inspected = await Promise.all(
      uploadedFiles.map(async (file) => ({
        file,
        isDicom: await isLikelyDicomFile(file),
      }))
    )

    const dicomFiles = inspected.filter((entry) => entry.isDicom).map((entry) => entry.file)

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

            <div data-tour="dicom-folder-upload">
              <FileUpload 
                onUpload={handleUpload}
                accept=".dcm,.dicom,application/dicom"
                multiple={true}
                bridgePullTarget="image_analysis"
              />
            </div>
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
