const OPUS_47 = 'anthropic/claude-opus-4.7';
const OPUS_48 = 'anthropic/claude-opus-4.8';
const OPUS_5 = 'anthropic/claude-opus-5';

function normalizeModelAlias(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';

  if (value === '4.7' || value === 'opus-4.7' || value === 'claude-opus-4.7' || value === OPUS_47) {
    return OPUS_47;
  }
  if (value === '4.8' || value === 'opus-4.8' || value === 'claude-opus-4.8' || value === OPUS_48) {
    return OPUS_48;
  }
  if (value === '5' || value === '5.0' || value === 'opus-5' || value === 'claude-opus-5' || value === OPUS_5) {
    return OPUS_5;
  }

  return '';
}

/**
 * Валидационная модель Opus:
 * - по умолчанию: 5
 * - быстрый откат: VALIDATED_OPUS_MODEL=4.7
 */
export function getValidatedOpusModel(): string {
  const envModel = normalizeModelAlias(String(process.env.VALIDATED_OPUS_MODEL || ''));
  return envModel || OPUS_5;
}

