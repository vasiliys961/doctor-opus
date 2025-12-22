import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* HERO-блок */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <div className="py-6">
            <div className="text-primary-900 font-bold text-lg uppercase tracking-wider mb-2">
              Медицинский ИИ‑ассистент профессора
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-gray-900 mb-3">
              Правильное время<br />
              для экспертной<br />
              <span className="text-primary-600">клинической диагностики</span>
            </h1>
            <p className="max-w-lg text-base text-primary-900 mb-6">
              Единый ИИ‑центр: Opus‑профессор для ЭКГ, рентгена, КТ, МРТ, УЗИ, гистологии, офтальмологии, маммографии и генетики.
              Автоматический анализ изображений, лабораторных и генетических отчётов
              с выводом в формате «клиническая директива» для врача.
            </p>
            
            <div className="flex gap-4 mb-6">
              <Link
                href="/image-analysis"
                className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-full transition-colors"
              >
                🔍 Начать анализ изображения
              </Link>
              <Link
                href="/genetic"
                className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold py-3 px-6 rounded-full transition-colors"
              >
                🧬 Генетический консультант
              </Link>
            </div>
            
            <p className="text-sm text-primary-700">
              24/7 доступ к Opus‑консилиуму · Поддержка сложных клинических случаев ·
              Безопасная локальная обработка данных
            </p>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-primary-400 to-secondary-400 rounded-2xl p-6 text-white text-center shadow-2xl">
            <div className="text-5xl mb-2">🩺</div>
            <h2 className="font-bold text-xl mb-2">
              Профессор‑консультант Opus
            </h2>
            <p className="text-sm opacity-90 mb-4">
              Кардиология · Неврология · Онкология · Генетика · Терапия
            </p>
            <div className="mt-4 text-sm text-left bg-white/10 p-3 rounded-xl">
              ✔ Сложные ЭКГ и аритмии<br />
              ✔ Рентген/КТ/МРТ с оценкой динамики<br />
              ✔ Лабораторные и генетические панели<br />
              ✔ Формирование готового клинического протокола
            </div>
          </div>
        </div>
      </div>
      
      <hr className="my-8 border-primary-200" />
      
      {/* Быстрые действия */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-primary-900 mb-6">⚡ Быстрые действия</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link
            href="/ecg"
            className="bg-white hover:bg-primary-50 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 px-4 rounded-lg text-center transition-all"
          >
            📈 Анализ ЭКГ
          </Link>
          <Link
            href="/patients"
            className="bg-white hover:bg-primary-50 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 px-4 rounded-lg text-center transition-all"
          >
            👤 База пациентов
          </Link>
          <Link
            href="/chat"
            className="bg-white hover:bg-primary-50 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 px-4 rounded-lg text-center transition-all"
          >
            🤖 ИИ-Консультант
          </Link>
          <Link
            href="/protocol"
            className="bg-white hover:bg-primary-50 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 px-4 rounded-lg text-center transition-all"
          >
            📝 Протокол
          </Link>
          <Link
            href="/document"
            className="bg-white hover:bg-primary-50 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 px-4 rounded-lg text-center transition-all"
          >
            📄 Сканирование
          </Link>
        </div>
      </div>
      
      <hr className="my-8 border-primary-200" />
      
      {/* Ключевые модули */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-primary-900 mb-6">Ключевые модули</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="module-card bg-white">
            <h3 className="font-bold text-lg mb-2">📈 ЭКГ & ритмы</h3>
            <p className="text-sm text-gray-600">
              Анализ 12‑канальной ЭКГ, аритмии, блокады, клиническая директива.
            </p>
          </div>
          <div className="module-card bg-white">
            <h3 className="font-bold text-lg mb-2">🩻 Визуальная диагностика</h3>
            <p className="text-sm text-gray-600">
              Рентген, КТ, МРТ, УЗИ — структурированный отчёт и оценка динамики.
            </p>
          </div>
          <div className="module-card bg-white">
            <h3 className="font-bold text-lg mb-2">🔬 Лабораторные данные</h3>
            <p className="text-sm text-gray-600">
              Сканирование бланков, структурирование анализов, без лишних интерпретаций.
            </p>
          </div>
          <div className="module-card bg-white">
            <h3 className="font-bold text-lg mb-2">🧬 Генетика & фармакогеномика</h3>
            <p className="text-sm text-gray-600">
              Разбор VCF/PDF, заключение генетика и профессорский обзор.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

