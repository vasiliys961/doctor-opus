// Проверенное решение: fallback срабатывает ТОЛЬКО по строгим текстовым сигнатурам.
// НЕ фильтруем по HTTP-статусу — OpenRouter может вернуть geo-ошибку
// как 400, 403 или даже внутри 200-ответа. Статус ненадёжен.
// НЕ добавлять provider_name, названия моделей или общие слова.

export function isAnthropicModel(model: string): boolean {
  const normalized = String(model || '').toLowerCase();
  return normalized.startsWith('anthropic/') || normalized.includes('claude');
}

// Только эти два паттерна — больше ничего лишнего
export function isOpenAIGeoRestrictionError(errorText: string): boolean {
  const normalized = String(errorText || '').toLowerCase();
  return (
    normalized.includes('unsupported_country_region_territory') ||
    normalized.includes('country, region, or territory not supported')
  );
}

export function isAnthropicGeoRestrictionError(errorText: string): boolean {
  const normalized = String(errorText || '').toLowerCase();
  return (
    normalized.includes('access to anthropic models is not allowed') ||
    normalized.includes('unsupported countries') ||
    normalized.includes('unsupported countries, regions, or territories')
  );
}

// status принимается для совместимости с вызовами, но не используется для фильтрации
export function shouldUseStage2GeoFallback(primaryModel: string, status: number, errorText: string): boolean {
  if (isAnthropicModel(primaryModel)) {
    return isAnthropicGeoRestrictionError(errorText);
  }
  return isOpenAIGeoRestrictionError(errorText);
}

// Оставляем для обратной совместимости с вызовами в openrouter-files.ts
export function isGeoRestrictionStatus(_status: number): boolean {
  return true;
}
