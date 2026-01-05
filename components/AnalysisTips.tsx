'use client'

import { useState } from 'react'

interface AnalysisTipsProps {
  title?: string
  content?: {
    fast?: string
    optimized?: string
    validated?: string
    extra?: string[]
  }
}

export default function AnalysisTips({ 
  title = 'Советы по использованию режимов анализа',
  content 
}: AnalysisTipsProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="mb-8 bg-primary-50/30 border-l-4 border-primary-600 p-6 rounded-r-xl shadow-sm transition-all duration-300">
      <details className="group" open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="flex justify-between items-center font-bold text-gray-900 cursor-pointer list-none outline-none">
          <div className="flex items-center gap-2">
            <span className="text-xl">💡</span>
            <span>{title}</span>
          </div>
          <span className={`transition-transform duration-300 text-primary-600 ${isOpen ? 'rotate-180' : ''}`}>
            <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </span>
        </summary>
        
        <div className="mt-4 space-y-4 text-sm text-gray-800 font-medium leading-relaxed animate-fadeIn">
          {content?.fast && (
            <div className="flex gap-3">
              <span className="shrink-0 text-yellow-600">⚡</span>
              <div>
                <strong>Быстрый анализ</strong> — {content.fast}
              </div>
            </div>
          )}
          
          {content?.optimized && (
            <div className="flex gap-3">
              <span className="shrink-0 text-purple-600">⭐</span>
              <div>
                <strong>Оптимизированный режим</strong> — {content.optimized}
              </div>
            </div>
          )}
          
          {content?.validated && (
            <div className="flex gap-3">
              <span className="shrink-0 text-green-600">🧠</span>
              <div>
                <strong>Итоговое заключение ИИ‑консультанта</strong> — {content.validated}
              </div>
            </div>
          )}
          
          {(content?.extra && content.extra.length > 0) && (
            <div className="mt-4 pt-4 border-t border-primary-200/50 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs opacity-90">
              {content.extra.map((tip, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="shrink-0 opacity-70">
                    {tip.startsWith('📸') || tip.startsWith('🔄') || tip.startsWith('💾') || tip.startsWith('🎞️') ? '' : '•'}
                  </span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  )
}


