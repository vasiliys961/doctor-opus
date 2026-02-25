import SerialDeviceManager from '@/components/SerialDeviceManager'

export default function DevicesPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">🔬 Device Lab</h1>
        <div className="h-1.5 w-24 bg-indigo-600 rounded-full mb-4"></div>
        <p className="text-slate-600 max-w-2xl">
          Direct connection of medical equipment. Read data from ECG monitors, pulse oximeters, and other devices directly into the system for instant AI analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <SerialDeviceManager />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 text-2xl">📈</div>
            <h3 className="font-bold text-slate-900 mb-2">ECG Monitoring</h3>
            <p className="text-sm text-slate-500">Connect a portable ECG sensor to monitor heart rhythm in real time.</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4 text-2xl">🩸</div>
            <h3 className="font-bold text-slate-900 mb-2">Glucometers</h3>
            <p className="text-sm text-slate-500">Automatic import of blood glucose data for glycemia chart visualization.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 mb-4 text-2xl">🩺</div>
            <h3 className="font-bold text-slate-900 mb-2">Other Sensors</h3>
            <p className="text-sm text-slate-500">Support for any Serial-interface devices (pulse oximeters, scales, spirometers).</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Connection Instructions</h3>
            <ul className="space-y-3 text-slate-400 text-sm list-disc pl-5">
              <li>Make sure the device is connected to your computer's USB port.</li>
              <li>Select the correct baud rate (usually 9600 or 115200).</li>
              <li>Click the «Connect» button and select your device from the browser list.</li>
              <li>If data is not displayed, check the device output format (should be plain text numbers).</li>
            </ul>
          </div>
          <div className="absolute -right-10 -bottom-10 text-9xl opacity-10 grayscale">🔌</div>
        </div>
      </div>
    </div>
  )
}




