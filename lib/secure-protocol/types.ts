/**
 * Типы для Secure Protocol Mode (параллельный модуль).
 *
 * Локальный черновик протокола ДО диагноза. Диагноз/обследование/лечение
 * формируются позже основным pipeline приложения, а не здесь.
 */

export interface LocalClinicalDraft {
  complaints: string[];
  anamnesisMorbi: string;
  anamnesisVitae: string;
  currentMedications: string[];
  allergies: string[];
  riskFactors: string[];
  vitalSigns: string[];
  /** Объективные признаки, явно проговоренные в беседе (без выдумывания). */
  objective: string;
}

export interface DraftBuildResult {
  draft: LocalClinicalDraft;
  /** Обезличенный текст, который реально ушёл в модель (для предпросмотра в UI). */
  redactedTranscript: string;
  model: string;
}

export function emptyDraft(): LocalClinicalDraft {
  return {
    complaints: [],
    anamnesisMorbi: '',
    anamnesisVitae: '',
    currentMedications: [],
    allergies: [],
    riskFactors: [],
    vitalSigns: [],
    objective: '',
  };
}
