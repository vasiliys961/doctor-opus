'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getAllPatients, savePatient, deletePatient, Patient, getPatientHistory, deleteHistoryRecord, AnalysisRecord } from '@/lib/patient-db'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })
const LabTrendChart = dynamic(() => import('@/components/LabTrendChart'), { ssr: false })

function PatientsContent() {
  const searchParams = useSearchParams()
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  
  useEffect(() => {
    const action = searchParams.get('action')
    const patientId = searchParams.get('id')
    const recordId = searchParams.get('record')

    if (action === 'new') {
      setShowAddModal(true)
    } else if (patientId) {
      // Ищем пациента в загруженном списке и выбираем его
      const patient = patients.find(p => p.id === patientId)
      if (patient) {
        setSelectedPatient(patient)
        if (recordId) {
          setActiveTab('history')
          // Можно добавить подсветку конкретной записи, если нужно
        }
      }
    }
  }, [searchParams, patients])

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'trends' | 'timeline'>('info')
  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [labTrends, setLabTrends] = useState<Record<string, any[]>>({})
  const [caseSummary, setCaseSummary] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  useEffect(() => {
    loadPatients()
  }, [])

  useEffect(() => {
    if (selectedPatient) {
      loadHistory(selectedPatient.id)
    } else {
      setActiveTab('info')
      setHistory([])
      setLabTrends({})
    }
  }, [selectedPatient])

  const loadHistory = async (patientId: string) => {
    setLoadingHistory(true)
    setCaseSummary(null)
    try {
      const data = await getPatientHistory(patientId)
      setHistory(data)
      
      // Парсим тренды из лабораторных анализов
      const labRecords = data
        .filter(r => r.type === 'lab')
        .map(r => ({ date: r.date, text: r.conclusion }))
      
      if (labRecords.length > 0) {
        const { extractLabTrends } = await import('@/lib/lab-parser')
        setLabTrends(extractLabTrends(labRecords))
      }
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleGenerateSummary = async () => {
    if (!selectedPatient || history.length === 0) return
    
    setGeneratingSummary(true)
    try {
      const response = await fetch('/api/analyze/patient-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: history.slice(0, 10), // Берем последние 10 записей для контекста
          patientName: selectedPatient.name 
        })
      })
      const data = await response.json()
      if (data.success) {
        setCaseSummary(data.summary)
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch (error) {
      console.error('Error generating summary:', error)
    } finally {
      setGeneratingSummary(false)
    }
  }

  const handleDeleteHistory = async (id: string) => {
    if (confirm('Удалить эту запись из истории?')) {
      await deleteHistoryRecord(id)
      if (selectedPatient) loadHistory(selectedPatient.id)
    }
  }

  const [newPatient, setNewPatient] = useState<Omit<Patient, 'id' | 'lastVisit' | 'createdAt'>>({
    name: '',
    age: undefined,
    gender: 'male',
    diagnosis: '',
    notes: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    try {
      // 1. Проверяем наличие данных в IndexedDB
      let localPatients = await getAllPatients()
      
      // 2. Если IndexedDB пуста, проверяем localStorage (миграция)
      if (localPatients.length === 0) {
        const savedPatients = localStorage.getItem('medicalPatients')
        if (savedPatients) {
          console.log('🔄 Миграция данных из localStorage в IndexedDB...')
          const parsed = JSON.parse(savedPatients)
          for (const p of parsed) {
            await savePatient({
              ...p,
              createdAt: p.createdAt || p.lastVisit || new Date().toISOString()
            })
          }
          localPatients = await getAllPatients()
          // localStorage.removeItem('medicalPatients') // Опционально: удалить старые данные после миграции
        }
      }

      setPatients(localPatients)
      setFilteredPatients(localPatients)
    } catch (error) {
      console.error('Error loading patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePatient = async (patient: Patient) => {
    await savePatient(patient)
    loadPatients()
  }

  const addPatient = async () => {
    if (!newPatient.name.trim()) {
      alert('Введите имя пациента')
      return
    }

    const patient: Patient = {
      id: Date.now().toString(),
      ...newPatient,
      lastVisit: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    await handleSavePatient(patient)
    setShowAddModal(false)
    setNewPatient({
      name: '',
      age: undefined,
      gender: 'male',
      diagnosis: '',
      notes: '',
      phone: '',
      email: '',
    })
  }

  const updatePatient = async (updatedPatient: Patient) => {
    const patientWithVisit = { ...updatedPatient, lastVisit: new Date().toISOString() }
    await handleSavePatient(patientWithVisit)
    setSelectedPatient(null)
  }

  const handleDeletePatient = async (id: string) => {
    if (confirm('Вы уверены, что хотите удалить этого пациента?')) {
      await deletePatient(id)
      loadPatients()
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Пол</label>
                    <select
                      value={newPatient.gender || 'male'}
                      onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                      <option value="other">Другой</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Диагноз</label>
                    <VoiceInput onTranscript={(text) => setNewPatient({ ...newPatient, diagnosis: newPatient.diagnosis ? `${newPatient.diagnosis} ${text}` : text })} />
                  </div>
                  <input
                    type="text"
                    value={newPatient.diagnosis || ''}
                    onChange={(e) => setNewPatient({ ...newPatient, diagnosis: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Основной диагноз"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Заметки</label>
                    <VoiceInput onTranscript={(text) => setNewPatient({ ...newPatient, notes: newPatient.notes ? `${newPatient.notes} ${text}` : text })} />
                  </div>
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
                      gender: 'male',
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
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-900">👤 {selectedPatient.name}</h2>
              <div className="flex bg-white border rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'info' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Карта
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'history' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  📜 История ({history.length})
                </button>
                <button
                  onClick={() => setActiveTab('trends')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'trends' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  📈 Динамика
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'timeline' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  🕒 Таймлайн
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 flex-grow">
              {activeTab === 'info' ? (
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Пол</label>
                      <select
                        value={selectedPatient.gender || 'male'}
                        onChange={(e) => setSelectedPatient({ ...selectedPatient, gender: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        <option value="male">Мужской</option>
                        <option value="female">Женский</option>
                        <option value="other">Другой</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                      <input
                        type="tel"
                        value={selectedPatient.phone || ''}
                        onChange={(e) => setSelectedPatient({ ...selectedPatient, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
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
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Диагноз</label>
                      <VoiceInput onTranscript={(text) => setSelectedPatient({ ...selectedPatient, diagnosis: selectedPatient.diagnosis ? `${selectedPatient.diagnosis} ${text}` : text })} />
                    </div>
                    <input
                      type="text"
                      value={selectedPatient.diagnosis || ''}
                      onChange={(e) => setSelectedPatient({ ...selectedPatient, diagnosis: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Заметки</label>
                      <VoiceInput onTranscript={(text) => setSelectedPatient({ ...selectedPatient, notes: selectedPatient.notes ? `${selectedPatient.notes} ${text}` : text })} />
                    </div>
                    <textarea
                      value={selectedPatient.notes}
                      onChange={(e) => setSelectedPatient({ ...selectedPatient, notes: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">
                      <strong>Создан:</strong> {formatDate(selectedPatient.createdAt)} | 
                      <strong> Последнее изменение:</strong> {formatDate(selectedPatient.lastVisit)}
                    </p>
                  </div>
                </div>
              ) : activeTab === 'history' ? (
                <div className="space-y-4">
                  {loadingHistory ? (
                    <p className="text-center py-8 text-gray-500">Загрузка истории...</p>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <p className="text-gray-500">История анализов пуста</p>
                      <p className="text-xs text-gray-400 mt-1">Сохраняйте результаты из разделов «Анализ изображений» или «ЭКГ»</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {history.map((record) => (
                        <div key={record.id} className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow relative group">
                          <button
                            onClick={() => handleDeleteHistory(record.id)}
                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors p-1"
                            title="Удалить запись"
                          >
                            🗑️
                          </button>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              record.type === 'ecg' ? 'bg-red-100 text-red-700' : 
                              record.type === 'image' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {record.imageType || record.type}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(record.date)}
                            </span>
                          </div>
                          <div className="prose prose-sm max-w-none text-gray-800 line-clamp-6 overflow-hidden relative">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} className="[&_h1]:text-lg [&_h2]:text-base [&_p]:mb-2">
                              {record.conclusion}
                            </ReactMarkdown>
                            {record.conclusion.length > 300 && (
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"></div>
                            )}
                          </div>
                          {record.conclusion.length > 300 && (
                            <button 
                              onClick={() => {
                                // Можно добавить модалку для полного просмотра или просто разворачивание
                                alert(record.conclusion)
                              }}
                              className="text-xs text-primary-600 font-semibold mt-2 hover:underline"
                            >
                              Показать полностью
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'timeline' ? (
                <div className="space-y-0 relative">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-900">Лента событий пациента</h3>
                    {history.length > 0 && (
                      <button
                        onClick={handleGenerateSummary}
                        disabled={generatingSummary}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {generatingSummary ? (
                          <>⏳ Генерирую сводку...</>
                        ) : (
                          <>🧠 Сделать AI-сводку по случаю</>
                        )}
                      </button>
                    )}
                  </div>

                  {caseSummary && (
                    <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm relative animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        AI Case Summary
                      </div>
                      <div className="prose prose-sm max-w-none text-indigo-900 leading-relaxed italic">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{caseSummary}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {history.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <p className="text-gray-500">Событий пока нет</p>
                    </div>
                  ) : (
                    <div className="relative ml-4 border-l-2 border-primary-100 pl-8 pb-4 space-y-8">
                      {history.map((record, index) => (
                        <div key={record.id} className="relative">
                          {/* Точка на линии */}
                          <div className="absolute -left-[41px] top-1 w-6 h-6 rounded-full bg-white border-4 border-primary-400 z-10"></div>
                          
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary-600 mb-1">
                              {new Date(record.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => setActiveTab('history')}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">
                                  {record.type === 'ecg' ? '📈' : record.type === 'image' ? '🩻' : record.type === 'lab' ? '🔬' : '📝'}
                                </span>
                                <span className="font-bold text-sm text-gray-800 uppercase tracking-tight">
                                  {record.type === 'ecg' ? 'ЭКГ анализ' : 
                                   record.type === 'image' ? (record.imageType === 'xray' ? 'Рентген' : record.imageType === 'ct' ? 'КТ' : record.imageType === 'mri' ? 'МРТ' : 'Анализ снимка') : 
                                   record.type === 'lab' ? 'Лабораторный анализ' : 'Обследование'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2 italic">
                                {record.conclusion.replace(/[#*]/g, '').substring(0, 150)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Начало пути */}
                      <div className="relative">
                        <div className="absolute -left-[41px] top-1 w-6 h-6 rounded-full bg-gray-100 border-4 border-gray-300 z-10 flex items-center justify-center">
                          <span className="text-[10px] text-gray-500">👶</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-400 mb-1">
                            {new Date(selectedPatient.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <div className="text-xs text-gray-400 italic">Создание карты пациента</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="font-bold text-gray-900 mb-4">Динамика лабораторных показателей</h3>
                  {Object.keys(labTrends).length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <p className="text-gray-500">Нет данных для построения графиков</p>
                      <p className="text-xs text-gray-400 mt-1 italic">
                        Загружайте анализы в разделе «Лабораторные данные» для этого пациента.
                        <br />Система автоматически извлечет показатели (Гемоглобин, Глюкоза и др.)
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(labTrends).map(([label, data]) => (
                        <LabTrendChart 
                          key={label}
                          label={label}
                          data={data}
                          unit={data[0]?.unit || ''}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-lg flex justify-between items-center">
              <button
                onClick={() => handleDeletePatient(selectedPatient.id)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-semibold"
              >
                🗑️ Удалить пациента
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="px-6 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Закрыть
                </button>
                {activeTab === 'info' && (
                  <button
                    onClick={() => updatePatient(selectedPatient)}
                    className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm font-bold shadow-sm"
                  >
                    Сохранить изменения
                  </button>
                )}
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

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-600">Загрузка...</div>}>
      <PatientsContent />
    </Suspense>
  )
}
