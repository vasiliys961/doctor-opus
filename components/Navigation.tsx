'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import BalanceWidget from './BalanceWidget'
import { useSession, signOut } from 'next-auth/react'

export default function Navigation() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  const pages = [
    { name: '🏠 Главная', href: '/' },
    { name: '📘 Инструкция для врача', href: '/manual' },
    { name: '🤖 ИИ-Консультант', href: '/chat' },
    { name: '📚 Персональная библиотека', href: '/library' },
    { name: '📝 Протокол приёма', href: '/protocol' },
    { name: '🧮 Мед. калькуляторы', href: 'https://medcalculator.vercel.app', isExternal: true },
    { name: '📚 Клинические рекомендации', href: '/protocols' },
    { name: '📈 Анализ ЭКГ', href: '/ecg' },
    { name: '🔍 Анализ изображений', href: '/image-analysis' },
    { name: '🔬 Расширенный анализ', href: '/advanced' },
    { name: '📊 Сравнительный анализ', href: '/comparative' },
    { name: '🩻 Анализ рентгена', href: '/xray' },
    { name: '🧠 Анализ МРТ', href: '/mri' },
    { name: '🩻 Анализ КТ', href: '/ct' },
    { name: '🔊 Анализ УЗИ', href: '/ultrasound' },
    { name: '🔬 Анализ дерматоскопии', href: '/dermatoscopy' },
    { name: '🔬 Анализ лабораторных данных', href: '/lab' },
    { name: '🎬 Анализ видео', href: '/video' },
    { name: '📄 Сканирование документов', href: '/document' },
    { name: '🧬 Генетический анализ', href: '/genetic' },
    { name: '🧪 Лаборатория (USB)', href: '/devices' },
    { name: '👤 База данных пациентов', href: '/patients' },
    { name: '📊 Расход единиц', href: '/statistics' },
  ]

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

  return (
    <>
      {/* Мобильная шапка с бургер-меню */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary-900 to-primary-800 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-bold" onClick={closeMenu}>
            🏥 Doctor Opus
          </Link>
          <div className="flex items-center gap-3">
            {!session && status !== 'loading' && (
              <Link 
                href="/auth/signin" 
                className="text-xs bg-white text-primary-900 px-3 py-1.5 rounded-full font-bold shadow-sm"
              >
                Войти
              </Link>
            )}
            <button
              onClick={toggleMenu}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors touch-manipulation"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay для мобильного меню */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMenu}
        />
      )}

      {/* Боковое меню */}
      <nav
        className={`
          bg-primary-900 text-white shadow-2xl border-r border-primary-800
          h-screen overflow-y-auto w-72
          fixed top-0 left-0 z-40
          transition-transform duration-300 ease-in-out
          lg:sticky lg:top-0 lg:translate-x-0 lg:z-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-4 py-4 mt-16 lg:mt-0">
          <div className="mb-6">
            <BalanceWidget />
          </div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">🧠 Меню</h1>
            {status === 'authenticated' ? (
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-200 px-2 py-1 rounded transition-colors"
              >
                Выйти
              </button>
            ) : (
              <Link
                href="/auth/signin"
                className="text-[10px] bg-teal-500/20 hover:bg-teal-500/40 text-teal-200 px-2 py-1 rounded transition-colors"
              >
                Войти
              </Link>
            )}
          </div>
          {session?.user && (
            <div className="mb-4 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
              <p className="text-[10px] text-primary-300 uppercase font-bold tracking-tighter">Пользователь</p>
              <p className="text-xs truncate font-medium text-white">{session.user.email}</p>
              <p className="text-[9px] text-teal-400">{(session.user as any).specialty || 'Общий профиль'}</p>
            </div>
          )}
          <div className="space-y-2">
            {pages.map((page) => {
              const isActive = pathname === page.href
              
              if ('isExternal' in page && page.isExternal) {
                return (
                  <a
                    key={page.href}
                    href={page.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-left py-2.5 px-4 rounded-lg transition-all touch-manipulation text-sm bg-white/95 text-gray-800 hover:bg-white hover:shadow-sm active:bg-primary-50"
                  >
                    <span className="flex items-center gap-3">
                      {page.name}
                      <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </span>
                  </a>
                )
              }

              return (
                <Link
                  key={page.href}
                  href={page.href}
                  onClick={closeMenu}
                  className={`block w-full text-left py-2.5 px-4 rounded-lg transition-all touch-manipulation text-sm ${
                    isActive
                      ? 'bg-primary-500 text-white font-bold shadow-md ring-2 ring-primary-300'
                      : 'bg-white/95 text-gray-800 hover:bg-white hover:shadow-sm active:bg-primary-50'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {page.name}
                  </span>
                </Link>
              )
            })}
          </div>
          <div className="mt-6 p-4 bg-primary-800/50 rounded-lg text-sm border border-primary-700">
            <p className="font-semibold mb-1">Медицинский Ассистент v3.39.0</p>
            <p className="text-[10px] uppercase tracking-widest text-primary-300 mb-2 font-bold">Optima Edition</p>
            <ul className="space-y-1 text-xs opacity-70">
              <li>• Claude 4.5 + Gemini 3.0</li>
              <li>• DICOM Viewer + Measure</li>
              <li>• Multi-modal (Images + Labs)</li>
              <li>• Trend Analysis & RAG</li>
              <li className="text-teal-400 font-bold mt-2">🛡️ Поддержка клинических решений</li>
            </ul>
          </div>
        </div>
      </nav>
    </>
  )
}
