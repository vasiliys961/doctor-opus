'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import AudioUpload from '@/components/AudioUpload'
import FileUpload from '@/components/FileUpload'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { ChatSpecialistSelector } from '@/components/ChatSpecialistSelector'
import { Specialty, SELF_CHECK_SYSTEM_PROMPT } from '@/lib/prompts'
import { searchLibraryLocal, searchLibraryLocalWithMeta } from '@/lib/library-db'
import ImageEditor from '@/components/ImageEditor'
import { anonymizeMedicalImage } from '@/lib/image-compression'
import { anonymizeText } from '@/lib/anonymization'
import mammoth from 'mammoth'
import ConsiliumProgress, { ConsiliumProgressItem, ConsiliumSpecialtyItem } from '@/components/advanced/ConsiliumProgress'
import ConsiliumAuditView from '@/components/advanced/ConsiliumAuditView'
import { ConsiliumProgressEvent, DiagnosticResult } from '@/lib/diagnostics/types'

type ResponseStyle = 'brief' | 'detailed'
const MAX_CHAT_FILES_PER_BATCH = 4;
const MAX_CHAT_TOTAL_BYTES_PER_BATCH = 16 * 1024 * 1024;
const BRIDGE_CHAT_KEY = 'mobile_bridge_chat_draft';

const specialtyMap: Record<string, Specialty> = {
  'Кардиолог': 'cardiology',
  'Эндокринолог': 'endocrinology',
  'Рентгенолог / Радиолог': 'radiology',
  'Дерматовенеролог': 'dermatology',
  'Невролог': 'neurology',
  'Гастроэнтеролог': 'gastroenterology',
  'Педиатр': 'pediatrics',
  'Онколог': 'oncology',
  'Гематолог': 'hematology',
  'Гинеколог': 'gynecology',
  'Ревматолог': 'rheumatology',
  'Академический поиск': 'openevidence',
  'ИИ-Эксперт': 'ai_assistant',
  'Титан: Учитель Хуа То': 'hua_tuo_master',
};

const getDisplayModelName = (model: 'opus' | 'sonnet' | 'gpt52' | 'gemini' | 'fable') => {
  if (model === 'gpt52') return 'openai/gpt-5.6-terra';
  if (model === 'sonnet') return 'anthropic/claude-sonnet-5';
  if (model === 'opus') return 'anthropic/claude-opus-4.8';
  if (model === 'fable') return 'anthropic/claude-fable-5';
  if (model === 'gemini') return 'google/gemini-3-flash-preview';
  return model;
};

const formatUnknownError = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const asRecord = value as Record<string, unknown>;
    const message = asRecord.message;
    if (typeof message === 'string' && message.trim()) return message;
    try {
      return JSON.stringify(value);
    } catch {
      return 'Неизвестная ошибка';
    }
  }
  return String(value ?? 'Неизвестная ошибка');
};

const resolveUsageCost = (
  usage: { total_cost?: number; prompt_tokens?: number; completion_tokens?: number } | undefined,
  modelName: string
): number | undefined => {
  if (!usage) return undefined;

  const direct = Number(usage.total_cost);
  if (Number.isFinite(direct) && direct >= 0) return direct;

  const inputTokens = Number(usage.prompt_tokens);
  const outputTokens = Number(usage.completion_tokens);
  if (Number.isFinite(inputTokens) && Number.isFinite(outputTokens)) {
    return calculateCost(inputTokens, outputTokens, modelName).totalCostUnits;
  }

  return undefined;
};

export default function ChatPage() {
  const { data: session } = useSession()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ 
    role: 'user' | 'assistant'; 
    content: string; 
    files?: Array<{ name: string; size: number; type: string }>;
    cost?: number;
    model?: string;
    ragRequested?: boolean;
    ragUsed?: boolean;
    ragSources?: string[];
    selfCheck?: string;
    selfCheckLoading?: boolean;
    selfCheckError?: string;
  }>>([])
  const [loading, setLoading] = useState(false)
  const [showAudioUpload, setShowAudioUpload] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [useStreaming, setUseStreaming] = useState(true)
  const [useLibrary, setUseLibrary] = useState(false)
  const [model, setModel] = useState<'opus' | 'sonnet' | 'gpt52' | 'gemini' | 'fable'>('sonnet')
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>('brief')
  const [specialty, setSpecialty] = useState<Specialty>('universal')
  const [isCutOff, setIsCutOff] = useState(false)
  const [lastMessageIndex, setLastMessageIndex] = useState<number | null>(null)
  const [searchingLibrary, setSearchingLibrary] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null)
  const [autoAnonymize, setAutoAnonymize] = useState(true)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  const [convertingPDF, setConvertingPDF] = useState(false)

  // --- Режим "Консилиум" (мультиагентный MAI-DxO-стиль разбор, без привязки к школам) ---
  const [consiliumMode, setConsiliumMode] = useState(false)
  const [consiliumLoading, setConsiliumLoading] = useState(false)
  const [consiliumEvents, setConsiliumEvents] = useState<ConsiliumProgressItem[]>([])
  const [consiliumCurrentRound, setConsiliumCurrentRound] = useState(0)
  const [consiliumStageMessage, setConsiliumStageMessage] = useState<string | null>(null)
  const [consiliumResult, setConsiliumResult] = useState<DiagnosticResult | null>(null)
  const [consiliumError, setConsiliumError] = useState<string | null>(null)
  const [consiliumSpecialtyEvents, setConsiliumSpecialtyEvents] = useState<ConsiliumSpecialtyItem[]>([])
  const [consiliumAmscDecision, setConsiliumAmscDecision] = useState<{ escalated: boolean; disagreementScore: number } | null>(null)

  // --- Triage-подсказка сложности кейса (только совет врачу, ничего не решает автоматически) ---
  const [triageSuggestion, setTriageSuggestion] = useState<{ complexity: 'complex'; reasoning: string } | null>(null)
  const [triageDismissed, setTriageDismissed] = useState(false)

  // Загружаем PDF.js v3 из локальных файлов (public/pdfjs/)
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      const script = document.createElement('script')
      script.src = '/pdfjs/pdf.min.js'
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
          setPdfJsLoaded(true)
          console.log('✅ PDF.js v3 загружен локально (Чат)')
        }
      }
      script.onerror = () => {
        console.warn('⚠️ PDF.js не удалось загрузить в Чате')
      }
      document.head.appendChild(script)
    } else if (window.pdfjsLib) {
      setPdfJsLoaded(true)
    }
  }, [])

  // Лёгкий triage сложности кейса: срабатывает только для первого сообщения диалога
  // (описание нового кейса), на дешёвой модели (Sonnet) и с задержкой после набора текста,
  // чтобы не мешать печатать и не тратить лишние вызовы. Ничего не решает сам — только
  // предлагает врачу переключиться на модель с более глубоким клиническим рассуждением.
  useEffect(() => {
    if (consiliumMode || model !== 'sonnet' || messages.length > 0 || triageDismissed) {
      return
    }
    const text = message.trim()
    if (text.length < 60) {
      setTriageSuggestion(null)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/chat/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        })
        const data = await response.json().catch(() => null)
        if (data?.success && data.complexity === 'complex') {
          setTriageSuggestion({ complexity: 'complex', reasoning: data.reasoning || '' })
        } else {
          setTriageSuggestion(null)
        }
      } catch {
        // Триаж — необязательная подсказка, при сбое просто не показываем баннер.
      }
    }, 1200)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [message, model, consiliumMode, messages.length, triageDismissed])

  const convertPDFToImages = async (pdfFile: File): Promise<File[]> => {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js не загружен. Подождите несколько секунд и попробуйте снова.')
    }

    const pdfjs = window.pdfjsLib
    const arrayBuffer = await pdfFile.arrayBuffer()
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer, verbosity: 0 })
    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages
    const maxPages = Math.min(totalPages, 10) // Ограничиваем 10 страницами для чата

    const imageFiles: File[] = []

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) continue
      
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (blob) {
        const name = pdfFile.name.replace('.pdf', '') + `_стр_${pageNum}.jpg`
        imageFiles.push(new File([blob], name, { type: 'image/jpeg' }))
      }
    }

    return imageFiles
  }

  const anonymizeWordFile = async (wordFile: File): Promise<File> => {
    try {
      const arrayBuffer = await wordFile.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const originalText = result.value;
      const safeText = anonymizeText(originalText);
      
      // Создаем новый текстовый файл вместо Word (так ИИ его точно прочитает)
      const blob = new Blob([safeText], { type: 'text/plain' });
      return new File([blob], wordFile.name.replace(/\.docx?$/i, '') + '_защищен.txt', { type: 'text/plain' });
    } catch (err) {
      console.error('Ошибка анонимизации Word:', err);
      return wordFile;
    }
  }

  useEffect(() => {
    // Проверяем наличие переданных данных из анализа изображений
    const pendingData = sessionStorage.getItem('pending_analysis');
    if (pendingData) {
      try {
        const { text, type, initialQuestion } = JSON.parse(pendingData);
        
        // Автоматический выбор специальности
        if (type === 'ecg') setSpecialty('cardiology');
        else if (['ct', 'mri', 'xray', 'ultrasound'].includes(type)) setSpecialty('radiology');
        else if (type === 'Клинические рекомендации') setSpecialty('universal');
        
        // Формируем вводное сообщение
        let initialPrompt = '';
        
        if (type === 'Клинические рекомендации') {
          initialPrompt = `Я изучаю следующие клинические рекомендации:\n\n${text}\n\nВопрос: ${initialQuestion || 'Проанализируй эти данные.'}`;
        } else {
          const typeNames: Record<string, string> = {
            'ecg': 'ЭКГ',
            'ct': 'КТ',
            'mri': 'МРТ',
            'xray': 'рентгена',
            'ultrasound': 'УЗИ'
          };
          const typeName = typeNames[type] || 'исследования';
          initialPrompt = `Ниже приведен готовый диагностический протокол ${typeName}. ПРОТОКОЛ УЖЕ СОСТАВЛЕН. НЕ переписывай его, НЕ дублируй описание находок. Твоя задача — разработать клиническую тактику ведения пациента на основе этого заключения:\n\n${text}${initialQuestion ? `\n\nУточняющий вопрос: ${initialQuestion}` : ''}`;
        }
        
        setMessage(initialPrompt);
        
        // Очищаем, чтобы не подставлялось при перезагрузке
        sessionStorage.removeItem('pending_analysis');
        
        // Если передан конкретный вопрос, сразу отправляем его
        if (initialQuestion) {
          // Используем setTimeout, чтобы дождаться обновления стейта сообщения
          setTimeout(() => {
            const sendButton = document.querySelector('button.bg-primary-500.active\\:bg-primary-700') as HTMLButtonElement;
            if (sendButton) sendButton.click();
          }, 100);
        }
      } catch (e) {
        console.error('Ошибка при разборе данных анализа:', e);
      }
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(BRIDGE_CHAT_KEY);
    if (!raw) return;

    const dataUrlToFile = (dataUrl: string, fileName: string, fallbackType = 'image/jpeg'): File => {
      const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!match) throw new Error('Неверный формат data URL');
      const mimeType = match[1] || fallbackType;
      const base64 = match[2];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new File([bytes], fileName, { type: mimeType });
    };

    try {
      const payload = JSON.parse(raw) as {
        title?: string;
        text?: string;
        dataUrl?: string;
        mimeType?: string;
      };
      const normalizedText = String(payload.text || '').trim();
      if (normalizedText) {
        setMessage(normalizedText);
      } else if (payload.title) {
        setMessage(`[Документ со смартфона] ${payload.title}`);
      }

      if (payload.dataUrl) {
        const extension = payload.mimeType?.includes('pdf') ? 'pdf' : 'jpg';
        const fileName = `${payload.title || 'mobile_scan'}.${extension}`;
        const file = dataUrlToFile(payload.dataUrl, fileName, payload.mimeType || 'image/jpeg');
        setSelectedFiles((prev) => [...prev, file]);
        setShowFileUpload(true);
      }
    } catch (error) {
      console.error('Ошибка импорта mobile bridge в чат:', error);
    } finally {
      localStorage.removeItem(BRIDGE_CHAT_KEY);
    }
  }, []);

  useEffect(() => {
    // Автоматически выбираем подходящую модель при смене специальности
    if (specialty === 'openevidence') {
      // Для академического поиска модель выбирается на сервере (Perplexity -> Sonnet)
    }
  }, [specialty])

  const handleContinue = async () => {
    if (loading || !isCutOff || lastMessageIndex === null) return;
    
    setIsCutOff(false);
    setLoading(true);
    
    // Подготавливаем запрос на продолжение
    const lastAssistantMessage = messages[lastMessageIndex];
    const continuePrompt = "Продолжи свой предыдущий ответ с того места, где ты остановился. Начни прямо с прерванного предложения, без вводных слов.";
    
    // Добавляем сообщение ассистента, которое будем дополнять
    const assistantMessageIndex = lastMessageIndex;
    let accumulatedText = lastAssistantMessage.content;

    try {
      // ВАЖНО: отправляем на сервер ключ модели (sonnet/gpt52/opus/gemini/fable).
      // displayModelName используется только для UI — чтобы не показывать 'gpt52' пользователю.
      const modelName = model
      const displayModelName = getDisplayModelName(model)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: continuePrompt,
          history: messages,
          useStreaming: true,
          model: modelName,
          specialty: specialty,
          responseStyle,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') break;

              try {
                const json = JSON.parse(data);
                
                // Проверяем причину завершения
                const finishReason = json.choices?.[0]?.finish_reason;
                if (finishReason === 'length') {
                  setIsCutOff(true);
                }

                const content = json.choices?.[0]?.delta?.content || '';
                if (content) {
                  accumulatedText += content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[assistantMessageIndex] = {
                      ...newMessages[assistantMessageIndex],
                      content: accumulatedText
                    };
                    return newMessages;
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Continue error:', err);
    } finally {
      setLoading(false);
    }
  };

  const splitFilesIntoBatches = (files: File[]): File[][] => {
    const batches: File[][] = [];
    let currentBatch: File[] = [];
    let currentBatchBytes = 0;

    for (const file of files) {
      const wouldExceedCount = currentBatch.length >= MAX_CHAT_FILES_PER_BATCH;
      const wouldExceedBytes = (currentBatchBytes + file.size) > MAX_CHAT_TOTAL_BYTES_PER_BATCH;
      if (currentBatch.length > 0 && (wouldExceedCount || wouldExceedBytes)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchBytes = 0;
      }
      currentBatch.push(file);
      currentBatchBytes += file.size;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  };

  const handleSend = async () => {
    if (!message.trim() && selectedFiles.length === 0) return

    setIsCutOff(false)
    setLoading(true)
    setTriageSuggestion(null)
    setTriageDismissed(false)

    const userMessageVisible = message || (selectedFiles.length > 0 ? 'Проанализируйте прикрепленные файлы' : '')
    let userMessageForModel = userMessageVisible
    let ragRequested = false
    let ragUsed = false
    let ragSources: string[] = []
    
    // Автоматический поиск в библиотеке (RAG), если включен тумблер
    if (useLibrary && message.trim()) {
      ragRequested = true
      setSearchingLibrary(true)
      try {
        const hits = await searchLibraryLocalWithMeta(message, 3)
        if (hits.length > 0) {
          const results = hits.map(hit => hit.content)
          ragSources = hits.map((hit, idx) => {
            const name = hit.documentName || `Документ ${idx + 1}`
            const pagePart = Number.isFinite(Number(hit.pageId)) ? `стр. ${hit.pageId}` : 'стр. ?'
            return `${name} (${pagePart})`
          })
          // Контекст нужен модели, но не должен визуализироваться в пользовательском сообщении.
          userMessageForModel += `\n\n### КОНТЕКСТ ИЗ БИБЛИОТЕКИ:\n${results.join('\n---\n')}`
          ragUsed = true
        }
      } catch (err) {
        console.error('Auto library search error:', err)
      } finally {
        setSearchingLibrary(false)
      }
    }

    const filesInfo = selectedFiles.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type
    }))

    setMessage('')
    setSelectedFiles([])
    setShowFileUpload(false)
    
    // Анонимизируем изображения перед отправкой, если включено
    let filesToSend = [...selectedFiles];
    if (autoAnonymize) {
      setIsProcessingFiles(true);
      try {
        const processed = await Promise.all(filesToSend.map(async (f) => {
          if (f.type.startsWith('image/')) {
            const anonymizationMode = specialty === 'radiology' ? 'soft' : 'strict';
            return await anonymizeMedicalImage(f, anonymizationMode);
          }
          if (f.name.toLowerCase().endsWith('.docx') || f.name.toLowerCase().endsWith('.doc')) {
            return await anonymizeWordFile(f);
          }
          if (f.type.startsWith('text/') || f.name.match(/\.(txt|csv|json)$/i)) {
            const text = await f.text();
            const safeText = anonymizeText(text);
            const blob = new Blob([safeText], { type: f.type });
            return new File([blob], f.name, { type: f.type });
          }
          return f;
        }));
        filesToSend = processed;
      } catch (err) {
        console.error('Anonymization error in chat:', err);
      } finally {
        setIsProcessingFiles(false);
      }
    }

    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessageVisible,
      files: filesInfo.length > 0 ? filesInfo : undefined,
      ragRequested: ragRequested || undefined,
      ragUsed: ragRequested ? ragUsed : undefined,
      ragSources: ragRequested && ragUsed ? ragSources.slice(0, 3) : undefined
    }])

    const assistantMessageIndex = messages.length + 1
    if (useStreaming) {
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    }

    try {
      // ВАЖНО: отправляем на сервер ключ модели (sonnet/gpt52/opus/gemini/fable),
      // а не строковый id провайдера. Сервер сам выберет актуальный id (например Sonnet 5).
      const modelName = model
      const displayModelName = getDisplayModelName(model)

      if (filesToSend.length > 0) {
        const fileBatches = splitFilesIntoBatches(filesToSend);
        if (fileBatches.length > 1) {
          let aggregatedText = `⚙️ Обнаружена большая загрузка. Обрабатываем ${filesToSend.length} файлов в ${fileBatches.length} пакетах для стабильной отправки.\n`;
          let totalCost = 0;

          if (useStreaming) {
            setMessages(prev => {
              const newMessages = [...prev];
              if (newMessages[assistantMessageIndex]) {
                newMessages[assistantMessageIndex] = { role: 'assistant', content: aggregatedText };
              }
              return newMessages;
            });
          }

          for (let batchIndex = 0; batchIndex < fileBatches.length; batchIndex++) {
            const batch = fileBatches[batchIndex];
            const batchPrompt = `${userMessageForModel}\n\n[Пакет вложений ${batchIndex + 1}/${fileBatches.length}] Проанализируйте файлы этого пакета и дайте выводы.`;
            const batchFormData = new FormData();
            batchFormData.append('message', batchPrompt);
            batchFormData.append('history', JSON.stringify(messages));
            batchFormData.append('useStreaming', 'false');
            batchFormData.append('model', modelName);
            batchFormData.append('specialty', specialty);
            batchFormData.append('responseStyle', responseStyle);
            batch.forEach(file => batchFormData.append('files', file));

            const batchResponse = await fetch('/api/chat', {
              method: 'POST',
              body: batchFormData,
            });

            const batchData = await batchResponse.json().catch(() => ({ success: false, error: `HTTP ${batchResponse.status}` }));
            if (!batchResponse.ok || !batchData.success) {
              const details = batchData?.error || `HTTP error! status: ${batchResponse.status}`;
              throw new Error(`Пакет ${batchIndex + 1}/${fileBatches.length} не обработан: ${details}`);
            }

            totalCost += Number(batchData.cost || 0);
            aggregatedText += `\n\n### Пакет ${batchIndex + 1}/${fileBatches.length}\n${batchData.result || ''}`;

            if (useStreaming) {
              setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages[assistantMessageIndex]) {
                  newMessages[assistantMessageIndex] = {
                    role: 'assistant',
                    content: aggregatedText,
                    cost: totalCost,
                    model: batchData.model || modelName
                  };
                }
                return newMessages;
              });
            }
          }

          if (!useStreaming) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: aggregatedText,
              cost: totalCost,
              model: modelName
            }]);
          }

          return;
        }

        const formData = new FormData()
        formData.append('message', userMessageForModel)
        formData.append('history', JSON.stringify(messages))
        formData.append('useStreaming', useStreaming.toString())
        formData.append('model', modelName)
        formData.append('specialty', specialty)
        formData.append('responseStyle', responseStyle)
        filesToSend.forEach(file => formData.append('files', file))

        if (useStreaming) {
          // Streaming режим с файлами
          const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let accumulatedText = ''

          if (reader) {
            console.log('📡 [STREAMING WITH FILES] Начало чтения потока')
            let buffer = ''
            let streamError = false
            
            while (true) {
              const { done, value } = await reader.read()
              if (done || streamError) {
                console.log('📡 [STREAMING WITH FILES] Поток завершён')
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk
              
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim()
                  if (data === '[DONE]') {
                    streamError = true // Прерываем внешний цикл
                    break
                  }

                  try {
                    const json = JSON.parse(data)
                    
                    // Проверяем причину завершения
                    const finishReason = json.choices?.[0]?.finish_reason;
                    if (finishReason === 'length') {
                      console.log('⚠️ [STREAMING WITH FILES] Ответ прерван по лимиту длины');
                      setIsCutOff(true);
                      setLastMessageIndex(assistantMessageIndex);
                    }

                    if (json.error) {
                      const errorText = formatUnknownError(json.error)
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            role: 'assistant',
                            content: `❌ Ошибка: ${errorText}`
                          }
                        }
                        return newMessages
                      })
                      streamError = true // Прерываем внешний цикл
                      break
                    }

                    // Обработка статистики использования
                    if (json.usage) {
                      const usageModel = json.model || displayModelName
                      const resolvedCost = resolveUsageCost(json.usage, usageModel)
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            ...newMessages[assistantMessageIndex],
                            cost: resolvedCost ?? newMessages[assistantMessageIndex].cost,
                            model: usageModel
                          }
                        }
                        return newMessages
                      })

                      logUsage({
                        section: 'chat',
                        model: usageModel,
                        inputTokens: Number(json.usage.prompt_tokens) || 0,
                        outputTokens: Number(json.usage.completion_tokens) || 0,
                        specialty: specialty
                      })
                      continue
                    }

                    const content = json.choices?.[0]?.delta?.content || ''
                    if (content) {
                      accumulatedText += content
                      
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            ...newMessages[assistantMessageIndex],
                            content: accumulatedText
                          }
                        } else {
                          newMessages.push({
                            role: 'assistant',
                            content: accumulatedText
                          })
                        }
                        return newMessages
                      })
                    }
                  } catch (e) {
                    console.warn('⚠️ [STREAMING WITH FILES] Ошибка парсинга SSE:', e)
                  }
                }
              }
            }
            
            console.log('✅ [STREAMING WITH FILES] Итого получено:', accumulatedText.length, 'символов')
          }
        } else {
          // Ообычный режим с файлами
          const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()

          if (data.success) {
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: data.result,
              cost: data.cost,
              model: data.model || modelName
            }])
            logUsage({
              section: 'chat',
              model: modelName,
              inputTokens: 1500,
              outputTokens: 1200,
            })
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${formatUnknownError(data.error)}` }])
          }
        }
      } else {
        // Отправка без файлов (обычный режим)
        if (useStreaming) {
          // Streaming режим
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessageForModel,
              history: messages,
              useStreaming: true,
              model: modelName,
              specialty: specialty,
              responseStyle,
            }),
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let accumulatedText = ''

          if (reader) {
            console.log('📡 [STREAMING] Начало чтения потока')
            let buffer = ''
            let streamError = false
            
            while (true) {
              const { done, value } = await reader.read()
              if (done || streamError) {
                console.log('📡 [STREAMING] Поток завершён')
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk
              
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim()
                  if (data === '[DONE]') {
                    streamError = true
                    break
                  }

                  try {
                    const json = JSON.parse(data)

                    // Проверяем причину завершения
                    const finishReason = json.choices?.[0]?.finish_reason;
                    if (finishReason === 'length') {
                      console.log('⚠️ [STREAMING] Ответ прерван по лимиту длины');
                      setIsCutOff(true);
                      setLastMessageIndex(assistantMessageIndex);
                    }

                    if (json.error) {
                      const errorText = formatUnknownError(json.error)
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            role: 'assistant',
                            content: `❌ Ошибка: ${errorText}`
                          }
                        }
                        return newMessages
                      })
                      streamError = true
                      break
                    }

                    // Обработка статистики использования
                    if (json.usage) {
                      const usageModel = json.model || displayModelName
                      const resolvedCost = resolveUsageCost(json.usage, usageModel)
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            ...newMessages[assistantMessageIndex],
                            cost: resolvedCost ?? newMessages[assistantMessageIndex].cost,
                            model: usageModel
                          }
                        }
                        return newMessages
                      })
                      
                      logUsage({
                        section: 'chat',
                        model: usageModel,
                        inputTokens: Number(json.usage.prompt_tokens) || 0,
                        outputTokens: Number(json.usage.completion_tokens) || 0,
                        specialty: specialty // Передаем специальность
                      })
                      continue;
                    }

                    // OpenRouter формат: json.choices[0].delta.content
                    const content = json.choices?.[0]?.delta?.content || ''
                    if (content) {
                      accumulatedText += content
                      
                      // Обновляем последнее сообщение ассистента
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            ...newMessages[assistantMessageIndex],
                            content: accumulatedText
                          }
                        } else {
                          // Если сообщения нет, добавляем новое
                          newMessages.push({
                            role: 'assistant',
                            content: accumulatedText
                          })
                        }
                        return newMessages
                      })
                    }
                  } catch (e) {
                    // Логируем ошибки парсинга для отладки
                    console.warn('⚠️ [STREAMING] Ошибка парсинга SSE:', e, 'data:', data.substring(0, 100))
                  }
                }
              }
            }
            
            console.log('✅ [STREAMING] Итого получено:', accumulatedText.length, 'символов')
          }
        } else {
          // Обычный режим
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessageForModel,
              history: messages,
              useStreaming: false,
              model: modelName,
              specialty: specialty,
              responseStyle,
            }),
          })

          const data = await response.json()

          if (data.success) {
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: data.result, 
              cost: data.cost,
              model: data.model || modelName
            }])
            logUsage({
              section: 'chat',
              model: modelName,
              inputTokens: 1000,
              outputTokens: 1000,
              specialty: specialty // Передаем специальность
            })
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${formatUnknownError(data.error)}` }])
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const newMessages = [...prev]
        if (useStreaming && newMessages[assistantMessageIndex]) {
          newMessages[assistantMessageIndex] = {
            role: 'assistant',
            content: `Ошибка: ${err.message}`
          }
        } else {
          newMessages.push({ role: 'assistant', content: `Ошибка: ${err.message}` })
        }
        return newMessages
      })
    } finally {
      setLoading(false)
    }
  }

  const handleConsiliumSend = async () => {
    if (!message.trim() && selectedFiles.length === 0) return

    setConsiliumLoading(true)
    setConsiliumEvents([])
    setConsiliumSpecialtyEvents([])
    setConsiliumAmscDecision(null)
    setConsiliumResult(null)
    setConsiliumError(null)
    setConsiliumCurrentRound(0)
    setConsiliumStageMessage('Подготовка кейса...')

    const caseText = message
    const caseFiles = [...selectedFiles]
    setMessage('')
    setSelectedFiles([])
    setShowFileUpload(false)

    try {
      const formData = new FormData()
      formData.append('message', caseText)
      caseFiles.forEach((file) => formData.append('files', file))

      const response = await fetch('/api/consilium', { method: 'POST', body: formData })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() || ''

          for (const chunk of chunks) {
            if (!chunk.startsWith('data: ')) continue
            try {
              const event: ConsiliumProgressEvent = JSON.parse(chunk.slice(6))
              if (event.type === 'stage') {
                setConsiliumStageMessage(event.message || null)
              } else if (event.type === 'specialty' && event.specialty && event.status) {
                setConsiliumSpecialtyEvents((prev) => {
                  const existingIndex = prev.findIndex((item) => item.specialty === event.specialty)
                  const nextItem = { specialty: event.specialty!, status: event.status! }
                  if (existingIndex === -1) return [...prev, nextItem]
                  const next = [...prev]
                  next[existingIndex] = nextItem
                  return next
                })
              } else if (event.type === 'amsc-decision' && typeof event.escalated === 'boolean') {
                setConsiliumAmscDecision({ escalated: event.escalated, disagreementScore: event.disagreementScore || 0 })
                if (event.escalated) {
                  // Гипотезы раунда 0 переиспользуются вместо повторного вызова Dr. Hypothesis —
                  // отмечаем эту роль как готовую, чтобы UI цикла дебатов не "завис" в ожидании.
                  setConsiliumEvents((prev) => [...prev, { round: 0, role: 'hypothesis', status: 'done' }])
                }
              } else if (event.type === 'round' && event.status === 'started' && typeof event.round === 'number') {
                setConsiliumCurrentRound(event.round)
                setConsiliumStageMessage(null)
              } else if (event.type === 'role' && event.role && event.status && typeof event.round === 'number') {
                setConsiliumEvents((prev) => [...prev, { round: event.round!, role: event.role!, status: event.status! }])
              } else if (event.type === 'final' && event.result) {
                setConsiliumResult(event.result)
              } else if (event.type === 'error') {
                setConsiliumError(event.message || 'Ошибка выполнения консилиума')
              }
            } catch (e) {
              console.warn('⚠️ [CONSILIUM] Ошибка парсинга SSE:', e)
            }
          }
        }
      }
    } catch (err: any) {
      setConsiliumError(err.message || 'Произошла ошибка при запуске консилиума')
    } finally {
      setConsiliumLoading(false)
      setConsiliumStageMessage(null)
    }
  }

  const handleLibrarySearch = async () => {
    if (!message.trim()) return
    
    setSearchingLibrary(true)
    try {
      const results = await searchLibraryLocal(message, 3)
      if (results.length > 0) {
        const context = `\n\n### КОНТЕКСТ ИЗ БИБЛИОТЕКИ:\n${results.join('\n---\n')}`
        setMessage(prev => prev + context)
      } else {
        alert('В библиотеке не найдено релевантных материалов.')
      }
    } catch (err) {
      console.error('Library search error:', err)
    } finally {
      setSearchingLibrary(false)
    }
  }

  const clearChat = () => {
    if (confirm('Вы уверены, что хотите очистить историю чата?')) {
      setMessages([])
    }
  }

  /**
   * Chain-of-Verification по требованию врача: отдельный лёгкий вызов дешёвой
   * модели с ролью "адвоката дьявола" (см. SELF_CHECK_SYSTEM_PROMPT) поверх уже
   * готового ответа. Опционально (кнопка под ответом), а не встроено в каждый
   * запрос — так обычный чат не дорожает по умолчанию.
   */
  const handleSelfCheck = async (assistantIndex: number) => {
    const assistantMsg = messages[assistantIndex]
    if (!assistantMsg || assistantMsg.role !== 'assistant' || !assistantMsg.content.trim()) return

    const questionMsg = [...messages.slice(0, assistantIndex)].reverse().find(m => m.role === 'user')
    const question = questionMsg?.content || 'Вопрос врача не сохранён в истории.'

    setMessages(prev => {
      const next = [...prev]
      next[assistantIndex] = { ...next[assistantIndex], selfCheckLoading: true, selfCheckError: undefined }
      return next
    })

    try {
      const formData = new FormData()
      formData.append(
        'message',
        `### ВОПРОС ВРАЧА:\n${question}\n\n### ОТВЕТ АССИСТЕНТА (проверь его):\n${assistantMsg.content}`
      )
      formData.append('systemPrompt', SELF_CHECK_SYSTEM_PROMPT)
      formData.append('useStreaming', 'false')
      formData.append('model', 'sonnet')
      formData.append('specialty', 'universal')
      formData.append('responseStyle', 'brief')

      const response = await fetch('/api/chat', { method: 'POST', body: formData })
      const data = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }))
      if (!response.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }

      setMessages(prev => {
        const next = [...prev]
        next[assistantIndex] = { ...next[assistantIndex], selfCheck: data.result, selfCheckLoading: false }
        return next
      })
    } catch (err: any) {
      setMessages(prev => {
        const next = [...prev]
        next[assistantIndex] = {
          ...next[assistantIndex],
          selfCheckLoading: false,
          selfCheckError: err?.message || 'Не удалось выполнить самопроверку',
        }
        return next
      })
    }
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <span className="bg-teal-600 text-white p-1.5 rounded-lg shadow-sm">🤖</span>
            ИИ-Ассистент
          </h1>
          {session?.user && (
            <p className="text-xs text-slate-500 mt-1">
              Сессия: {session.user.email}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={clearChat}
            className="flex-1 sm:flex-none px-3 py-2 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border border-slate-200 shadow-sm"
            title="Очистить историю диалога"
          >
            🗑️ Очистить
          </button>
          
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="flex-1 sm:flex-none px-3 py-2 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border border-slate-200 shadow-sm"
          >
            🚪 Выйти
          </button>
        </div>
      </div>

      <div
        className={`mb-4 sm:mb-6 rounded-2xl border-2 shadow-sm transition-colors ${
          consiliumMode ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-white' : 'border-indigo-200 bg-white hover:border-indigo-300'
        }`}
      >
        <button
          onClick={() => setConsiliumMode((prev) => !prev)}
          disabled={loading || consiliumLoading}
          className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 text-left disabled:opacity-50 touch-manipulation"
        >
          <span className="text-2xl sm:text-3xl shrink-0">🩺</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm sm:text-base text-slate-900">Консилиум</span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                Премиум
              </span>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                🧠 Глубокий анализ
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Сначала независимые мнения нескольких специальностей, подобранных под ваш кейс (+ скептик по red flags).
              Если мнения совпадают — сразу консенсус. Если расходятся — эскалация в полный цикл дебатов из 5 ролей
              (генератор гипотез → советчик по обследованиям → критик → контроль избыточности → финальный чек-лист).
            </p>
          </div>
          <span
            aria-hidden
            className={`relative inline-flex h-6 w-11 sm:h-7 sm:w-12 shrink-0 items-center rounded-full transition-colors ${
              consiliumMode ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow transition-transform ${
                consiliumMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
        </button>

        {consiliumMode && (
          <div className="border-t border-indigo-200 px-4 sm:px-5 py-3 text-xs sm:text-sm text-indigo-900 bg-indigo-50/60 rounded-b-2xl">
            Опишите кейс и/или приложите файлы (фото заключений, снимков, документы) как обычно. Простой кейс без
            расхождений во мнениях занимает ~1 минуту и стоит ~19 у.е. Если специальности разошлись во мнении (или
            скептик заметил red flag) — консилиум автоматически эскалируется в полный цикл дебатов на Fable 5
            (углублённое клиническое рассуждение): ещё 3–6 минут и до ~154 у.е. суммарно. Это существенно дороже
            обычного сообщения в чате.
          </div>
        )}
      </div>

      {consiliumMode ? (
        <div className="mb-4 sm:mb-6">
          {consiliumError && (
            <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-4">❌ {consiliumError}</div>
          )}
          {(consiliumLoading || consiliumEvents.length > 0 || consiliumSpecialtyEvents.length > 0) && !consiliumResult && (
            <ConsiliumProgress
              stageMessage={consiliumStageMessage || undefined}
              items={consiliumEvents}
              currentRound={consiliumCurrentRound}
              specialtyItems={consiliumSpecialtyEvents}
              amscDecision={consiliumAmscDecision}
            />
          )}
          {consiliumResult && <ConsiliumAuditView result={consiliumResult} />}
          {!consiliumLoading && !consiliumResult && !consiliumError && consiliumEvents.length === 0 && consiliumSpecialtyEvents.length === 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-500 text-sm">
              Опишите кейс ниже и нажмите «Запустить консилиум».
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-4 sm:mb-6 h-[70vh] sm:h-[700px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 sm:mt-20 text-sm sm:text-base">
            Начните диалог с ИИ-ассистентом
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 sm:p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary-100 sm:ml-12'
                    : 'bg-gray-100 sm:mr-12'
                }`}
              >
                <div className="font-semibold mb-2 text-sm sm:text-base flex items-center justify-between">
                  <span>{msg.role === 'user' ? 'Вы' : `Аналитический ответ (${msg.model || 'ИИ-Ассистент'})`}</span>
                  {msg.role === 'assistant' && msg.cost !== undefined && (
                    <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 font-bold">
                      💰 {msg.cost.toFixed(2)} ед.
                    </span>
                  )}
                </div>
                {msg.files && msg.files.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1 sm:gap-2">
                    {msg.files.map((file, fileIdx) => (
                      <span
                        key={fileIdx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 rounded text-xs"
                        title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
                      >
                        📎 <span className="max-w-[150px] sm:max-w-none truncate">{file.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                {msg.role === 'user' && msg.ragRequested && (
                  <div className="mb-2">
                    <span
                      title={msg.ragUsed ? 'Части ответа без опоры на эти источники модель обязана явно пометить "⚠️ не подтверждено предоставленными источниками"' : undefined}
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${
                        msg.ragUsed
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {msg.ragUsed ? '📚 RAG: контекст найден' : '📚 RAG: контекст не найден'}
                    </span>
                    {msg.ragUsed && msg.ragSources && msg.ragSources.length > 0 && (
                      <div className="mt-1 text-[10px] text-slate-600">
                        Источники: {msg.ragSources.join('; ')}. Не подтверждённые ими утверждения модель помечает в тексте отдельно.
                      </div>
                    )}
                  </div>
                )}
                <div className="prose prose-sm max-w-none text-sm sm:text-base">
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize]}
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-3 mb-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-2 mb-1" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1" {...props} />,
                        p: ({node, ...props}) => <p className="mb-2" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        table: ({node, ...props}) => (
                          <div className="my-3 overflow-x-auto">
                            <table className="min-w-full border border-gray-300 text-sm" {...props} />
                          </div>
                        ),
                        thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                        tbody: ({node, ...props}) => <tbody {...props} />,
                        tr: ({node, ...props}) => <tr className="border-b border-gray-200" {...props} />,
                        th: ({node, ...props}) => <th className="border border-gray-300 px-2 py-1 text-left font-semibold" {...props} />,
                        td: ({node, ...props}) => <td className="border border-gray-300 px-2 py-1 align-top" {...props} />,
                        code: ({node, inline, ...props}: any) => 
                          inline ? (
                            <code className="bg-gray-200 px-1 rounded text-sm" {...props} />
                          ) : (
                            <code className="block bg-gray-200 p-2 rounded text-sm my-2" {...props} />
                          ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {msg.role === 'assistant' && msg.content.trim() && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    {!msg.selfCheck && !msg.selfCheckLoading && (
                      <button
                        onClick={() => handleSelfCheck(idx)}
                        title="Отдельный запрос к модели-скептику: ищет пропущенные альтернативы, red flags и необоснованные утверждения в этом ответе"
                        className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                      >
                        🔍 Проверить ответ (Chain-of-Verification)
                      </button>
                    )}
                    {msg.selfCheckLoading && (
                      <div className="text-[11px] text-gray-500">⏳ Проверяю ответ на слабые места…</div>
                    )}
                    {msg.selfCheckError && (
                      <div className="text-[11px] text-red-600">❌ {msg.selfCheckError}</div>
                    )}
                    {msg.selfCheck && (
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-2.5">
                        <div className="mb-1 text-[11px] font-bold text-purple-800">🔍 Самопроверка (независимая критика ответа)</div>
                        <div className="whitespace-pre-wrap text-[12px] text-purple-900">{msg.selfCheck}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            )}
            {isCutOff && !loading && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-full text-xs font-bold transition-all border border-amber-300 shadow-sm animate-pulse"
                >
                  ⏳ Ответ прерван. Дописать до конца?
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {showAudioUpload && (
        <div className="mb-3 sm:mb-4 bg-white rounded-lg shadow-lg p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm sm:text-base">🎤 Загрузка аудио</h3>
            <button
              onClick={() => setShowAudioUpload(false)}
              className="text-gray-500 hover:text-gray-700 p-2 touch-manipulation"
            >
              ✕
            </button>
          </div>
          <AudioUpload
            onTranscribe={(transcript) => {
              setMessage(transcript)
              setShowAudioUpload(false)
            }}
          />
        </div>
      )}

      {showFileUpload && (
        <div className="mb-3 sm:mb-4 bg-white rounded-lg shadow-lg p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm sm:text-base">📎 Загрузка файлов</h3>
            <button
              onClick={() => {
                setShowFileUpload(false)
                setSelectedFiles([])
              }}
              className="text-gray-500 hover:text-gray-700 p-2 touch-manipulation"
            >
              ✕
            </button>
          </div>
          <FileUpload
            onUpload={(files) => {
              setSelectedFiles(prev => [...prev, ...files])
            }}
            multiple={true}
            maxSize={50}
            bridgePullTarget="chat"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs sm:text-sm font-medium mb-3 flex items-center justify-between">
                <span>Выбранные файлы ({selectedFiles.length}):</span>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  💡 Нажмите 🛡️ для удаления ФИО или 🎨 для закрашивания
                </span>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {selectedFiles.map((file, idx) => {
                  const isImage = file.type.startsWith('image/');
                  const isPDF = file.type === 'application/pdf';
                  const isWord = file.name.match(/\.docx?$/i);
                  const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|csv)$/i);

                  return (
                    <span
                      key={idx}
                      className="inline-flex flex-col sm:flex-row items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs group transition-all hover:border-primary-400 shadow-sm hover:shadow-md min-w-[150px]"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-lg">
                          {isImage ? '🖼️' : isPDF ? '📄' : isWord ? '📝' : '📎'}
                        </span>
                        <span className="flex-1 truncate font-semibold text-slate-700 max-w-[150px]">
                          {file.name}
                        </span>
                        <button
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 hover:bg-red-50 rounded-full text-red-400 hover:text-red-600 transition-colors"
                          title="Удалить файл"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-1 w-full mt-1 sm:mt-0 pt-1 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-2">
                        {isPDF && (
                          <button
                            onClick={async () => {
                              setConvertingPDF(true);
                              try {
                                const images = await convertPDFToImages(file);
                                setSelectedFiles(prev => {
                                  const updated = [...prev];
                                  const currentIdx = updated.indexOf(file);
                                  if (currentIdx !== -1) {
                                    updated.splice(currentIdx, 1, ...images);
                                  }
                                  return updated;
                                });
                              } catch (err: any) {
                                alert(err.message);
                              } finally {
                                setConvertingPDF(false);
                              }
                            }}
                            disabled={convertingPDF}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2 py-1 bg-teal-50 hover:bg-teal-100 rounded-lg text-teal-700 transition-colors font-bold"
                            title="Разобрать PDF на страницы для закрашивания ФИО"
                          >
                            <span>{convertingPDF ? '⌛' : '🛡️'}</span>
                            <span className="text-[9px] uppercase tracking-tighter">Аноним.</span>
                          </button>
                        )}
                        
                        {isImage && (
                          <button
                            onClick={() => {
                              setEditingFileIndex(idx);
                              setShowEditor(true);
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 transition-colors font-bold"
                            title="Закрасить данные вручную"
                          >
                            <span>🎨</span>
                            <span className="text-[9px] uppercase tracking-tighter">Правка</span>
                          </button>
                        )}

                        {(isWord || isText) && (
                          <button
                            onClick={async () => {
                              setIsProcessingFiles(true);
                              try {
                                const currentIdx = selectedFiles.indexOf(file);
                                if (currentIdx === -1) return;

                                let anonymized;
                                if (isWord) {
                                  anonymized = await anonymizeWordFile(file);
                                } else {
                                  const text = await file.text();
                                  const safeText = anonymizeText(text);
                                  anonymized = new File([new Blob([safeText])], file.name, { type: file.type });
                                }
                                setSelectedFiles(prev => {
                                  const updated = [...prev];
                                  updated[currentIdx] = anonymized;
                                  return updated;
                                });
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsProcessingFiles(false);
                              }
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-700 transition-colors font-bold"
                            title="Автоматически очистить текст от ФИО"
                          >
                            <span>🛡️</span>
                            <span className="text-[9px] uppercase tracking-tighter">Аноним.</span>
                          </button>
                        )}
                      </div>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center">
          {consiliumMode ? (
            <div className="text-xs sm:text-sm text-slate-500">
              🩺 В режиме «Консилиум» выбор специальности, модели и стиля ответа не используется — состав ролей и моделей фиксирован.
            </div>
          ) : (
          <>
          <ChatSpecialistSelector 
            selectedSpecialty={specialty}
            onSelect={setSpecialty}
          />
          
          <div className="h-px sm:h-8 w-full sm:w-px bg-slate-200" />

          <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 text-primary-600"
            />
            <span className="text-xs sm:text-sm">Streaming</span>
          </label>

          <label data-tour="chat-rag-toggle" className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={useLibrary}
              onChange={(e) => setUseLibrary(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 text-teal-600"
            />
            <span className="text-xs sm:text-sm font-medium text-teal-700">📚 Искать по моей библиотеке</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={autoAnonymize}
              onChange={(e) => setAutoAnonymize(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600"
            />
            <span className="text-xs sm:text-sm font-medium text-blue-700">🛡️ Авто-анонимизация</span>
          </label>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Модель:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
              disabled={loading}
            >
              <option value="gpt52">🚀 GPT-5.6 Terra</option>
              <option value="opus">🧠 Opus 4.8</option>
              <option value="fable">🚀 Fable 5 (дороже)</option>
              <option value="sonnet">🤖 Sonnet 5</option>
              <option value="gemini">⚡ Gemini 3.1</option>
            </select>
          </div>

          <div className="w-full sm:w-auto rounded-lg border-2 border-teal-300 bg-teal-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-teal-800 whitespace-nowrap">Для врача: формат ответа</span>
              <select
                value={responseStyle}
                onChange={(e) => setResponseStyle(e.target.value as ResponseStyle)}
                className="flex-1 sm:flex-none px-3 py-2 border border-teal-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 touch-manipulation"
                disabled={loading}
              >
                <option value="brief">Кратко (по умолчанию)</option>
                <option value="detailed">Развернуто</option>
              </select>
            </div>
            <p className="mt-1 text-[10px] sm:text-xs text-teal-700">
              Влияет на все следующие ответы в этом диалоге.
            </p>
          </div>
          </>
          )}
        </div>
      </div>

      {triageSuggestion && !consiliumMode && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs sm:text-sm">
          <span className="font-semibold text-amber-800">💡 Похоже, случай непростой</span>
          {triageSuggestion.reasoning && (
            <span className="text-amber-700">— {triageSuggestion.reasoning}.</span>
          )}
          <span className="text-amber-700">Рекомендуем более глубокое рассуждение.</span>
          <button
            type="button"
            onClick={() => { setModel('fable'); setTriageSuggestion(null) }}
            className="ml-auto rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
          >
            Переключить на Fable 5
          </button>
          <button
            type="button"
            onClick={() => { setTriageSuggestion(null); setTriageDismissed(true) }}
            className="rounded-full px-2 py-1 text-amber-500 hover:bg-amber-100"
            title="Скрыть подсказку"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAudioUpload(!showAudioUpload)}
            className="px-4 py-3 sm:py-2 bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 text-white rounded-lg transition-colors text-lg sm:text-base touch-manipulation"
            title="Загрузить аудио"
          >
            🎤
          </button>
          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`px-4 py-3 sm:py-2 rounded-lg transition-colors text-lg sm:text-base touch-manipulation ${
              selectedFiles.length > 0
                ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white'
                : 'bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700'
            }`}
            title="Загрузить файлы"
          >
            📎 {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </button>
          <button
            onClick={handleLibrarySearch}
            disabled={searchingLibrary || !message.trim() || useLibrary}
            className={`px-4 py-3 sm:py-2 rounded-lg transition-colors text-lg sm:text-base touch-manipulation ${
              useLibrary 
                ? 'bg-teal-100 text-teal-400 cursor-not-allowed' 
                : searchingLibrary 
                  ? 'bg-indigo-100 text-indigo-400' 
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
            title={useLibrary ? "Поиск по библиотеке уже включен для этого сообщения" : "Найти и вставить источники из вашей библиотеки вручную"}
          >
            {searchingLibrary ? '⏳' : '📚'}
          </button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              consiliumMode ? handleConsiliumSend() : handleSend();
            }
          }}
          placeholder={consiliumMode ? 'Опишите кейс для консилиума (жалобы, анамнез, вложенные заключения)...' : 'Введите ваш вопрос...'}
          data-tour="chat-question-input"
          className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base touch-manipulation min-h-[50px] max-h-[200px] resize-y"
          disabled={loading || consiliumLoading}
          rows={1}
        />
        <button
          onClick={consiliumMode ? handleConsiliumSend : handleSend}
          data-tour="chat-send-button"
          disabled={
            consiliumMode
              ? consiliumLoading || isProcessingFiles || (!message.trim() && selectedFiles.length === 0)
              : loading || isProcessingFiles || (!message.trim() && selectedFiles.length === 0)
          }
          className={`px-6 py-3 sm:py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium touch-manipulation flex items-center justify-center gap-2 ${
            consiliumMode
              ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              : 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700'
          }`}
        >
          {isProcessingFiles ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>🛡️ Защита...</span>
            </>
          ) : consiliumLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Консилиум работает...</span>
            </>
          ) : consiliumMode ? (
            '🩺 Запустить консилиум'
          ) : (
            'Отправить'
          )}
        </button>
      </div>

      {showEditor && editingFileIndex !== null && selectedFiles[editingFileIndex] && (
        <ImageEditor
          image={URL.createObjectURL(selectedFiles[editingFileIndex])}
          onSave={(editedDataUrl) => {
            // Мгновенно закрываем редактор и сбрасываем индекс
            setShowEditor(false);
            const targetIndex = editingFileIndex;
            setEditingFileIndex(null);

            // Конвертируем в файл асинхронно
            fetch(editedDataUrl)
              .then(res => res.blob())
              .then(blob => {
                setSelectedFiles(prev => {
                  const updated = [...prev];
                  if (updated[targetIndex]) {
                    updated[targetIndex] = new File([blob], selectedFiles[targetIndex].name, { type: 'image/jpeg' });
                  }
                  return updated;
                });
              })
              .catch(err => console.error('Ошибка сохранения файла в чате:', err));
          }}
          onCancel={() => {
            setShowEditor(false);
            setEditingFileIndex(null);
          }}
        />
      )}

    </div>
  )
}

