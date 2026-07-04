/**
 * Сохранение audit trail консилиума в БД.
 */
import { sql } from '@/lib/database';
import { safeError } from '@/lib/logger';
import { DiagnosticResult } from './types';

export async function saveConsiliumAuditTrail(params: {
  patientId: string;
  caseId: string;
  doctorEmail: string;
  result: DiagnosticResult;
}): Promise<void> {
  const { patientId, caseId, doctorEmail, result } = params;

  try {
    await sql`
      INSERT INTO diagnostic_audit_trail (
        patient_id, case_id, doctor_id, rounds_completed,
        final_diagnosis, full_state, requires_human_review,
        review_reason, total_tokens_used, total_cost_usd
      ) VALUES (
        ${patientId}, ${caseId}, ${doctorEmail}, ${result.auditTrail.round + 1},
        ${JSON.stringify(result.finalDiagnosis)}, ${JSON.stringify(result.auditTrail)},
        ${result.requiresHumanReview}, ${result.reviewReason || null},
        ${result.totalTokensUsed}, ${result.totalCostUsd}
      )
    `;
  } catch (error) {
    // Не роняем ответ врачу из-за сбоя записи аудита — только логируем.
    safeError('[CONSILIUM] Не удалось сохранить audit trail:', error);
  }
}
