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

          <div className="lg:col-span-3 space-y-4">
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
                <p className="text-[10px] opacity-70 italic">Самозанятый Селиванов В.Ф., ИНН 920455053236</p>
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

