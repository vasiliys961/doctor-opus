'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { saveAnalysisResult, getAllPatients, Patient } from '@/lib/patient-db'
import { suggestDermnetLinks, buildDermnetSearchUrl } from '@/lib/dermnet-links'
import { suggestEcgReferenceLinks, buildEcgGeneralLinks } from '@/lib/ecg-reference-links'
import { suggestXrayReferenceLinks, buildXrayGeneralLinks } from '@/lib/xray-reference-links'
import { suggestRadiologyReferenceLinks, buildRadiologyGeneralLinks } from '@/lib/radiology-reference-links'
import { suggestUltrasoundReferenceLinks, buildUltrasoundGeneralLinks } from '@/lib/ultrasound-reference-links'
import LibrarySearch from './LibrarySearch'
import { getClientLocale } from '@/lib/i18n/client'
import { analysisResultComponentMessages } from '@/lib/i18n/ui-client-messages'
import type { Locale } from '@/lib/i18n/config'
import { CURRENT_LEGAL_CONSENT_VERSION } from '@/lib/legal-consent'
import { handleSSEStream, stripStreamingStatusNoise } from '@/lib/streaming-utils'
import {
  finalizeDiagnosticReport,
  getDiagnosticReportUi,
  isValidDiagnosticReport,
  resolveDiagnosticReportKind,
} from '@/lib/diagnostic-report'

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

type ReferenceLinkUi = {
  id: string
  title: string
  titleEn?: string
  source: string
  url: string
}

export default function AnalysisResult({ result, loading = false, model, mode, imageType, cost, isAnonymous, images }: AnalysisResultProps) {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const t = analysisResultComponentMessages[locale]
  const draftDisclaimerTitle = t.draftDisclaimerTitle || 'Draft Clinical Output (Beta)'
  const draftDisclaimerLine1 = t.draftDisclaimerLine1 || 'This AI output may be incomplete or inaccurate.'
  const draftDisclaimerLine2 = t.draftDisclaimerLine2 || 'Independent physician verification is required before clinical use.'
  const draftDisclaimerLine3 = t.draftDisclaimerLine3 || 'Not for patient self-diagnosis.'
  const consentVersionLabel = t.consentVersionLabel || 'Consent version'
  const verificationModalTitle = t.verificationModalTitle || 'Physician verification before saving'
  const verificationModalPrivacyNote =
    t.verificationModalPrivacyNote ||
    'Only the case ID and confirmation fact are saved for audit. Patient personal details are not sent.'
  const verificationModalCheckReviewed =
    t.verificationModalCheckReviewed ||
    'I confirm that I personally reviewed and verified this draft before saving.'
  const verificationModalCheckResponsibility =
    t.verificationModalCheckResponsibility ||
    'I understand that final clinical responsibility remains with the physician.'
  const verificationModalConfirmSave = t.verificationModalConfirmSave || 'Confirm and Save'
  const verificationModalSaving = t.verificationModalSaving || 'Saving...'
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showPatientSelector, setShowPatientSelector] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [saving, setSaving] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [showLibrarySearch, setShowLibrarySearch] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(null)
  const [verificationSaving, setVerificationSaving] = useState(false)
  const [verificationChecks, setVerificationChecks] = useState({
    reviewed: false,
    responsibility: false,
  })
  const [diagnosticNote, setDiagnosticNote] = useState('')
  const [diagnosticLoading, setDiagnosticLoading] = useState(false)
  const [diagnosticError, setDiagnosticError] = useState('')
  const [streamPaused, setStreamPaused] = useState(false)
  const diagnosticKind = resolveDiagnosticReportKind(imageType)
  const diagnosticUi = diagnosticKind ? getDiagnosticReportUi(diagnosticKind) : null

  useEffect(() => {
    setDiagnosticNote('')
    setDiagnosticError('')
    setDiagnosticLoading(false)
  }, [imageType])

  useEffect(() => {
    if (!loading) {
      setStreamPaused(false)
      return
    }
    const timer = window.setTimeout(() => setStreamPaused(true), 2500)
    return () => window.clearTimeout(timer)
  }, [loading, result.length])

  const parsedResult = useMemo(() => {
    const marker = '**Draft Clinical Output (Beta)**'
    const source = String(result || '')
    const markerIndex = source.indexOf(marker)
    if (markerIndex === -1) {
      return { clinicalText: loading ? source : stripStreamingStatusNoise(source), hasDraftDisclaimer: false }
    }
    const before = source.slice(0, markerIndex).replace(/\n*---\s*$/g, '').trimEnd()
    return { clinicalText: loading ? before : stripStreamingStatusNoise(before), hasDraftDisclaimer: true }
  }, [result, loading])

  const PROTOCOL_DRAFT_KEY = 'protocol_draft'

  useEffect(() => {
    setLocale(getClientLocale())
  }, [])

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

  const referenceLinks = useMemo<ReferenceLinkUi[]>(() => {
    const source = parsedResult.clinicalText.trim()
    if (!source) return []

    if (imageType === 'dermatoscopy') {
      return suggestDermnetLinks(source, 8).map((item) => ({
        id: item.slug,
        title: item.title,
        titleEn: item.title,
        source: 'DermNet NZ',
        url: item.url,
      }))
    }
    if (imageType === 'ecg') {
      return suggestEcgReferenceLinks(source, 8).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }
    if (imageType === 'xray') {
      return suggestXrayReferenceLinks(source, 8).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }
    if (imageType === 'ct' || imageType === 'mri') {
      return suggestRadiologyReferenceLinks(source, imageType, 8).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }
    if (imageType === 'ultrasound') {
      return suggestUltrasoundReferenceLinks(source, 8).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }

    return []
  }, [imageType, parsedResult.clinicalText])

  const generalReferenceLinks = useMemo<ReferenceLinkUi[]>(() => {
    const seed = referenceLinks[0]?.titleEn || referenceLinks[0]?.title || parsedResult.clinicalText
    if (imageType === 'dermatoscopy') {
      return [{
        id: 'dermnet-search',
        title: 'DermNet Search',
        titleEn: 'DermNet Search',
        source: 'DermNet NZ',
        url: buildDermnetSearchUrl(seed),
      }]
    }
    if (imageType === 'ecg') {
      return buildEcgGeneralLinks(seed).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }
    if (imageType === 'xray') {
      return buildXrayGeneralLinks(seed).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }
    if (imageType === 'ct' || imageType === 'mri') {
      return buildRadiologyGeneralLinks(imageType, seed).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }
    if (imageType === 'ultrasound') {
      return buildUltrasoundGeneralLinks(seed).map((item) => ({
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        source: item.source,
        url: item.url,
      }))
    }
    return []
  }, [imageType, referenceLinks, parsedResult.clinicalText])

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
        conclusion: parsedResult.clinicalText,
        imageType: imageType
      })
      alert(t.saveSuccess)
      setShowPatientSelector(false)
    } catch (error) {
      console.error('Error saving result:', error)
      alert(t.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const openVerificationForPatient = (patientId: string) => {
    setPendingPatientId(patientId)
    setVerificationChecks({ reviewed: false, responsibility: false })
    setShowVerificationModal(true)
  }

  const buildSha256Hex = async (text: string): Promise<string> => {
    const normalized = String(text || '')
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      // Fallback (не криптостойкий) только если Web Crypto недоступен.
      let hash = 0
      for (let i = 0; i < normalized.length; i += 1) {
        hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0
      }
      return `fallback-${Math.abs(hash)}-${normalized.length}`
    }
    const encoded = new TextEncoder().encode(normalized)
    const digest = await window.crypto.subtle.digest('SHA-256', encoded)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  const handleConfirmVerificationAndSave = async () => {
    if (!pendingPatientId) return
    if (!verificationChecks.reviewed || !verificationChecks.responsibility) return

    setVerificationSaving(true)
    try {
      const resultHash = await buildSha256Hex(parsedResult.clinicalText)
      const verificationResponse = await fetch('/api/legal/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: pendingPatientId,
          analysisType: imageType || 'image',
          resultHash,
          sessionId,
          physicianVerified: true,
        }),
      })

      const verificationPayload = await verificationResponse.json().catch(() => ({}))
      if (!verificationResponse.ok || verificationPayload?.success !== true) {
        alert('Failed to record physician verification. Result was not saved.')
        return
      }

      await handleSaveToPatient(pendingPatientId)
      setShowVerificationModal(false)
      setPendingPatientId(null)
    } catch (error) {
      console.error('Verification save error:', error)
      alert('Failed to complete verification step. Please try again.')
    } finally {
      setVerificationSaving(false)
    }
  }

  const getModelDisplayName = (modelName?: string) => {
    if (!modelName) return null
    if (modelName.includes('opus')) return '🧠 Opus 5'
    if (modelName.includes('sonnet')) return '🤖 Sonnet 5'
    if (modelName.includes('gpt-5')) return '🚀 GPT-5.6 Terra'
    if (modelName.includes('fable')) return '🧬 Fable 5.1'
    if (modelName.includes('gemini') || modelName.includes('flash')) return '⚡ Gemini 3.8 Flash'
    return modelName
  }

  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(parsedResult.clinicalText)
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

      const lines = parsedResult.clinicalText.split('\n').filter(line => {
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
      alert(`${t.downloadError}: ${error?.message || t.unknownError}. Try refreshing the page.`)
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
          title: t.shareTitle,
          text: parsedResult.clinicalText.substring(0, 1000) + (parsedResult.clinicalText.length > 1000 ? '...' : ''),
          url: window.location.href
        })
      } else {
        await navigator.clipboard.writeText(parsedResult.clinicalText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert(t.copiedToClipboard)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        await navigator.clipboard.writeText(parsedResult.clinicalText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert(t.copiedToClipboard)
      }
    }
  }

  const handleTransferToConsultant = () => {
    const truncated = parsedResult.clinicalText.length > 2000
      ? parsedResult.clinicalText.substring(0, 2000) + `\n\n${t.transferTruncated}`
      : parsedResult.clinicalText;
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

  const handleTransferToProtocol = () => {
    const draftText = buildProtocolDraftFromResult(parsedResult.clinicalText);
    const payload = {
      kind: imageType || 'image',
      rawText: draftText,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem(PROTOCOL_DRAFT_KEY, JSON.stringify(payload));
    router.push('/protocol');
  };

  const handleGenerateDiagnosticReport = async () => {
    const sourceText = parsedResult.clinicalText.trim()
    if (!sourceText || !diagnosticKind || !diagnosticUi || diagnosticLoading) return

    setDiagnosticLoading(true)
    setDiagnosticError('')
    setDiagnosticNote('')
    try {
      const payload = { kind: diagnosticKind, sourceText, model: 'haiku', useStreaming: true }
      const response = await fetch('/api/protocol/diagnostic-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const streamed = await handleSSEStream(response, {
        onChunk: (text) => {
          setDiagnosticNote((prev) => prev + text)
        },
        onError: (err) => {
          setDiagnosticError(err.message || diagnosticUi.error)
        },
      })

      const cleaned = finalizeDiagnosticReport(streamed)
      if (isValidDiagnosticReport(diagnosticKind, cleaned)) {
        setDiagnosticNote(cleaned)
        return
      }

      const retryResponse = await fetch('/api/protocol/diagnostic-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, useStreaming: false }),
      })
      const retryData = await retryResponse.json()
      if (!retryData?.success) {
        throw new Error(retryData?.error || diagnosticUi.error)
      }
      setDiagnosticNote(finalizeDiagnosticReport(String(retryData.report || '')))
    } catch (error: any) {
      setDiagnosticError(error?.message || diagnosticUi.error)
    } finally {
      setDiagnosticLoading(false)
    }
  }

  const handleDownloadDiagnosticReport = async () => {
    if (!diagnosticNote.trim() || !diagnosticUi || downloading) return
    setDownloading(true)
    try {
      const { Document, Paragraph, TextRun, AlignmentType, Packer } = await import('docx')
      const fileSaver = await import('file-saver')
      const saveAs = fileSaver.saveAs || fileSaver.default?.saveAs || fileSaver.default
      const paragraphs: any[] = [
        new Paragraph({
          children: [new TextRun({ text: diagnosticUi.docTitle, bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-US')}`, size: 20 })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 400 },
        }),
      ]

      for (const line of diagnosticNote.split('\n')) {
        if (!line.trim()) {
          paragraphs.push(new Paragraph({ text: '' }))
          continue
        }
        const textRuns: any[] = []
        const boldRegex = /\*\*(.*?)\*\*/g
        let lastIndex = 0
        let match
        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > lastIndex) textRuns.push(new TextRun({ text: line.substring(lastIndex, match.index) }))
          textRuns.push(new TextRun({ text: match[1], bold: true }))
          lastIndex = match.index + match[0].length
        }
        if (lastIndex < line.length) textRuns.push(new TextRun({ text: line.substring(lastIndex) }))
        paragraphs.push(new Paragraph({
          children: textRuns.length > 0 ? textRuns : [new TextRun({ text: line })],
          spacing: { after: 120 },
        }))
      }

      const blob = await Packer.toBlob(new Document({ sections: [{ properties: {}, children: paragraphs }] }))
      saveAs(blob, `${diagnosticUi.filePrefix}_${new Date().toISOString().split('T')[0]}.docx`)
    } catch (error: any) {
      alert(`${t.downloadError}: ${error?.message || t.unknownError}`)
    } finally {
      setDownloading(false)
    }
  }

  if (!result) {
    if (loading) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="text-primary-900 font-semibold">{t.loading}</span>
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
          <h3 className="text-xl font-bold text-primary-900">🩺 {t.reportTitle}</h3>
          {loading && (
            <div className="flex items-center space-x-2 mt-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">
                {streamPaused ? 'Still generating…' : t.loading}
              </span>
            </div>
          )}
          {model && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-sm text-gray-600">
                {t.modelUsed}: <span className="font-semibold">{getModelDisplayName(model)}</span>
                {mode && (
                  <span className="ml-2">
                    ({mode === 'fast' ? t.modeFast : mode === 'optimized' ? t.modeOptimized : t.modeValidated})
                  </span>
                )}
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
              📌 {t.saveToPatient}
            </button>
          )}
          <button
            onClick={() => setShowLibrarySearch(!showLibrarySearch)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 font-bold ${showLibrarySearch ? 'bg-primary-100 text-primary-700' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'}`}
          >
            📚 {showLibrarySearch ? t.hideLibrary : t.searchLibrary}
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
          >
            {copied ? `✓ ${t.copied}` : `📋 ${t.copy}`}
          </button>
          {!loading && result && diagnosticKind && diagnosticUi && (
            <button
              onClick={handleGenerateDiagnosticReport}
              disabled={diagnosticLoading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-bold disabled:opacity-50"
              title={diagnosticUi.hint}
            >
              📄 {diagnosticLoading ? diagnosticUi.generating : diagnosticUi.button}
            </button>
          )}
          {!loading && result && !diagnosticKind && imageType !== 'lab' && (
            <button
              onClick={handleTransferToProtocol}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-bold"
              title={t.toProtocol}
            >
              📄 {t.toProtocol}
            </button>
          )}
          <button
            onClick={handleDownloadDoc}
            disabled={downloading}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? `⏳ ${t.downloading}` : `📄 ${t.downloadDocx}`}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
          >
            🖨️ {t.print}
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
          >
            🔗 {t.share}
          </button>
          {!loading && result && (
            <button
              onClick={handleTransferToConsultant}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-bold"
            >
              🩺 {t.discussManagement}
            </button>
          )}
        </div>
      </div>

      {showPatientSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-xl">
              <h4 className="font-bold text-indigo-900">{t.selectPatient}</h4>
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
                  <p className="text-gray-500 mb-4">{t.emptyPatients}</p>
                  <a 
                    href="/patients" 
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    {t.goCreatePatient}
                  </a>
                </div>
              ) : (
                <div className="space-y-1">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => openVerificationForPatient(p.id)}
                      disabled={saving}
                      className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200 group"
                    >
                      <div className="font-semibold text-gray-900 group-hover:text-indigo-700">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.age} y.o. • {p.diagnosis || t.noDiagnosis}
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
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-4 border-b bg-amber-50 rounded-t-xl">
              <h4 className="font-bold text-amber-900">⚠️ {verificationModalTitle}</h4>
              <p className="text-xs text-amber-800 mt-1">
                {verificationModalPrivacyNote}
              </p>
            </div>
            <div className="p-4 space-y-3 text-sm text-slate-700">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={verificationChecks.reviewed}
                  onChange={(e) =>
                    setVerificationChecks((prev) => ({ ...prev, reviewed: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  {verificationModalCheckReviewed}
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={verificationChecks.responsibility}
                  onChange={(e) =>
                    setVerificationChecks((prev) => ({ ...prev, responsibility: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  {verificationModalCheckResponsibility}
                </span>
              </label>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowVerificationModal(false)
                  setPendingPatientId(null)
                }}
                disabled={verificationSaving}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmVerificationAndSave}
                disabled={
                  verificationSaving ||
                  !verificationChecks.reviewed ||
                  !verificationChecks.responsibility
                }
                className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {verificationSaving ? verificationModalSaving : verificationModalConfirmSave}
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
            {parsedResult.clinicalText}
          </ReactMarkdown>

          {diagnosticKind && diagnosticUi && (diagnosticLoading || diagnosticError || diagnosticNote) && (
            <div id="diagnostic-report" className="mt-8 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-rose-900">{diagnosticUi.title}</h3>
                  <p className="mt-1 text-xs text-rose-800/80">{diagnosticUi.hint}</p>
                </div>
                {diagnosticNote && !diagnosticLoading && (
                  <button
                    onClick={handleDownloadDiagnosticReport}
                    disabled={downloading}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {downloading ? `⏳ ${t.downloading}` : `📄 ${t.downloadDocx}`}
                  </button>
                )}
              </div>
              {diagnosticError && (
                <p className="mt-3 text-sm text-red-700">{diagnosticError}</p>
              )}
              {(diagnosticNote || diagnosticLoading) && (
                <div className="mt-4 rounded-lg border border-rose-100 bg-white p-4">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                    className="[&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_strong]:font-semibold"
                  >
                    {diagnosticNote || diagnosticUi.generating}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {parsedResult.hasDraftDisclaimer && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <p className="font-semibold mb-2">⚠️ {draftDisclaimerTitle}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>{draftDisclaimerLine1}</li>
                <li>{draftDisclaimerLine2}</li>
                <li>{draftDisclaimerLine3}</li>
              </ul>
              <p className="mt-2 text-[11px] opacity-90">
                {consentVersionLabel}: <span className="font-mono">{CURRENT_LEGAL_CONSENT_VERSION}</span>
              </p>
            </div>
          )}

          {referenceLinks.length > 0 && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-bold text-slate-900">
                🔗 Relevant references
              </h4>
              <p className="mt-1 text-xs text-slate-600">
                The list is generated from the analysis result and helps quickly validate clinical hypotheses.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {referenceLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-primary-400 hover:bg-primary-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">{link.title}</div>
                    {link.titleEn && link.titleEn !== link.title && (
                      <div className="text-[11px] text-slate-500">{link.titleEn}</div>
                    )}
                    <div className="text-[11px] text-slate-500">{link.source}</div>
                  </a>
                ))}
              </div>
              {generalReferenceLinks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {generalReferenceLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                      {`Open ${link.source}`}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Яркая и заметная кнопка прямо под заключением */}
          {!loading && parsedResult.clinicalText && (
            <div className="mt-12 mb-8 flex justify-center">
              <button
                onClick={handleTransferToConsultant}
                className="group relative px-10 py-5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 text-white rounded-2xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.4)] hover:shadow-[0_0_40px_rgba(20,184,166,0.7)] hover:scale-105 flex items-center gap-4 text-xl font-black animate-bounce-slow"
              >
                <span className="text-3xl animate-pulse">🩺</span>
                <span className="tracking-widest uppercase">{t.discussClinicalManagement}</span>
                <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-fast"></div>
              </button>
            </div>
          )}

          <LibrarySearch query={parsedResult.clinicalText} isActive={showLibrarySearch} />
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-100">
        <div className="flex flex-col md:flex-row justify-between gap-4 text-[10px] text-gray-400">
          <div className="space-y-1 max-w-2xl">
            <p><strong>⚠️ </strong>{t.verificationRequired}</p>
            <p><strong>ℹ️ </strong>{t.pricingInfo}</p>
          </div>
          <div className="text-right">
            <p>{t.sessionId}: {sessionId || t.notAvailable}</p>
            <p>{t.coreVersion}: 4.1.0-rational</p>
          </div>
        </div>
      </div>
    </div>
  )
}
