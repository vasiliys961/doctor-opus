'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import AudioUpload from '@/components/AudioUpload'
import VoiceInput from '@/components/VoiceInput'
import SecureProtocolRecorder from '@/components/SecureProtocolRecorder'

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
import { markdownToPlainText } from '@/lib/markdown-to-plain-text'
import mammoth from 'mammoth'

declare global {
  interface Window {
    pdfjsLib: any
  }
}

const PROTOCOL_DRAFT_KEY = 'protocol_draft'
const PROTOCOL_DRAFT_URL_PARAM = 'draftText'
const PROTOCOL_DRAFT_WINDOW_NAME_PREFIX = 'secure_protocol_draft:'
const PROTOCOL_TEMPLATE_RAG_KEY = 'protocol_template_rag_doc_id'
const ECG_FUNCTIONAL_TEMPLATE_ID = 'ecg-functional-conclusion'

type InteractionSeverity = 'minor' | 'moderate' | 'major'

type DrugInteractionView = {
  pair: [string, string]
  severity: InteractionSeverity
  mechanism: string
  recommendation: string
  explanation: string
}

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
  const [showSecureRecorder, setShowSecureRecorder] = useState(false)
  const [protocol, setProtocol] = useState('')
  const [loading, setLoading] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [model, setModel] = useState<'sonnet' | 'opus' | 'gemini' | 'gpt52'>('gpt52')
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [resolvedModel, setResolvedModel] = useState<string | null>(null)
  const [interactionLoading, setInteractionLoading] = useState(false)
  const [interactionError, setInteractionError] = useState('')
  const [interactionExplainerModel, setInteractionExplainerModel] = useState<string | null>(null)
  const [interactionResults, setInteractionResults] = useState<DrugInteractionView[]>([])
  const [interactionChecked, setInteractionChecked] = useState(false)
  
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
        console.warn('⚠️ PDF.js не удалось загрузить на странице протоколов')
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
        setCustomTemplate(parsed.template)
        setSpecialistName(parsed.name || specialistName)
        setIsEditingTemplate(true)
        setIsTemplateLocked(Boolean(parsed.isTemplateLocked))
        setStrictTemplateMode(parsed.strictTemplateMode !== false)
        if (parsed.ragDocId) {
          setTemplateRagDocId(parsed.ragDocId)
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

  // Импорт черновика из URL (например, переход из stt-service localhost:8000 -> localhost:3000/protocol?draftText=...)
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Приоритет 1: перенос через window.name (работает между localhost:8000 и localhost:3000).
    const draftFromWindowName = window.name?.startsWith(PROTOCOL_DRAFT_WINDOW_NAME_PREFIX)
      ? window.name.slice(PROTOCOL_DRAFT_WINDOW_NAME_PREFIX.length)
      : ''
    if (draftFromWindowName.trim()) {
      setRawText(draftFromWindowName)
      window.name = ''
      return
    }

    // Приоритет 2: fallback через query param.
    const url = new URL(window.location.href)
    const encoded = url.searchParams.get(PROTOCOL_DRAFT_URL_PARAM)
    if (!encoded) return

    try {
      if (encoded.trim()) {
        setRawText(encoded)
      }
    } catch {
      // ignore malformed query
    } finally {
      // Чистим URL, чтобы текст не вставлялся повторно при refresh и не светился в адресной строке.
      url.searchParams.delete(PROTOCOL_DRAFT_URL_PARAM)
      window.history.replaceState({}, '', url.toString())
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
    alert('Шаблон сохранен как ваш персональный стандарт!')
  }

  const readTextFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => resolve((event.target?.result as string) || '')
      reader.onerror = () => reject(new Error('Ошибка чтения текстового файла'))
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

    const firstRow = rows[0]
    const headerIsExplicit = Array.from(rows[0].length ? table.querySelectorAll('tr')[0].querySelectorAll('th') : []).length > 0
    const columnCount = Math.max(...rows.map((r) => r.length), firstRow.length)
    const normalizeRow = (row: string[]) =>
      [...row, ...new Array(Math.max(0, columnCount - row.length)).fill('')].slice(0, columnCount)

    const header = normalizeRow(firstRow)
    const bodyRows = headerIsExplicit ? rows.slice(1).map(normalizeRow) : rows.slice(1).map(normalizeRow)
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
      throw new Error('Не удалось прочитать Word-файл. Для .doc лучше использовать .docx.')
    }
  }

  const extractPdfTemplate = async (file: File): Promise<string> => {
    if (!pdfJsLoaded || !window.pdfjsLib) {
      throw new Error('PDF модуль еще загружается. Подождите 2-3 секунды и повторите.')
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
        pages.push(`=== Страница ${pageNum} ===\n${pageText}`)
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

    throw new Error('Поддерживаются только .txt, .doc/.docx и .pdf')
  }

  const handleLoadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    void (async () => {
      const content = (await extractTemplateContent(file)).trim()
      if (!content) {
        throw new Error('Файл прочитан, но шаблон пустой. Проверьте формат и содержимое.')
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
          name: `Протокол-шаблон: ${file.name}`,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          chunksCount: chunks.length,
        },
        chunks
      )
      setTemplateRagDocId(docId)
      localStorage.setItem(PROTOCOL_TEMPLATE_RAG_KEY, docId)
      alert('Шаблон загружен и сохранен в библиотеку как RAG-образец.')
    })().catch((error) => {
      console.error('Template load error:', error)
      alert(error?.message || 'Не удалось загрузить файл шаблона.')
    }).finally(() => {
      e.target.value = ''
    })
  }

  const handleGenerateProtocol = async () => {
    if (!rawText.trim()) return

    setLoading(true)
    setProtocol('')
    setCurrentCost(0)
    setResolvedModel(null)
    setInteractionResults([])
    setInteractionError('')
    setInteractionExplainerModel(null)
    setInteractionChecked(false)

    const modelsMap: Record<string, string> = {
      'opus': MODELS.OPUS_VALIDATED,
      'sonnet': MODELS.SONNET,
      'gpt52': MODELS.GPT_5_2,
      'gemini': MODELS.GEMINI_3_FLASH
    };

    const finalModel = modelsMap[model] || MODELS.SONNET;
    const safeRawText = anonymizeText(rawText.trim())

    try {
      let ragExamples: string[] = []
      if (templateRagDocId) {
        // Для пользовательского шаблона берем больше чанков, чтобы модель видела
        // не только "шапку", но и блоки диагноза/лечения/результата.
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
        const streamResolvedModel = response.headers.get('x-resolved-model')
        if (streamResolvedModel) {
          setResolvedModel(streamResolvedModel)
        }

        await handleSSEStream(response, {
          onChunk: (text) => {
            setProtocol(prev => prev + text)
          },
          onUsage: (usage) => {
            console.log('📊 [PROTOCOL STREAMING] Получена точная стоимость:', usage.total_cost)
            setCurrentCost(usage.total_cost)
            const effectiveUsageModel = usage.model || streamResolvedModel || finalModel
            setResolvedModel(effectiveUsageModel)
            
            logUsage({
              section: 'protocols',
              model: effectiveUsageModel,
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
          const effectiveResolvedModel = data.resolvedModel || finalModel
          setResolvedModel(effectiveResolvedModel)
          const inputTokens = Math.ceil(rawText.length / 4) + 1000;
          const outputTokens = Math.ceil(data.protocol.length / 4);
          const costInfo = calculateCost(inputTokens, outputTokens, effectiveResolvedModel);
          setCurrentCost(costInfo.totalCostUnits);

          logUsage({
            section: 'protocols',
            model: effectiveResolvedModel,
            inputTokens,
            outputTokens,
            specialty: specialistName // Передаем специальность для аудита
          });
        }
        else setProtocol(`Ошибка: ${data.error}`)
      }
    } catch (err: any) {
      setProtocol(`Ошибка: ${err.message}`)
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
      const filePrefix = selectedTemplateId === ECG_FUNCTIONAL_TEMPLATE_ID ? 'Протокол_ЭКГ' : 'Протокол_приема'
      saveAs(blob, `${filePrefix}_${datePart}.docx`)
    } catch (err: any) {
      alert('Ошибка экспорта: ' + err.message)
    }
  }

  const handleCopyProtocol = async () => {
    if (!protocol) return
    const plainText = markdownToPlainText(protocol)
    await navigator.clipboard.writeText(plainText)
    alert('Скопировано без Markdown-разметки')
  }

  const getSeverityUi = (severity: InteractionSeverity) => {
    if (severity === 'major') {
      return {
        label: 'Высокий риск',
        badgeClass: 'bg-red-100 text-red-700 border-red-200'
      }
    }
    if (severity === 'moderate') {
      return {
        label: 'Умеренный риск',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-200'
      }
    }
    return {
      label: 'Низкий риск',
      badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    }
  }

  const handleAnalyzeInteractions = async () => {
    if (!protocol.trim()) return
    setInteractionLoading(true)
    setInteractionChecked(true)
    setInteractionError('')
    setInteractionResults([])
    setInteractionExplainerModel(null)
    try {
      const response = await fetch('/api/drug-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol })
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Сервис проверки временно недоступен.')
      }
      setInteractionResults(Array.isArray(data.interactions) ? data.interactions : [])
      setInteractionExplainerModel(typeof data.explainerModel === 'string' ? data.explainerModel : null)
    } catch (err: any) {
      setInteractionError(err?.message || 'Ошибка проверки взаимодействий.')
    } finally {
      setInteractionLoading(false)
    }
  }

  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const THERAPY_SECTION_MARKERS = [
    'терапия',
    'фармакотерапия',
    'лечение',
    'назначения',
    'медикаментозная терапия',
    'медикамент'
  ]

  const NON_THERAPY_SECTION_MARKERS = [
    'жалобы',
    'анамнез',
    'осмотр',
    'объективно',
    'статус',
    'диагноз',
    'обследован',
    'анализ'
  ]

  const cleanupMedicationLine = (line: string) =>
    line
      .replace(/^\s*[-*•]\s*/, '')
      .replace(/^\s*\d+[.)]\s*/, '')
      .replace(/^\s*(rp\.?|s\.?|d\.t\.d\.?)\s*[:.-]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()

  const NON_MEDICATION_PHRASES = [
    'аллерг',
    'анамнез',
    'жалоб',
    'диагноз',
    'осмотр',
    'объективно',
    'статус',
    'риски',
    'наблюдение',
    'госпитализац',
    'согласие',
    'физиотерап',
    'лфк',
    'массаж',
    'магнитотерап',
    'электрофорез',
    'увч',
    'ультразвук',
    'фонофорез',
    'лазеротерап',
    'парафин',
    'озокерит',
    'грязелеч'
  ]

  const PHYSIOTHERAPY_MARKERS = [
    'физиотерап',
    'лфк',
    'массаж',
    'магнитотерап',
    'электрофорез',
    'увч',
    'ультразвук',
    'фонофорез',
    'лазеротерап',
    'парафин',
    'озокерит',
    'грязелеч',
    'процедур'
  ]

  const isMedicationLikeLine = (line: string) => {
    const low = line.toLowerCase()
    if (PHYSIOTHERAPY_MARKERS.some((marker) => low.includes(marker))) return false

    const hasMnnTag = /\(\s*м[нn]н\s*\)/i.test(low)
    const hasDose = /(\d+(?:[.,]\d+)?)\s*(мкг\/кг|mcg\/kg|мг\/кг|mg\/kg|мг\/мл|mg\/ml|мг|mg|мл|ml|г|mcg|мкг|ед|%)\b/i.test(low)
    const hasForm = /таб|капс|амп|раств|сироп|спрей|крем|маз|свеч|капл|инъ|sol|tab|caps|ung|supp|gtt/i.test(low)
    const hasScheme = /подкож|per os|в\/м|в\/в|внутрь|наружно|по\s+\d+|раз[а]?\s+в\s+(сутки|день)|ежедневно|на\s+ночь/i.test(low)
    const hasNoiseOnly = NON_MEDICATION_PHRASES.some((marker) => low.includes(marker))

    if (hasNoiseOnly && !hasMnnTag) return false
    return hasMnnTag || ((hasDose || hasForm) && (hasScheme || hasForm))
  }

  type ParsedMedication = {
    drugDisplayName: string
    dosage: string
    form: 'Tab.' | 'Sol.' | 'Ung.' | 'Caps.' | 'Supp.' | 'Gtt.'
    signa: string
    sourceType: 'mnn' | 'brand' | 'unknown'
    sourceLine: string
  }

  const CYR_TO_LAT: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'u', я: 'a'
  }

  const translitRuToLat = (value: string) =>
    value
      .toLowerCase()
      .split('')
      .map((ch) => CYR_TO_LAT[ch] ?? ch)
      .join('')

  const toLatinGenitiveWord = (word: string) => {
    const w = word.toLowerCase()
    if (w.endsWith('um')) return `${w.slice(0, -2)}i`
    if (w.endsWith('us')) return `${w.slice(0, -2)}i`
    if (w.endsWith('a')) return `${w.slice(0, -1)}ae`
    if (w.endsWith('is')) return w
    if (w.endsWith('e')) return `${w.slice(0, -1)}is`
    if (w.endsWith('on')) return `${w}i`
    return `${w}i`
  }

  const normalizeToLatinGenitive = (name: string): string => {
    const latinBase = translitRuToLat(name)
      .replace(/[^a-z\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!latinBase) return '________________'

    return latinBase
      .split(' ')
      .map((part) =>
        part
          .split('-')
          .map((word) => (word.length > 2 ? toLatinGenitiveWord(word) : word))
          .join('-')
      )
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const extractDrugIdentity = (line: string): { name: string; sourceType: ParsedMedication['sourceType'] } => {
    const cleaned = cleanupMedicationLine(line)
    const mnnTaggedMatch = cleaned.match(/^(.+?)\s*\(\s*м[нn]н\s*\)/i)
    const beforeDash = cleaned.split('—')[0]
    const beforeColon = beforeDash.split(':')[0]
    const beforeComma = beforeColon.split(',')[0]
    const candidate = (mnnTaggedMatch?.[1] || beforeComma)
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(бренд|генерик|коммерческ\w*|торгов\w*|таб|табл|капс|раствор|мазь|крем|капли)\b/gi, '')
      .replace(/\d+([.,]\d+)?\s?(мг|mg|мл|ml|г|mcg|мкг|ед|%)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (NON_MEDICATION_PHRASES.some((marker) => candidate.toLowerCase().includes(marker))) {
      return { name: '', sourceType: 'unknown' }
    }
    if (mnnTaggedMatch?.[1]?.trim()) {
      return { name: mnnTaggedMatch[1].trim(), sourceType: 'mnn' }
    }
    if (candidate.length >= 3) {
      return { name: candidate, sourceType: 'brand' }
    }
    return { name: '', sourceType: 'unknown' }
  }

  const detectForm = (line: string): ParsedMedication['form'] => {
    const low = line.toLowerCase()
    if (/(маз|крем|гель|ung)/i.test(low)) return 'Ung.'
    if (/(подкож|в\/м|в\/в|раств|амп|инъ|sol)/i.test(low)) return 'Sol.'
    if (/(капл|gtt)/i.test(low)) return 'Gtt.'
    if (/(свеч|supp)/i.test(low)) return 'Supp.'
    if (/(капс|caps)/i.test(low)) return 'Caps.'
    return 'Tab.'
  }

  const normalizeDoseForRp = (line: string, form: ParsedMedication['form']) => {
    const low = line.toLowerCase()
    const mcgPerKgMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(мкг|mcg)\s*\/\s*(кг|kg)/i)
    const mgPerKgMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(мг|mg)\s*\/\s*(кг|kg)/i)
    const mgPerMlMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(мг|mg)\s*\/\s*(мл|ml)/i)
    const percentMatch = low.match(/(\d+(?:[.,]\d+)?)\s*%/)
    const mlMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(мл|ml)\b/i)
    const gMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(г|g)\b/i)
    const mgMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(мг|mg)\b/i)
    const mcgMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(мкг|mcg)\b/i)

    if (mcgPerKgMatch) {
      return `${mcgPerKgMatch[1].replace('.', ',')} mcg/kg`
    }

    if (mgPerKgMatch) {
      return `${mgPerKgMatch[1].replace('.', ',')} mg/kg`
    }

    if (form === 'Sol.' && mgPerMlMatch) {
      const conc = `${mgPerMlMatch[1].replace('.', ',')} mg/ml`
      const vol = mlMatch ? `${mlMatch[1].replace('.', ',')} ml` : '____ ml'
      return `${conc} — ${vol}`
    }

    if (form === 'Sol.' && percentMatch) {
      const percent = percentMatch[1].replace('.', ',')
      const vol = mlMatch ? `${mlMatch[1].replace('.', ',')} ml` : '____ ml'
      return `${percent}% — ${vol}`
    }

    if (gMatch) {
      return `${gMatch[1].replace('.', ',')} g`
    }

    if (mcgMatch) {
      return `${mcgMatch[1].replace('.', ',')} mcg`
    }

    if (mgMatch) {
      return `${mgMatch[1].replace('.', ',')} mg`
    }

    if (form === 'Sol.' && mlMatch) {
      return `____% — ${mlMatch[1].replace('.', ',')} ml`
    }

    return '____'
  }

  const buildMediumTherapeuticSigna = (form: ParsedMedication['form']) => {
    if (form === 'Sol.') return 'S.: По 5 ml 2 раза в день.'
    if (form === 'Ung.') return 'S.: Наносить тонким слоем 2 раза в день.'
    if (form === 'Gtt.') return 'S.: По 2 капли 3 раза в день.'
    if (form === 'Supp.') return 'S.: По 1 супп. 1-2 раза в день.'
    if (form === 'Caps.') return 'S.: По 1 капс. 2 раза в день.'
    return 'S.: По 1 таб. 2 раза в день.'
  }

  const extractSignaFromLine = (line: string, form: ParsedMedication['form']) => {
    const low = line.toLowerCase()

    const route =
      /(подкож)/i.test(low) ? 'подкожно' :
      /(в\/м)/i.test(low) ? 'в/м' :
      /(в\/в)/i.test(low) ? 'в/в' :
      /(внутрь|per os)/i.test(low) ? 'внутрь' :
      /(наружно)/i.test(low) ? 'наружно' : ''

    const frequencyMatch = low.match(/(\d+)\s*раз[а]?\s*в\s*(сутки|день)/i)
    const frequency = frequencyMatch
      ? `${frequencyMatch[1]} раз${frequencyMatch[1] === '1' ? '' : 'а'} в ${frequencyMatch[2]}`
      : ''

    const untilMatch = low.match(/(до\s+[^.,;]+)/i)
    const durationMatch = low.match(/(в\s+течение\s+\d+\s*(дн|дней|нед|недель|мес|месяц\w*))/i)
    const tail = untilMatch?.[1] || durationMatch?.[1] || ''

    if (!route && !frequency && !tail) {
      return buildMediumTherapeuticSigna(form)
    }

    const chunks = [route, frequency, tail].filter(Boolean)
    return `S.: ${chunks.join(', ')}.`
  }

  const parseMedicationLine = (line: string): ParsedMedication | null => {
    if (!isMedicationLikeLine(line)) return null
    if (PHYSIOTHERAPY_MARKERS.some((marker) => line.toLowerCase().includes(marker))) return null

    const form = detectForm(line)
    const dosage = normalizeDoseForRp(line, form)
    let signa = extractSignaFromLine(line, form)
    const identity = extractDrugIdentity(line)
    const hasUsefulDose = dosage !== '____'
    if (!identity.name && !hasUsefulDose) return null

    const drugDisplayName =
      identity.sourceType === 'mnn'
        ? normalizeToLatinGenitive(identity.name)
        : identity.name || '________________'

    return { drugDisplayName, dosage, form, signa, sourceType: identity.sourceType, sourceLine: line }
  }

  const normalizeMedicationsWithAi = async (items: ParsedMedication[]): Promise<ParsedMedication[]> => {
    if (items.length === 0) return items

    try {
      const response = await fetch('/api/prescription/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      })
      if (!response.ok) return items

      const data = await response.json()
      if (!data?.success || !Array.isArray(data?.items)) return items

      return items.map((original, idx) => {
        const normalized = data.items[idx]
        if (!normalized) return original

        return {
          ...original,
          drugDisplayName:
            typeof normalized.drugDisplayName === 'string' && normalized.drugDisplayName.trim()
              ? normalized.drugDisplayName.trim()
              : original.drugDisplayName,
          dosage:
            typeof normalized.dosage === 'string' && normalized.dosage.trim()
              ? normalized.dosage.trim()
              : original.dosage,
          form: ['Tab.', 'Sol.', 'Ung.', 'Caps.', 'Supp.', 'Gtt.'].includes(normalized.form)
            ? normalized.form
            : original.form,
          signa:
            typeof normalized.signa === 'string' && normalized.signa.trim()
              ? normalized.signa.trim()
              : original.signa
        }
      })
    } catch {
      return items
    }
  }

  const extractMedicationsFromProtocol = (text: string): ParsedMedication[] => {
    const lines = text.split('\n')
    let inTherapyBlock = false
    const meds: ParsedMedication[] = []

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const normalized = line
        .replace(/^#+\s*/, '')
        .replace(/[:.]$/, '')
        .toLowerCase()

      const isHeadingLike = /^#+\s+/.test(line) || /^[А-Яа-яA-Za-z\s-]{4,40}[:.]$/.test(line)
      if (isHeadingLike) {
        if (THERAPY_SECTION_MARKERS.some((marker) => normalized.includes(marker))) {
          inTherapyBlock = true
          continue
        }
        if (NON_THERAPY_SECTION_MARKERS.some((marker) => normalized.includes(marker))) {
          inTherapyBlock = false
          continue
        }
      }

      if (!inTherapyBlock && !/\(\s*м[нn]н\s*\)/i.test(line)) {
        continue
      }

      const parsed = parseMedicationLine(line)
      if (!parsed) continue
      meds.push(parsed)
      if (meds.length >= 16) break
    }

    return meds.filter(
      (med, idx, arr) =>
        arr.findIndex((m) => m.drugDisplayName.toLowerCase() === med.drugDisplayName.toLowerCase()) === idx
    )
  }

  const buildRxBlockHtml = (medication?: ParsedMedication) => {
    if (!medication) {
      return `
        <div class="rx-line" contenteditable="true">Rp.: Tab. ________________________________ ____</div>
        <div class="rx-line" contenteditable="true">D.t.d. N. ______</div>
        <div class="rx-line" contenteditable="true">S.: ________________________________</div>
      `
    }

    return `
      <div class="rx-line" contenteditable="true">Rp.: ${medication.form} ${escapeHtml(medication.drugDisplayName)} ${escapeHtml(medication.dosage)}</div>
      <div class="rx-line" contenteditable="true">D.t.d. N. ______</div>
      <div class="rx-line" contenteditable="true">${escapeHtml(medication.signa)}</div>
    `
  }

  const openPrescriptionLayout = async () => {
    if (!protocol.trim()) return
    const extractedMedications = await normalizeMedicationsWithAi(extractMedicationsFromProtocol(protocol))
    const cards = Array.from({ length: 6 }, (_, idx) => ({ number: idx + 1 }))

    const cardsHtml = cards
      .map((card) => {
        const medA = extractedMedications[(card.number - 1) * 3]
        const medB = extractedMedications[(card.number - 1) * 3 + 1]
        const medC = extractedMedications[(card.number - 1) * 3 + 2]

        return `
          <section class="rx-card">
            <div class="rx-form-top">
              <div class="rx-form-top-left">
                <div>Министерство здравоохранения<br/>Российской Федерации</div>
                <div class="rx-form-stamp-line">Наименование (штамп)<br/>медицинской организации</div>
                <div class="rx-form-stamp-line">Наименование (штамп) индивидуального предпринимателя<br/>и дату лицензии, наименование органа<br/>государственной власти, выдавшего лицензию)</div>
              </div>
              <div class="rx-form-top-right">
                <div>Код формы по ОКУД</div>
                <div>Код учреждения по ОКПО</div>
                <div>Медицинская документация</div>
                <div><strong>Форма № 107-1/у</strong></div>
                <div>Утверждена приказом<br/>Министерства здравоохранения<br/>Российской Федерации<br/>от 14 января 2019 г. № 4н</div>
              </div>
            </div>
            <div class="rx-form-title-block">
              <div class="rx-title">РЕЦЕПТ</div>
              <div class="rx-subtitle">(взрослый, детский — нужное подчеркнуть)</div>
              <div class="rx-date">« <span contenteditable="true">__</span> » <span contenteditable="true">__________</span> 20<span contenteditable="true">__</span> г.</div>
            </div>
            <div class="rx-meta">
              Ф.И.О. пациента: <span contenteditable="true">__________________________</span>
            </div>
            <div class="rx-meta">
              Ф.И.О. врача: <span contenteditable="true">__________________________</span>
            </div>

            ${buildRxBlockHtml(medA)}
            ${buildRxBlockHtml(medB)}
            ${buildRxBlockHtml(medC)}

            <div class="rx-foot">
              <div class="rx-foot-sign-row">
                <div>
                  Подпись<br/>
                  и печать лечащего врача<br/>
                  (подпись фельдшера, акушерки)
                </div>
                <div class="rx-foot-mp">М. П.</div>
              </div>
              <div class="rx-foot-valid-row">
                <span>Рецепт действителен в течение 60 дней, до 1 года</span>
                <span class="rx-foot-months-line"><span contenteditable="true">__________</span></span>
              </div>
              <div class="rx-foot-hints-row">
                <span>(нужное подчеркнуть)</span>
                <span>(указать количество месяцев)</span>
              </div>
            </div>
          </section>
        `
      })
      .join('')

    const html = `
      <!doctype html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>Рецепты для печати</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Times New Roman", serif;
            background: #f3f4f6;
            color: #111827;
          }
          .toolbar {
            position: sticky;
            top: 0;
            z-index: 10;
            background: #111827;
            color: #fff;
            padding: 10px 14px;
            display: flex;
            gap: 10px;
            align-items: center;
          }
          .toolbar button {
            border: 0;
            border-radius: 8px;
            padding: 8px 12px;
            background: #2563eb;
            color: #fff;
            cursor: pointer;
            font-weight: 700;
          }
          .toolbar button.secondary {
            background: #374151;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 14px auto;
            padding: 10mm;
            background: #fff;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-auto-rows: minmax(33mm, auto);
            gap: 8mm 8mm;
          }
          .rx-card {
            border: 1px dashed #6b7280;
            padding: 5mm;
            display: flex;
            flex-direction: column;
            gap: 2mm;
          }
          .rx-form-top {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            font-size: 9px;
            line-height: 1.2;
            border-bottom: 1px solid #111827;
            padding-bottom: 2px;
            margin-bottom: 2px;
          }
          .rx-form-top-left {
            width: 58%;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .rx-form-top-right {
            width: 42%;
            display: flex;
            flex-direction: column;
            gap: 1px;
            text-align: left;
          }
          .rx-form-stamp-line {
            min-height: 26px;
          }
          .rx-form-title-block {
            border-bottom: 1px solid #111827;
            padding-bottom: 2px;
            margin-bottom: 2px;
          }
          .rx-title {
            font-weight: 700;
            font-size: 15px;
            letter-spacing: 2px;
            text-align: center;
          }
          .rx-subtitle {
            font-size: 11px;
            text-align: center;
            margin-top: 1px;
          }
          .rx-date {
            font-size: 12px;
            text-align: center;
            margin-top: 1px;
          }
          .rx-meta {
            font-size: 11px;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 2px;
          }
          .rx-line {
            font-size: 12px;
            min-height: 14px;
            border-bottom: 1px dotted #d1d5db;
            padding: 1px 0;
          }
          .rx-foot {
            margin-top: auto;
            font-size: 11px;
            border-top: 1px solid #d1d5db;
            padding-top: 3px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .rx-foot-sign-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 8px;
            min-height: 32px;
          }
          .rx-foot-mp {
            font-size: 14px;
            min-width: 56px;
            text-align: right;
            padding-bottom: 2px;
          }
          .rx-foot-valid-row {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            align-items: flex-end;
            white-space: nowrap;
          }
          .rx-foot-months-line {
            flex: 1;
            border-bottom: 1px solid #111827;
            min-height: 14px;
            display: inline-flex;
            justify-content: center;
            align-items: flex-end;
          }
          .rx-foot-hints-row {
            display: flex;
            justify-content: space-between;
            gap: 6px;
            font-size: 10px;
          }
          [contenteditable="true"] {
            outline: none;
          }
          [contenteditable="true"]:focus {
            background: #eff6ff;
          }
          @media print {
            body { background: #fff; }
            .toolbar { display: none; }
            .page {
              margin: 0;
              width: auto;
              min-height: auto;
              padding: 0;
              gap: 4mm;
            }
            .rx-card {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button onclick="window.print()">🖨 Печать</button>
          <button class="secondary" onclick="window.close()">✖ Закрыть</button>
          <span>Автоподстановка: форма + МНН (лат.) + доза. Поля врача/пациента заполняются вручную.</span>
        </div>
        <main class="page">
          ${cardsHtml}
        </main>
      </body>
      </html>
    `

    const win = window.open('about:blank', '_blank', 'width=1200,height=900')
    if (!win) {
      alert('Разрешите всплывающие окна для открытия бланка рецептов.')
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  return (
    <>
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary-900">
          {selectedTemplateId === ECG_FUNCTIONAL_TEMPLATE_ID ? '🫀 Протокол ЭКГ' : '📝 Протокол приёма'}
        </h1>
      </div>
      
      {showAudioUpload && (
        <div className="mb-4 bg-white rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">🎤 Загрузка аудио</h3>
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
          <h2 className="text-xl font-semibold mb-4">Настройки и ввод данных</h2>

          {/* Специалист и Шаблоны */}
          <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">👨‍⚕️ Кто проводит осмотр:</label>
                <input 
                  type="text"
                  value={specialistName}
                  onChange={(e) => setSpecialistName(e.target.value)}
                  placeholder="Например: Врач-невролог"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">🏥 Специализация (шаблон):</label>
                <select 
                  value={selectedUniversalKey}
                  onChange={(e) => handleUniversalSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm bg-white"
                >
                  <option value="">-- Выберите профиль --</option>
                  {Object.entries(UNIVERSAL_SPECIALIST_TEMPLATES).map(([key, tpl]) => (
                    <option key={key} value={key}>{tpl.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedUniversalKey && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">Инструкция для ИИ (можно редактировать):</label>
                  <span className="text-[10px] text-gray-400 italic">Фокус: {UNIVERSAL_SPECIALIST_TEMPLATES[selectedUniversalKey].focus}</span>
                </div>
                <textarea
                  value={universalPrompt}
                  onChange={(e) => setUniversalPrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[60px] bg-indigo-50/30 font-medium leading-relaxed"
                  placeholder="Специфические инструкции для этого врача..."
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider italic">Быстрое форматирование:</label>
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
              {isEditingTemplate ? '🔼 Скрыть структуру документа' : '⚙️ Настроить структуру документа (H1, H2...)'}
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
                  🔒 Закрепить мой шаблон (не перезаписывать при смене специалиста)
                </label>
                <label className="inline-flex items-center gap-2 text-[10px] font-semibold text-indigo-700">
                  <input
                    type="checkbox"
                    checked={strictTemplateMode}
                    onChange={(e) => setStrictTemplateMode(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  🧷 Строго заполнять структуру шаблона (без свободной перестройки)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveAsDefault}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    💾 Сохранить как мой стандарт
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-[10px] font-bold hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    📁 Загрузить из файла (.txt/.docx/.pdf)
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
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <button
                onClick={() => setShowSecureRecorder(!showSecureRecorder)}
                className={`px-4 py-2 rounded-lg transition-colors text-sm text-white ${showSecureRecorder ? 'bg-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                disabled={loading}
              >
                🎙️ Запись беседы с пациентом
              </button>
              <span className="text-[11px] text-gray-500">
                Запись и ввод объективных данных можно вести одновременно
              </span>
            </div>
            {showSecureRecorder && (
              <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-indigo-900">🎙️ Запись беседы с пациентом</h3>
                  <button onClick={() => setShowSecureRecorder(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <p className="text-[11px] text-gray-500 mb-3">
                  Запись → локальное распознавание (Whisper) → проверка текста врачом → черновик жалоб/анамнеза.
                  Пока идёт запись, объективные данные можно сразу вносить в поле ниже. Аудио на диск не сохраняется.
                </p>
                <SecureProtocolRecorder
                  disabled={loading}
                  onInsert={(text) => {
                    setRawText(prev => prev ? prev + '\n\n' + text : text)
                  }}
                />
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Текст для обработки:</label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">Голосовой ввод данных врачом</span>
                <VoiceInput 
                  onTranscript={(text) => setRawText(prev => prev ? prev + ' ' + text : text)}
                  disabled={loading}
                  className="!bg-indigo-600 !text-white hover:!bg-indigo-700"
                  placeholder="Голосовой ввод данных врачом"
                />
              </div>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Введите данные осмотра или используйте 🎤..."
              data-tour="protocol-input"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-h-[300px]"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setShowAudioUpload(!showAudioUpload)} className="px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg transition-colors text-sm" disabled={loading}>
              📁 Аудио файл
            </button>
            <button onClick={() => setRawText('')} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm" disabled={!rawText || loading}>
              🗑️ Очистить
            </button>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useStreaming} onChange={(e) => setUseStreaming(e.target.checked)} className="w-4 h-4 text-primary-600" disabled={loading} />
              <span className="text-sm">Streaming</span>
            </label>
            <select value={model} onChange={(e) => setModel(e.target.value as any)} className="px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-primary-500" disabled={loading}>
              <option value="gpt52">🚀 GPT-5.4 (быстрее)</option>
              <option value="sonnet">🤖 Sonnet 5 (детальнее, но медленнее)</option>
              <option value="opus">🧠 Opus 4.8</option>
              <option value="gemini">⚡ Gemini 3.1</option>
            </select>
          </div>

          <button onClick={handleGenerateProtocol} data-tour="protocol-generate-button" disabled={!rawText.trim() || loading} className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 font-semibold shadow-md">
            {loading ? '⏳ Генерация...' : '📝 Создать протокол'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Сгенерированный протокол</h2>
              {currentCost > 0 && (
                <div className="mt-1 bg-teal-50 text-teal-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-teal-200 inline-block shadow-sm">
                  💰 Стоимость сервиса: {currentCost.toFixed(2)} ед.
                </div>
              )}
              {resolvedModel && (
                <div className="mt-1 ml-2 bg-blue-50 text-blue-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-blue-200 inline-block shadow-sm">
                  🤖 Фактическая модель: {resolvedModel}
                </div>
              )}
            </div>
            {protocol && (
              <div className="flex gap-2">
                <button onClick={handleCopyProtocol} className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm">📋</button>
                <button
                  onClick={handleAnalyzeInteractions}
                  disabled={interactionLoading}
                  className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm disabled:opacity-60"
                >
                  {interactionLoading ? '⏳ Проверка...' : '⚠️ Взаимодействия'}
                </button>
                <button onClick={openPrescriptionLayout} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">🧾 Рецепты</button>
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
              <p>{loading ? 'ИИ формирует протокол...' : 'Результат появится здесь'}</p>
            </div>
          )}

          {protocol && (
            <div className="mt-4 border border-orange-200 rounded-lg p-4 bg-orange-50/40">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-orange-900">Потенциальные взаимодействия</h3>
                {interactionExplainerModel && (
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border bg-white text-orange-700 border-orange-200">
                    LLM: {interactionExplainerModel}
                  </span>
                )}
              </div>

              {!interactionLoading && !interactionError && interactionResults.length === 0 && (
                interactionChecked ? (
                  <p className="text-xs text-gray-600">
                    По локальному справочнику клинически значимые взаимодействия не выявлены.
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">
                    Нажмите «⚠️ Взаимодействия», чтобы проверить назначения после генерации протокола.
                  </p>
                )
              )}

              {interactionError && (
                <p className="text-xs text-red-700">{interactionError}</p>
              )}

              {interactionLoading && (
                <p className="text-xs text-orange-700">Проверяем потенциальные взаимодействия...</p>
              )}

              {interactionResults.length > 0 && (
                <div className="space-y-2">
                  {interactionResults.map((item, idx) => {
                    const severityUi = getSeverityUi(item.severity)
                    return (
                      <div key={`${item.pair[0]}-${item.pair[1]}-${idx}`} className="bg-white border border-orange-100 rounded-md p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <strong className="text-sm text-gray-900">{item.pair[0]} + {item.pair[1]}</strong>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${severityUi.badgeClass}`}>
                            {severityUi.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700"><strong>Механизм:</strong> {item.mechanism}</p>
                        <p className="text-xs text-gray-700"><strong>Пояснение:</strong> {item.explanation}</p>
                        <p className="text-xs text-gray-700"><strong>Тактика:</strong> {item.recommendation}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
