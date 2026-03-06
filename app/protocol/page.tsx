'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import AudioUpload from '@/components/AudioUpload'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx'
import { saveAs } from 'file-saver'
import { DEFAULT_TEMPLATES, ProtocolTemplate } from '@/lib/protocol-templates'
import { UNIVERSAL_SPECIALIST_TEMPLATES } from '@/lib/prompts'
import { MODELS } from '@/lib/openrouter'
import { handleSSEStream } from '@/lib/streaming-utils'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { saveDocument, getDocumentChunks, searchLibraryLocal } from '@/lib/library-db'
import { anonymizeText } from '@/lib/anonymization'
import mammoth from 'mammoth'

declare global {
  interface Window {
    pdfjsLib: any
  }
}

const PROTOCOL_DRAFT_KEY = 'protocol_draft'
const PROTOCOL_TEMPLATE_RAG_KEY = 'protocol_template_rag_doc_id'
const ECG_FUNCTIONAL_TEMPLATE_ID = 'ecg-functional-conclusion'
const CYRILLIC_REGEX = /[А-Яа-яЁё]/

function chunkTemplateForRag(content: string, maxChunkLength: number = 1200): string[] {
  const clean = content.replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const parts = clean
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buffer = ''

  for (const part of parts) {
    if (!buffer) {
      buffer = part
      continue
    }

    const candidate = `${buffer}\n\n${part}`
    if (candidate.length <= maxChunkLength) {
      buffer = candidate
    } else {
      chunks.push(buffer)
      buffer = part
    }
  }

  if (buffer) chunks.push(buffer)
  return chunks.slice(0, 10)
}

export default function ProtocolPage() {
  const [rawText, setRawText] = useState('')
  const [showAudioUpload, setShowAudioUpload] = useState(false)
  const [protocol, setProtocol] = useState('')
  const [loading, setLoading] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [model, setModel] = useState<'sonnet' | 'opus' | 'gemini' | 'gpt52'>('sonnet')
  const [currentCost, setCurrentCost] = useState<number>(0)
  
  // Состояния для специалистов и шаблонов
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATES[0].id)
  const [specialistName, setSpecialistName] = useState(DEFAULT_TEMPLATES[0].specialist)
  const [customTemplate, setCustomTemplate] = useState(DEFAULT_TEMPLATES[0].content)
  const [isEditingTemplate, setIsEditingTemplate] = useState(false)
  const [templateRagDocId, setTemplateRagDocId] = useState<string | null>(null)
  const [isTemplateLocked, setIsTemplateLocked] = useState(false)
  const [strictTemplateMode, setStrictTemplateMode] = useState(true)

  // Универсальные промпты
  const [selectedUniversalKey, setSelectedUniversalKey] = useState<string>('')
  const [universalPrompt, setUniversalPrompt] = useState<string>('')
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      const script = document.createElement('script')
      script.src = '/pdfjs/pdf.min.js'
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
          setPdfJsLoaded(true)
        }
      }
      script.onerror = () => {
        console.warn('⚠️ Failed to load PDF.js on protocol page')
      }
      document.head.appendChild(script)
    } else if (window.pdfjsLib) {
      setPdfJsLoaded(true)
    }
  }, [])

  // Загрузка пользовательского шаблона при старте
  useEffect(() => {
    const saved = localStorage.getItem('user_protocol_template')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const hasLegacyRussianTemplate =
          CYRILLIC_REGEX.test(parsed?.template || '') ||
          CYRILLIC_REGEX.test(parsed?.name || '')

        // Reset legacy RU template snapshot to keep EN-global branch consistent.
        if (hasLegacyRussianTemplate) {
          localStorage.removeItem('user_protocol_template')
        } else {
          setCustomTemplate(parsed.template)
          setSpecialistName(parsed.name || specialistName)
          setIsEditingTemplate(true)
          setIsTemplateLocked(Boolean(parsed.isTemplateLocked))
          setStrictTemplateMode(parsed.strictTemplateMode !== false)
          if (parsed.ragDocId) {
            setTemplateRagDocId(parsed.ragDocId)
          }
        }
      } catch (e) {}
    }
    const ragDocId = localStorage.getItem(PROTOCOL_TEMPLATE_RAG_KEY)
    if (ragDocId) setTemplateRagDocId(ragDocId)
  }, [])

  // Импорт черновика протокола (например, из анализа ЭКГ)
  useEffect(() => {
    const raw = localStorage.getItem(PROTOCOL_DRAFT_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as { kind?: string; rawText?: string; templateId?: string }
      if (!parsed?.rawText) return

      // Сразу подставляем текст и нужный шаблон, затем очищаем черновик,
      // чтобы повторно не подставлялся при обновлении страницы.
      setRawText(parsed.rawText)
      const tpl = DEFAULT_TEMPLATES.find(t => t.id === (parsed.templateId || ''))
      if (tpl) {
        applyTemplate(tpl, { force: true })
      }
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem(PROTOCOL_DRAFT_KEY)
    }
  }, [])

  const handleUniversalSelect = (key: string) => {
    setSelectedUniversalKey(key)
    if (key && UNIVERSAL_SPECIALIST_TEMPLATES[key]) {
      const tpl = UNIVERSAL_SPECIALIST_TEMPLATES[key]
      setUniversalPrompt(tpl.prompt)
      setSpecialistName(tpl.name)
      
      // Если у специалиста есть своя структура, подставляем её
      if (tpl.structure && !isTemplateLocked) {
        setCustomTemplate(tpl.structure)
      }
    } else {
      setUniversalPrompt('')
    }
  }

  const handleSaveAsDefault = () => {
    const data = {
      template: customTemplate,
      name: specialistName,
      ragDocId: templateRagDocId,
      isTemplateLocked,
      strictTemplateMode
    }
    localStorage.setItem('user_protocol_template', JSON.stringify(data))
    alert('Template saved as your personal standard!')
  }

  const readTextFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => resolve((event.target?.result as string) || '')
      reader.onerror = () => reject(new Error('Failed to read text file'))
      reader.readAsText(file)
    })

  const normalizeInlineText = (value: string): string =>
    value.replace(/\s+/g, ' ').trim()

  const escapeMdCell = (value: string): string =>
    normalizeInlineText(value).replace(/\|/g, '\\|')

  const tableToMarkdown = (table: HTMLTableElement): string => {
    const rows = Array.from(table.querySelectorAll('tr'))
      .map((row) =>
        Array.from(row.querySelectorAll('th, td')).map((cell) => escapeMdCell(cell.textContent || ''))
      )
      .filter((cells) => cells.length > 0)

    if (rows.length === 0) return ''

    const columnCount = Math.max(...rows.map((r) => r.length))
    const normalizeRow = (row: string[]) =>
      [...row, ...new Array(Math.max(0, columnCount - row.length)).fill('')].slice(0, columnCount)

    const header = normalizeRow(rows[0])
    const bodyRows = rows.slice(1).map(normalizeRow)
    const ensuredBodyRows = bodyRows.length > 0 ? bodyRows : [new Array(columnCount).fill('')]

    const headerLine = `| ${header.join(' | ')} |`
    const separatorLine = `| ${new Array(columnCount).fill('---').join(' | ')} |`
    const bodyLines = ensuredBodyRows.map((row) => `| ${row.join(' | ')} |`)

    return [headerLine, separatorLine, ...bodyLines].join('\n')
  }

  const htmlToTemplateText = (html: string): string => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const blocks: string[] = []

    const pushBlock = (text: string) => {
      const normalized = text.replace(/\u00A0/g, ' ').replace(/\s+\n/g, '\n').trim()
      if (normalized) blocks.push(normalized)
    }

    const walk = (element: Element) => {
      const tag = element.tagName.toLowerCase()

      if (tag === 'table') {
        const mdTable = tableToMarkdown(element as HTMLTableElement)
        pushBlock(mdTable)
        return
      }

      if (tag === 'ul') {
        const items = Array.from(element.querySelectorAll(':scope > li'))
          .map((li) => normalizeInlineText(li.textContent || ''))
          .filter(Boolean)
          .map((item) => `- ${item}`)
        pushBlock(items.join('\n'))
        return
      }

      if (tag === 'ol') {
        const items = Array.from(element.querySelectorAll(':scope > li'))
          .map((li) => normalizeInlineText(li.textContent || ''))
          .filter(Boolean)
          .map((item, index) => `${index + 1}. ${item}`)
        pushBlock(items.join('\n'))
        return
      }

      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag.slice(1))
        const text = normalizeInlineText(element.textContent || '')
        if (text) pushBlock(`${'#'.repeat(level)} ${text}`)
        return
      }

      if (tag === 'p') {
        const text = normalizeInlineText(element.textContent || '')
        if (text) pushBlock(text)
        return
      }

      const children = Array.from(element.children)
      if (children.length === 0) {
        const text = normalizeInlineText(element.textContent || '')
        if (text) pushBlock(text)
        return
      }

      children.forEach(walk)
    }

    Array.from(doc.body.children).forEach(walk)
    return blocks.join('\n\n').trim()
  }

  const extractWordTemplate = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer })
      const structured = htmlToTemplateText(htmlResult.value || '')
      if (structured) return structured

      const fallbackText = await mammoth.extractRawText({ arrayBuffer })
      return fallbackText.value?.trim() || ''
    } catch (error) {
      console.error('Word extract error:', error)
      throw new Error('Failed to read Word file. For .doc, prefer .docx.')
    }
  }

  const extractPdfTemplate = async (file: File): Promise<string> => {
    if (!pdfJsLoaded || !window.pdfjsLib) {
      throw new Error('PDF module is still loading. Wait 2-3 seconds and try again.')
    }

    const pdfjs = window.pdfjsLib
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer, verbosity: 0 })
    const pdf = await loadingTask.promise
    const maxPages = Math.min(pdf.numPages, 15)
    const pages: string[] = []

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const items = (textContent.items || []) as Array<{ str?: string }>
      const pageText = items
        .map((item) => item.str || '')
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim()

      if (pageText) {
        pages.push(`=== Page ${pageNum} ===\n${pageText}`)
      }
    }

    return pages.join('\n\n')
  }

  const extractTemplateContent = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase()

    if (name.endsWith('.txt') || file.type.startsWith('text/')) {
      return readTextFile(file)
    }

    if (name.endsWith('.docx') || name.endsWith('.doc')) {
      return extractWordTemplate(file)
    }

    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      return extractPdfTemplate(file)
    }

    throw new Error('Supported formats: .txt, .doc/.docx, .pdf')
  }

  const handleLoadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    void (async () => {
      const content = (await extractTemplateContent(file)).trim()
      if (!content) {
        throw new Error('File was read, but template content is empty.')
      }

      setCustomTemplate(content)
      setIsEditingTemplate(true)
      setIsTemplateLocked(true)

      const chunks = chunkTemplateForRag(content)
      if (chunks.length === 0) return

      const docId = `protocol-template-${Date.now()}`
      await saveDocument(
        {
          id: docId,
          name: `Protocol template: ${file.name}`,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          chunksCount: chunks.length,
        },
        chunks
      )
      setTemplateRagDocId(docId)
      localStorage.setItem(PROTOCOL_TEMPLATE_RAG_KEY, docId)
      alert('Template loaded and saved to library as RAG sample.')
    })().catch((error) => {
      console.error('Template load error:', error)
      alert(error?.message || 'Failed to load template file.')
    }).finally(() => {
      e.target.value = ''
    })
  }

  const handleGenerateProtocol = async () => {
    if (!rawText.trim()) return

    setLoading(true)
    setProtocol('')
    setCurrentCost(0)

    const modelUsed = model === 'opus' ? MODELS.OPUS : 
                    model === 'gpt52' ? MODELS.GPT_5_2 :
                    model === 'gemini' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET;

    const modelsMap: Record<string, string> = {
      'opus': MODELS.OPUS,
      'sonnet': MODELS.SONNET,
      'gpt52': MODELS.GPT_5_2,
      'gemini': MODELS.GEMINI_3_FLASH
    };

    const finalModel = modelsMap[model] || MODELS.SONNET;
    const safeRawText = anonymizeText(rawText.trim())

    try {
      let ragExamples: string[] = []
      if (templateRagDocId) {
        ragExamples = await getDocumentChunks(templateRagDocId, 8)
      } else if (safeRawText) {
        ragExamples = await searchLibraryLocal(`${specialistName} ${safeRawText}`, 3)
      }

      const payload = {
        rawText: safeRawText,
        useStreaming: useStreaming,
        model: model,
        templateId: selectedTemplateId,
        customTemplate: customTemplate,
        specialistName: specialistName,
        // Добавляем универсальный промпт, если он есть
        universalPrompt: universalPrompt,
        ragExamples,
        strictTemplateMode,
      };

      if (useStreaming) {
        const response = await fetch('/api/protocol', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        await handleSSEStream(response, {
          onChunk: (text) => {
            setProtocol(prev => prev + text)
          },
          onUsage: (usage) => {
            console.log('📊 [PROTOCOL STREAMING] Получена точная стоимость:', usage.total_cost)
            setCurrentCost(usage.total_cost)
            
            logUsage({
              section: 'protocols',
              model: usage.model || finalModel,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
              specialty: specialistName // Передаем специальность для аудита
            });
          },
          onComplete: (finalText) => {
            console.log('✅ [PROTOCOL STREAMING] Протокол готов')
          }
        })
      } else {
        const response = await fetch('/api/protocol', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json()
        if (data.success) {
          setProtocol(data.protocol)
          const inputTokens = Math.ceil(rawText.length / 4) + 1000;
          const outputTokens = Math.ceil(data.protocol.length / 4);
          const costInfo = calculateCost(inputTokens, outputTokens, finalModel);
          setCurrentCost(costInfo.totalCostUnits);

          logUsage({
            section: 'protocols',
            model: finalModel,
            inputTokens,
            outputTokens,
            specialty: specialistName // Передаем специальность для аудита
          });
        }
        else setProtocol(`Error: ${data.error}`)
      }
    } catch (err: any) {
      setProtocol(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Функция применения шаблона
  const applyTemplate = (tpl: ProtocolTemplate, options?: { force?: boolean }) => {
    setSelectedTemplateId(tpl.id)
    setSpecialistName(tpl.specialist)
    if (!isTemplateLocked || options?.force) {
      setCustomTemplate(tpl.content)
    }
    // Не смешиваем универсальные директивы с выбранным шаблоном
    setSelectedUniversalKey('')
    setUniversalPrompt('')
  }

  const handleExportToDocx = async () => {
    if (!protocol) return
    try {
      const lines = protocol.split('\n')
      const paragraphs: any[] = []
      for (const line of lines) {
        if (!line.trim()) {
          paragraphs.push(new Paragraph({ text: '' }))
          continue
        }
        if (line.startsWith('# ')) {
          paragraphs.push(new Paragraph({ text: line.replace('# ', ''), heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }))
        } else if (line.startsWith('## ')) {
          paragraphs.push(new Paragraph({ text: line.replace('## ', ''), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }))
        } else if (line.startsWith('### ')) {
          paragraphs.push(new Paragraph({ text: line.replace('### ', ''), heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }))
        } else {
          const textRuns: TextRun[] = []
          const boldRegex = /\*\*(.*?)\*\*/g
          let lastIndex = 0
          let match
          while ((match = boldRegex.exec(line)) !== null) {
            if (match.index > lastIndex) textRuns.push(new TextRun({ text: line.substring(lastIndex, match.index) }))
            textRuns.push(new TextRun({ text: match[1], bold: true }))
            lastIndex = match.index + match[0].length
          }
          if (lastIndex < line.length) textRuns.push(new TextRun({ text: line.substring(lastIndex) }))
          paragraphs.push(new Paragraph({ children: textRuns.length > 0 ? textRuns : [new TextRun({ text: line })], spacing: { after: 120 } }))
        }
      }
      const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] })
      const blob = await Packer.toBlob(doc)
      const datePart = new Date().toISOString().split('T')[0]
      const filePrefix = selectedTemplateId === ECG_FUNCTIONAL_TEMPLATE_ID ? 'Protocol_ECG' : 'Protocol_Appointment'
      saveAs(blob, `${filePrefix}_${datePart}.docx`)
    } catch (err: any) {
      alert('Export error: ' + err.message)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">
        {selectedTemplateId === ECG_FUNCTIONAL_TEMPLATE_ID ? '🫀 ECG Protocol' : '📝 Appointment Protocol'}
      </h1>
      
      {showAudioUpload && (
        <div className="mb-4 bg-white rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">🎤 Audio Upload</h3>
            <button onClick={() => setShowAudioUpload(false)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <AudioUpload onTranscribe={(transcript) => {
            setRawText(prev => prev ? prev + '\n\n' + transcript : transcript)
            setShowAudioUpload(false)
          }} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Settings and Input</h2>

          {/* Специалист и Шаблоны */}
          <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">👨‍⚕️ Who is performing the examination:</label>
                <input 
                  type="text"
                  value={specialistName}
                  onChange={(e) => setSpecialistName(e.target.value)}
                  placeholder="Example: Neurologist"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">🏥 Specialty (template):</label>
                <select 
                  value={selectedUniversalKey}
                  onChange={(e) => handleUniversalSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm bg-white"
                >
                  <option value="">-- Select specialty --</option>
                  {Object.entries(UNIVERSAL_SPECIALIST_TEMPLATES).map(([key, tpl]) => (
                    <option key={key} value={key}>{tpl.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedUniversalKey && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">AI Instructions (editable):</label>
                  <span className="text-[10px] text-gray-400 italic">Focus: {UNIVERSAL_SPECIALIST_TEMPLATES[selectedUniversalKey].focus}</span>
                </div>
                <textarea
                  value={universalPrompt}
                  onChange={(e) => setUniversalPrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[60px] bg-indigo-50/30 font-medium leading-relaxed"
                  placeholder="Specific instructions for this clinician..."
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider italic">Quick formatting:</label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                      selectedTemplateId === tpl.id 
                        ? 'bg-primary-500 text-white border-primary-600' 
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsEditingTemplate(!isEditingTemplate)}
              className="text-[10px] font-bold text-primary-600 hover:underline flex items-center gap-1 uppercase tracking-tighter"
            >
              {isEditingTemplate ? '🔼 Hide document structure' : '⚙️ Configure document structure (H1, H2...)'}
            </button>

            {isEditingTemplate && (
              <div className="mt-2 animate-in fade-in slide-in-from-top-1 space-y-2">
                <textarea
                  value={customTemplate}
                  onChange={(e) => {
                    setCustomTemplate(e.target.value)
                    if (!isTemplateLocked) setIsTemplateLocked(true)
                  }}
                  className="w-full px-3 py-2 text-[10px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-h-[150px] font-mono leading-tight bg-white"
                />
                <label className="inline-flex items-center gap-2 text-[10px] font-semibold text-indigo-700">
                  <input
                    type="checkbox"
                    checked={isTemplateLocked}
                    onChange={(e) => setIsTemplateLocked(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  🔒 Pin my template (do not overwrite when changing specialist)
                </label>
                <label className="inline-flex items-center gap-2 text-[10px] font-semibold text-indigo-700">
                  <input
                    type="checkbox"
                    checked={strictTemplateMode}
                    onChange={(e) => setStrictTemplateMode(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  🧷 Strictly preserve template structure
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveAsDefault}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    💾 Save as my standard
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-[10px] font-bold hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    📁 Load from file (.txt/.docx/.pdf)
                  </button>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLoadFromFile}
                    accept=".txt,.doc,.docx,.pdf,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Text to process:</label>
              <VoiceInput 
                onTranscript={(text) => setRawText(prev => prev ? prev + ' ' + text : text)}
                disabled={loading}
                className="!bg-indigo-600 !text-white hover:!bg-indigo-700"
                placeholder="Dictate"
              />
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Enter examination data or use 🎤..."
              data-tour="protocol-input"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-h-[300px]"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => setShowAudioUpload(!showAudioUpload)} className="px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg transition-colors text-sm" disabled={loading}>
              📁 Audio file
            </button>
            <button onClick={() => setRawText('')} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm" disabled={!rawText || loading}>
              🗑️ Clear
            </button>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useStreaming} onChange={(e) => setUseStreaming(e.target.checked)} className="w-4 h-4 text-primary-600" disabled={loading} />
              <span className="text-sm">Streaming</span>
            </label>
            <select value={model} onChange={(e) => setModel(e.target.value as any)} className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-primary-500" disabled={loading}>
              <option value="sonnet">🤖 Sonnet 4.6</option>
              <option value="gpt52">🚀 GPT-5.2</option>
              <option value="opus">🧠 Opus 4.6</option>
              <option value="gemini">⚡ Gemini 3.1</option>
            </select>
          </div>

          <button onClick={handleGenerateProtocol} data-tour="protocol-generate-button" disabled={!rawText.trim() || loading} className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 font-semibold shadow-md">
            {loading ? '⏳ Generating...' : '📝 Generate Protocol'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Generated Protocol</h2>
              {currentCost > 0 && (
                <div className="mt-1 bg-teal-50 text-teal-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-teal-200 inline-block shadow-sm">
                  💰 Service cost: {currentCost.toFixed(2)} cr.
                </div>
              )}
            </div>
            {protocol && (
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(protocol); alert('Copied'); }} className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm">📋</button>
                <button onClick={handleExportToDocx} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm">📄 DOCX</button>
              </div>
            )}
          </div>
          
          {protocol ? (
            <div data-tour="protocol-generated-result" className="prose prose-sm max-w-none border border-gray-200 rounded-lg p-6 bg-white overflow-y-auto max-h-[800px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{protocol}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-20 border-2 border-dashed border-gray-100 rounded-lg">
              {loading ? <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div> : <p className="text-4xl mb-4 opacity-20">📄</p>}
              <p>{loading ? 'AI is generating protocol...' : 'Result will appear here'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
