'use client'

import { useState, useEffect } from 'react'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import Script from 'next/script'
import { logUsage } from '@/lib/simple-logger'

// Расширяем Window для PDF.js
declare global {
  interface Window {
    pdfjsLib: any
  }
}

export default function DocumentPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convertingPDF, setConvertingPDF] = useState(false)
  const [conversionProgress, setConversionProgress] = useState<{ current: number; total: number } | null>(null)
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [model, setModel] = useState<string>('')
  const [mode, setMode] = useState<string>('')

  const convertPDFToImages = async (pdfFile: File): Promise<string[]> => {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js не загружен. Подождите несколько секунд и попробуйте снова.')
    }

    try {
      const pdfjs = window.pdfjsLib
      console.log('📄 [DOC PDF] Начинаем конвертацию PDF в изображения...')
      
      const arrayBuffer = await pdfFile.arrayBuffer()
      console.log(`📄 [DOC PDF] Файл загружен, размер: ${arrayBuffer.byteLength} байт`)
      
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0
      })
      
      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const maxPages = Math.min(totalPages, 7) // Первые 7 страниц

      console.log(`📄 [DOC PDF] Всего страниц: ${totalPages}, обрабатываем: ${maxPages}`)

      const base64Images: string[] = []

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        setConversionProgress({ current: pageNum, total: maxPages })
        
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context) {
          throw new Error('Не удалось получить контекст canvas')
        }
        
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise

        const base64 = canvas.toDataURL('image/png').split(',')[1]
        
        if (base64 && base64.length > 0) {
          base64Images.push(base64)
          console.log(`✅ [DOC PDF] Страница ${pageNum}/${maxPages} конвертирована`)
        }
      }

      if (base64Images.length === 0) {
        throw new Error('Не удалось конвертировать ни одной страницы PDF')
      }

      console.log(`✅ [DOC PDF] Конвертация завершена. Получено ${base64Images.length} изображений`)
      return base64Images
      
    } catch (error: any) {
      console.error('❌ [DOC PDF] Ошибка конвертации:', error)
      throw new Error(`Ошибка конвертации PDF: ${error.message}`)
    }
  }

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    setResult('')
    setError(null)
    setLoading(true)
    setCurrentCost(0)
    setModel('')
    setMode('')

    try {
      // Если это PDF - конвертируем в изображения на клиенте
      if (uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        console.log('📄 [DOC] Обнаружен PDF файл, начинаем конвертацию...')
        setConvertingPDF(true)
        setConversionProgress(null)
        
        const pdfImages = await convertPDFToImages(uploadedFile)
        
        setConvertingPDF(false)
        setConversionProgress(null)
        
        console.log(`📄 [DOC] PDF конвертирован в ${pdfImages.length} изображений, отправляем на сканирование...`)
        
        // Отправляем изображения на сервер
        const response = await fetch('/api/scan/document-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            images: pdfImages,
            prompt: 'Отсканируйте и извлеките весь текст из медицинского документа, СОХРАНЯЯ СТРУКТУРУ: таблицы в Markdown, списки, заголовки, форматирование. Структурируйте информацию по страницам.'
          }),
        })

        const data = await response.json()

        if (data.success) {
          setResult(data.result)
          setCurrentCost(data.cost || 0)
          setModel(data.model || 'google/gemini-3-flash-preview')
          setMode('fast')
          
          logUsage({
            section: 'document',
            model: data.model || 'google/gemini-3-flash-preview',
            inputTokens: data.usage?.prompt_tokens || (pdfImages.length * 1500),
            outputTokens: data.usage?.completion_tokens || 1000,
          })
        } else {
          setError(data.error || 'Ошибка при сканировании')
        }
      } else {
        // Для обычных изображений - используем существующий endpoint
        // Создаем превью для изображений
        if (uploadedFile.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onloadend = () => {
            setImagePreview(reader.result as string)
          }
          reader.readAsDataURL(uploadedFile)
        } else {
          setImagePreview(null)
        }

        const formData = new FormData()
        formData.append('file', uploadedFile)
        formData.append('prompt', 'Отсканируйте и извлеките текст из медицинского документа, СОХРАНЯЯ СТРУКТУРУ: таблицы, списки, заголовки, форматирование.')

        const response = await fetch('/api/scan/document', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (data.success) {
          setResult(data.result)
          setCurrentCost(data.cost || 0)
          setModel(data.model || 'google/gemini-3-flash-preview')
          setMode('fast')

          logUsage({
            section: 'document',
            model: data.model || 'google/gemini-3-flash-preview',
            inputTokens: data.usage?.prompt_tokens || 1500,
            outputTokens: data.usage?.completion_tokens || 800,
          })
        } else {
          setError(data.error || 'Ошибка при сканировании')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
      setConvertingPDF(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Загрузка PDF.js */}
      <Script
        src="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs"
        type="module"
        onLoad={() => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
              'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs'
            setPdfJsLoaded(true)
            console.log('✅ PDF.js загружен для сканирования документов')
          }
        }}
      />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary-900 mb-6">📄 Сканирование документов</h1>
        
        <AnalysisTips 
          title="Советы по сканированию документов"
          content={{
            fast: "используется модель Gemini 3.0 Flash — она идеально подходит для быстрого и точного извлечения текста из медицинских выписок, справок и протоколов.",
            extra: [
              "⭐ Рекомендуемый режим: Gemini 3.0 Flash — лучший баланс скорости распознавания текста и стоимости.",
              "📄 Поддерживаются многостраничные PDF (обрабатываются первые 7 страниц) и изображения.",
              "🔍 Система сохраняет структуру документа: таблицы переводятся в Markdown, списки и заголовки остаются на своих местах.",
              "💡 Отсканированный текст можно скопировать для вставки в карту пациента или отправить ИИ‑ассистенту для анализа."
            ]
          }}
        />
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Загрузите документ для сканирования</h2>
          <p className="text-sm text-gray-600 mb-4">
            Поддерживаемые форматы: PDF, изображения (JPG, PNG)
          </p>
          <ImageUpload onUpload={handleUpload} accept=".pdf,image/*" maxSize={50} />
        </div>

        {/* Прогресс конвертации PDF */}
        {convertingPDF && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-3"></div>
              <span>
                {conversionProgress 
                  ? `Конвертация PDF: страница ${conversionProgress.current} из ${conversionProgress.total}...`
                  : 'Подготовка PDF к конвертации...'}
              </span>
            </div>
          </div>
        )}

      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженный документ</h2>
          <div className="flex justify-center">
            <img 
              src={imagePreview} 
              alt="Загруженный документ" 
              className="max-w-full max-h-[600px] rounded-lg shadow-lg object-contain"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        cost={currentCost}
        model={model}
        mode={mode}
      />
      </div>
    </>
  )
}

