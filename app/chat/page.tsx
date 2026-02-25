'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import AudioUpload from '@/components/AudioUpload'
import FileUpload from '@/components/FileUpload'
import AnalysisTips from '@/components/AnalysisTips'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { logUsage } from '@/lib/simple-logger'
import { ChatSpecialistSelector } from '@/components/ChatSpecialistSelector'
import { Specialty } from '@/lib/prompts'
import { searchLibraryLocal } from '@/lib/library-db'
import ImageEditor from '@/components/ImageEditor'
import { anonymizeMedicalImage } from '@/lib/image-compression'
import { anonymizeText } from '@/lib/anonymization'
import mammoth from 'mammoth'

type ModelType = 'opus' | 'sonnet'

const specialtyMap: Record<string, Specialty> = {
  'Cardiologist': 'cardiology',
  'Endocrinologist': 'endocrinology',
  'Radiologist': 'radiology',
  'Dermatologist': 'dermatology',
  'Neurologist': 'neurology',
  'Gastroenterologist': 'gastroenterology',
  'Pediatrician': 'pediatrics',
  'Oncologist': 'oncology',
  'Hematologist': 'hematology',
  'Gynecologist': 'gynecology',
  'Rheumatologist': 'rheumatology',
  'Academic Search': 'openevidence',
  'AI Expert': 'ai_assistant',
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
  }>>([])
  const [loading, setLoading] = useState(false)
  const [showAudioUpload, setShowAudioUpload] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [useStreaming, setUseStreaming] = useState(true)
  const [useLibrary, setUseLibrary] = useState(false)
  const [model, setModel] = useState<'opus' | 'sonnet' | 'gpt52' | 'gemini'>('gpt52')
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

  // Load PDF.js v3 from local files (public/pdfjs/)
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      const script = document.createElement('script')
      script.src = '/pdfjs/pdf.min.js'
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
          setPdfJsLoaded(true)
          console.log('✅ PDF.js v3 loaded locally (Chat)')
        }
      }
      script.onerror = () => {
        console.warn('⚠️ PDF.js failed to load in Chat')
      }
      document.head.appendChild(script)
    } else if (window.pdfjsLib) {
      setPdfJsLoaded(true)
    }
  }, [])

  const convertPDFToImages = async (pdfFile: File): Promise<File[]> => {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js is not loaded. Please wait a few seconds and try again.')
    }

    const pdfjs = window.pdfjsLib
    const arrayBuffer = await pdfFile.arrayBuffer()
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer, verbosity: 0 })
    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages
    const maxPages = Math.min(totalPages, 10) // Limit to 10 pages for chat

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
        const name = pdfFile.name.replace('.pdf', '') + `_p${pageNum}.jpg`
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
      
      const blob = new Blob([safeText], { type: 'text/plain' });
      return new File([blob], wordFile.name.replace(/\.docx?$/i, '') + '_anonymized.txt', { type: 'text/plain' });
    } catch (err) {
      console.error('Word anonymization error:', err);
      return wordFile;
    }
  }

  useEffect(() => {
    const pendingData = sessionStorage.getItem('pending_analysis');
    if (pendingData) {
      try {
        const { text, type, initialQuestion } = JSON.parse(pendingData);
        
        if (type === 'ecg') setSpecialty('cardiology');
        else if (['ct', 'mri', 'xray', 'ultrasound'].includes(type)) setSpecialty('radiology');
        else if (type === 'Clinical Guidelines') setSpecialty('universal');
        
        let initialPrompt = '';
        
        if (type === 'Clinical Guidelines') {
          initialPrompt = `I am reviewing the following clinical guidelines:\n\n${text}\n\nQuestion: ${initialQuestion || 'Analyze this data.'}`;
        } else {
          const typeNames: Record<string, string> = {
            'ecg': 'ECG',
            'ct': 'CT',
            'mri': 'MRI',
            'xray': 'X-Ray',
            'ultrasound': 'Ultrasound'
          };
          const typeName = typeNames[type] || 'study';
          initialPrompt = `Below is a completed diagnostic report for ${typeName}. THE REPORT IS ALREADY COMPOSED. DO NOT rewrite it, DO NOT duplicate the findings. Your task is to develop a clinical management strategy based on this conclusion:\n\n${text}${initialQuestion ? `\n\nFollow-up question: ${initialQuestion}` : ''}`;
        }
        
        setMessage(initialPrompt);
        sessionStorage.removeItem('pending_analysis');
        
        if (initialQuestion) {
          setTimeout(() => {
            const sendButton = document.querySelector('button.bg-primary-500.active\\:bg-primary-700') as HTMLButtonElement;
            if (sendButton) sendButton.click();
          }, 100);
        }
      } catch (e) {
        console.error('Error parsing pending analysis data:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (specialty === 'openevidence') {
      // For academic search the model is selected server-side (Perplexity -> Sonnet)
    }
  }, [specialty])

  const handleContinue = async () => {
    if (loading || !isCutOff || lastMessageIndex === null) return;
    
    setIsCutOff(false);
    setLoading(true);
    
    const lastAssistantMessage = messages[lastMessageIndex];
    const continuePrompt = "Continue your previous answer from where you left off. Start directly from the interrupted sentence, without any preamble.";
    
    // Добавляем сообщение ассистента, которое будем дополнять
    const assistantMessageIndex = lastMessageIndex;
    let accumulatedText = lastAssistantMessage.content;

    try {
      const modelName = model

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: continuePrompt,
          history: messages,
          useStreaming: true,
          model: modelName,
          specialty: specialty,
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

  const handleSend = async () => {
    if (!message.trim() && selectedFiles.length === 0) return

    setIsCutOff(false)
    setLoading(true)

    let userMessage = message || (selectedFiles.length > 0 ? 'Please analyze the attached files.' : '')
    
    if (useLibrary && message.trim()) {
      setSearchingLibrary(true)
      try {
        const results = await searchLibraryLocal(message, 3)
        if (results.length > 0) {
          userMessage += `\n\n### LIBRARY CONTEXT:\n${results.join('\n---\n')}`
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
    
    let filesToSend = [...selectedFiles];
    if (autoAnonymize) {
      setIsProcessingFiles(true);
      try {
        const processed = await Promise.all(filesToSend.map(async (f) => {
          if (f.type.startsWith('image/')) {
            return await anonymizeMedicalImage(f);
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
      content: userMessage,
      files: filesInfo.length > 0 ? filesInfo : undefined
    }])

    const assistantMessageIndex = messages.length + 1
    if (useStreaming) {
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    }

    try {
      const modelName = model

      if (filesToSend.length > 0) {
        const formData = new FormData()
        formData.append('message', userMessage)
        formData.append('history', JSON.stringify(messages))
        formData.append('useStreaming', useStreaming.toString())
        formData.append('model', modelName)
        formData.append('specialty', specialty)
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
            let buffer = ''
            let streamError = false
            
            while (true) {
              const { done, value } = await reader.read()
              if (done || streamError) {
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
                    
                    const finishReason = json.choices?.[0]?.finish_reason;
                    if (finishReason === 'length') {
                      setIsCutOff(true);
                      setLastMessageIndex(assistantMessageIndex);
                    }

                    if (json.error) {
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            role: 'assistant',
                            content: `❌ Error: ${json.error}`
                          }
                        }
                        return newMessages
                      })
                      streamError = true
                      break
                    }

                    if (json.usage && json.usage.total_cost) {
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            ...newMessages[assistantMessageIndex],
                            cost: json.usage.total_cost,
                            model: json.model || modelName
                          }
                        }
                        return newMessages
                      })
                      
                      logUsage({
                        section: 'chat',
                        model: json.model || modelName,
                        inputTokens: json.usage.prompt_tokens,
                        outputTokens: json.usage.completion_tokens,
                        specialty: specialty
                      })
                      continue;
                    }

                    const content = json.choices?.[0]?.delta?.content || ''
                    if (content) {
                      accumulatedText += content
                      
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            role: 'assistant',
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
                    console.warn('⚠️ [STREAMING WITH FILES] SSE parse error:', e)
                  }
                }
              }
            }
          }
        } else {
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
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
          }
        }
      } else {
        if (useStreaming) {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessage,
              history: messages,
              useStreaming: true,
              model: modelName,
              specialty: specialty,
            }),
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let accumulatedText = ''

          if (reader) {
            let buffer = ''
            let streamError = false
            
            while (true) {
              const { done, value } = await reader.read()
              if (done || streamError) {
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

                    const finishReason = json.choices?.[0]?.finish_reason;
                    if (finishReason === 'length') {
                      setIsCutOff(true);
                      setLastMessageIndex(assistantMessageIndex);
                    }

                    if (json.error) {
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            role: 'assistant',
                            content: `❌ Error: ${json.error}`
                          }
                        }
                        return newMessages
                      })
                      streamError = true
                      break
                    }

                    if (json.usage && json.usage.total_cost) {
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            ...newMessages[assistantMessageIndex],
                            cost: json.usage.total_cost,
                            model: json.model || modelName
                          }
                        }
                        return newMessages
                      })
                      
                      logUsage({
                        section: 'chat',
                        model: json.model || modelName,
                        inputTokens: json.usage.prompt_tokens,
                        outputTokens: json.usage.completion_tokens,
                        specialty: specialty
                      })
                      continue;
                    }

                    const content = json.choices?.[0]?.delta?.content || ''
                    if (content) {
                      accumulatedText += content
                      
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            role: 'assistant',
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
                    console.warn('⚠️ [STREAMING] SSE parse error:', e, 'data:', data.substring(0, 100))
                  }
                }
              }
            }
          }
        } else {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessage,
              history: messages,
              useStreaming: false,
              model: modelName,
              specialty: specialty,
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
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const newMessages = [...prev]
        if (useStreaming && newMessages[assistantMessageIndex]) {
          newMessages[assistantMessageIndex] = {
            role: 'assistant',
            content: `Error: ${err.message}`
          }
        } else {
          newMessages.push({ role: 'assistant', content: `Error: ${err.message}` })
        }
        return newMessages
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLibrarySearch = async () => {
    if (!message.trim()) return
    
    setSearchingLibrary(true)
    try {
      const results = await searchLibraryLocal(message, 3)
      if (results.length > 0) {
        const context = `\n\n### LIBRARY CONTEXT:\n${results.join('\n---\n')}`
        setMessage(prev => prev + context)
      } else {
        alert('No relevant materials found in the library.')
      }
    } catch (err) {
      console.error('Library search error:', err)
    } finally {
      setSearchingLibrary(false)
    }
  }

  const clearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([])
    }
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <span className="bg-teal-600 text-white p-1.5 rounded-lg shadow-sm">🤖</span>
            AI Assistant
          </h1>
          {session?.user && (
            <p className="text-xs text-slate-500 mt-1">
              Session: {session.user.email}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={clearChat}
            className="flex-1 sm:flex-none px-3 py-2 bg-white text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border border-slate-200 shadow-sm"
            title="Clear chat history"
          >
            🗑️ Clear
          </button>
          
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="flex-1 sm:flex-none px-3 py-2 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border border-slate-200 shadow-sm"
          >
            🚪 Sign Out
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-4 sm:mb-6 h-[70vh] sm:h-[700px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 sm:mt-20 text-sm sm:text-base">
            Start a dialogue with the AI Assistant
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
                  <span>{msg.role === 'user' ? 'You' : `Analytical Response (${msg.model || 'AI Assistant'})`}</span>
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
                  ⏳ Response was cut off. Continue to end?
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showAudioUpload && (
        <div className="mb-3 sm:mb-4 bg-white rounded-lg shadow-lg p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm sm:text-base">🎤 Audio Upload</h3>
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
            <h3 className="font-semibold text-sm sm:text-base">📎 File Upload</h3>
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
          />
          {selectedFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs sm:text-sm font-medium mb-3 flex items-center justify-between">
                <span>Selected files ({selectedFiles.length}):</span>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  💡 Press 🛡️ to remove PHI or 🎨 to redact manually
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
                          title="Remove file"
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
                            title="Extract PDF pages for PHI redaction"
                          >
                            <span>{convertingPDF ? '⌛' : '🛡️'}</span>
                            <span className="text-[9px] uppercase tracking-tighter">Anon.</span>
                          </button>
                        )}
                        
                        {isImage && (
                          <button
                            onClick={() => {
                              setEditingFileIndex(idx);
                              setShowEditor(true);
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-700 transition-colors font-bold"
                            title="Manually redact data"
                          >
                            <span>🎨</span>
                            <span className="text-[9px] uppercase tracking-tighter">Redact</span>
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
                            title="Automatically strip PHI from text"
                          >
                            <span>🛡️</span>
                            <span className="text-[9px] uppercase tracking-tighter">Anon.</span>
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

          <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={useLibrary}
              onChange={(e) => setUseLibrary(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 text-teal-600"
            />
            <span className="text-xs sm:text-sm font-medium text-teal-700">📚 Library (RAG)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={autoAnonymize}
              onChange={(e) => setAutoAnonymize(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600"
            />
            <span className="text-xs sm:text-sm font-medium text-blue-700">🛡️ Auto-Anonymize</span>
          </label>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Model:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
              disabled={loading}
            >
              <option value="gpt52">🚀 GPT-5.2</option>
              <option value="opus">🧠 Opus 4.6</option>
              <option value="sonnet">🤖 Sonnet 4.6</option>
              <option value="gemini">⚡ Gemini 3.1</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAudioUpload(!showAudioUpload)}
            className="px-4 py-3 sm:py-2 bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 text-white rounded-lg transition-colors text-lg sm:text-base touch-manipulation"
            title="Upload audio"
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
            title="Upload files"
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
            title={useLibrary ? "Auto library search is enabled" : "Find and insert context from your PDF library manually"}
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
              handleSend();
            }
          }}
          placeholder="Enter your question..."
          className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base touch-manipulation min-h-[50px] max-h-[200px] resize-y"
          disabled={loading}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={loading || isProcessingFiles || (!message.trim() && selectedFiles.length === 0)}
          className="px-6 py-3 sm:py-2 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium touch-manipulation flex items-center justify-center gap-2"
        >
          {isProcessingFiles ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>🛡️ Processing...</span>
            </>
          ) : (
            'Send'
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
              .catch(err => console.error('Error saving file in chat:', err));
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

