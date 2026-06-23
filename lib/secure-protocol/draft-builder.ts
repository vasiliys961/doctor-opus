/**
 * Построение локального черновика протокола из транскрипта разговора.
 *
 * Принцип: лёгкая модель (Gemini Flash) только СТРУКТУРИРУЕТ сказанное в разговоре
 * (жалобы, анамнез, препараты, аллергии, факторы риска). Диагноз, обследование
 * и лечение здесь НЕ формируются — это задача основного pipeline после того,
 * как врач допишет объективные данные.
 *
 * Текст обезличивается ДО отправки в модель (reuse lib/anonymization).
 */

import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { anonymizeText } from '@/lib/anonymization';
import type { DraftBuildResult, LocalClinicalDraft } from './types';
import { emptyDraft } from './types';

function buildDraftPrompt(redactedTranscript: string): string {
  return `Ты — медицинский ассистент, который структурирует расшифровку разговора врача и пациента.

ВХОДНЫЕ ДАННЫЕ — это уже ОБЕЗЛИЧЕННЫЙ транскрипт приёма (реплики врача и пациента вперемешку):
"""
${redactedTranscript}
"""

ЗАДАЧА: извлеки ТОЛЬКО то, что реально прозвучало в разговоре, и верни СТРОГО валидный JSON по схеме:
{
  "complaints": string[],          // жалобы пациента
  "anamnesisMorbi": string,        // анамнез заболевания (как развивалось)
  "anamnesisVitae": string,        // анамнез жизни (хронические болезни, операции, привычки)
  "currentMedications": string[],  // принимаемые сейчас препараты
  "allergies": string[],           // аллергии
  "riskFactors": string[],         // факторы риска (курение, наследственность и т.п.)
  "vitalSigns": string[],          // витальные показатели, ТОЛЬКО если прозвучали (АД, пульс, температура)
  "objective": string              // объективные признаки, прозвучавшие в речи врача (отёк, сыпь и т.п.)
}

СТРОГИЕ ПРАВИЛА:
1. НЕ придумывай факты. Если данных нет — пустая строка "" или пустой массив [].
2. НЕ ставь диагноз, НЕ назначай обследование и лечение. Этих полей в схеме нет — и не добавляй их.
3. В "objective" вноси только объективные признаки, которые реально прозвучали в беседе.
   Если объективных признаков в речи нет — пустая строка "".
4. Верни ТОЛЬКО JSON, без markdown, без пояснений, без текста до или после.
5. Язык значений — русский.`;
}

function parseDraftJson(raw: string): LocalClinicalDraft {
  const match = raw.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : raw;
  const parsed = JSON.parse(jsonStr);

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
  const asString = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  return {
    complaints: asStringArray(parsed.complaints),
    anamnesisMorbi: asString(parsed.anamnesisMorbi),
    anamnesisVitae: asString(parsed.anamnesisVitae),
    currentMedications: asStringArray(parsed.currentMedications),
    allergies: asStringArray(parsed.allergies),
    riskFactors: asStringArray(parsed.riskFactors),
    vitalSigns: asStringArray(parsed.vitalSigns),
    objective: asString(parsed.objective),
  };
}

/**
 * Обезличивает транскрипт и строит структурированный черновик через Gemini Flash.
 */
export async function buildLocalDraft(transcript: string): Promise<DraftBuildResult> {
  const redactedTranscript = anonymizeText(String(transcript ?? '')).trim();
  const model = MODELS.GEMINI_3_FLASH;

  if (!redactedTranscript) {
    return { draft: emptyDraft(), redactedTranscript, model };
  }

  const prompt = buildDraftPrompt(redactedTranscript);
  const raw = await sendTextRequest(prompt, [], model);

  let draft: LocalClinicalDraft;
  try {
    draft = parseDraftJson(raw);
  } catch {
    // Если модель вернула невалидный JSON — отдаём пустой черновик, не роняя запрос.
    draft = emptyDraft();
  }

  return { draft, redactedTranscript, model };
}
