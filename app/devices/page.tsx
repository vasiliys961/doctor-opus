import SerialDeviceManager from '@/components/SerialDeviceManager'

export default function DevicesPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">🔬 Лаборатория</h1>
        <div className="h-1.5 w-24 bg-indigo-600 rounded-full mb-4"></div>
        <p className="text-slate-600 max-w-2xl">
          Прямое подключение медицинского оборудования. Считывайте данные с ЭКГ, пульсоксиметров и других приборов напрямую в систему для мгновенного ИИ-анализа.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <SerialDeviceManager />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 text-2xl">📈</div>
            <h3 className="font-bold text-slate-900 mb-2">ЭКГ Мониторинг</h3>
            <p className="text-sm text-slate-500">Подключите портативный ЭКГ-датчик для наблюдения за ритмом сердца в реальном времени.</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4 text-2xl">🩸</div>
            <h3 className="font-bold text-slate-900 mb-2">Глюкометры</h3>
            <p className="text-sm text-slate-500">Автоматический импорт данных уровня сахара в крови для построения графиков гликемии.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-4 text-2xl">🩺</div>
            <h3 className="font-bold text-slate-900 mb-2">Другие датчики</h3>
            <p className="text-sm text-slate-500">Поддержка любых приборов с Serial-интерфейсом (пульсоксиметры, весы, спирометры).</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Инструкция по подключению</h3>
            <ul className="space-y-3 text-slate-400 text-sm list-disc pl-5">
              <li>Убедитесь, что прибор подключен к USB-порту вашего компьютера.</li>
              <li>Выберите правильную скорость передачи (обычно 9600 или 115200 baud).</li>
              <li>Нажмите кнопку «Подключить» и выберите ваше устройство в списке браузера.</li>
              <li>Если данные не отображаются, проверьте формат вывода прибора (должны быть текстовые числа).</li>
            </ul>
          </div>
          <div className="absolute -right-10 -bottom-10 text-9xl opacity-10 grayscale">🔌</div>
        </div>
      </div>
    </div>
  )
}




