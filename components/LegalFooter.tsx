'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LegalFooter() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <footer className="mt-auto pt-10 pb-6 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Юридическая информация</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="/docs/offer" className="hover:text-primary-600 transition-colors">
                  📄 Договор оферты
                </Link>
              </li>
              <li>
                <Link href="/docs/refund" className="hover:text-primary-600 transition-colors">
                  💳 Оплата и возврат
                </Link>
              </li>
              <li>
                <Link href="/docs/terms" className="hover:text-primary-600 transition-colors">
                  ⚖️ Пользовательское соглашение
                </Link>
              </li>
              <li>
                <Link href="/docs/privacy" className="hover:text-primary-600 transition-colors">
                  🛡️ Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link href="/docs/consent" className="hover:text-primary-600 transition-colors">
                  ✅ Согласие на обработку ПД
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Сообщество</h3>
            <div className="flex flex-col gap-3">
              <a 
                href="https://t.me/doctor_opus" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white rounded-lg hover:bg-[#0077b5] transition-colors text-sm font-medium w-fit"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.72 1-1.31.94-1.33-.12-2.31-1-3.6-1.86-2.02-1.35-3.16-2.19-5.12-3.49-.23-.15-.46-.3-.68-.45 1.96-1.81 4.35-4.01 4.46-4.11.05-.05.1-.15.02-.2-.08-.05-.18-.02-.25-.01-.1.02-1.68 1.06-4.76 3.14-.45.31-.86.46-1.23.45-.41-.01-1.2-.23-1.79-.42-.72-.23-1.29-.35-1.24-.75.03-.2.38-.41 1.05-.62 4.12-1.79 6.87-2.97 8.25-3.54 3.92-1.63 4.73-1.91 5.26-1.92.12 0 .38.03.55.17.14.12.18.29.2.42.02.08.03.24.02.4z"/>
                </svg>
                📢 Подписаться на канал
              </a>
              <p className="text-xs text-gray-500">
                Свежие новости, обновления и кейсы использования ИИ в медицине.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
              <p className="font-bold mb-1 flex items-center gap-2">
                ⚠️ Важное уведомление (Disclaimer)
              </p>
              <p className="leading-relaxed">
                Doctor Opus — это вспомогательная система на базе искусственного интеллекта для поддержки принятия клинических решений. 
                Результаты анализа не являются окончательным диагнозом, медицинским заключением или руководством к действию. 
                Все данные носят ознакомительный характер. Окончательное решение о диагнозе и лечении всегда принимает только квалифицированный лечащий врач. 
                Система может допускать ошибки или интерпретировать данные неточно.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-400">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <p>© {mounted ? new Date().getFullYear() : '2026'} Doctor Opus. Все права защищены.</p>
                <p className="text-[10px] opacity-70 italic">Самозанятый Селиванов В.Ф., ИНН 920455053236, г. Севастополь</p>
              </div>
              
              <div className="flex items-center gap-4 opacity-60">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg">💳</span>
                  <span className="text-[7px] font-bold uppercase">МИР</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg">🟡</span>
                  <span className="text-[7px] font-bold uppercase">T-Pay</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg">📲</span>
                  <span className="text-[7px] font-bold uppercase">СБП</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg">💳</span>
                  <span className="text-[7px] font-bold uppercase">Mir Pay</span>
                </div>
              </div>
              
              <p>Разработано для профессионального медицинского использования</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

