import GlucoseProfile from '@/components/GlucoseProfile'

export const metadata = {
  title: 'Глюкозный профиль — Doctor Opus',
  description: 'Анализ данных непрерывного мониторинга глюкозы (CGM): FreeStyle Libre, Dexcom, AGP-профиль',
}

export default function GlucosePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">🩸 Глюкозный профиль</h1>
        <div className="h-1.5 w-24 bg-emerald-600 rounded-full mb-3" />
        <p className="text-slate-500 max-w-2xl text-sm">
          Загрузите CSV-файл из FreeStyle Libre, Dexcom или другого CGM-монитора.
          Система построит AGP-профиль и даст клиническое заключение эндокринолога на основе GPT-5.4.
        </p>
      </div>
      <GlucoseProfile />
    </div>
  )
}
