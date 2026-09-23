'use client'

import { useState, useRef, useEffect } from 'react'
import { AUDIO_TRANSCRIPTION_CREDITS_PER_HOUR, calculateAudioTranscriptionCost } from '@/lib/cost-calculator'
import { getClientLocale } from '@/lib/i18n/client'
import { mapLocaleToAssemblyAiLanguage } from '@/lib/i18n/stt-language'
import type { Locale } from '@/lib/i18n/config'

const RECORDING_TIMESLICE_MS = 1000
const SEGMENT_SECONDS = 5 * 60

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface AudioUploadProps {
  onTranscribe: (transcript: string, data?: { duration: number; cost: number }) => void
  accept?: string
  maxSize?: number // в MB
}

const AUDIO_UPLOAD_TEXT: Record<Locale, {
  fileTooLarge: (maxSize: number) => string
  notAudio: string
  transcribing: string
  recording: string
  stop: string
  recordMic: string
  or: string
  uploadFile: string
  dragHint: string
  formats: string
  maxSize: (maxSize: number) => string
  privacyHint: string
  duration: string
  cost: string
  costByDuration: string
  estimatedStt: (cost: number) => string
  httpsRequired: string
  micDenied: string
  micNotFound: string
  micBusy: string
  browserUnsupported: string
  micError: string
  genericError: string
}> = {
  en: {
    fileTooLarge: (maxSize) => `File is too large. Maximum size: ${maxSize}MB`,
    notAudio: 'Please upload an audio file',
    transcribing: 'Transcription in progress...',
    recording: 'Recording...',
    stop: 'Stop recording',
    recordMic: 'Record from microphone',
    or: 'or',
    uploadFile: 'Upload file',
    dragHint: 'You can also drag and drop an audio file here',
    formats: 'Supported formats: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `Max size: ${maxSize}MB`,
    privacyHint: 'Do not dictate patient names, addresses, or ID data. Audio is transcribed by AssemblyAI.',
    duration: 'Duration',
    cost: 'STT cost',
    costByDuration: 'STT is billed by conversation duration ({rate} credits per hour of audio).',
    estimatedStt: (cost) => `Estimated STT: ${cost.toFixed(2)} cr`,
    httpsRequired: 'Microphone access requires HTTPS (or localhost).',
    micDenied: 'Microphone access was denied. Allow the microphone for this site and reload.',
    micNotFound: 'No microphone found. Check the device connection.',
    micBusy: 'The microphone is in use by another app. Close it and try again.',
    browserUnsupported: 'This browser does not support microphone recording.',
    micError: 'Could not access microphone',
    genericError: 'An error occurred during transcription',
  },
  es: {
    fileTooLarge: (maxSize) => `El archivo es demasiado grande. Máximo: ${maxSize}MB`,
    notAudio: 'Suba un archivo de audio',
    transcribing: 'Transcripción en curso...',
    recording: 'Grabando...',
    stop: 'Detener grabación',
    recordMic: 'Grabar con el micrófono',
    or: 'o',
    uploadFile: 'Subir archivo',
    dragHint: 'También puede arrastrar un archivo de audio aquí',
    formats: 'Formatos: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `Tamaño máximo: ${maxSize}MB`,
    privacyHint: 'No dicte nombres, direcciones ni identificadores. El audio se transcribe con AssemblyAI.',
    duration: 'Duración',
    cost: 'Costo STT',
    costByDuration: 'El STT se cobra por la duración de la conversación ({rate} créditos por hora de audio).',
    estimatedStt: (cost) => `STT estimado: ${cost.toFixed(2)} cr`,
    httpsRequired: 'El micrófono requiere HTTPS (o localhost).',
    micDenied: 'Acceso al micrófono denegado. Permítalo para este sitio y recargue.',
    micNotFound: 'No se encontró micrófono. Compruebe el dispositivo.',
    micBusy: 'El micrófono está en uso. Cierre la otra aplicación e inténtelo de nuevo.',
    browserUnsupported: 'Este navegador no admite grabación de micrófono.',
    micError: 'No se pudo acceder al micrófono',
    genericError: 'Error durante la transcripción',
  },
  fr: {
    fileTooLarge: (maxSize) => `Fichier trop volumineux. Maximum : ${maxSize}MB`,
    notAudio: 'Veuillez envoyer un fichier audio',
    transcribing: 'Transcription en cours...',
    recording: 'Enregistrement...',
    stop: 'Arrêter l’enregistrement',
    recordMic: 'Enregistrer au microphone',
    or: 'ou',
    uploadFile: 'Téléverser un fichier',
    dragHint: 'Vous pouvez aussi déposer un fichier audio ici',
    formats: 'Formats : MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `Taille max. : ${maxSize}MB`,
    privacyHint: 'Ne dictez pas de noms, adresses ou identifiants. L’audio est transcrit par AssemblyAI.',
    duration: 'Durée',
    cost: 'Coût STT',
    costByDuration: 'Le STT est facturé selon la durée de la conversation ({rate} crédits par heure d’audio).',
    estimatedStt: (cost) => `STT estimé : ${cost.toFixed(2)} cr`,
    httpsRequired: 'Le microphone nécessite HTTPS (ou localhost).',
    micDenied: 'Accès au microphone refusé. Autorisez-le pour ce site et rechargez.',
    micNotFound: 'Aucun microphone trouvé. Vérifiez l’appareil.',
    micBusy: 'Le microphone est utilisé par une autre application.',
    browserUnsupported: 'Ce navigateur ne prend pas en charge l’enregistrement.',
    micError: 'Impossible d’accéder au microphone',
    genericError: 'Erreur pendant la transcription',
  },
  ar: {
    fileTooLarge: (maxSize) => `الملف كبير جداً. الحد الأقصى: ${maxSize}MB`,
    notAudio: 'يرجى رفع ملف صوتي',
    transcribing: 'جارٍ التفريغ النصي...',
    recording: 'جارٍ التسجيل...',
    stop: 'إيقاف التسجيل',
    recordMic: 'تسجيل من الميكروفون',
    or: 'أو',
    uploadFile: 'رفع ملف',
    dragHint: 'يمكن أيضاً سحب ملف صوتي إلى هنا',
    formats: 'الصيغ: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `الحد الأقصى: ${maxSize}MB`,
    privacyHint: 'لا تملِ أسماء المرضى أو العناوين أو بيانات الهوية. يتم التفريغ عبر AssemblyAI.',
    duration: 'المدة',
    cost: 'تكلفة التفريغ',
    costByDuration: 'يُحسب التفريغ حسب مدة المحادثة ({rate} رصيدًا لكل ساعة صوت).',
    estimatedStt: (cost) => `تقدير التفريغ: ${cost.toFixed(2)} cr`,
    httpsRequired: 'يحتاج الميكروفون إلى HTTPS (أو localhost).',
    micDenied: 'تم رفض الوصول إلى الميكروفون. اسمح به لهذا الموقع ثم أعد التحميل.',
    micNotFound: 'لم يتم العثور على ميكروفون.',
    micBusy: 'الميكروفون مستخدم في تطبيق آخر.',
    browserUnsupported: 'هذا المتصفح لا يدعم التسجيل.',
    micError: 'تعذر الوصول إلى الميكروفون',
    genericError: 'حدث خطأ أثناء التفريغ النصي',
  },
  hi: {
    fileTooLarge: (maxSize) => `फ़ाइल बहुत बड़ी है। अधिकतम: ${maxSize}MB`,
    notAudio: 'कृपया ऑडियो फ़ाइल अपलोड करें',
    transcribing: 'ट्रांस्क्रिप्शन चल रहा है...',
    recording: 'रिकॉर्डिंग...',
    stop: 'रिकॉर्डिंग रोकें',
    recordMic: 'माइक्रोफ़ोन से रिकॉर्ड करें',
    or: 'या',
    uploadFile: 'फ़ाइल अपलोड करें',
    dragHint: 'ऑडियो फ़ाइल यहाँ खींचकर भी छोड़ सकते हैं',
    formats: 'फॉर्मेट: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `अधिकतम आकार: ${maxSize}MB`,
    privacyHint: 'रोगी का नाम, पता या पहचान न बोलें। ऑडियो AssemblyAI से ट्रांस्क्राइब होता है।',
    duration: 'अवधि',
    cost: 'STT लागत',
    costByDuration: 'STT बातचीत की अवधि के अनुसार लगता है ({rate} क्रेडिट प्रति घंटा ऑडियो)।',
    estimatedStt: (cost) => `अनुमानित STT: ${cost.toFixed(2)} cr`,
    httpsRequired: 'माइक्रोफ़ोन के लिए HTTPS (या localhost) चाहिए।',
    micDenied: 'माइक्रोफ़ोन की अनुमति नहीं मिली। साइट के लिए अनुमति दें और रीलोड करें।',
    micNotFound: 'माइक्रोफ़ोन नहीं मिला।',
    micBusy: 'माइक्रोफ़ोन दूसरे ऐप में व्यस्त है।',
    browserUnsupported: 'यह ब्राउज़र रिकॉर्डिंग समर्थित नहीं करता।',
    micError: 'माइक्रोफ़ोन उपलब्ध नहीं',
    genericError: 'ट्रांस्क्रिप्शन में त्रुटि',
  },
  'pt-BR': {
    fileTooLarge: (maxSize) => `Arquivo muito grande. Máximo: ${maxSize}MB`,
    notAudio: 'Envie um arquivo de áudio',
    transcribing: 'Transcrição em andamento...',
    recording: 'Gravando...',
    stop: 'Parar gravação',
    recordMic: 'Gravar pelo microfone',
    or: 'ou',
    uploadFile: 'Enviar arquivo',
    dragHint: 'Você também pode arrastar um arquivo de áudio aqui',
    formats: 'Formatos: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `Tamanho máx.: ${maxSize}MB`,
    privacyHint: 'Não dite nomes, endereços ou documentos. O áudio é transcrito pela AssemblyAI.',
    duration: 'Duração',
    cost: 'Custo STT',
    costByDuration: 'O STT é cobrado pela duração da conversa ({rate} créditos por hora de áudio).',
    estimatedStt: (cost) => `STT estimado: ${cost.toFixed(2)} cr`,
    httpsRequired: 'O microfone exige HTTPS (ou localhost).',
    micDenied: 'Acesso ao microfone negado. Permita para este site e recarregue.',
    micNotFound: 'Nenhum microfone encontrado.',
    micBusy: 'O microfone está em uso em outro aplicativo.',
    browserUnsupported: 'Este navegador não suporta gravação.',
    micError: 'Não foi possível acessar o microfone',
    genericError: 'Erro durante a transcrição',
  },
  id: {
    fileTooLarge: (maxSize) => `File terlalu besar. Maksimum: ${maxSize}MB`,
    notAudio: 'Unggah file audio',
    transcribing: 'Transkripsi sedang diproses...',
    recording: 'Merekam...',
    stop: 'Hentikan rekaman',
    recordMic: 'Rekam dari mikrofon',
    or: 'atau',
    uploadFile: 'Unggah file',
    dragHint: 'Anda juga dapat menyeret file audio ke sini',
    formats: 'Format: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `Ukuran maks.: ${maxSize}MB`,
    privacyHint: 'Jangan sebut nama, alamat, atau identitas pasien. Audio ditranskripsi AssemblyAI.',
    duration: 'Durasi',
    cost: 'Biaya STT',
    costByDuration: 'STT ditagih sesuai durasi percakapan ({rate} kredit per jam audio).',
    estimatedStt: (cost) => `Perkiraan STT: ${cost.toFixed(2)} cr`,
    httpsRequired: 'Mikrofon memerlukan HTTPS (atau localhost).',
    micDenied: 'Akses mikrofon ditolak. Izinkan untuk situs ini lalu muat ulang.',
    micNotFound: 'Mikrofon tidak ditemukan.',
    micBusy: 'Mikrofon digunakan aplikasi lain.',
    browserUnsupported: 'Browser ini tidak mendukung rekaman.',
    micError: 'Tidak dapat mengakses mikrofon',
    genericError: 'Terjadi kesalahan saat transkripsi',
  },
  ms: {
    fileTooLarge: (maxSize) => `Fail terlalu besar. Maksimum: ${maxSize}MB`,
    notAudio: 'Sila muat naik fail audio',
    transcribing: 'Transkripsi sedang dijalankan...',
    recording: 'Merakam...',
    stop: 'Hentikan rakaman',
    recordMic: 'Rakam dari mikrofon',
    or: 'atau',
    uploadFile: 'Muat naik fail',
    dragHint: 'Anda juga boleh seret fail audio ke sini',
    formats: 'Format: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `Saiz maks.: ${maxSize}MB`,
    privacyHint: 'Jangan sebut nama, alamat atau ID pesakit. Audio ditranskripsi oleh AssemblyAI.',
    duration: 'Tempoh',
    cost: 'Kos STT',
    costByDuration: 'STT dicaj mengikut tempoh perbualan ({rate} kredit sejam audio).',
    estimatedStt: (cost) => `Anggaran STT: ${cost.toFixed(2)} cr`,
    httpsRequired: 'Mikrofon memerlukan HTTPS (atau localhost).',
    micDenied: 'Akses mikrofon ditolak. Benarkan untuk laman ini lalu muat semula.',
    micNotFound: 'Mikrofon tidak dijumpai.',
    micBusy: 'Mikrofon sedang digunakan aplikasi lain.',
    browserUnsupported: 'Pelayar ini tidak menyokong rakaman.',
    micError: 'Tidak dapat mengakses mikrofon',
    genericError: 'Ralat semasa transkripsi',
  },
  tr: {
    fileTooLarge: (maxSize) => `Dosya çok büyük. Maksimum: ${maxSize}MB`,
    notAudio: 'Lütfen bir ses dosyası yükleyin',
    transcribing: 'Transkripsiyon sürüyor...',
    recording: 'Kaydediliyor...',
    stop: 'Kaydı durdur',
    recordMic: 'Mikrofondan kaydet',
    or: 'veya',
    uploadFile: 'Dosya yükle',
    dragHint: 'Ses dosyasını buraya da sürükleyebilirsiniz',
    formats: 'Biçimler: MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `Maks. boyut: ${maxSize}MB`,
    privacyHint: 'Hasta adı, adres veya kimlik bilgisi dikte etmeyin. Ses AssemblyAI ile yazıya dökülür.',
    duration: 'Süre',
    cost: 'STT maliyeti',
    costByDuration: 'STT, görüşme süresine göre ücretlendirilir (saatlik ses {rate} kredi).',
    estimatedStt: (cost) => `Tahmini STT: ${cost.toFixed(2)} cr`,
    httpsRequired: 'Mikrofon için HTTPS (veya localhost) gerekir.',
    micDenied: 'Mikrofon erişimi reddedildi. Bu site için izin verip yenileyin.',
    micNotFound: 'Mikrofon bulunamadı.',
    micBusy: 'Mikrofon başka bir uygulamada kullanımda.',
    browserUnsupported: 'Bu tarayıcı kaydı desteklemiyor.',
    micError: 'Mikrofona erişilemedi',
    genericError: 'Transkripsiyon sırasında hata oluştu',
  },
  'zh-CN': {
    fileTooLarge: (maxSize) => `文件过大。最大：${maxSize}MB`,
    notAudio: '请上传音频文件',
    transcribing: '正在转写...',
    recording: '正在录音...',
    stop: '停止录音',
    recordMic: '从麦克风录制',
    or: '或',
    uploadFile: '上传文件',
    dragHint: '也可以将音频文件拖到此处',
    formats: '格式：MP3, WAV, M4A, WEBM, OGG, FLAC',
    maxSize: (maxSize) => `最大大小：${maxSize}MB`,
    privacyHint: '请勿口述患者姓名、地址或身份信息。音频由 AssemblyAI 转写。',
    duration: '时长',
    cost: '转写费用',
    costByDuration: '语音转写按对话时长计费（每小时音频 {rate} 积分）。',
    estimatedStt: (cost) => `预计转写：${cost.toFixed(2)} cr`,
    httpsRequired: '麦克风需要 HTTPS（或 localhost）。',
    micDenied: '麦克风权限被拒绝。请允许后刷新页面。',
    micNotFound: '未找到麦克风。',
    micBusy: '麦克风正被其他应用占用。',
    browserUnsupported: '此浏览器不支持录音。',
    micError: '无法访问麦克风',
    genericError: '转写时出错',
  },
}

export default function AudioUpload({ onTranscribe, accept = 'audio/*', maxSize = 2000 }: AudioUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [lastAnalysis, setLastAnalysis] = useState<{ duration: number; cost: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const segmentsRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mimeTypeRef = useRef('audio/webm')
  const rotatingRef = useRef(false)
  const elapsedRef = useRef(0)
  const lastSegmentAtRef = useRef(0)
  const recordingRef = useRef(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [locale, setLocale] = useState<Locale>('en')
  const t = AUDIO_UPLOAD_TEXT[locale] || AUDIO_UPLOAD_TEXT.en
  const costByDuration = t.costByDuration.replace('{rate}', String(AUDIO_TRANSCRIPTION_CREDITS_PER_HOUR))

  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => undefined)
    wakeLockRef.current = null
  }

  const requestWakeLock = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request('screen')
      }
    } catch {
      // Wake Lock is optional; recording continues without it.
    }
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const flushRecorder = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.requestData()
    }
  }

  useEffect(() => {
    setLocale(getClientLocale())
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushRecorder()
      } else if (recordingRef.current) {
        void requestWakeLock()
      }
    }
    const onPageHide = () => {
      if (recordingRef.current) {
        rotatingRef.current = false
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      clearTimer()
      releaseWakeLock()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const transcribeFile = async (file: File): Promise<{ transcript: string; duration: number; cost: number } | null> => {
    if (file.size > maxSize * 1024 * 1024) {
      setError(t.fileTooLarge(maxSize))
      return null
    }
    if (!file.type.startsWith('audio/') && !file.type.includes('webm') && !file.type.includes('octet-stream')) {
      setError(t.notAudio)
      return null
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('language', mapLocaleToAssemblyAiLanguage(getClientLocale()))

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()
    if (!data?.success) {
      throw new Error(data?.error || t.genericError)
    }
    return {
      transcript: String(data.transcript || ''),
      duration: Number(data.duration) || 0,
      cost: Number(data.cost) || 0,
    }
  }

  const handleFile = async (file: File) => {
    setError(null)
    setTranscribing(true)
    try {
      const result = await transcribeFile(file)
      if (!result) return
      setLastAnalysis({ duration: result.duration, cost: result.cost })
      onTranscribe(result.transcript, { duration: result.duration, cost: result.cost })
    } catch (err: any) {
      setError(err?.message || t.genericError)
    } finally {
      setTranscribing(false)
    }
  }

  const transcribeSegments = async () => {
    const mimeType = mimeTypeRef.current
    const segments = segmentsRef.current.filter((blob) => blob.size > 0)
    segmentsRef.current = []
    if (!segments.length) return

    setTranscribing(true)
    setError(null)
    try {
      const texts: string[] = []
      let duration = 0
      let cost = 0
      for (const [index, blob] of segments.entries()) {
        const file = new File([blob], `recording-${index + 1}.${extensionForMime(mimeType)}`, { type: mimeType })
        const result = await transcribeFile(file)
        if (!result) continue
        if (result.transcript.trim()) texts.push(result.transcript.trim())
        duration += result.duration
        cost += result.cost
      }
      if (!texts.length) {
        setError(t.genericError)
        return
      }
      setLastAnalysis({ duration, cost })
      onTranscribe(texts.join('\n\n'), { duration, cost })
    } catch (err: any) {
      setError(err?.message || t.genericError)
    } finally {
      setTranscribing(false)
    }
  }

  const attachRecorder = (stream: MediaStream, mimeType: string) => {
    let mediaRecorder: MediaRecorder
    try {
      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      mediaRecorder = new MediaRecorder(stream)
    }

    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onerror = () => {
      setError(t.genericError)
    }

    mediaRecorder.onstop = () => {
      const finalMime = mimeTypeRef.current || mediaRecorder.mimeType || 'audio/webm'
      if (chunksRef.current.length) {
        const blob = new Blob(chunksRef.current, { type: finalMime })
        if (blob.size > 0) segmentsRef.current.push(blob)
      }
      chunksRef.current = []

      if (rotatingRef.current && streamRef.current) {
        rotatingRef.current = false
        lastSegmentAtRef.current = elapsedRef.current
        attachRecorder(streamRef.current, mimeTypeRef.current)
        mediaRecorderRef.current?.start(RECORDING_TIMESLICE_MS)
        return
      }

      recordingRef.current = false
      setRecording(false)
      stopTracks()
      releaseWakeLock()
      clearTimer()
      setRecordingTime(0)
      elapsedRef.current = 0
      lastSegmentAtRef.current = 0
      void transcribeSegments()
    }

    return mediaRecorder
  }

  const startRecording = async () => {
    try {
      if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
        setError(t.browserUnsupported)
        return
      }

      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!window.isSecureContext && !isLocalhost) {
        setError(t.httpsRequired)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const candidateMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
      const mimeType = candidateMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
      mimeTypeRef.current = mimeType || 'audio/webm'
      streamRef.current = stream
      segmentsRef.current = []
      rotatingRef.current = false
      elapsedRef.current = 0
      lastSegmentAtRef.current = 0

      const mediaRecorder = attachRecorder(stream, mimeType)
      mediaRecorder.start(RECORDING_TIMESLICE_MS)
      recordingRef.current = true
      setRecording(true)
      setError(null)
      setRecordingTime(0)
      void requestWakeLock()

      clearTimer()
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setRecordingTime(elapsedRef.current)
        if (
          elapsedRef.current - lastSegmentAtRef.current >= SEGMENT_SECONDS &&
          mediaRecorderRef.current?.state === 'recording'
        ) {
          rotatingRef.current = true
          mediaRecorderRef.current.stop()
        }
      }, 1000)
    } catch (err: any) {
      const code = String(err?.name || '')
      if (code === 'NotAllowedError' || code === 'SecurityError') {
        setError(t.micDenied)
        return
      }
      if (code === 'NotFoundError' || code === 'DevicesNotFoundError') {
        setError(t.micNotFound)
        return
      }
      if (code === 'NotReadableError') {
        setError(t.micBusy)
        return
      }
      setError(`${t.micError}: ${err?.message || ''}`)
    }
  }

  const stopRecording = () => {
    rotatingRef.current = false
    recordingRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        } ${transcribing ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={transcribing || recording}
        />
        <div className="space-y-4">
          {transcribing ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <div className="text-primary-900 font-semibold">{t.transcribing}</div>
            </>
          ) : recording ? (
            <>
              <div className="relative">
                <div className="text-4xl animate-pulse">🔴</div>
                <div className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping"></div>
              </div>
              <div className="text-primary-900 font-semibold text-xl">
                {t.recording} {formatClock(recordingTime)}
              </div>
              <p className="text-sm text-indigo-700 font-medium">
                {t.estimatedStt(calculateAudioTranscriptionCost(recordingTime))}
              </p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                {costByDuration}
              </p>
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
              >
                ⏹️ {t.stop}
              </button>
            </>
          ) : (
            <>
              <div className="text-4xl">🎤</div>
              
              {/* Кнопка записи с микрофона */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold flex items-center gap-2"
                >
                  🎙️ {t.recordMic}
                </button>
                <span className="text-gray-500">{t.or}</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold flex items-center gap-2"
                >
                  📁 {t.uploadFile}
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mt-2">
                {t.dragHint}
              </p>
              
              <p className="text-sm text-gray-500">
                {t.formats}
                <br />
                {t.maxSize(maxSize)}
              </p>
              <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mt-2">
                {costByDuration}
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                {t.privacyHint}
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ {error}
        </div>
      )}
      
      {lastAnalysis && !transcribing && !recording && (
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span>⏱️ {t.duration}: <b>{formatClock(lastAnalysis.duration)}</b></span>
              <span>💰 {t.cost}: <b>{lastAnalysis.cost.toFixed(2)} cr.</b></span>
            </div>
            <button
              onClick={() => setLastAnalysis(null)}
              className="text-indigo-400 hover:text-indigo-600"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-[11px] text-indigo-600">{costByDuration}</p>
        </div>
      )}
    </div>
  )
}
