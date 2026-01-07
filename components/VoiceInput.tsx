'use client'

import { useState, useEffect } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export default function VoiceInput({ onTranscript, disabled = false, className = "", placeholder = "" }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
    }
  }, [])

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (isListening) {
      // recognition.stop() is handled via instance, but we can just toggle state 
      // if we want to stop it properly we need a ref to the recognition instance
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.interimResults = true // Показывать промежуточные результаты для "живого" эффекта
    recognition.maxAlternatives = 1
    recognition.continuous = false // Останавливаться после фразы

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
        onTranscript(finalTranscript)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
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
      title={isListening ? 'Идет запись... Говорите' : (placeholder || 'Нажмите, чтобы продиктовать')}
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



