const OPENAI_GEO_ERROR_PATTERNS = [
  'unsupported_country_region_territory',
  'country, region, or territory not supported',
];

const ANTHROPIC_GEO_ERROR_PATTERNS = [
  'access to anthropic models is not allowed',
  'unsupported countries',
  'unsupported countries, regions, or territories',
];

function normalizeErrorText(errorText: string): string {
  return String(errorText || '').toLowerCase();
}

export function isGeoRestrictionStatus(status: number): boolean {
  return status === 403 || status === 451;
}

export function isAnthropicModel(model: string): boolean {
  const normalized = String(model || '').toLowerCase();
  return normalized.startsWith('anthropic/') || normalized.includes('claude');
}

export function isOpenAIGeoRestrictionError(errorText: string): boolean {
  const normalized = normalizeErrorText(errorText);
  return OPENAI_GEO_ERROR_PATTERNS.some(pattern => normalized.includes(pattern));
}

export function isAnthropicGeoRestrictionError(errorText: string): boolean {
  const normalized = normalizeErrorText(errorText);
  return ANTHROPIC_GEO_ERROR_PATTERNS.some(pattern => normalized.includes(pattern));
}

export function shouldUseStage2GeoFallback(primaryModel: string, status: number, errorText: string): boolean {
  if (!isGeoRestrictionStatus(status)) {
    return false;
  }

  if (isAnthropicModel(primaryModel)) {
    return isAnthropicGeoRestrictionError(errorText);
  }

  return isOpenAIGeoRestrictionError(errorText);
}
