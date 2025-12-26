'use client'

import { useState, useEffect } from 'react'

interface Patient {
  id: string
  name: string
  age?: number
  diagnosis?: string
  lastVisit: string
  notes: string
  phone?: string
  email?: string
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  const [newPatient, setNewPatient] = useState<Omit<Patient, 'id' | 'lastVisit'>>({
    name: '',
    age: undefined,
    diagnosis: '',
    notes: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    loadPatients()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPatients(patients)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredPatients(
        patients.filter(
          p =>
            p.name.toLowerCase().includes(query) ||
            p.diagnosis?.toLowerCase().includes(query) ||
            p.notes.toLowerCase().includes(query) ||
            p.phone?.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, patients])

  const loadPatients = () => {
    try {
      const savedPatients = localStorage.getItem('medicalPatients')
      if (savedPatients) {
        const parsed = JSON.parse(savedPatients)
        setPatients(parsed)
        setFilteredPatients(parsed)
      }
    } catch (error) {
      console.error('Error loading patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePatients = (updatedPatients: Patient[]) => {
    localStorage.setItem('medicalPatients', JSON.stringify(updatedPatients))
    setPatients(updatedPatients)
  }

  const addPatient = () => {
    if (!newPatient.name.trim()) {
      alert('Введите имя пациента')
      return
    }

    const patient: Patient = {
      id: Date.now().toString(),
      ...newPatient,
      lastVisit: new Date().toISOString(),
    }

    const updatedPatients = [...patients, patient]
    savePatients(updatedPatients)
    setShowAddModal(false)
    setNewPatient({
      name: '',
      age: undefined,
      diagnosis: '',
      notes: '',
      phone: '',
      email: '',
    })
  }

  const updatePatient = (updatedPatient: Patient) => {
    const updatedPatients = patients.map(p =>
      p.id === updatedPatient.id ? { ...updatedPatient, lastVisit: new Date().toISOString() } : p
    )
    savePatients(updatedPatients)
    setSelectedPatient(null)
  }

  const deletePatient = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить этого пациента?')) {
      const updatedPatients = patients.filter(p => p.id !== id)
      savePatients(updatedPatients)
      setSelectedPatient(null)
    }
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary-900 mb-6">👤 База данных пациентов</h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary-900">👤 База данных пациентов</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
        >
          ➕ Добавить пациента
        </button>
      </div>

      {/* Поиск */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Поиск по имени, диагнозу, заметкам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="text-gray-600 text-sm mb-1">Всего пациентов</div>
          <div className="text-3xl font-bold text-primary-700">{patients.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="text-gray-600 text-sm mb-1">Результатов поиска</div>
          <div className="text-3xl font-bold text-secondary-600">{filteredPatients.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="text-gray-600 text-sm mb-1">Последнее обновление</div>
          <div className="text-sm font-semibold text-gray-700">
            {patients.length > 0
              ? formatDate(patients[patients.length - 1].lastVisit)
              : '—'}
          </div>
        </div>
      </div>

      {/* Список пациентов */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-600 text-lg">
            {patients.length === 0
              ? '📋 База пациентов пуста. Добавьте первого пациента!'
              : '🔍 Пациенты не найдены. Попробуйте изменить запрос.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Пациент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Возраст
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Диагноз
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Последний визит
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map(patient => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                      {patient.phone && (
                        <div className="text-xs text-gray-500">📞 {patient.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {patient.age ? `${patient.age} лет` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {patient.diagnosis || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(patient.lastVisit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedPatient(patient)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Просмотр
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модальное окно добавления пациента */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">➕ Добавить пациента</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Имя пациента *
                  </label>
                  <input
                    type="text"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Возраст</label>
                    <input
                      type="number"
                      value={newPatient.age || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, age: parseInt(e.target.value) || undefined })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="45"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                    <input
                      type="tel"
                      value={newPatient.phone || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newPatient.email || ''}
                    onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="patient@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Диагноз</label>
                  <input
                    type="text"
                    value={newPatient.diagnosis || ''}
                    onChange={(e) => setNewPatient({ ...newPatient, diagnosis: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Основной диагноз"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
                  <textarea
                    value={newPatient.notes}
                    onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Дополнительная информация о пациенте..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewPatient({
                      name: '',
                      age: undefined,
                      diagnosis: '',
                      notes: '',
                      phone: '',
                      email: '',
                    })
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={addPatient}
                  className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра пациента */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">👤 Информация о пациенте</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя пациента</label>
                  <input
                    type="text"
                    value={selectedPatient.name}
                    onChange={(e) => setSelectedPatient({ ...selectedPatient, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Возраст</label>
                    <input
                      type="number"
                      value={selectedPatient.age || ''}
                      onChange={(e) => setSelectedPatient({ ...selectedPatient, age: parseInt(e.target.value) || undefined })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                    <input
                      type="tel"
                      value={selectedPatient.phone || ''}
                      onChange={(e) => setSelectedPatient({ ...selectedPatient, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={selectedPatient.email || ''}
                    onChange={(e) => setSelectedPatient({ ...selectedPatient, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Диагноз</label>
                  <input
                    type="text"
                    value={selectedPatient.diagnosis || ''}
                    onChange={(e) => setSelectedPatient({ ...selectedPatient, diagnosis: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
                  <textarea
                    value={selectedPatient.notes}
                    onChange={(e) => setSelectedPatient({ ...selectedPatient, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Последний визит:</strong> {formatDate(selectedPatient.lastVisit)}
                  </p>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => deletePatient(selectedPatient.id)}
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
                >
                  🗑️ Удалить
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => updatePatient(selectedPatient)}
                    className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Информация */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>ℹ️ Примечание:</strong> Данные пациентов сохраняются локально в браузере. 
          Для серверного хранения данных потребуется настройка базы данных.
        </p>
      </div>
    </div>
  )
}
