export function formatInsufficientCreditsMessage(params: {
  available: number;
  required: number;
  guest?: boolean;
}): string {
  const available = Number.isFinite(params.available) ? params.available : 0;
  const required = Number.isFinite(params.required) ? params.required : 0;
  const headline = params.guest
    ? 'Пробный лимит исчерпан.'
    : 'Недостаточно единиц.';

  return `${headline} Доступно: ${available.toFixed(2)} ед., требуется: ${required.toFixed(2)} ед. Пополните пакет для продолжения.`;
}
