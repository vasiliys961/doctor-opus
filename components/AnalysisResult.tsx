'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx'
import { saveAs } from 'file-saver'
import { saveAnalysisResult, getAllPatients, Patient } from '@/lib/patient-db'

interface AnalysisResultProps {
  result: string
  loading?: boolean
  model?: string
  mode?: string
  imageType?: string
}

export default function AnalysisResult({ result, loading = false, model, mode, imageType }: AnalysisResultProps) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showPatientSelector, setShowPatientSelector] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (showPatientSelector) {
      loadPatients()
    }
  }, [showPatientSelector])

  const loadPatients = async () => {
    try {
      const allPatients = await getAllPatients()
      setPatients(allPatients)
    } catch (error) {
      console.error('Ошибка при загрузке пациентов:', error)
    }
  }

  const handleSaveToPatient = async (patientId: string) => {
    setSaving(true)
    try {
      await saveAnalysisResult({
        patientId,
        type: 'image', // Можно расширить в зависимости от контекста
        conclusion: result,
        imageType: imageType
      })
      alert('Результат успешно сохранен в карту пациента!')
      setShowPatientSelector(false)
    } catch (error) {
      console.error('Ошибка при сохранении:', error)
      alert('Не удалось сохранить результат.')
    } finally {
      setSaving(false)
    }
  }

  const getModelDisplayName = (modelName?: string) => {
    if (!modelName) return null
    if (modelName.includes('opus')) return '🧠 Opus 4.5'
    if (modelName.includes('sonnet')) return '🤖 Sonnet 4.5'
    if (modelName.includes('gemini') || modelName.includes('flash')) return '⚡ Gemini Flash'
    return modelName
  }

  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadDoc = async () => {
    setDownloading(true)
    try {
      // Парсим markdown и создаем параграфы для DOCX
      const lines = result.split('\n')
      const paragraphs: any[] = []

      // Медицинский заголовок
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "МЕДИЦИНСКИЙ КОНСУЛЬТАТИВНЫЙ ОТЧЕТ", bold: true, size: 28 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      )

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Дата: ${new Date().toLocaleDateString('ru-RU')}`, size: 20 }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 400 },
        })
      )

      // Информация о модели (техническая сноска)
      if (model) {
        const modelName = getModelDisplayName(model) || model;
        const analysisMode = mode === 'fast' ? 'быстрый' : mode === 'optimized' ? 'оптимизированный' : 'с валидацией';
        
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: `Техническая информация: Анализ выполнен ИИ-системой (модель ${modelName}, режим: ${analysisMode}). `,
                italics: true,
                size: 16,
                color: "666666"
              }),
            ],
            spacing: { after: 200 },
          })
        )
      }

      // Разделительная линия (горизонтальная черта)
      paragraphs.push(new Paragraph({ 
        text: "________________________________________________________________________________",
        spacing: { after: 300 }
      }))

      // Парсим содержимое
      for (const line of lines) {
        if (!line.trim()) {
          // Пустая строка
          paragraphs.push(new Paragraph({ text: '' }))
          continue
        }

        // Заголовок H1
        if (line.match(/^#\s+/)) {
          paragraphs.push(
            new Paragraph({
              text: line.replace(/^#\s+/, ''),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 },
            })
          )
        }
        // Заголовок H2
        else if (line.match(/^##\s+/)) {
          paragraphs.push(
            new Paragraph({
              text: line.replace(/^##\s+/, ''),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            })
          )
        }
        // Заголовок H3
        else if (line.match(/^###\s+/)) {
          paragraphs.push(
            new Paragraph({
              text: line.replace(/^###\s+/, ''),
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 160, after: 80 },
            })
          )
        }
        // Заголовок H4
        else if (line.match(/^####\s+/)) {
          paragraphs.push(
            new Paragraph({
              text: line.replace(/^####\s+/, ''),
              heading: HeadingLevel.HEADING_4,
              spacing: { before: 120, after: 60 },
            })
          )
        }
        // Маркированный список
        else if (line.match(/^[-*]\s+/)) {
          const text = line.replace(/^[-*]\s+/, '')
          const textRuns = parseMarkdownTextRuns(text)
          paragraphs.push(
            new Paragraph({
              children: textRuns,
              bullet: { level: 0 },
              spacing: { after: 60 },
            })
          )
        }
        // Нумерованный список
        else if (line.match(/^\d+\.\s+/)) {
          const text = line.replace(/^\d+\.\s+/, '')
          const textRuns = parseMarkdownTextRuns(text)
          paragraphs.push(
            new Paragraph({
              children: textRuns,
              numbering: { level: 0 },
              spacing: { after: 60 },
            })
          )
        }
        // Код блок (начинается с ```)
        else if (line.startsWith('```')) {
          // Пропускаем строки кода - они будут обработаны отдельно
          continue
        }
        // Обычный текст
        else {
          const textRuns = parseMarkdownTextRuns(line)
          paragraphs.push(
            new Paragraph({
              children: textRuns,
              spacing: { after: 120 },
            })
          )
        }
      }

      // Создаем документ
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      })

      // Экспортируем
      const blob = await Packer.toBlob(doc)
      saveAs(blob, `результат_анализа_${new Date().toISOString().split('T')[0]}.docx`)
    } catch (error) {
      console.error('Ошибка при скачивании документа:', error)
      alert('Ошибка при скачивании документа. Попробуйте еще раз.')
    } finally {
      setDownloading(false)
    }
  }

  const parseMarkdownTextRuns = (text: string): TextRun[] => {
    if (!text) return [new TextRun({ text: '' })]
    
    // Сначала обрабатываем код (он в обратных кавычках и не конфликтует)
    const codeParts: Array<{ start: number; end: number; text: string }> = []
    const codeRegex = /`([^`]+)`/g
    let match
    while ((match = codeRegex.exec(text)) !== null) {
      codeParts.push({ start: match.index, end: match.index + match[0].length, text: match[1] })
    }

    const textRuns: TextRun[] = []
    let lastIndex = 0
    let codeIndex = 0

    // Обрабатываем текст по частям
    for (let i = 0; i <= text.length; i++) {
      // Проверяем, достигли ли мы начала блока кода
      if (codeIndex < codeParts.length && i === codeParts[codeIndex].start) {
        // Добавляем текст до кода
        if (i > lastIndex) {
          const beforeCode = text.substring(lastIndex, i)
          if (beforeCode) {
            textRuns.push(...parseBoldItalicTextRuns(beforeCode))
          }
        }
        // Добавляем код
        textRuns.push(new TextRun({ text: codeParts[codeIndex].text, font: 'Courier New' }))
        lastIndex = codeParts[codeIndex].end
        i = codeParts[codeIndex].end - 1
        codeIndex++
        continue
      }
    }

    // Оставшийся текст после всех блоков кода
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        textRuns.push(...parseBoldItalicTextRuns(remainingText))
      }
    }

    return textRuns.length > 0 ? textRuns : [new TextRun({ text })]
  }

  const parseBoldItalicTextRuns = (text: string): TextRun[] => {
    if (!text) return [new TextRun({ text: '' })]
    
    const textRuns: TextRun[] = []
    let lastIndex = 0

    // Сначала обрабатываем жирный текст **text**
    const boldRegex = /\*\*(.*?)\*\*/g
    let match

    while ((match = boldRegex.exec(text)) !== null) {
      // Текст до bold
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index)
        if (beforeText) {
          // Проверяем на курсив в этом тексте
          textRuns.push(...parseItalicTextRuns(beforeText))
        }
      }
      // Bold текст (может содержать курсив)
      const boldText = match[1]
      const boldRuns = parseItalicTextRuns(boldText)
      boldRuns.forEach(run => {
        textRuns.push(new TextRun({ text: run.text, bold: true, italics: run.italics }))
      })
      lastIndex = match.index + match[0].length
    }

    // Оставшийся текст
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        textRuns.push(...parseItalicTextRuns(remainingText))
      }
    }

    return textRuns.length > 0 ? textRuns : [new TextRun({ text })]
  }

  const parseItalicTextRuns = (text: string): TextRun[] => {
    if (!text) return [new TextRun({ text: '' })]
    
    const textRuns: TextRun[] = []
    let lastIndex = 0
    let i = 0

    // Обработка курсива *text* (но не **text**)
    while (i < text.length) {
      if (text[i] === '*' && 
          (i === 0 || text[i - 1] !== '*') && 
          (i === text.length - 1 || text[i + 1] !== '*')) {
        // Ищем закрывающую одиночную звездочку
        let endIndex = i + 1
        while (endIndex < text.length) {
          if (text[endIndex] === '*' && 
              (endIndex === text.length - 1 || text[endIndex + 1] !== '*') &&
              (endIndex === 0 || text[endIndex - 1] !== '*')) {
            // Нашли закрывающую звездочку
            break
          }
          endIndex++
        }
        
        if (endIndex < text.length && endIndex > i) {
          // Текст до курсива
          if (i > lastIndex) {
            const beforeText = text.substring(lastIndex, i)
            if (beforeText) {
              textRuns.push(new TextRun({ text: beforeText }))
            }
          }
          // Курсив текст
          const italicText = text.substring(i + 1, endIndex)
          textRuns.push(new TextRun({ text: italicText, italics: true }))
          lastIndex = endIndex + 1
          i = endIndex + 1
          continue
        }
      }
      i++
    }

    // Оставшийся текст
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        textRuns.push(new TextRun({ text: remainingText }))
      }
    }

    return textRuns.length > 0 ? textRuns : [new TextRun({ text })]
  }


  const handleShare = async () => {
    try {
      // Проверяем поддержку Web Share API
      if (navigator.share) {
        await navigator.share({
          title: 'Результат медицинского анализа',
          text: result.substring(0, 1000) + (result.length > 1000 ? '...' : ''),
          url: window.location.href
        })
      } else {
        // Fallback: копируем текст в буфер обмена
        await navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert('Текст скопирован в буфер обмена!')
      }
    } catch (error: any) {
      // Пользователь отменил шаринг или произошла ошибка
      if (error.name !== 'AbortError') {
        console.error('Ошибка при попытке поделиться:', error)
        // Fallback: копируем текст
        await navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert('Текст скопирован в буфер обмена!')
      }
    }
  }

  // Если есть результат, показываем его даже во время загрузки (для streaming)
  if (!result) {
    if (loading) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="text-primary-900 font-semibold">Анализ выполняется...</span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-primary-900">Результат анализа</h3>
          {loading && (
            <div className="flex items-center space-x-2 mt-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">Анализ выполняется...</span>
            </div>
          )}
          {model && (
            <p className="text-sm text-gray-600 mt-1">
              Использована модель: <span className="font-semibold">{getModelDisplayName(model)}</span>
              {mode && <span className="ml-2">({mode === 'fast' ? 'быстрый' : mode === 'optimized' ? 'оптимизированный' : 'с валидацией'})</span>}
            </p>
          )}
          <a 
            href="https://medcalculator.vercel.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 mt-2 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
          >
            🧮 Проверить через Мед. калькуляторы
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPatientSelector(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            📌 В карту пациента
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
          >
            {copied ? '✓ Скопировано' : '📋 Копировать'}
          </button>
          <button
            onClick={handleDownloadDoc}
            disabled={downloading}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? '⏳ Скачивание...' : '📄 Скачать .docx'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
          >
            🖨️ Печать
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
          >
            🔗 Поделиться
          </button>
        </div>
      </div>

      {/* Модальное окно выбора пациента */}
      {showPatientSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-xl">
              <h4 className="font-bold text-indigo-900">Выберите пациента</h4>
              <button 
                onClick={() => setShowPatientSelector(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-2 flex-grow">
              {patients.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 mb-4">База пациентов пуста</p>
                  <a 
                    href="/patients" 
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Перейти к созданию пациента
                  </a>
                </div>
              ) : (
                <div className="space-y-1">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSaveToPatient(p.id)}
                      disabled={saving}
                      className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200 group"
                    >
                      <div className="font-semibold text-gray-900 group-hover:text-indigo-700">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.age} лет • {p.diagnosis || 'Нет диагноза'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t bg-gray-50 rounded-b-xl text-center">
              <button 
                onClick={() => setShowPatientSelector(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="prose max-w-none">
        <div 
          className="text-gray-800 leading-relaxed text-base"
          style={{ 
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
            fontSize: '16px',
            lineHeight: '1.75',
            letterSpacing: '0.01em',
            fontWeight: '400'
          }}
        >
          <ReactMarkdown
            className="[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:space-y-1 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-gray-900 [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2"
          >
            {result}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

