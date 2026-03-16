'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function HomeAuthBadge() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="bg-white border border-slate-200 text-slate-500 px-4 py-2 rounded-xl text-sm font-medium shadow-sm">
        Проверка сессии...
      </div>
    )
  }

  if (!session) {
    return (
      <Link
        href="/auth/signin"
        className="bg-white border border-teal-600 text-teal-600 hover:bg-teal-50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
      >
        🔑 Войти / Регистрация
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3 bg-teal-50 px-4 py-2 rounded-xl border border-teal-100">
      <span className="text-xs text-teal-700">
        Вы вошли как: <strong>{session.user?.email}</strong>
      </span>
      <Link
        href="/chat"
        className="text-xs bg-teal-600 text-white px-2 py-1 rounded-md font-bold"
      >
        В чат
      </Link>
    </div>
  )
}
