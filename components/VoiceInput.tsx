'use client'

import { useState, useEffect, useRef } from 'react'
import { getClientLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

const SPEECH_RECOGNITION_LANG_BY_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  ar: 'ar-SA',
  hi: 'hi-IN',
  'pt-BR': 'pt-BR',
  id: 'id-ID',
  ms: 'ms-MY',
  tr: 'tr-TR',
  'zh-CN': 'zh-CN',
}

export default function VoiceInput({ onTranscript, disabled = false, className = "", placeholder = "" }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any | null>(null)
  const latestInterimRef = useRef('')
  const hasEmittedFinalRef = useRef(false)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
    }

    return () => {
      try {
        recognitionRef.current?.abort?.()
      } catch {}
      recognitionRef.current = null
    }
  }, [])

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (isListening) {
      try {
        recognitionRef.current?.stop?.()
      } catch {
        try {
          recognitionRef.current?.abort?.()
        } catch {}
      }
      return
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {}
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    const locale = getClientLocale()
    recognition.lang = SPEECH_RECOGNITION_LANG_BY_LOCALE[locale] || 'en-US'
    recognition.interimResults = true // Показывать промежуточные результаты для "живого" эффекта
    recognition.maxAlternatives = 1
    recognition.continuous = false // Останавливаться после фразы

    recognition.onstart = () => {
      latestInterimRef.current = ''
      hasEmittedFinalRef.current = false
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const chunk = String(event.results[i]?.[0]?.transcript || '').trim()
        if (!chunk) continue
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + chunk
        } else {
          interimTranscript += (interimTranscript ? ' ' : '') + chunk
        }
      }
      if (interimTranscript) {
        latestInterimRef.current = interimTranscript
      }
      if (finalTranscript) {
        hasEmittedFinalRef.current = true
        latestInterimRef.current = ''
        onTranscript(finalTranscript)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      // Если пользователь остановил запись вручную до финализации фразы,
      // Web Speech API иногда не отдает isFinal=true. В этом случае отдаём
      // последний interim-текст, чтобы диктовка не "пропадала".
      if (!hasEmittedFinalRef.current && latestInterimRef.current.trim()) {
        onTranscript(latestInterimRef.current.trim())
      }
      latestInterimRef.current = ''
      hasEmittedFinalRef.current = false
      setIsListening(false)
      recognitionRef.current = null
    }

    try {
      recognition.start()
    } catch (error) {
      console.error('Speech recognition start error:', error)
      setIsListening(false)
      recognitionRef.current = null
    }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`p-2 rounded-full transition-all flex items-center justify-center ${
        isListening 
          ? 'bg-red-500 text-white animate-pulse shadow-lg scale-110' 
          : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
      } ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isListening ? 'Recording... Speak (do not dictate patient names!)' : (placeholder || 'Click to dictate (no patient names)')}
    >
      {isListening ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
          <circle cx="12" cy="12" r="10" strokeDasharray="4 4" className="animate-spin-slow" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      )}
    </button>
  )
}




