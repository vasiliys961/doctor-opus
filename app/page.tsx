import Link from 'next/link'
import SpendingSummary from '@/components/SpendingSummary'

export default function HomePage() {
  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <SpendingSummary />
      {/* HERO-блок */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12">
        <div className="lg:col-span-2">
          <div className="py-4 sm:py-6">
            <div className="text-primary-900 font-bold text-sm sm:text-base lg:text-lg uppercase tracking-wider mb-2">
              Медицинский ИИ‑ассистент профессора
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-gray-900 mb-3">
              Правильное время<br />
              для экспертной<br />
              <span className="text-primary-600">клинической диагностики</span>
            </h1>
            <p className="max-w-lg text-sm sm:text-base text-primary-900 mb-4 sm:mb-6">
              Единый ИИ‑центр: Opus‑профессор для ЭКГ, рентгена, КТ, МРТ, УЗИ, гистологии, офтальмологии, маммографии и генетики.
              Автоматический анализ изображений, лабораторных и генетических отчётов
              с выводом в формате «клиническая директива» для врача.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <Link
                href="/image-analysis"
                className="bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-full transition-colors text-center touch-manipulation"
              >
                🔍 Начать анализ изображения
              </Link>
              <Link
                href="/genetic"
                className="bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-full transition-colors text-center touch-manipulation"
              >
                🧬 Генетический консультант
              </Link>
            </div>
            
            <p className="text-xs sm:text-sm text-primary-700">
              24/7 доступ к Opus‑консилиуму · Поддержка сложных клинических случаев ·
              Безопасная локальная обработка данных
            </p>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-primary-400 to-secondary-400 rounded-2xl p-4 sm:p-6 text-white text-center shadow-2xl">
            <div className="text-4xl sm:text-5xl mb-2">🩺</div>
            <h2 className="font-bold text-lg sm:text-xl mb-2">
              Профессор‑консультант Opus
            </h2>
            <p className="text-xs sm:text-sm opacity-90 mb-3 sm:mb-4">
              Кардиология · Неврология · Онкология · Генетика · Терапия
            </p>
            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-left bg-white/10 p-3 rounded-xl">
              ✔ Сложные ЭКГ и аритмии<br />
              ✔ Рентген/КТ/МРТ с оценкой динамики<br />
              ✔ Лабораторные и генетические панели<br />
              ✔ Формирование готового клинического протокола
            </div>
          </div>
        </div>
      </div>
      
      <hr className="my-6 sm:my-8 border-primary-200" />
      
      {/* Быстрые действия */}
      <div className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-4 sm:mb-6">⚡ Быстрые действия</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          <Link
            href="/ecg"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            📈 Анализ ЭКГ
          </Link>
          <Link
            href="/patients"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            👤 База пациентов
          </Link>
          <Link
            href="/chat"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            🤖 ИИ-Консультант
          </Link>
          <Link
            href="/protocol"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            📝 Протокол
          </Link>
          <Link
            href="/document"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            📄 Сканирование
          </Link>
          <Link
            href="/video"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            🎬 Анализ видео
          </Link>
          <a
            href="https://medcalculator.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            🧮 Мед. калькуляторы
          </a>
        </div>
      </div>
      
      <hr className="my-6 sm:my-8 border-primary-200" />
      
      {/* Ключевые модули */}
      <div className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-4 sm:mb-6">Ключевые модули</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <h3 className="font-bold text-base sm:text-lg mb-2">📈 ЭКГ & ритмы</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              Анализ 12‑канальной ЭКГ, аритмии, блокады, клиническая директива.
            </p>
          </div>
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <h3 className="font-bold text-base sm:text-lg mb-2">🩻 Визуальная диагностика</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              Рентген, КТ, МРТ, УЗИ — структурированный отчёт и оценка динамики.
            </p>
          </div>
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <h3 className="font-bold text-base sm:text-lg mb-2">🔬 Лабораторные данные</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              Сканирование бланков, структурирование анализов, без лишних интерпретаций.
            </p>
          </div>
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <h3 className="font-bold text-base sm:text-lg mb-2">🧬 Генетика & фармакогеномика</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              Разбор VCF/PDF, заключение генетика и профессорский обзор.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

