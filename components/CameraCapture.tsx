'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { postAnalyzeImageWithModelConsent } from '@/lib/analyze-image-client'
import { getClientLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'
import { getCameraCaptureMessages } from '@/lib/i18n/camera-capture'
import type { DeviceStatus } from '@/lib/device-hub'

type AnalysisType = 'ultrasound' | 'endoscopy' | 'general'

interface CameraCaptureProps {
  onStatusChange?: (status: DeviceStatus) => void
}

export default function CameraCapture({ onStatusChange }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [locale, setLocale] = useState<Locale>('en')
  const t = getCameraCaptureMessages(locale)

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [analysisType, setAnalysisType] = useState<AnalysisType>('ultrasound')
  const [clinicalContext, setClinicalContext] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null)

  const updateStatus = useCallback(
    (status: DeviceStatus) => {
      onStatusChange?.(status)
    },
    [onStatusChange]
  )

  const analysisConfig = [
    { id: 'ultrasound' as const, icon: '🔊', label: t.analysisTypes.ultrasound, prompt: t.prompts.ultrasound },
    { id: 'endoscopy' as const, icon: '🔭', label: t.analysisTypes.endoscopy, prompt: t.prompts.endoscopy },
    { id: 'general' as const, icon: '📷', label: t.analysisTypes.general, prompt: t.prompts.general },
  ]

  const loadDevices = useCallback(async () => {
    try {
      setError(null)
      updateStatus('idle')
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach(track => track.stop())
      const all = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = all.filter(d => d.kind === 'videoinput')
      setDevices(videoDevices)
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId)
      }
    } catch (e: any) {
      setError(
        e.name === 'NotAllowedError'
          ? t.errors.cameraBlocked
          : e.name === 'NotFoundError'
          ? t.errors.noCameraFound
          : `${t.errors.generic}: ${e.message}`
      )
      updateStatus('error')
    }
  }, [selectedDeviceId, t.errors.cameraBlocked, t.errors.generic, t.errors.noCameraFound, updateStatus])

  useEffect(() => {
    setLocale(getClientLocale())
  }, [])

  useEffect(() => {
    updateStatus('idle')
  }, [updateStatus])

  useEffect(() => {
    return () => {
      streamRef?.getTracks().forEach(track => track.stop())
    }
  }, [streamRef])

  const startStream = async () => {
    try {
      setError(null)
      streamRef?.getTracks().forEach(track => track.stop())

      let deviceId = selectedDeviceId
      if (devices.length === 0) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
        tempStream.getTracks().forEach(track => track.stop())
        const all = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = all.filter(d => d.kind === 'videoinput')
        setDevices(videoDevices)
        if (videoDevices.length > 0) {
          deviceId = videoDevices[0].deviceId
          setSelectedDeviceId(deviceId)
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      setStreamRef(stream)
      setStreaming(true)
      setCapturedFrame(null)
      setResult('')
      updateStatus('streaming')
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setError(t.errors.cameraBlocked)
      } else if (e.name === 'NotFoundError') {
        setError(t.errors.noCameraFound)
      } else {
        setError(`${t.errors.cameraStart}: ${e.message}`)
      }
      updateStatus('error')
    }
  }

  const stopStream = () => {
    streamRef?.getTracks().forEach(track => track.stop())
    setStreamRef(null)
    setStreaming(false)
    if (videoRef.current) videoRef.current.srcObject = null
    updateStatus('idle')
  }

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedFrame(dataUrl)
    setResult('')
    setError(null)
  }

  const analyze = async () => {
    if (!capturedFrame) return
    setLoading(true)
    setError(null)
    setResult('')

    try {
      const current = analysisConfig.find(a => a.id === analysisType)!

      // Convert dataUrl to file for API upload
      const res = await fetch(capturedFrame)
      const blob = await res.blob()
      const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', current.prompt)
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', 'optimized')
      formData.append('imageType', analysisType)
      formData.append('useStreaming', 'true')
      formData.append('isTwoStage', 'true')
      formData.append('model', 'anthropic/claude-sonnet-5')

      const response = await postAnalyzeImageWithModelConsent({ formData, mode: 'optimized' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const { handleSSEStream } = await import('@/lib/streaming-utils')
      await handleSSEStream(response, {
        onChunk: (_, acc) => setResult(acc),
        onError: (e) => setError(`${t.errors.analysis}: ${e.message}`),
        onUsage: () => {},
        onComplete: () => {},
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setCapturedFrame(null)
    setResult('')
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100 p-5 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base mb-1">{t.ui.howItWorksTitle}</h3>
          <p className="text-sm text-slate-600">
            {t.ui.howItWorksDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 border border-indigo-100">
            <p className="text-lg mb-1">🔊</p>
            <p className="text-xs font-bold text-slate-700 mb-1">{t.ui.ultrasoundCardTitle}</p>
            <p className="text-xs text-slate-500">{t.ui.ultrasoundCardDescription}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-indigo-100">
            <p className="text-lg mb-1">🔭</p>
            <p className="text-xs font-bold text-slate-700 mb-1">{t.ui.endoscopyCardTitle}</p>
            <p className="text-xs text-slate-500">{t.ui.endoscopyCardDescription}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-indigo-100">
            <p className="text-lg mb-1">📷</p>
            <p className="text-xs font-bold text-slate-700 mb-1">{t.ui.anyCameraCardTitle}</p>
            <p className="text-xs text-slate-500">{t.ui.anyCameraCardDescription}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-indigo-100 p-4">
          <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">{t.ui.whatAiAnalyzesTitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-slate-600">
            {t.ui.aiAnalyzeItems.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <span>{t.ui.disclaimer}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {analysisConfig.map(a => (
          <button
            key={a.id}
            onClick={() => setAnalysisType(a.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
              analysisType === a.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              {t.ui.cameraDeviceLabel}
            </label>
            {devices.length === 0 ? (
              <p className="text-sm text-gray-400 italic">{t.ui.refreshHint}</p>
            ) : (
              <select
                value={selectedDeviceId}
                onChange={e => setSelectedDeviceId(e.target.value)}
                disabled={streaming}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400"
              >
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${t.ui.cameraFallbackName} ${devices.indexOf(d) + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={loadDevices}
            disabled={streaming}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-40"
          >
            🔄 {t.ui.refreshButton}
          </button>
          {!streaming ? (
            <button
              onClick={startStream}
              disabled={devices.length === 0}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all"
            >
              ▶ {t.ui.startButton}
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-all"
            >
              ⏹ {t.ui.stopButton}
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">
          💡 {t.ui.captureHint}
        </p>
      </div>

      {streaming && (
        <div className="bg-black rounded-xl overflow-hidden relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[500px] object-contain"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              onClick={captureFrame}
              className="px-8 py-3 bg-white text-indigo-700 font-black text-sm rounded-full shadow-xl hover:scale-105 transition-transform flex items-center gap-2"
            >
              📸 {t.ui.captureButton}
            </button>
          </div>
        </div>
      )}

      {capturedFrame && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">📷 {t.ui.capturedFrameTitle}</h3>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              ✕ {t.ui.resetButton}
            </button>
          </div>
          <img
            src={capturedFrame}
            alt="Captured frame"
            className="w-full max-h-96 object-contain rounded-lg border border-gray-100"
          />

          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              {t.ui.clinicalContextLabel}
            </label>
            <textarea
              value={clinicalContext}
              onChange={e => setClinicalContext(e.target.value)}
              placeholder={t.ui.clinicalContextPlaceholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400"
              rows={2}
            />
          </div>

          <button
            onClick={analyze}
            disabled={loading}
            className="mt-4 w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span> {t.ui.analyzingButton}
              </>
            ) : (
              `🤖 ${t.ui.analyzeButton}`
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
          {error.toLowerCase().includes('blocked') ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">📷</span>
                <div>
                  <p className="font-bold text-amber-900 text-base">{t.errors.allowAccessTitle}</p>
                  <p className="text-amber-700 text-sm mt-1">
                    {t.errors.allowAccessBody}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setError(null); startStream() }}
                className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all text-sm"
              >
                ▶ {t.ui.retryButton}
              </button>
              <p className="text-xs text-amber-600 text-center">
                {t.errors.allowAccessHint}
              </p>
            </div>
          ) : (
            <p className="text-amber-800 text-sm font-medium">⚠️ {error}</p>
          )}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            🧠 {t.ui.analysisResultTitle}
            <span className="text-xs font-normal text-gray-400">Gemini + Claude Sonnet 5</span>
          </h3>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {result}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
