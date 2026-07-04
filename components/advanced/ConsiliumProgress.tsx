'use client'

import { DiagnosticRoleId } from '@/lib/diagnostics/types'

export interface ConsiliumProgressItem {
  round: number
  role: DiagnosticRoleId
  status: 'started' | 'done' | 'failed'
}

export interface ConsiliumSpecialtyItem {
  specialty: string
  status: 'started' | 'done' | 'failed'
}

const ROLE_LABELS: Record<DiagnosticRoleId, { icon: string; label: string }> = {
  hypothesis: { icon: '🧩', label: 'Dr. Hypothesis — генератор гипотез' },
  testChooser: { icon: '🔬', label: 'Dr. Test-Chooser — советчик по обследованиям' },
  challenger: { icon: '⚔️', label: 'Dr. Challenger — критик' },
  stewardship: { icon: '💰', label: 'Dr. Stewardship — контроль избыточности' },
  checklist: { icon: '✅', label: 'Dr. Checklist — финальная проверка' },
}

const ROLE_ORDER: DiagnosticRoleId[] = ['hypothesis', 'testChooser', 'challenger', 'stewardship', 'checklist']

interface ConsiliumProgressProps {
  stageMessage?: string
  items: ConsiliumProgressItem[]
  currentRound: number
  specialtyItems?: ConsiliumSpecialtyItem[]
  amscDecision?: { escalated: boolean; disagreementScore: number } | null
}

export default function ConsiliumProgress({
  stageMessage,
  items,
  currentRound,
  specialtyItems = [],
  amscDecision,
}: ConsiliumProgressProps) {
  const statusByRole = new Map<string, ConsiliumProgressItem['status']>()
  for (const item of items) {
    if (item.round === currentRound) {
      statusByRole.set(item.role, item.status)
    }
  }

  // Пока не пришло решение AMSC-раунда 0, полноценный цикл дебатов ещё не начат —
  // не показываем список ролей, чтобы не создавать впечатление зависшего процесса.
  const showDebateCycle = !!amscDecision?.escalated || currentRound > 0 || items.length > 0

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 border border-primary-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-primary-900 flex items-center gap-2">
          🩺 Консилиум в работе {currentRound > 0 && <span className="text-xs font-normal text-slate-500">(раунд {currentRound + 1})</span>}
        </h3>
      </div>

      {stageMessage && (
        <div className="mb-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {stageMessage}
        </div>
      )}

      {specialtyItems.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
            Раунд 0 — мнения специальностей
          </div>
          <div className="space-y-2">
            {specialtyItems.map((item) => (
              <div
                key={item.specialty}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  item.status === 'done'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : item.status === 'failed'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                }`}
              >
                <span className="text-lg">🩺</span>
                <span className="flex-1">{item.specialty}</span>
                <span className="text-xs font-bold uppercase tracking-tight">
                  {item.status === 'done' ? 'Готово' : item.status === 'failed' ? 'Ошибка' : 'Работает...'}
                </span>
              </div>
            ))}
          </div>

          {amscDecision && (
            <div
              className={`mt-2 text-xs rounded-lg px-3 py-2 border ${
                amscDecision.escalated
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {amscDecision.escalated
                ? `⚠️ Мнения специальностей разошлись (расхождение ${amscDecision.disagreementScore.toFixed(2)}) — запускаем полный цикл дебатов между ролями.`
                : `✅ Мнения специальностей совпали (расхождение ${amscDecision.disagreementScore.toFixed(2)}) — формируем консенсус без дебатов.`}
            </div>
          )}
        </div>
      )}

      {showDebateCycle && (
      <div className="space-y-2">
        {ROLE_ORDER.map((role) => {
          const status = statusByRole.get(role)
          const config = ROLE_LABELS[role]
          return (
            <div
              key={role}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-colors ${
                status === 'done'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : status === 'failed'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : status === 'started'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <span className="text-lg">{config.icon}</span>
              <span className="flex-1">{config.label}</span>
              <span className="text-xs font-bold uppercase tracking-tight">
                {status === 'done' ? 'Готово' : status === 'failed' ? 'Ошибка' : status === 'started' ? 'Работает...' : 'Ожидает'}
              </span>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
