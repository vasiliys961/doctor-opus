'use client'

export type ImageModality = 
  | 'xray' 
  | 'ct' 
  | 'mri' 
  | 'ultrasound' 
  | 'dermatoscopy' 
  | 'ecg' 
  | 'histology' 
  | 'retinal' 
  | 'mammography' 
  | 'universal'

interface ModalitySelectorProps {
  value: ImageModality
  onChange: (modality: ImageModality) => void
  disabled?: boolean
}

export default function ModalitySelector({ value, onChange, disabled = false }: ModalitySelectorProps) {
  const modalities: Array<{ value: ImageModality; label: string; icon: string }> = [
    { value: 'universal', label: 'Universal', icon: '🔍' },
    { value: 'xray', label: 'X-Ray', icon: '🩻' },
    { value: 'ct', label: 'CT', icon: '🌀' },
    { value: 'mri', label: 'MRI', icon: '🧲' },
    { value: 'ultrasound', label: 'Ultrasound', icon: '🔊' },
    { value: 'ecg', label: 'ECG', icon: '💓' },
    { value: 'dermatoscopy', label: 'Dermatoscopy', icon: '🔬' },
    { value: 'histology', label: 'Histology', icon: '🧪' },
    { value: 'retinal', label: 'Ophthalmology', icon: '👁️' },
    { value: 'mammography', label: 'Mammography', icon: '🎀' },
  ]

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Study Type:
      </label>
      <div className="flex flex-wrap gap-2">
        {modalities.map((modality) => (
          <button
            key={modality.value}
            type="button"
            onClick={() => !disabled && onChange(modality.value)}
            disabled={disabled}
            className={`
              px-3 py-2 rounded-lg border transition-all text-sm flex items-center space-x-2
              ${value === modality.value
                ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span>{modality.icon}</span>
            <span>{modality.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}



