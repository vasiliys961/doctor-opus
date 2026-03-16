const ANTHROPIC_GEO_ERROR_PATTERNS = [
  'access to anthropic models is not allowed',
  'unsupported countries',
  'unsupported countries, regions, or territories',
];

function normalizeErrorText(errorText: string): string {
  return String(errorText || '').toLowerCase();
}

export function isGeoRestrictionStatus(status: number): boolean {
  // OpenRouter может возвращать geo-ошибку как 400 (provider wrapped error),
  // поэтому учитываем и его, но только вместе со строгими geo-сигнатурами.
  return status === 400 || status === 403 || status === 451;
}

export function isAnthropicModel(model: string): boolean {
  const normalized = String(model || '').toLowerCase();
  return normalized.startsWith('anthropic/') || normalized.includes('claude');
}

export function isOpenAIGeoRestrictionError(errorText: string): boolean {
  const normalized = String(errorText || '').toLowerCase();
  return (
    normalized.includes('unsupported_country_region_territory') ||
    normalized.includes('country, region, or territory not supported')
  );
}

export function isAnthropicGeoRestrictionError(errorText: string): boolean {
  const normalized = normalizeErrorText(errorText);
  return ANTHROPIC_GEO_ERROR_PATTERNS.some(pattern => normalized.includes(pattern));
}

export function shouldUseStage2GeoFallback(primaryModel: string, status: number, errorText: string): boolean {
  if (isAnthropicModel(primaryModel)) {
    // Anthropic geo-блок в OpenRouter может приходить не только как 403/451,
    // поэтому опираемся на строгие сигнатуры ошибки.
    return isAnthropicGeoRestrictionError(errorText);
  }

  if (!isGeoRestrictionStatus(status)) {
    return false;
  }

  return isOpenAIGeoRestrictionError(errorText);
}
