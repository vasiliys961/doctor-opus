'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { saveAnalysisResult, getAllPatients, Patient } from '@/lib/patient-db'
import LibrarySearch from './LibrarySearch'

interface AnalysisResultProps {
  result: string
  loading?: boolean
  model?: string
  mode?: string
  imageType?: string
  cost?: number
  isAnonymous?: boolean
  images?: string[] // Новое поле для передачи снимков в отчет
}

export default function AnalysisResult({ result, loading = false, model, mode, imageType, cost, isAnonymous, images }: AnalysisResultProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showPatientSelector, setShowPatientSelector] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [saving, setSaving] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [showLibrarySearch, setShowLibrarySearch] = useState(false)

  const PROTOCOL_DRAFT_KEY = 'protocol_draft'
  const ECG_FUNCTIONAL_TEMPLATE_ID = 'ecg-functional-conclusion'

  useEffect(() => {
    if (showPatientSelector) {
      loadPatients()
    }
  }, [showPatientSelector])

  useEffect(() => {
    if (result && !sessionId) {
      setSessionId(Math.random().toString(36).substring(7).toUpperCase())
    }
  }, [result])

  const loadPatients = async () => {
    try {
      const allPatients = await getAllPatients()
      setPatients(allPatients)
    } catch (error) {
      console.error('Error loading patients:', error)
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
      alert('Result successfully saved to patient record!')
      setShowPatientSelector(false)
    } catch (error) {
      console.error('Error saving result:', error)
      alert('Failed to save result.')
    } finally {
      setSaving(false)
    }
  }

  const getModelDisplayName = (modelName?: string) => {
    if (!modelName) return null
    if (modelName.includes('opus')) return '🧠 Opus 4.6'
    if (modelName.includes('sonnet')) return '🤖 Sonnet 4.6'
    if (modelName.includes('gemini') || modelName.includes('flash')) return '⚡ Gemini 3.1'
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
      const { Document, Paragraph, TextRun, AlignmentType, Packer } = await import('docx');
      const fileSaver = await import('file-saver');
      const saveAs = fileSaver.saveAs || fileSaver.default?.saveAs || fileSaver.default;
      const toRuns = (data: DocRunData[]) => data.map(r => new TextRun({ text: r.text, bold: r.bold, italics: r.italics, font: r.font }));

      const lines = result.split('\n').filter(line => {
        const l = line.toLowerCase().trim();
        if (l.includes('data received') || l.includes('section 0 accepted')) return false;
        if (l.includes('preparing analysis') || l.includes('extracting data')) return false;
        if (l.includes('data extracted') || l.includes('findings') && l.includes('metrics')) return false;
        if (l.includes('clinical review in') || l.includes('professor review in')) return false;
        if (l.startsWith('>') && l.includes('stage')) return false;
        if (l.includes('stage 1:') || l.includes('stage 2:')) return false;
        if (l.includes('gemini vision') || l.includes('fast analysis')) return false;
        if (line.trim() === '.' || line.trim() === '..' || line.trim() === '...') return false;
        if (l.startsWith('---') && l.length < 10) return false;
        if (l.startsWith('legal status') || l.startsWith('**legal status')) return false;
        return true;
      });

      const paragraphs: any[] = []

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "MEDICAL CONSULTATIVE REPORT", bold: true, size: 28 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      )

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-US')}`, size: 20 }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 400 },
        })
      )

      const excludeSections = [
        'clinical review',
        'leading syndrome',
        'clinical scenario',
        'risk assessment',
        'management strategy',
        'treatment tactics',
        'contradictions and limitations',
        'legal status',
        'integrated summary',
        'technical parameters',
        'clinical hypotheses',
        'differential diagnosis',
      ];
      let skipSection = false;
      let skipSectionLevel = 0; // уровень заголовка исключённой секции

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (!line.trim()) continue;

        // Определяем уровень заголовка текущей строки
        const headingMatch = line.match(/^(#{1,4})\s+/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = line.replace(/^#{1,4}\s+/, '').replace(/\*\*/g, '').trim().toLowerCase();
          // Убираем нумерацию вида "1." "2." в начале
          const cleanHeading = headingText.replace(/^\d+[\.\)]\s*/, '');

          // Проверяем, начинается ли исключаемая секция
          if (excludeSections.some(s => cleanHeading.includes(s))) {
            skipSection = true;
            skipSectionLevel = level;
            continue;
          }

          // Если встретили заголовок того же или более высокого уровня — секция кончилась
          if (skipSection && level <= skipSectionLevel) {
            skipSection = false;
          }
        }

        // Пропускаем контент исключённой секции
        if (skipSection) continue;

        // Заголовки H1-H4
        if (line.match(/^####\s+/)) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.replace(/^####\s+/, ''), bold: true, size: 20 })],
            spacing: { before: 120, after: 60 },
          }))
        } else if (line.match(/^###\s+/)) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.replace(/^###\s+/, ''), bold: true, size: 22 })],
            spacing: { before: 160, after: 80 },
          }))
        } else if (line.match(/^##\s+/)) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.replace(/^##\s+/, ''), bold: true, size: 24 })],
            spacing: { before: 200, after: 100 },
          }))
        } else if (line.match(/^#\s+/)) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.replace(/^#\s+/, ''), bold: true, size: 28 })],
            spacing: { before: 240, after: 120 },
          }))
        }
        // Маркированный / нумерованный список
        else if (line.match(/^[-*+•]\s+/) || line.match(/^\d+\.\s+/)) {
          const text = line.replace(/^[-*+•]\s+/, '').replace(/^\d+\.\s+/, '')
          paragraphs.push(new Paragraph({
            children: toRuns(parseMarkdownToRuns(text)),
            bullet: { level: 0 },
            spacing: { after: 60 },
          }))
        }
        // Блок кода — пропускаем разделители
        else if (line.startsWith('```')) {
          continue
        }
        // Обычный текст
        else {
          paragraphs.push(new Paragraph({
            children: toRuns(parseMarkdownToRuns(line)),
            spacing: { after: 120 },
          }))
        }
      }

      paragraphs.push(new Paragraph({ 
        border: { top: { color: "000000", space: 1, value: "single", size: 6 } },
        children: [
          new TextRun({ text: "VERIFIED BY PHYSICIAN", bold: true, size: 18 })
        ],
        spacing: { before: 300, after: 40 },
      }));
      
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "This report was generated by Doctor Opus AI and must be verified by the treating physician.", size: 10, italics: true, color: "666666" }),
          ],
          spacing: { after: 120 },
        })
      )

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Physician: ____________________ / ____________________", size: 18 }),
          ],
          spacing: { after: 40 },
        })
      )
      
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "                                     (signature)                      (Full Name)", size: 10, color: "999999" }),
          ],
          spacing: { after: 200 },
        })
      )

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ 
              text: "This conclusion was generated by Doctor Opus AI as an analytical draft containing clinical hypotheses. It does not constitute a medical opinion. The final clinical decision rests solely with the treating physician.", 
              size: 14,
              italics: true,
              color: "999999"
            }),
          ],
          spacing: { before: 200, after: 120 },
        })
      )

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ 
              text: "Doctor Opus v4.0 Clinical. For informational and analytical purposes only.",
              size: 10,
              color: "AAAAAA",
              italics: true
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      )

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: { top: 720, right: 720, bottom: 720, left: 720 },
              },
            },
            children: paragraphs,
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      const fileName = `Report_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.docx`;
      saveAs(blob, fileName)
    } catch (error: any) {
      console.error('Error downloading document:', error?.message || error, error?.stack)
      alert(`Download error: ${error?.message || 'Unknown error'}. Try refreshing the page.`)
    } finally {
      setDownloading(false)
    }
  }

  interface DocRunData {
    text: string;
    bold?: boolean;
    italics?: boolean;
    font?: string;
  }

  const parseMarkdownToRuns = (text: string): DocRunData[] => {
    if (!text) return [{ text: '' }]

    // Сначала обрабатываем код (он в обратных кавычках и не конфликтует)
    const codeParts: Array<{ start: number; end: number; text: string }> = []
    const codeRegex = /`([^`]+)`/g
    let match
    while ((match = codeRegex.exec(text)) !== null) {
      codeParts.push({ start: match.index, end: match.index + match[0].length, text: match[1] })
    }

    const runs: DocRunData[] = []
    let lastIndex = 0
    let codeIndex = 0

    // Обрабатываем текст по частям
    for (let i = 0; i <= text.length; i++) {
      if (codeIndex < codeParts.length && i === codeParts[codeIndex].start) {
        if (i > lastIndex) {
          const beforeCode = text.substring(lastIndex, i)
          if (beforeCode) {
            runs.push(...parseBoldItalicParsedRuns(beforeCode))
          }
        }
        runs.push({ text: codeParts[codeIndex].text, font: 'Courier New' })
        lastIndex = codeParts[codeIndex].end
        i = codeParts[codeIndex].end - 1
        codeIndex++
        continue
      }
    }

    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        runs.push(...parseBoldItalicParsedRuns(remainingText))
      }
    }

    return runs.length > 0 ? runs : [{ text }]
  }

  const parseBoldItalicParsedRuns = (text: string): Array<{text: string, bold?: boolean, italics?: boolean}> => {
    if (!text) return [{ text: '' }]
    
    const runs: Array<{text: string, bold?: boolean, italics?: boolean}> = []
    let lastIndex = 0
    let i = 0

    // Сначала обрабатываем жирный текст **text**
    const boldRegex = /\*\*(.*?)\*\*/g
    let match

    while ((match = boldRegex.exec(text)) !== null) {
      // Текст до bold
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index)
        if (beforeText) {
          // Проверяем на курсив в этом тексте
          runs.push(...parseItalicParsedRuns(beforeText))
        }
      }
      // Bold текст (может содержать курсив)
      const boldText = match[1]
      const boldRuns = parseItalicParsedRuns(boldText)
      boldRuns.forEach(run => {
        runs.push({ text: run.text, bold: true, italics: run.italics })
      })
      lastIndex = match.index + match[0].length
    }

    // Оставшийся текст
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        runs.push(...parseItalicParsedRuns(remainingText))
      }
    }

    return runs.length > 0 ? runs : [{ text }]
  }

  const parseItalicParsedRuns = (text: string): Array<{text: string, italics?: boolean}> => {
    if (!text) return [{ text: '' }]
    
    const runs: Array<{text: string, italics?: boolean}> = []
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
              runs.push({ text: beforeText })
            }
          }
          // Курсив текст
          const italicText = text.substring(i + 1, endIndex)
          runs.push({ text: italicText, italics: true })
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
        runs.push({ text: remainingText })
      }
    }

    return runs.length > 0 ? runs : [{ text }]
  }


  const handleShare = async () => {
    try {
      // Проверяем поддержку Web Share API
      if (navigator.share) {
        await navigator.share({
          title: 'Medical Analysis Result',
          text: result.substring(0, 1000) + (result.length > 1000 ? '...' : ''),
          url: window.location.href
        })
      } else {
        await navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert('Text copied to clipboard!')
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        await navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert('Text copied to clipboard!')
      }
    }
  }

  const handleTransferToConsultant = () => {
    const truncated = result.length > 2000 ? result.substring(0, 2000) + '\n\n[...result truncated for transfer]' : result;
    const data = {
      text: truncated,
      type: imageType,
      model: model,
      timestamp: new Date().toISOString()
    };
    sessionStorage.setItem('pending_analysis', JSON.stringify(data));
    router.push('/chat');
  };

  const buildProtocolDraftFromResult = (fullText: string) => {
    // Берем только "сухую" клиническую часть (протокол описания + заключение),
    const lines = fullText.split('\n').filter(line => {
      const l = line.toLowerCase().trim();
      if (!l) return true;
      if (l.includes('data received') || l.includes('section 0 accepted')) return false;
      if (l.includes('preparing analysis') || l.includes('extracting data')) return false;
      if (l.includes('clinical review in') || l.includes('professor review in')) return false;
      if (l.startsWith('>') && l.includes('stage')) return false;
      if (l.includes('stage 1:') || l.includes('stage 2:')) return false;
      if (l.includes('gemini vision') || l.includes('fast analysis')) return false;
      if (line.trim() === '.' || line.trim() === '..' || line.trim() === '...') return false;
      if (l.startsWith('---') && l.length < 10) return false;
      return true;
    });

    const excludeSections = [
      'clinical review',
      'leading syndrome',
      'clinical scenario',
      'risk assessment',
      'management strategy',
      'treatment tactics',
      'contradictions and limitations',
      'legal status',
      'integrated summary',
      'technical parameters',
      'clinical hypotheses',
      'differential diagnosis',
    ];

    let skipSection = false;
    let skipSectionLevel = 0;
    const out: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (!skipSection) out.push('');
        continue;
      }

      const headingMatch = line.match(/^(#{1,4})\s+/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = line.replace(/^#{1,4}\s+/, '').replace(/\*\*/g, '').trim().toLowerCase();
        const cleanHeading = headingText.replace(/^\d+[\.\)]\s*/, '');

        if (excludeSections.some(s => cleanHeading.includes(s))) {
          skipSection = true;
          skipSectionLevel = level;
          continue;
        }

        if (skipSection && level <= skipSectionLevel) {
          skipSection = false;
        }
      }

      if (skipSection) continue;
      if (line.startsWith('```')) continue;
      out.push(line);
    }

    return out.join('\n').trim();
  };

  const handleTransferToProtocol = (useEcgTemplate = false) => {
    const draftText = buildProtocolDraftFromResult(result);
    const payload = {
      kind: imageType || 'image',
      templateId: useEcgTemplate ? ECG_FUNCTIONAL_TEMPLATE_ID : undefined,
      rawText: draftText,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem(PROTOCOL_DRAFT_KEY, JSON.stringify(payload));
    router.push('/protocol');
  };

  const handleTransferToEcgProtocol = () => handleTransferToProtocol(true);

  if (!result) {
    if (loading) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="text-primary-900 font-semibold">Analysis in progress...</span>
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
          <h3 className="text-xl font-bold text-primary-900">🩺 Consultative Report</h3>
          {loading && (
            <div className="flex items-center space-x-2 mt-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">Analysis in progress...</span>
            </div>
          )}
          {model && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-sm text-gray-600">
                Model used: <span className="font-semibold">{getModelDisplayName(model)}</span>
                {mode && <span className="ml-2">({mode === 'fast' ? 'fast' : mode === 'optimized' ? 'optimized' : 'expert validated'})</span>}
              </p>
              {cost !== undefined && cost > 0 && !loading && (
                <div className="bg-teal-50 text-teal-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-teal-200 shadow-sm">
                  💰 Service cost: {cost.toFixed(2)} cr.
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isAnonymous && (
            <button
              onClick={() => setShowPatientSelector(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
            >
              📌 Save to Patient Record
            </button>
          )}
          <button
            onClick={() => setShowLibrarySearch(!showLibrarySearch)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 font-bold ${showLibrarySearch ? 'bg-primary-100 text-primary-700' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'}`}
          >
            📚 {showLibrarySearch ? 'Hide Library' : 'Search Library'}
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          {!loading && result && imageType === 'ecg' && (
            <button
              onClick={handleTransferToEcgProtocol}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-bold"
              title="Generate a short ECG functional conclusion using template"
            >
              🫀 ECG Protocol
            </button>
          )}
          {!loading && result && imageType !== 'ecg' && (
            <button
              onClick={() => handleTransferToProtocol(false)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-bold"
              title="Transfer clean conclusion to Protocol section"
            >
              📄 To Protocol
            </button>
          )}
          <button
            onClick={handleDownloadDoc}
            disabled={downloading}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? '⏳ Downloading...' : '📄 Download .docx'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
          >
            🖨️ Print
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
          >
            🔗 Share
          </button>
          {!loading && result && (
            <button
              onClick={handleTransferToConsultant}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-bold"
            >
              🩺 Discuss Management
            </button>
          )}
        </div>
      </div>

      {showPatientSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-xl">
              <h4 className="font-bold text-indigo-900">Select Patient</h4>
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
                  <p className="text-gray-500 mb-4">Patient database is empty</p>
                  <a 
                    href="/patients" 
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Go to create patient
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
                        {p.age} y.o. • {p.diagnosis || 'No diagnosis'}
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
                Cancel
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
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            className="[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:space-y-1 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-gray-900 [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2"
          >
            {result}
          </ReactMarkdown>

          {/* Яркая и заметная кнопка прямо под заключением */}
          {!loading && result && (
            <div className="mt-12 mb-8 flex justify-center">
              <button
                onClick={handleTransferToConsultant}
                className="group relative px-10 py-5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 text-white rounded-2xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.4)] hover:shadow-[0_0_40px_rgba(20,184,166,0.7)] hover:scale-105 flex items-center gap-4 text-xl font-black animate-bounce-slow"
              >
                <span className="text-3xl animate-pulse">🩺</span>
                <span className="tracking-widest uppercase">Discuss Clinical Management</span>
                <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-fast"></div>
              </button>
            </div>
          )}

          <LibrarySearch query={result} isActive={showLibrarySearch} />
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-100">
        <div className="flex flex-col md:flex-row justify-between gap-4 text-[10px] text-gray-400">
          <div className="space-y-1 max-w-2xl">
            <p><strong>⚠️ Verification Required:</strong> This consultative report must be reviewed and signed by the treating physician. Doctor Opus is an informational-analytical SaaS service and does not provide medical services. All content is for informational purposes only.</p>
            <p><strong>ℹ️ Pricing:</strong> Credit cost reflects the service charge (AI models + infrastructure: server processing, storage, delivery). Repeated requests for the same data are re-billed unless cached.</p>
          </div>
          <div className="text-right">
            <p>Session ID: {sessionId || 'N/A'}</p>
            <p>Core version: 4.1.0-rational</p>
          </div>
        </div>
      </div>
    </div>
  )
}
