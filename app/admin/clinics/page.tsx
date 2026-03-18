'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

type Clinic = {
  id: number
  name: string
  inn: string | null
  contact_email: string | null
  status: string
  created_at: string
  balance: string
  total_spent: string
  members_count: number
}

export default function AdminClinicsPage() {
  const { data: session } = useSession()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [inn, setInn] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const isAdmin = Boolean((session?.user as any)?.isAdmin)

  const loadClinics = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/clinics')
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Не удалось загрузить клиники')
        return
      }
      setClinics(data.clinics || [])
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить клиники')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      void loadClinics()
    }
  }, [isAdmin])

  const createClinic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setCreating(true)
    setError('')
    try {
      const response = await fetch('/api/admin/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          inn: inn.trim(),
          contactEmail: contactEmail.trim(),
          ownerEmail: ownerEmail.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Не удалось создать клинику')
        return
      }
      setName('')
      setInn('')
      setContactEmail('')
      setOwnerEmail('')
      await loadClinics()
    } catch (err: any) {
      setError(err.message || 'Не удалось создать клинику')
    } finally {
      setCreating(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-10 rounded-2xl shadow-lg max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Доступ ограничен</h2>
          <p className="text-slate-500 mb-6">Раздел клиник доступен только администратору платформы.</p>
          <Link href="/" className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition-all">
            На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg text-2xl">🏥</span>
              Управление клиниками
            </h1>
            <p className="text-slate-500 mt-1 italic">
              Этап 1: реестр клиник и владельцев без включения B2B-списаний.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadClinics}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              🔄 Обновить
            </button>
            <Link
              href="/admin/payments"
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              ← В админ-платежи
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Добавить клинику</h2>
          <form onSubmit={createClinic} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название клиники *"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              required
            />
            <input
              value={inn}
              onChange={(e) => setInn(e.target.value)}
              placeholder="ИНН (опц.)"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Контактный email (опц.)"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <input
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="Email владельца (опц.)"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="md:col-span-2 lg:col-span-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Создаём...' : 'Создать клинику'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Реестр клиник</h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500">Загрузка...</div>
          ) : clinics.length === 0 ? (
            <div className="p-10 text-center text-slate-500">Клиники пока не добавлены.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клиника</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">ИНН</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Контакт</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Участники</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Баланс</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Потрачено</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Статус</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clinics.map((clinic) => (
                    <tr key={clinic.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{clinic.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{clinic.inn || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{clinic.contact_email || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{clinic.members_count}</td>
                      <td className="px-4 py-3 text-sm text-indigo-700 font-bold">{Number(clinic.balance || 0).toFixed(2)} ед.</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{Number(clinic.total_spent || 0).toFixed(2)} ед.</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-1 rounded-full font-bold uppercase ${clinic.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {clinic.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Link
                          href={`/admin/clinics/${clinic.id}/members`}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold"
                        >
                          Участники
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
