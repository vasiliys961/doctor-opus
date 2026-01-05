'use client'

import { useState, useEffect } from 'react'
import { getAllPatients, anonymizePatientContext, Patient, getPatientHistory } from '@/lib/patient-db'

interface PatientSelectorProps {
  onSelect: (patientData: string) => void
  disabled?: boolean
}

export default function PatientSelector({ onSelect, disabled = false }: PatientSelectorProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const localPatients = await getAllPatients()
        setPatients(localPatients)
      } catch (e) {
        console.error('Ошибка загрузки пациентов:', e)
      }
    }
    loadPatients()
  }, [])

  const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setSelectedId(id)
    
    if (id === '') {
      onSelect('')
      return
    }

    const patient = patients.find(p => p.id === id)
    if (patient) {
      // 1. ПРИМЕНЯЕМ АНОНИМИЗАЦИЮ: На сервер (AI) уходит только клинический контекст без ФИО
      let context = anonymizePatientContext(patient)

      // 2. ДОБАВЛЯЕМ ИСТОРИЮ (Trend Analysis)
      try {
        const history = await getPatientHistory(patient.id)
        if (history && history.length > 0) {
          const recentHistory = history.slice(0, 2) // Берем последние 2 записи для сравнения
          context += '\n\n=== ИСТОРИЯ ПОСЛЕДНИХ АНАЛИЗОВ (ДЛЯ СРАВНЕНИЯ) ==='
          recentHistory.forEach((record, index) => {
            const date = new Date(record.date).toLocaleDateString('ru-RU')
            context += `\n[${index + 1}] Дата: ${date}, Исследование: ${record.imageType || record.type}\nЗаключение: ${record.conclusion.substring(0, 600)}...`
          })
          context += '\n\nИНСТРУКЦИЯ: Проведи сравнительный анализ с историей пациента. Оцени динамику процесса (стабилизация, прогрессирование, регресс).'
        }
      } catch (err) {
        console.error('Ошибка при получении истории пациента:', err)
      }

      onSelect(context)
    }
  }

  if (patients.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic mb-2">
        База пациентов пуста. Добавьте пациентов в разделе «База пациентов».
      </div>
    )
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        👥 Выбрать пациента из базы (автозаполнение контекста):
      </label>
      <select
        value={selectedId}
        onChange={handleSelect}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
      >
        <option value="">-- Выберите пациента --</option>
        {patients.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} {p.age ? `(${p.age} л.)` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

