/**
 * Пополнение баланса: фиксированный курс и минимальная сумма (настраивается через env).
 */
export const DEFAULT_CREDIT_PRICE_RUB = 2.5;
export const DEFAULT_MIN_TOPUP_RUB = 250;

export function getCreditPricing() {
  const creditPriceRub = Number(process.env.CREDIT_PRICE_RUB ?? DEFAULT_CREDIT_PRICE_RUB);
  const minTopupRub = Number(process.env.MIN_TOPUP_RUB ?? DEFAULT_MIN_TOPUP_RUB);
  return {
    creditPriceRub: Number.isFinite(creditPriceRub) && creditPriceRub > 0 ? creditPriceRub : DEFAULT_CREDIT_PRICE_RUB,
    minTopupRub: Number.isFinite(minTopupRub) && minTopupRub > 0 ? minTopupRub : DEFAULT_MIN_TOPUP_RUB,
  };
}

/** Идентификатор «пакета» в таблице payments для пополнений через Yagoda */
export const YAGODA_TOPUP_PACKAGE_ID = 'yagoda_topup';

/**
 * Копейки на единицу (2.5 ₽ → 250 коп.) для точного целочисленного деления.
 */
export function creditsFromAmountRub(amountRub: number): number {
  const { creditPriceRub } = getCreditPricing();
  const unitKop = Math.round(creditPriceRub * 100);
  const amountKop = Math.round(amountRub * 100);
  if (unitKop <= 0) return 0;
  return Math.floor(amountKop / unitKop);
}

export function validateTopupAmountRub(amountRub: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(amountRub)) {
    return { ok: false, error: 'Некорректная сумма' };
  }
  const { minTopupRub, creditPriceRub } = getCreditPricing();
  if (amountRub < minTopupRub) {
    return { ok: false, error: `Минимальная сумма пополнения ${minTopupRub} ₽` };
  }
  const units = creditsFromAmountRub(amountRub);
  if (units < 1) {
    return { ok: false, error: `Сумма слишком мала для начисления единиц при курсе ${creditPriceRub} ₽/ед.` };
  }
  return { ok: true };
}
