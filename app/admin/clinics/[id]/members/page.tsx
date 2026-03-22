'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

type ClinicMember = {
  id: number
  clinic_id: number
  user_id: number
  role: 'owner' | 'admin' | 'doctor'
  is_active: boolean
  created_at: string
  email: string
  name: string | null
}

const ROLE_OPTIONS: Array<{ id: ClinicMember['role']; label: string }> = [
  { id: 'owner', label: 'Владелец' },
  { id: 'admin', label: 'Админ клиники' },
  { id: 'doctor', label: 'Врач' },
]

export default function ClinicMembersPage() {
  const { data: session } = useSession()
  const params = useParams<{ id: string }>()
  const clinicId = useMemo(() => Number(params?.id || 0), [params?.id])
  const isAdmin = Boolean((session?.user as any)?.isAdmin)

  const [members, setMembers] = useState<ClinicMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ClinicMember['role']>('doctor')
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const loadMembers = async () => {
    if (!clinicId) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}/members`, {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Не удалось загрузить участников')
        return
      }
      setMembers(data.members || [])
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить участников')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && clinicId > 0) {
      void loadMembers()
    }
  }, [isAdmin, clinicId])

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || clinicId <= 0) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Не удалось добавить участника')
        return
      }
      setNotice(data.message || 'Изменения сохранены')
      setEmail('')
      setRole('doctor')
      await loadMembers()
    } catch (err: any) {
      setError(err.message || 'Не удалось добавить участника')
    } finally {
      setSaving(false)
    }
  }

  const updateMember = async (member: ClinicMember, updates: Partial<Pick<ClinicMember, 'role' | 'is_active'>>) => {
    setUpdatingId(member.id)
    setError('')
    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          memberId: member.id,
          ...updates,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Не удалось обновить участника')
        return
      }
      await loadMembers()
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить участника')
    } finally {
      setUpdatingId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-10 rounded-2xl shadow-lg max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Доступ ограничен</h2>
          <p className="text-slate-500 mb-6">Управление участниками клиники доступно только администратору платформы.</p>
          <Link href="/" className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition-all">
            На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg text-2xl">👥</span>
              Участники клиники #{clinicId}
            </h1>
            <p className="text-slate-500 mt-1 italic">
              Этап 2: роли и доступы (без включения клинических списаний).
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => void loadMembers()}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              🔄 Обновить
            </button>
            <Link
              href="/admin/clinics"
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              ← К списку клиник
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}
        {notice && !error && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl mb-6">
            {notice}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Добавить / назначить участника</h2>
          <form onSubmit={addMember} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email зарегистрированного пользователя"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ClinicMember['role'])}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Сохраняем...' : 'Добавить / обновить роль'}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-3">
            Если пользователя еще нет в системе, ему будет отправлено приглашение. Допускается один автоматический повтор приглашения.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Текущие участники</h2>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500">Загрузка...</div>
          ) : members.length === 0 ? (
            <div className="p-10 text-center text-slate-500">Участники пока не добавлены.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Пользователь</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Роль</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm text-slate-800">{member.name || 'Без имени'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{member.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={member.role}
                          onChange={(e) => void updateMember(member, { role: e.target.value as ClinicMember['role'] })}
                          disabled={updatingId === member.id}
                          className="px-2 py-1 border border-slate-200 rounded-md bg-white"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => void updateMember(member, { is_active: !member.is_active })}
                          disabled={updatingId === member.id}
                          className={`px-2 py-1 rounded-md text-xs font-bold ${
                            member.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {member.is_active ? 'Активен' : 'Отключен'}
                        </button>
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
