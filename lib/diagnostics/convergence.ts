/**
 * Расчёт степени разногласия между агентами и финализация диагноза консилиума.
 */
import { AMSC_ROUTER_MODEL } from './roles';
import { callDiagnosticAgent } from './llm-client';
import { Hypothesis } from './types';

export interface DisagreementUsage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface DisagreementResult {
  score: number;
  reasoning: string;
  usage: DisagreementUsage;
}

const ZERO_USAGE: DisagreementUsage = { promptTokens: 0, completionTokens: 0, costUsd: 0 };

function normalizeDiagnosisLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[.,;!?]+$/g, '');
}

function calculateExactDisagreementScore(normalizedDiagnoses: string[]): { score: number; reasoning: string } {
  const counts = new Map<string, number>();
  for (const diagnosis of normalizedDiagnoses) {
    counts.set(diagnosis, (counts.get(diagnosis) || 0) + 1);
  }
  const majorityCount = Math.max(...Array.from(counts.values()));
  const agreementRatio = majorityCount / normalizedDiagnoses.length;
  return {
    score: Number((1 - agreementRatio).toFixed(2)),
    reasoning: 'Точное строковое сравнение формулировок (семантическая кластеризация недоступна).',
  };
}

const SEMANTIC_CLUSTER_SYSTEM_PROMPT = `Ты помогаешь оценить, насколько согласны между собой врачи-специалисты.
Тебе дан пронумерованный список наиболее вероятных диагнозов, названных разными участниками
консилиума. Формулировки могут отличаться (синонимы, разная степень детализации, разный порядок
слов), но описывать ОДНО И ТО ЖЕ клиническое состояние — например "ОРВИ" и "Острый ринофарингит"
клинически эквивалентны и НЕ являются разногласием.
Сгруппируй номера диагнозов в кластеры так, чтобы в одном кластере оказались только диагнозы,
описывающие клинически одно и то же состояние (по сути, а не по дословному совпадению).
Ответь СТРОГО в формате JSON одной строкой, без markdown-обрамления:
{"clusters":[[1,3],[2]],"reasoning":"краткое пояснение группировки"}`;

function buildDiagnosesListPrompt(diagnoses: string[]): string {
  return diagnoses.map((d, i) => `${i + 1}. ${d}`).join('\n');
}

function parseClusterResponse(content: string, total: number): number[][] | null {
  const match = content.match(/\{\s*"clusters"\s*:\s*\[[\s\S]*?\]\s*(?:,[\s\S]*)?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.clusters)) return null;

    const seen = new Set<number>();
    const clusters: number[][] = [];
    for (const cluster of parsed.clusters) {
      if (!Array.isArray(cluster)) continue;
      const nums: number[] = cluster.filter(
        (n: any) => Number.isInteger(n) && n >= 1 && n <= total && !seen.has(n)
      );
      nums.forEach((n) => seen.add(n));
      if (nums.length > 0) clusters.push(nums);
    }
    // Диагнозы, не попавшие ни в один кластер (модель их пропустила), считаем
    // отдельными несовпадающими мнениями — так безопаснее для disagreement-метрики.
    for (let i = 1; i <= total; i += 1) {
      if (!seen.has(i)) clusters.push([i]);
    }
    return clusters.length > 0 ? clusters : null;
  } catch {
    return null;
  }
}

/**
 * Семантическая оценка расхождения топ-диагнозов набора мнений (специальностей
 * раунда 0 или ролей раунда дебатов). Точное строковое сравнение ложно считало
 * "ОРВИ" и "Острый ринофарингит" разными диагнозами — это приводило к лишним
 * дорогим эскалациям в дебаты на простых кейсах, где мнения по сути совпадали.
 *
 * Быстрый путь (без вызова LLM): если формулировки после нормализации совпали
 * дословно — расхождения нет, дополнительный вызов не нужен. LLM-кластеризация
 * (дешёвая модель раунда 0) вызывается только когда формулировки различаются.
 */
export async function calculateSemanticDisagreementScore(hypothesesSets: Hypothesis[][]): Promise<DisagreementResult> {
  const topDiagnoses = hypothesesSets
    .filter((set) => set.length > 0)
    .map((set) => [...set].sort((a, b) => b.probability - a.probability)[0].diagnosis);

  if (topDiagnoses.length <= 1) {
    return { score: 0, reasoning: '', usage: ZERO_USAGE };
  }

  const normalized = topDiagnoses.map(normalizeDiagnosisLabel);
  if (new Set(normalized).size === 1) {
    return { score: 0, reasoning: 'Точное совпадение формулировок диагноза.', usage: ZERO_USAGE };
  }

  const call = await callDiagnosticAgent({
    systemPrompt: SEMANTIC_CLUSTER_SYSTEM_PROMPT,
    userContent: buildDiagnosesListPrompt(topDiagnoses),
    model: AMSC_ROUTER_MODEL,
    maxTokens: 500,
  });

  const usage: DisagreementUsage = {
    promptTokens: call.promptTokens,
    completionTokens: call.completionTokens,
    costUsd: call.costUsd,
  };

  const clusters = call.error ? null : parseClusterResponse(call.content, topDiagnoses.length);
  if (clusters) {
    const largest = Math.max(...clusters.map((c) => c.length));
    const score = Number((1 - largest / topDiagnoses.length).toFixed(2));
    const reasoningMatch = call.content.match(/"reasoning"\s*:\s*"([^"]*)"/);
    return { score, reasoning: reasoningMatch?.[1] || '', usage };
  }

  // LLM недоступна или вернула неразбираемый ответ — безопасный фолбек на точное
  // сравнение, чтобы оркестратор никогда не падал из-за этого расчёта.
  return { ...calculateExactDisagreementScore(normalized), usage };
}

/**
 * Выбор финального диагноза-кандидата: приоритет отдаётся гипотезам
 * из финального раунда (Dr. Checklist), с fallback на Dr. Hypothesis.
 */
export function selectFinalDiagnosis(hypothesesSets: Hypothesis[][]): Hypothesis {
  for (const set of [...hypothesesSets].reverse()) {
    if (set.length > 0) {
      return [...set].sort((a, b) => b.probability - a.probability)[0];
    }
  }
  return {
    diagnosis: 'Не удалось сформировать итоговый диагноз автоматически',
    probability: 0,
    reasoning: 'Ни одна роль консилиума не вернула структурированные гипотезы. Требуется ручной разбор врачом.',
  };
}
