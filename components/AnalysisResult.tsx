'use client'

import { useState } from 'react'

interface AnalysisResultProps {
  result: string
  loading?: boolean
  model?: string
  mode?: string
}

export default function AnalysisResult({ result, loading = false, model, mode }: AnalysisResultProps) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const getModelDisplayName = (modelName?: string) => {
    if (!modelName) return null
    if (modelName.includes('opus')) return '🧠 Opus 4.5'
    if (modelName.includes('sonnet')) return '🤖 Sonnet 4.5'
    if (modelName.includes('gemini') || modelName.includes('flash')) return '⚡ Gemini Flash'
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

  const handleDownloadDoc = () => {
    setDownloading(true)
    try {
      // Создаем HTML контент с форматированием
      const htmlContent = result.split('\n').map(line => {
        if (line.match(/^#{1,6}\s+/)) {
          const level = line.match(/^#+/)?.[0].length || 1
          const text = line.replace(/^#{1,6}\s+/, '')
          const fontSize = level === 1 ? '24pt' : level === 2 ? '20pt' : level === 3 ? '16pt' : '14pt'
          return `<p style="font-size: ${fontSize}; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt;">${escapeHtml(text)}</p>`
        }
        return `<p style="margin-bottom: 6pt; line-height: 1.5;">${escapeHtml(line || ' ')}</p>`
      }).join('')

      const modelInfo = model ? `<p style="font-size: 10pt; color: #666; margin-bottom: 12pt;">Использована модель: ${escapeHtml(getModelDisplayName(model) || model)}${mode ? ` (${mode === 'fast' ? 'быстрый' : mode === 'precise' ? 'точный' : 'с валидацией'})` : ''}</p>` : ''
      
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Результат анализа</title>
</head>
<body style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; padding: 20pt;">
  <h1 style="font-size: 18pt; font-weight: bold; margin-bottom: 12pt;">Результат анализа</h1>
  ${modelInfo}
  ${htmlContent}
</body>
</html>`

      // Создаем Blob с HTML контентом
      const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `результат_анализа_${new Date().toISOString().split('T')[0]}.doc`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при скачивании документа:', error)
      alert('Ошибка при скачивании документа. Попробуйте еще раз.')
    } finally {
      setDownloading(false)
    }
  }

  const handleShare = async () => {
    try {
      // Проверяем поддержку Web Share API
      if (navigator.share) {
        await navigator.share({
          title: 'Результат медицинского анализа',
          text: result.substring(0, 1000) + (result.length > 1000 ? '...' : ''),
          url: window.location.href
        })
      } else {
        // Fallback: копируем текст в буфер обмена
        await navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert('Текст скопирован в буфер обмена!')
      }
    } catch (error: any) {
      // Пользователь отменил шаринг или произошла ошибка
      if (error.name !== 'AbortError') {
        console.error('Ошибка при попытке поделиться:', error)
        // Fallback: копируем текст
        await navigator.clipboard.writeText(result)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        alert('Текст скопирован в буфер обмена!')
      }
    }
  }

  // Если есть результат, показываем его даже во время загрузки (для streaming)
  if (!result) {
    if (loading) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="text-primary-900 font-semibold">Анализ выполняется...</span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-primary-900">Результат анализа</h3>
          {loading && (
            <div className="flex items-center space-x-2 mt-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">Анализ выполняется...</span>
            </div>
          )}
          {model && (
            <p className="text-sm text-gray-600 mt-1">
              Использована модель: <span className="font-semibold">{getModelDisplayName(model)}</span>
              {mode && <span className="ml-2">({mode === 'fast' ? 'быстрый' : mode === 'precise' ? 'точный' : 'с валидацией'})</span>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
          >
            {copied ? '✓ Скопировано' : '📋 Копировать'}
          </button>
          <button
            onClick={handleDownloadDoc}
            disabled={downloading}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? '⏳ Скачивание...' : '📄 Скачать .doc'}
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
          >
            🔗 Поделиться
          </button>
        </div>
      </div>
      <div className="prose max-w-none">
        <div 
          className="whitespace-pre-wrap text-gray-800 leading-relaxed text-base"
          style={{ 
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
            fontSize: '16px',
            lineHeight: '1.75',
            letterSpacing: '0.01em',
            fontWeight: '400'
          }}
        >
          {result.split('\n').map((line, index) => {
            // Форматируем строки с решетками (заголовки) как жирный текст без решеток
            if (line.match(/^#{1,6}\s+/)) {
              const level = line.match(/^#+/)?.[0].length || 1;
              const text = line.replace(/^#{1,6}\s+/, '');
              const fontSize = level === 1 ? '1.5em' : level === 2 ? '1.3em' : level === 3 ? '1.1em' : '1em';
              return (
                <div key={index} className="mb-3 mt-4" style={{ fontSize, fontWeight: '600' }}>
                  {text}
                </div>
              );
            }
            return (
              <div key={index} className="mb-1.5">
                {line || '\u00A0'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}

