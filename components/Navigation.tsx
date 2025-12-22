'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const pages = [
    { name: '🏠 Главная', href: '/' },
    { name: '🤖 ИИ-Консультант', href: '/chat' },
    { name: '📝 Протокол приёма', href: '/protocol' },
    { name: '📈 Анализ ЭКГ', href: '/ecg' },
    { name: '🔍 Анализ изображений', href: '/image-analysis' },
    { name: '🩻 Анализ рентгена', href: '/xray' },
    { name: '🧠 Анализ МРТ', href: '/mri' },
    { name: '🩻 Анализ КТ', href: '/ct' },
    { name: '🔊 Анализ УЗИ', href: '/ultrasound' },
    { name: '🔬 Анализ дерматоскопии', href: '/dermatoscopy' },
    { name: '🔬 Анализ лабораторных данных', href: '/lab' },
    { name: '📄 Сканирование документов', href: '/document' },
    { name: '🧬 Генетический анализ', href: '/genetic' },
    { name: '👤 База данных пациентов', href: '/patients' },
    { name: '📊 Статистика', href: '/statistics' },
  ]

  return (
    <nav className="bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">🧠 Меню</h1>
        </div>
        <div className="space-y-2">
          {pages.map((page) => {
            const isActive = pathname === page.href
            return (
              <Link
                key={page.href}
                href={page.href}
                className={`block w-full text-center py-2 px-4 rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-primary-900 font-bold border-3 border-primary-400 shadow-lg'
                    : 'bg-white/95 text-gray-800 hover:bg-white hover:shadow-md'
                }`}
              >
                {page.name}
              </Link>
            )
          })}
        </div>
        <div className="mt-6 p-4 bg-white/10 rounded-lg text-sm">
          <p className="font-semibold mb-2">Медицинский Ассистент v3.28</p>
          <ul className="space-y-1 text-xs opacity-90">
            <li>• AssemblyAI для голоса</li>
            <li>• 10 типов изображений</li>
            <li>• Улучшенный анализ лабораторных данных</li>
            <li>• Структурированный JSON анализ</li>
            <li>• Claude 4.5 Sonnet + Opus 4.5 + OpenRouter</li>
            <li className="text-yellow-300">⚠️ ВНИМАНИЕ: Только для обучения</li>
          </ul>
        </div>
      </div>
    </nav>
  )
}

