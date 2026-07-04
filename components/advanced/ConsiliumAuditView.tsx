'use client'

import { useState } from 'react'
import { DiagnosticResult, DiagnosticRoleId } from '@/lib/diagnostics/types'

const ROLE_LABELS: Record<DiagnosticRoleId, string> = {
  hypothesis: '🧩 Dr. Hypothesis',
  testChooser: '🔬 Dr. Test-Chooser',
  challenger: '⚔️ Dr. Challenger',
  stewardship: '💰 Dr. Stewardship',
  checklist: '✅ Dr. Checklist',
}

interface ConsiliumAuditViewProps {
  result: DiagnosticResult
}

export default function ConsiliumAuditView({ result }: ConsiliumAuditViewProps) {
  const [expandedRound, setExpandedRound] = useState<number | null>(result.auditTrail.roundOutputs.length - 1)
  const amscRound = result.auditTrail.amscRound
  const [amscExpanded, setAmscExpanded] = useState(!amscRound?.escalatedToDebate)

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 border border-primary-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="font-bold text-lg text-primary-900">🩺 Итог консилиума</h3>
        <span className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded border border-teal-100 font-bold w-fit">
          💰 {result.totalCostUsd.toFixed(3)} $ · {result.totalTokensUsed.toLocaleString('ru-RU')} токенов
        </span>
      </div>

      {result.requiresHumanReview && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-amber-900">
          <div className="font-bold text-sm mb-1">⚠️ Требуется очная оценка врача</div>
          <div className="text-xs">{result.reviewReason}</div>
        </div>
      )}

      <div className="mb-4 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3">
        <div className="text-xs font-semibold text-primary-700 mb-1">Итоговый диагноз-кандидат</div>
        <div className="font-bold text-primary-900">
          {result.finalDiagnosis.diagnosis}
          <span className="ml-2 text-xs font-normal text-primary-600">
            (вероятность {(result.finalDiagnosis.probability * 100).toFixed(0)}%)
          </span>
        </div>
        <div className="text-sm text-primary-800 mt-1 whitespace-pre-wrap">{result.finalDiagnosis.reasoning}</div>
      </div>

      <div className="mb-4 text-xs text-slate-600 flex items-center gap-2">
        <span className="font-semibold">Разногласие между агентами:</span>
        <span
          className={`px-2 py-0.5 rounded-full font-bold ${
            result.auditTrail.disagreementScore > 0.6
              ? 'bg-red-100 text-red-700'
              : result.auditTrail.disagreementScore > 0.34
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {result.auditTrail.disagreementScore.toFixed(2)}
        </span>
        <span>· раундов дебатов: {result.auditTrail.roundOutputs.length}</span>
      </div>

      {amscRound && (
        <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setAmscExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700"
          >
            <span>
              Раунд 0 — мнения специальностей ({amscRound.selectedSpecialties.length}){' '}
              <span
                className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  amscRound.escalatedToDebate ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {amscRound.escalatedToDebate ? 'эскалирован в дебаты' : 'без эскалации'}
              </span>
            </span>
            <span>{amscExpanded ? '▲' : '▼'}</span>
          </button>
          {amscExpanded && (
            <div className="p-4 space-y-3">
              {amscRound.opinions.map((opinion) => (
                <div key={opinion.specialty} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-800">🩺 {opinion.specialty}</span>
                    <span className="text-[10px] text-slate-400">
                      {opinion.model} · {opinion.promptTokens + opinion.completionTokens} ток.
                    </span>
                  </div>
                  {opinion.error ? (
                    <div className="text-xs text-red-600">❌ {opinion.error}</div>
                  ) : (
                    <div className="text-xs text-slate-600 whitespace-pre-wrap">{opinion.content}</div>
                  )}
                </div>
              ))}
              {amscRound.synthesisContent && (
                <div className="pt-1">
                  <div className="font-bold text-sm text-slate-800 mb-1">🤝 Синтез консенсуса</div>
                  <div className="text-xs text-slate-600 whitespace-pre-wrap">{amscRound.synthesisContent}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {result.auditTrail.roundOutputs.map((outputs, roundIdx) => (
          <div key={roundIdx} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedRound(expandedRound === roundIdx ? null : roundIdx)}
              className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700"
            >
              <span>Раунд {roundIdx + 1}</span>
              <span>{expandedRound === roundIdx ? '▲' : '▼'}</span>
            </button>
            {expandedRound === roundIdx && (
              <div className="p-4 space-y-3">
                {outputs.map((output) => (
                  <div key={output.role} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-800">{ROLE_LABELS[output.role]}</span>
                      <span className="text-[10px] text-slate-400">
                        {output.model} · {output.promptTokens + output.completionTokens} ток.
                      </span>
                    </div>
                    {output.error ? (
                      <div className="text-xs text-red-600">❌ {output.error}</div>
                    ) : (
                      <div className="text-xs text-slate-600 whitespace-pre-wrap">{output.content}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
