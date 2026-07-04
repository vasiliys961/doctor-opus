'use client'

import { useState, useEffect, useRef } from 'react'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import { logUsage } from '@/lib/simple-logger'
import { Document, Packer, Paragraph, ImageRun, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'

import ImageEditor from '@/components/ImageEditor'

// Расширяем Window для PDF.js
declare global {
  interface Window {
    pdfjsLib: any
  }
}

type ScanMode = 'local' | 'ai'

export default function DocumentPage() {
  const BRIDGE_DOCUMENT_SCAN_KEY = 'mobile_bridge_document_scan_draft'
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convertingPDF, setConvertingPDF] = useState(false)
  const [conversionProgress, setConversionProgress] = useState<{ current: number; total: number } | null>(null)
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  
  // Загружаем PDF.js v3 из локальных файлов (public/pdfjs/)
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      const script = document.createElement('script')
      script.src = '/pdfjs/pdf.min.js'
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
          setPdfJsLoaded(true)
          console.log('✅ PDF.js v3 загружен локально (Сканирование)')
        }
      }
      script.onerror = () => {
        console.warn('⚠️ PDF.js не удалось загрузить при Сканировании')
      }
      document.head.appendChild(script)
    } else if (window.pdfjsLib) {
      setPdfJsLoaded(true)
    }
  }, [])

  const [currentCost, setCurrentCost] = useState<number>(0)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [maskImage, setMaskImage] = useState(true)
  const [model, setModel] = useState<string>('')
  const [mode, setMode] = useState<string>('')
  const [scanMode, setScanMode] = useState<ScanMode>('local')
  const [showEditor, setShowEditor] = useState(false)
  
  // Параметры "ксерокса"
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [isGrayscale, setIsGrayscale] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Применяем фильтры к изображению через Canvas
  useEffect(() => {
    if (!imagePreview || scanMode !== 'local') return

    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = img.width
      canvas.height = img.height

      // Применяем фильтры
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) ${isGrayscale ? 'grayscale(100%)' : ''}`
      ctx.drawImage(img, 0, 0)
      
      setProcessedImage(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.src = imagePreview
  }, [imagePreview, brightness, contrast, isGrayscale, scanMode])

  const handleDownloadWord = async () => {
    if (!processedImage) return
    
    try {
      const base64Data = processedImage.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')

      // Получаем размеры для сохранения пропорций
      const img = new Image()
      img.src = processedImage
      await new Promise(resolve => img.onload = resolve)
      
      const maxWidth = 600 // Эквивалент ширины A4
      const ratio = img.width / img.height
      const width = maxWidth
      const height = maxWidth / ratio

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: buffer,
                  transformation: {
                    width: width,
                    height: height,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `Scan_${new Date().getTime()}.docx`)
    } catch (err) {
      console.error('Ошибка при создании Word:', err)
      alert('Не удалось создать Word файл')
    }
  }

  const handlePrintPDF = () => {
    if (!processedImage) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <body style="margin:0; display:flex; justify-content:center; align-items:center;">
          <img src="${processedImage}" style="max-width:100%; max-height:100vh; object-contain:contain;" onload="window.print(); window.close();">
        </body>
      </html>
    `)
    win.document.close()
  }

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
    
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setImagePreview(base64)
      setProcessedImage(base64) // Изначально обработанное равно исходному
    }
    reader.readAsDataURL(uploadedFile)

    // В ЛЮБОМ РЕЖИМЕ теперь просто показываем превью и даем возможность анонимизировать
    // Анализ ИИ теперь запускается только вручную кнопкой
  }

  useEffect(() => {
    const raw = localStorage.getItem(BRIDGE_DOCUMENT_SCAN_KEY)
    if (!raw) return

    const dataUrlToFile = (dataUrl: string, fileName: string, fallbackType = 'image/jpeg'): File => {
      const match = dataUrl.match(/^data:(.+);base64,(.*)$/)
      if (!match) throw new Error('Некорректный формат data URL')
      const mimeType = match[1] || fallbackType
      const base64 = match[2]
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const ext = mimeType.includes('pdf') ? 'pdf' : (mimeType.split('/')[1] || 'jpg')
      return new File([bytes], `${fileName}.${ext}`, { type: mimeType })
    }

    void (async () => {
      try {
        const payload = JSON.parse(raw) as { title?: string; text?: string; dataUrl?: string; mimeType?: string }
        if (payload.text?.trim()) {
          setResult((prev) => (prev ? `${prev}\n\n${payload.text}` : payload.text || ''))
        }
        if (payload.dataUrl) {
          const imported = dataUrlToFile(payload.dataUrl, payload.title || 'mobile_document', payload.mimeType || 'image/jpeg')
          setScanMode('ai')
          await handleUpload(imported)
        }
      } catch (error) {
        console.error('Ошибка импорта mobile bridge в сканирование документов:', error)
      } finally {
        localStorage.removeItem(BRIDGE_DOCUMENT_SCAN_KEY)
      }
    })()
  }, [])

  const runAIAnalysis = async (imageData: string) => {
    setLoading(true)
    setCurrentCost(0)
    setModel('')
    setMode('')

    try {
      // Конвертация data:image/... в File без fetch(data:...) — совместимо с CSP.
      const dataUrlToFile = (dataUrl: string, fileName: string): File => {
        const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
        if (!match) throw new Error('Неверный формат изображения')

        const mimeType = match[1] || 'image/png'
        const base64 = match[2]
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        return new File([bytes], fileName, { type: mimeType })
      }

      // Если это data:image (после редактора/предобработки)
      const isBase64 = imageData.startsWith('data:image')
      
      // Отправляем на сервер (используем существующий API для документов)
      const formData = new FormData()
      
      if (isBase64) {
        const fileFromDataUrl = dataUrlToFile(imageData, 'document.png')
        formData.append('file', fileFromDataUrl)
      } else {
        if (!file) throw new Error('Файл не выбран')
        formData.append('file', file)
      }

      formData.append('isAnonymous', isAnonymous.toString())
      formData.append('maskImage', maskImage.toString())
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
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary-900">📄 Сканирование документов</h1>
        </div>
        
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setScanMode('local')}
            className={`flex-1 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-3 ${
              scanMode === 'local' 
                ? 'bg-primary-600 text-white scale-105' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">💾</span>
            <div>
              <div className="text-sm uppercase tracking-wider">Локальный</div>
              <div className="text-[10px] font-normal opacity-80">Без ИИ, 100% приватно</div>
            </div>
          </button>
          <button
            onClick={() => setScanMode('ai')}
            className={`flex-1 py-4 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-3 ${
              scanMode === 'ai' 
                ? 'bg-purple-600 text-white scale-105' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">🧠</span>
            <div>
              <div className="text-sm uppercase tracking-wider">Умный OCR</div>
              <div className="text-[10px] font-normal opacity-80">Распознавание текста через ИИ</div>
            </div>
          </button>
        </div>

        <AnalysisTips 
          title="Советы по сканированию документов"
          content={{
            fast: scanMode === 'ai' ? "используется модель Gemini 3.1 Flash — она идеально подходит для быстрого и точного извлечения текста." : "локальный режим позволяет моментально создать качественный цифровой скан без отправки данных в сеть.",
            extra: scanMode === 'ai' ? [
              "⭐ Рекомендуемый режим: Gemini 3.1 Flash — лучший баланс скорости распознавания текста и стоимости.",
              "🛡️ В режиме ИИ обязательно используйте тумблер анонимизации для защиты ПД.",
              "🔍 Система сохраняет структуру документа: таблицы переводятся в Markdown."
            ] : [
              "💾 Используйте фильтры для улучшения читаемости (контрастность, яркость).",
              "📄 Кнопка «Word» создаст документ со снимком на весь лист.",
              "🌍 100% приватность: обработка происходит прямо в вашем браузере."
            ]
          }}
        />
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {scanMode === 'local' ? '1. Загрузите или сфотографируйте документ' : 'Загрузите документ для распознавания'}
            </h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Поддерживаемые форматы: PDF, изображения (JPG, PNG)
          </p>
          <ImageUpload onUpload={handleUpload} accept=".pdf,image/*" maxSize={50} bridgePullTarget="document_scan" />
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

      {file && imagePreview && scanMode === 'local' && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            🎨 2. Настройка и экспорт
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-widest">Инструменты ксерокса</h3>
                
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Яркость ({brightness}%)</label>
                  <input 
                    type="range" min="50" max="200" value={brightness} 
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Контрастность ({contrast}%)</label>
                  <input 
                    type="range" min="50" max="250" value={contrast} 
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">Черно-белый режим</span>
                  <button 
                    onClick={() => setIsGrayscale(!isGrayscale)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      isGrayscale ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isGrayscale ? 'ВКЛ' : 'ВЫКЛ'}
                  </button>
                </div>
              </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowEditor(true)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
              >
                <span className="text-xl">🎨</span>
                Закрасить данные вручную
              </button>
              <button
                onClick={handleDownloadWord}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-xl">📝</span>
                  Сохранить как Word (.docx)
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-3"
                >
                  <span className="text-xl">💾</span>
                  Скачать/Печать как PDF
                </button>
              </div>
            </div>

            <div className="flex justify-center bg-gray-900 rounded-lg p-2 overflow-hidden items-start shadow-inner min-h-[400px]">
              <img 
                src={processedImage || imagePreview} 
                alt="Предпросмотр скана" 
                className="max-w-full rounded shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {file && imagePreview && scanMode === 'ai' && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">📷 Предпросмотр и анонимизация</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditor(true)}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-all border border-indigo-200 flex items-center gap-2"
              >
                🎨 Закрасить данные вручную
              </button>
            </div>
          </div>

          <div className="flex justify-center bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-200 mb-6">
            <img 
              src={processedImage || imagePreview} 
              alt="Загруженный документ" 
              className="max-w-full max-h-[600px] rounded-lg shadow-lg object-contain"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-6">
            <label className="flex items-center space-x-2 cursor-pointer p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 w-full sm:w-fit shadow-sm">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                disabled={loading}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-blue-900">
                  🛡️ Разовый анонимный анализ
                </span>
                <span className="text-[10px] text-blue-700 font-normal">
                  Результат не будет сохранён в базу пациентов.
                </span>
              </div>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer p-3 bg-green-50 border border-green-100 rounded-xl text-green-900 w-full sm:w-fit shadow-sm">
              <input
                type="checkbox"
                checked={maskImage}
                onChange={(e) => setMaskImage(e.target.checked)}
                disabled={loading}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-green-900">
                  🖌️ Закрашивать края документа
                </span>
                <span className="text-[10px] text-green-700 font-normal">
                  Включено по умолчанию. Если важные данные (таблицы, шапка) обрезаются — отключите.
                </span>
              </div>
            </label>

            <button
              onClick={() => runAIAnalysis(processedImage || imagePreview!)}
              disabled={loading}
              className="w-full sm:w-auto px-10 py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg transform hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <span className="text-xl">🚀</span>
              Распознать текст
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно редактора */}
      {showEditor && (imagePreview || processedImage) && (
        <ImageEditor
          image={processedImage || imagePreview!}
          onSave={(editedImage) => {
            setProcessedImage(editedImage)
            // Если в локальном режиме, обновляем и исходник, чтобы фильтры накладывались на закрашенное
            if (scanMode === 'local') {
              setImagePreview(editedImage)
            }
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {scanMode === 'ai' && (
        <AnalysisResult 
          result={result} 
          loading={loading} 
          cost={currentCost}
          model={model}
          mode={mode}
          isAnonymous={isAnonymous}
          images={imagePreview ? [imagePreview] : []}
        />
      )}
      </div>
    </>
  )
}

