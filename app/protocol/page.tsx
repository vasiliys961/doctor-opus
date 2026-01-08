'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import AudioUpload from '@/components/AudioUpload'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

import ReactMarkdown from 'react-markdown'
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx'
import { saveAs } from 'file-saver'
import { DEFAULT_TEMPLATES, ProtocolTemplate } from '@/lib/protocol-templates'
import { handleSSEStream } from '@/lib/streaming-utils'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'

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

  const handleGenerateProtocol = async () => {
    if (!rawText.trim()) return

    setLoading(true)
    setProtocol('')
    setCurrentCost(0)

    try {
      const payload = {
        rawText,
        useStreaming: useStreaming,
        model: model,
        templateId: selectedTemplateId,
        customTemplate: customTemplate,
        specialistName: specialistName
      };

      const modelUsed = model === 'opus' ? 'anthropic/claude-opus-4.5' : 
                      model === 'gpt52' ? 'openai/gpt-5.2-chat' :
                      model === 'gemini' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-sonnet-4.5';

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
              model: usage.model || modelUsed,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
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
          const costInfo = calculateCost(inputTokens, outputTokens, modelUsed);
          setCurrentCost(costInfo.totalCostUnits);

          logUsage({
            section: 'protocols',
            model: modelUsed,
            inputTokens,
            outputTokens
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
  const applyTemplate = (tpl: ProtocolTemplate) => {
    setSelectedTemplateId(tpl.id)
    setSpecialistName(tpl.specialist)
    setCustomTemplate(tpl.content)
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
      saveAs(blob, `Протокол_приема_${new Date().toISOString().split('T')[0]}.docx`)
    } catch (err: any) {
      alert('Ошибка экспорта: ' + err.message)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📝 Протокол приёма</h1>
      
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
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">👨‍⚕️ Кто проводит осмотр:</label>
              <input 
                type="text"
                value={specialistName}
                onChange={(e) => setSpecialistName(e.target.value)}
                placeholder="Например: Врач-невролог Иванов И.И."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Быстрые шаблоны:</label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      selectedTemplateId === tpl.id 
                        ? 'bg-primary-500 text-white border-primary-600 shadow-sm' 
                        : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:bg-primary-50'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsEditingTemplate(!isEditingTemplate)}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              {isEditingTemplate ? '🔼 Свернуть шаблон' : '⚙️ Редактировать структуру шаблона'}
            </button>

            {isEditingTemplate && (
              <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                <textarea
                  value={customTemplate}
                  onChange={(e) => setCustomTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-h-[200px] font-mono"
                />
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Текст для обработки:</label>
              <VoiceInput 
                onTranscript={(text) => setRawText(prev => prev ? prev + ' ' + text : text)}
                disabled={loading}
                className="!bg-indigo-600 !text-white hover:!bg-indigo-700"
                placeholder="Диктовать"
              />
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Введите данные осмотра или используйте 🎤..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-h-[300px]"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 mb-4">
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
              <option value="sonnet">🤖 Sonnet 4.5</option>
              <option value="gpt52">🚀 GPT-5.2</option>
              <option value="opus">🧠 Opus 4.5</option>
              <option value="gemini">⚡ Gemini 3.0</option>
            </select>
          </div>

          <button onClick={handleGenerateProtocol} disabled={!rawText.trim() || loading} className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 font-semibold shadow-md">
            {loading ? '⏳ Генерация...' : '📝 Создать протокол'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Сгенерированный протокол</h2>
              {currentCost > 0 && (
                <div className="mt-1 bg-teal-50 text-teal-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-teal-200 inline-block shadow-sm">
                  💰 Списано: {currentCost.toFixed(2)} ед.
                </div>
              )}
            </div>
            {protocol && (
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(protocol); alert('Скопировано'); }} className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm">📋</button>
                <button onClick={handleExportToDocx} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm">📄 DOCX</button>
              </div>
            )}
          </div>
          
          {protocol ? (
            <div className="prose prose-sm max-w-none border border-gray-200 rounded-lg p-6 bg-white overflow-y-auto max-h-[800px]">
              <ReactMarkdown>{protocol}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-20 border-2 border-dashed border-gray-100 rounded-lg">
              {loading ? <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div> : <p className="text-4xl mb-4 opacity-20">📄</p>}
              <p>{loading ? 'ИИ формирует протокол...' : 'Результат появится здесь'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
