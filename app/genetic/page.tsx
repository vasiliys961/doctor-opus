'use client'

import { useState, useEffect } from 'react'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import ReactMarkdown from 'react-markdown'
import { handleSSEStream } from '@/lib/streaming-utils'
import { logUsage } from '@/lib/simple-logger'

declare global {
  interface Window {
    pdfjsLib: any
  }
}

export default function GeneticPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<string>('')
  const [convertingPDF, setConvertingPDF] = useState(false)
  const [conversionProgress, setConversionProgress] = useState({ current: 0, total: 0 })
  const [pdfjsReady, setPdfjsReady] = useState(false)
  const [clinicalContext, setClinicalContext] = useState<string>('')
  const [question, setQuestion] = useState<string>('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string; files?: Array<{ name: string; type: string; base64: string }> }>>([])
  const [chatMessage, setChatMessage] = useState<string>('')
  const [chatLoading, setChatLoading] = useState(false)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [chatFiles, setChatFiles] = useState<File[]>([])

  // Конвертация файлов в base64
  const convertFilesToBase64 = async (files: File[]): Promise<Array<{ name: string; type: string; base64: string }>> => {
    const promises = files.map(file => {
      return new Promise<{ name: string; type: string; base64: string }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1] // Убираем префикс data:image/...;base64,
          resolve({
            name: file.name,
            type: file.type || 'application/octet-stream',
            base64: base64
          })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    })
    return Promise.all(promises)
  }

  // Конвертация текста в markdown формат
  const convertToMarkdown = (text: string): string => {
    if (!text) return ''
    
    // Разбиваем на строки
    const lines = text.split('\n')
    const markdownLines: string[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Пропускаем пустые строки
      if (!trimmed) {
        markdownLines.push('')
        continue
      }
      
      // Если строка содержит формат ГЕН;rsID;ГЕНОТИП;КОММЕНТАРИЙ
      if (trimmed.includes(';')) {
        const parts = trimmed.split(';').map(p => p.trim()).filter(p => p)
        
        if (parts.length >= 3) {
          // Форматируем как markdown список с выделением
          const gene = parts[0] || ''
          const rsid = parts[1] || ''
          const genotype = parts[2] || ''
          const comment = parts[3] || ''
          
          markdownLines.push(`- **${gene}** (${rsid}): \`${genotype}\`${comment ? ` — ${comment}` : ''}`)
        } else {
          markdownLines.push(trimmed)
        }
      } else if (trimmed.startsWith('---')) {
        // Заголовки страниц
        const header = trimmed.replace(/---/g, '').trim()
        if (header) {
          markdownLines.push(`\n### ${header}\n`)
        }
      } else if (trimmed.match(/^rs\d+/i)) {
        // Строка начинается с rsID
        markdownLines.push(`- ${trimmed}`)
      } else {
        // Обычный текст
        markdownLines.push(trimmed)
      }
    }
    
    return markdownLines.join('\n')
  }

  // Загружаем PDF.js с CDN
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          setPdfjsReady(true)
          console.log('✅ PDF.js загружен и готов')
        }
      }
      script.onerror = () => {
        console.error('❌ Ошибка загрузки PDF.js')
        setError('Не удалось загрузить библиотеку для обработки PDF')
      }
      document.head.appendChild(script)
    } else if (window.pdfjsLib) {
      setPdfjsReady(true)
    }
  }, [])

  // Конвертация PDF в изображения на клиенте
  const convertPDFToImages = async (pdfFile: File): Promise<string[]> => {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js не загружен. Подождите несколько секунд и попробуйте снова.')
    }

    try {
      const pdfjs = window.pdfjsLib
      console.log('📄 [PDF] Начинаем конвертацию PDF в изображения...')
      
      const arrayBuffer = await pdfFile.arrayBuffer()
      console.log(`📄 [PDF] Файл загружен, размер: ${arrayBuffer.byteLength} байт`)
      
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0 // Отключаем лишние логи
      })
      
      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const maxPages = Math.min(totalPages, 7) // Первые 7 страниц

      console.log(`📄 [PDF] Всего страниц: ${totalPages}, обрабатываем: ${maxPages}`)

      const base64Images: string[] = []

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        setConversionProgress({ current: pageNum, total: maxPages })
        
        console.log(`📄 [PDF] Обработка страницы ${pageNum}/${maxPages}...`)
        
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1.5 }) // Оптимизировано: 1.5 вместо 2.0 для экономии места

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context) {
          throw new Error('Не удалось получить контекст canvas для рендеринга страницы')
        }
        
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise

        // Используем jpeg с качеством 0.8 вместо png - это уменьшит размер в 5-10 раз
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
        
        if (!base64 || base64.length === 0) {
          console.warn(`⚠️ [PDF] Страница ${pageNum} не была конвертирована (пустое изображение)`)
          continue
        }
        
        base64Images.push(base64)
        console.log(`✅ [PDF] Страница ${pageNum}/${maxPages} конвертирована (размер: ${Math.round(base64.length / 1024)} KB)`)
      }

      if (base64Images.length === 0) {
        throw new Error('Не удалось конвертировать ни одной страницы PDF в изображение')
      }

      console.log(`✅ [PDF] Конвертация завершена. Получено ${base64Images.length} изображений`)
      return base64Images
      
    } catch (error: any) {
      console.error('❌ [PDF] Ошибка конвертации:', error)
      throw new Error(`Ошибка конвертации PDF: ${error.message}`)
    }
  }

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    setResult('')
    setExtractedData('')
    setError(null)
    setLoading(true)

    try {
      console.log('🧬 [GENETIC PAGE] Этап 1: Извлечение данных из файла...')

      // Если PDF, конвертируем в изображения на клиенте
      if (uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        console.log('📄 [GENETIC PAGE] PDF обнаружен, конвертируем в изображения...')
        
        if (!pdfjsReady) {
          setError('PDF.js еще не загружен. Подождите несколько секунд и попробуйте снова.')
          setLoading(false)
          return
        }

        setConvertingPDF(true)
        setConversionProgress({ current: 0, total: 7 })

        try {
          const base64Images = await convertPDFToImages(uploadedFile)
          console.log(`✅ [GENETIC PAGE] PDF конвертирован в ${base64Images.length} изображений`)
          
          // Проверяем что изображения получены
          if (base64Images.length === 0) {
            throw new Error('Не удалось конвертировать PDF в изображения')
          }
          
          const totalSize = base64Images.reduce((sum, img) => sum + img.length, 0)
          console.log(`📊 [GENETIC PAGE] Общий размер изображений: ${Math.round(totalSize / 1024)} KB`)

          // Отправляем изображения на сервер для извлечения данных
          console.log(`📤 [GENETIC PAGE] Отправка ${base64Images.length} изображений на сервер для извлечения данных...`)
          console.log(`📊 [GENETIC PAGE] Размеры изображений:`, base64Images.map((img, idx) => `Стр.${idx+1}: ${Math.round(img.length/1024)}KB`).join(', '))
          
          const extractionResponse = await fetch('/api/analyze/genetic/extract-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              images: base64Images,
              fileName: uploadedFile.name,
            }),
          })
          
          console.log(`📥 [GENETIC PAGE] Ответ сервера: ${extractionResponse.status} ${extractionResponse.statusText}`)

          const extractionData = await extractionResponse.json()
          
          console.log(`📊 [GENETIC PAGE] Данные ответа:`, {
            success: extractionData.success,
            extractedLength: extractionData.extractedData?.length || 0,
            stats: extractionData.stats,
            error: extractionData.error,
          })

          if (!extractionData.success) {
            const errorMsg = extractionData.error || 'Ошибка при извлечении данных'
            const statsInfo = extractionData.stats 
              ? ` (Обработано: ${extractionData.stats.successPages}/${extractionData.stats.totalPages} страниц, ошибок: ${extractionData.stats.errorPages})`
              : ''
            setError(`${errorMsg}${statsInfo}`)
            setLoading(false)
            setConvertingPDF(false)
            return
          }

          console.log('✅ [GENETIC PAGE] Данные извлечены, длина:', extractionData.extractedData?.length)
          setExtractedData(extractionData.extractedData || '')
          setConvertingPDF(false)
          setLoading(false)
          return

        } catch (pdfError: any) {
          console.error('❌ [GENETIC PAGE] Ошибка конвертации PDF:', pdfError)
          setError(`Ошибка конвертации PDF: ${pdfError.message}`)
          setLoading(false)
          setConvertingPDF(false)
          return
        }
      }

      // Для остальных файлов (VCF, TXT, изображения) - стандартная обработка
      const formData = new FormData()
      formData.append('file', uploadedFile)

      const extractionResponse = await fetch('/api/analyze/genetic', {
        method: 'POST',
        body: formData,
      })

      const extractionData = await extractionResponse.json()

      if (!extractionData.success) {
        setError(extractionData.error || 'Ошибка при извлечении данных')
        setLoading(false)
        return
      }

      console.log('✅ [GENETIC PAGE] Данные извлечены, длина:', extractionData.extractedData?.length)
      setExtractedData(extractionData.extractedData || '')
      
      // Логирование использования (этап извлечения)
      logUsage({
        section: 'genetic',
        model: 'google/gemini-2.0-flash-exp:free',
        inputTokens: 3000, // примерное значение для PDF
        outputTokens: 2000,
      })
      
      setLoading(false)

    } catch (err: any) {
      console.error('❌ [GENETIC PAGE] Ошибка:', err)
      setError(err.message || 'Произошла ошибка')
      setLoading(false)
      setConvertingPDF(false)
    }
  }

  const handleSendToGeneticist = async () => {
    if (!extractedData) {
      setError('Нет извлеченных данных для отправки')
      return
    }

    setResult('')
    setError(null)
    setLoading(true)

    try {
      // ЭТАП 2: Отправка на консультацию генетика
      console.log('🧬 [GENETIC PAGE] Этап 2: Отправка на консультацию генетика...')

      const useStreaming = true // Включаем стриминг для режима professor

      // Конвертируем файлы в base64 если есть
      let filesBase64: Array<{ name: string; type: string; base64: string }> = []
      if (additionalFiles.length > 0) {
        console.log(`📎 [GENETIC PAGE] Конвертация ${additionalFiles.length} дополнительных файлов...`)
        filesBase64 = await convertFilesToBase64(additionalFiles)
      }

      const consultResponse = await fetch('/api/analyze/genetic/consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis: extractedData,
          clinicalContext: clinicalContext.trim(),
          question: question.trim() || 'Проанализируйте генетические данные. Извлеките варианты, их значение, клиническую значимость, рекомендации по фармакогеномике.',
          mode: 'professor',
          useStreaming: useStreaming,
          files: filesBase64,
        }),
      })

      if (!consultResponse.ok) {
        const errorText = await consultResponse.text()
        throw new Error(`HTTP error! status: ${consultResponse.status} - ${errorText}`)
      }

      if (useStreaming && consultResponse.body) {
        // Streaming режим
        console.log('📡 [GENETIC PAGE] Запуск streaming режима...')
        
        await handleSSEStream(consultResponse, {
          onChunk: (content: string, accumulatedText: string) => {
            // Обновляем результат по мере получения данных
            setResult(accumulatedText)
          },
          onError: (error: Error) => {
            console.error('❌ [GENETIC PAGE] Ошибка streaming:', error)
            setError(error.message || 'Ошибка при получении данных')
            setLoading(false)
          },
          onComplete: (finalText: string) => {
            console.log('✅ [GENETIC PAGE] Streaming завершён, получено:', finalText.length, 'символов')
            setResult(finalText)
            // Добавляем первый ответ в историю диалога с информацией о файлах
            setChatHistory([
              { 
                role: 'assistant', 
                content: finalText,
                files: filesBase64.length > 0 ? filesBase64 : undefined
              }
            ])
            setLoading(false)
          },
        })
      } else {
        // Обычный режим (fallback)
        const consultData = await consultResponse.json()

        if (consultData.success) {
          setResult(consultData.result)
          // Добавляем первый ответ в историю диалога с информацией о файлах
          setChatHistory([
            { 
              role: 'assistant', 
              content: consultData.result,
              files: filesBase64.length > 0 ? filesBase64 : undefined
            }
          ])
        } else {
          setError(consultData.error || 'Ошибка при анализе')
        }
        
        // Логирование использования (этап консультации)
        logUsage({
          section: 'genetic',
          model: 'anthropic/claude-opus-4.5',
          inputTokens: 4000, // примерное значение для консультации
          outputTokens: 3000,
        })
        
        setLoading(false)
      }
    } catch (err: any) {
      console.error('❌ [GENETIC PAGE] Ошибка:', err)
      setError(err.message || 'Произошла ошибка')
      setLoading(false)
    }
  }

  const handleChatMessage = async () => {
    if ((!chatMessage.trim() && chatFiles.length === 0) || !extractedData || chatHistory.length === 0) return

    const userQuestion = chatMessage.trim()
    setChatMessage('')
    setChatLoading(true)

    // Конвертируем файлы в base64 если есть
    let filesBase64: Array<{ name: string; type: string; base64: string }> = []
    if (chatFiles.length > 0) {
      console.log(`📎 [GENETIC PAGE] Конвертация ${chatFiles.length} файлов для чата...`)
      filesBase64 = await convertFilesToBase64(chatFiles)
      setChatFiles([]) // Очищаем файлы после конвертации
    }

    // Добавляем вопрос пользователя в историю с файлами
    const updatedHistory: Array<{ role: 'user' | 'assistant'; content: string; files?: Array<{ name: string; type: string; base64: string }> }> = [
      ...chatHistory,
      { 
        role: 'user' as const, 
        content: userQuestion || (filesBase64.length > 0 ? `[Прикреплено файлов: ${filesBase64.length}]` : ''),
        files: filesBase64.length > 0 ? filesBase64 : undefined
      }
    ]
    setChatHistory(updatedHistory)

    // Добавляем пустое сообщение ассистента для streaming
    const assistantMessageIndex = updatedHistory.length
    setChatHistory([...updatedHistory, { role: 'assistant' as const, content: '' }])

    try {
      const useStreaming = true

      const consultResponse = await fetch('/api/analyze/genetic/consult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analysis: extractedData,
          clinicalContext: clinicalContext.trim(),
          question: userQuestion || 'Проанализируйте прикрепленные файлы в контексте генетического анализа.',
          mode: 'professor',
          useStreaming: useStreaming,
          history: chatHistory.slice(0, -1), // Вся история кроме последнего пустого сообщения
          isFollowUp: true,
          files: filesBase64,
        }),
      })

      if (!consultResponse.ok) {
        const errorText = await consultResponse.text()
        throw new Error(`HTTP error! status: ${consultResponse.status} - ${errorText}`)
      }

      if (useStreaming && consultResponse.body) {
        // Streaming режим
        await handleSSEStream(consultResponse, {
          onChunk: (content: string, accumulatedText: string) => {
            // Обновляем последнее сообщение ассистента
            setChatHistory(prev => {
              const newHistory = [...prev]
              if (newHistory[assistantMessageIndex]) {
                newHistory[assistantMessageIndex] = {
                  role: 'assistant',
                  content: accumulatedText
                }
              }
              return newHistory
            })
          },
          onError: (error: Error) => {
            console.error('❌ [GENETIC PAGE] Ошибка streaming:', error)
            setError(error.message || 'Ошибка при получении данных')
            setChatLoading(false)
            // Удаляем пустое сообщение при ошибке
            setChatHistory(prev => prev.slice(0, -1))
          },
          onComplete: (finalText: string) => {
            console.log('✅ [GENETIC PAGE] Chat streaming завершён')
            setChatLoading(false)
          },
        })
      } else {
        // Обычный режим (fallback)
        const consultData = await consultResponse.json()

        if (consultData.success) {
          setChatHistory(prev => {
            const newHistory = [...prev]
            newHistory[assistantMessageIndex] = {
              role: 'assistant',
              content: consultData.result
            }
            return newHistory
          })
        } else {
          setError(consultData.error || 'Ошибка при анализе')
          setChatHistory(prev => prev.slice(0, -1))
        }
        setChatLoading(false)
      }
    } catch (err: any) {
      console.error('❌ [GENETIC PAGE] Ошибка chat:', err)
      setError(err.message || 'Произошла ошибка')
      setChatLoading(false)
      // Удаляем пустое сообщение при ошибке
      setChatHistory(prev => prev.slice(0, -1))
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🧬 Генетический анализ</h1>
      
      <AnalysisTips 
        title="Как работает генетический анализ"
        content={{
          fast: "первый этап: извлечение данных из сложных отчетов и VCF‑файлов. Мы используем специализированные алгоритмы для корректного чтения rsID и генотипов.",
          validated: "второй этап: консультация «Профессора генетики» (Gemini JSON + Opus 4.5) — самый точный клинический разбор рисков; самый дорогой режим.",
          extra: [
            "⭐ Рекомендуемый режим: «Оптимизированный» (Sonnet 4.5) — лучший баланс глубины анализа и скорости для генетики.",
            "🧬 Поддерживаются VCF файлы, PDF отчеты (до 7 страниц), текстовые файлы и фото бумажных бланков.",
            "👤 Рекомендуется добавить клинический контекст для более точной интерпретации результатов.",
            "💬 После получения заключения вы можете продолжить диалог с генетиком для уточнения деталей.",
            "📎 Можно прикреплять дополнительные анализы и документы прямо в чат."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите генетический отчет</h2>
        <p className="text-sm text-gray-600 mb-4">
          Поддерживаемые форматы: VCF, PDF, TXT, изображения
        </p>
        <ImageUpload onUpload={handleUpload} accept=".vcf,.pdf,.txt,image/*" maxSize={50} />
        
        {convertingPDF && (
          <div className="mt-4 text-blue-600">
            <div className="flex items-center gap-2 mb-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Конвертация PDF в изображения...</span>
            </div>
            {conversionProgress.total > 0 && (
              <div className="text-sm">
                Страница {conversionProgress.current} из {conversionProgress.total}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {extractedData && !result && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📊 Извлеченные генетические данные</h2>
          <div className="bg-gray-50 p-4 rounded-lg mb-6 max-h-96 overflow-y-auto">
            <div className="text-sm text-gray-800 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-1 [&_li]:marker:text-blue-600 [&_code]:bg-gray-200 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_strong]:font-semibold [&_strong]:text-gray-900">
              <ReactMarkdown>
                {convertToMarkdown(extractedData)}
              </ReactMarkdown>
            </div>
          </div>

          {/* Клинический контекст и дополнительные вопросы */}
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="clinicalContext" className="block text-sm font-semibold text-gray-700 mb-2">
                👤 Клинический контекст пациента (опционально)
              </label>
              <textarea
                id="clinicalContext"
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                placeholder="Пример: Пациентка, 45 лет. Жалобы на повышенную утомляемость, головные боли. Семейный анамнез: у матери инфаркт миокарда в 60 лет. Принимает метформин, аспирин. Интересует влияние генетических вариантов на метаболизм препаратов и риски сердечно-сосудистых заболеваний."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y min-h-[100px] text-sm"
                rows={4}
              />
              <p className="mt-1 text-xs text-gray-500">
                💡 Эта информация поможет генетику дать более точное и персонализированное заключение
              </p>
            </div>

            <div>
              <label htmlFor="question" className="block text-sm font-semibold text-gray-700 mb-2">
                ❓ Дополнительный вопрос генетику (опционально)
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Пример: Особое внимание к фармакогеномике (метаболизм метформина, аспирина), рискам сердечно-сосудистых заболеваний, нутригеномике (витамины группы B, фолиевая кислота). Дайте конкретные рекомендации по дозировкам."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[80px] text-sm"
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500">
                💡 Если не указано, будет выполнен стандартный анализ генетических данных
              </p>
            </div>

            {/* Загрузка дополнительных файлов */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📎 Дополнительные файлы (опционально)
              </label>
              <div className="border border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setAdditionalFiles(Array.from(e.target.files))
                    }
                  }}
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                {additionalFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {additionalFiles.map((file, index) => (
                      <div key={index} className="text-xs text-gray-600 flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span>{file.name}</span>
                        <button
                          onClick={() => {
                            setAdditionalFiles(additionalFiles.filter((_, i) => i !== index))
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                💡 Можно прикрепить дополнительные документы, анализы, изображения для более полного анализа
              </p>
            </div>
          </div>

          <button
            onClick={handleSendToGeneticist}
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white px-6 py-3 rounded-lg font-medium transition-colors text-base"
          >
            {loading ? '⏳ Отправка генетику...' : '🧬 Отправить генетику'}
          </button>
        </div>
      )}

      <AnalysisResult 
        result={chatHistory.length > 0 ? chatHistory[chatHistory.length - 1]?.content || result : result} 
        loading={loading && !extractedData} 
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="GENETICS" 
          analysisResult={chatHistory.length > 0 ? chatHistory[chatHistory.length - 1]?.content || result : result} 
          inputCase={clinicalContext}
        />
      )}

      {/* Продолжение диалога с генетиком */}
      {result && chatHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">💬 Продолжение диалога с генетиком</h2>
          
          {/* История диалога */}
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.role === 'user'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="text-xs font-semibold mb-1 opacity-70">
                    {msg.role === 'user' ? '👤 Вы' : '🧬 Генетик'}
                  </div>
                  {msg.files && msg.files.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.files.map((file, fileIndex) => (
                        <div key={fileIndex} className="text-xs text-gray-600 bg-white bg-opacity-50 p-1 rounded">
                          📎 {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-sm leading-relaxed">
                    {msg.content ? (
                      <ReactMarkdown
                        className="[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-1 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-2 [&_ul]:space-y-0.5 [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-2 [&_ol]:space-y-0.5 [&_li]:mb-0.5 [&_strong]:font-semibold [&_code]:bg-gray-200 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      chatLoading && index === chatHistory.length - 1 ? '⏳ Генетик печатает...' : ''
                    )}
                  </div>
                </div>
              </div>
            ))}
            {chatLoading && chatHistory[chatHistory.length - 1]?.role === 'assistant' && !chatHistory[chatHistory.length - 1]?.content && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm text-gray-600">Генетик печатает...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Поле ввода для продолжения диалога */}
          <div className="space-y-2">
            {chatFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {chatFiles.map((file, index) => (
                  <div key={index} className="text-xs text-gray-700 bg-gray-100 px-3 py-1 rounded-full flex items-center gap-2">
                    <span>📎 {file.name}</span>
                    <button
                      onClick={() => {
                        setChatFiles(chatFiles.filter((_, i) => i !== index))
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setChatFiles([...chatFiles, ...Array.from(e.target.files)])
                  }
                }}
                className="hidden"
                id="chat-file-input"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="chat-file-input"
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors cursor-pointer flex items-center"
              >
                📎
              </label>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatMessage()
                  }
                }}
                placeholder="Задайте дополнительный вопрос генетику..."
                disabled={chatLoading}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleChatMessage}
                disabled={(!chatMessage.trim() && chatFiles.length === 0) || chatLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                {chatLoading ? '⏳' : '📤'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            💡 Вы можете задавать дополнительные вопросы о генетическом анализе. Генетик будет учитывать предыдущий контекст.
          </p>
        </div>
      )}
    </div>
  )
}
