import { calculateCost } from './cost-calculator';

/** 1 единица = $0,01 прайса. При курсе Polza 120 ₽ за доллар это около 1,20 ₽ себестоимости. */
const UNITS_PER_USD = 100;

/** Сколько рублей Polza берёт за $1 прайса, если в ответе нет cost_rub. */
function rubPerUsd(): number {
  const configured = Number(process.env.POLZA_RUB_PER_USD || '120');
  return Number.isFinite(configured) && configured > 0 ? configured : 120;
}

/**
 * Рубли, которые Polza уже списала за этот ответ.
 * Поле cost_rub берём как есть. Голое cost принимаем за рубли только когда сумма
 * явно рублёвая: типичный ответ Opus стоит десятки рублей, а в долларах это доли доллара.
 */
export function readProviderCostRub(usage: unknown): number | null {
  if (!usage || typeof usage !== 'object') return null;
  const record = usage as Record<string, unknown>;
  const explicitRub = Number(record.cost_rub ?? record.provider_cost_rub ?? record.providerCostRub);
  if (Number.isFinite(explicitRub) && explicitRub > 0) return explicitRub;

  const cost = Number(record.cost);
  if (Number.isFinite(cost) && cost >= 5) return cost;
  return null;
}

/** Единицы врача из рублёвого счёта Polza: 33 ₽ → 27,5 единицы при курсе 120. */
export function unitsFromProviderRub(costRub: number): number {
  return Number(((costRub * UNITS_PER_USD) / rubPerUsd()).toFixed(2));
}

/** Запасной перевод прайса модели, когда провайдер не прислал рублёвый счёт. */
export function unitsFromUsd(costUsd: number): number {
  return Number((costUsd * UNITS_PER_USD).toFixed(2));
}

export function unitsFromTokens(promptTokens: number, completionTokens: number, model: string): number {
  return unitsFromUsd(calculateCost(promptTokens, completionTokens, model).totalCostUsd);
}

/**
 * Итоговые единицы за один или два этапа.
 * Если есть рублёвый счёт Polza, единицы = рубли / 1,20. Иначе — токены по прайсу, $0,01 = 1 единица.
 */
export function combinedProviderUnits(options: {
  stageUsage?: unknown;
  stageModel: string;
  stagePromptTokens: number;
  stageCompletionTokens: number;
  priorCostRub?: number;
  priorUnits?: number;
}): number {
  const stageRub = readProviderCostRub(options.stageUsage);
  const stageUnits = stageRub != null
    ? unitsFromProviderRub(stageRub)
    : unitsFromTokens(options.stagePromptTokens, options.stageCompletionTokens, options.stageModel);

  const priorRub = Number(options.priorCostRub) || 0;
  const priorUnits = priorRub > 0
    ? unitsFromProviderRub(priorRub)
    : (Number(options.priorUnits) || 0);

  return Number((stageUnits + priorUnits).toFixed(2));
}
