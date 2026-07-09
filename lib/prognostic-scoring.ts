export type PrognosticLevel = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';

export interface PrognosticScoreResult {
  key: 'CHA2DS2-VASc' | 'CURB-65' | 'SOFA' | 'APACHE II' | 'GRACE';
  score: number | null;
  level: PrognosticLevel;
  interpretation: string;
  missing: string[];
}

interface ParsedClinicalSignals {
  age: number | null;
  female: boolean | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  respiratoryRate: number | null;
  ureaMmolL: number | null;
  confusion: boolean | null;
  chf: boolean | null;
  hypertension: boolean | null;
  diabetes: boolean | null;
  strokeTia: boolean | null;
  vascularDisease: boolean | null;
}

function parseNumeric(text: string, regex: RegExp): number | null {
  const match = text.match(regex);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function extractClinicalSignals(rawText: string, protocolText: string): ParsedClinicalSignals {
  const text = `${rawText}\n${protocolText}`.toLowerCase();

  const age =
    parseNumeric(text, /\b(\d{1,3})\s*лет\b/) ??
    parseNumeric(text, /\bвозраст[:\s]+(\d{1,3})\b/);

  const systolic = parseNumeric(text, /\bад[:\s]+(\d{2,3})\s*[\/\\]\s*\d{2,3}\b/);
  const diastolic = parseNumeric(text, /\bад[:\s]+\d{2,3}\s*[\/\\]\s*(\d{2,3})\b/);
  const respiratoryRate =
    parseNumeric(text, /\bчдд[:\s]+(\d{1,2})\b/) ??
    parseNumeric(text, /\bдыхани[ея].{0,20}(\d{1,2})\s*в\s*мин/);
  const urea =
    parseNumeric(text, /\bмочевин[аы][^\d]{0,20}(\d+(?:[.,]\d+)?)\b/) ??
    parseNumeric(text, /\burea[^\d]{0,20}(\d+(?:[.,]\d+)?)\b/);

  const female =
    /\b(жен|female|f\b|женский пол)\b/.test(text)
      ? true
      : /\b(муж|male|m\b|мужской пол)\b/.test(text)
        ? false
        : null;

  const confusion =
    /\b(спутан|дезориент|нарушени[ея]\s+сознани|confusion)\b/.test(text)
      ? true
      : /\b(сознани[ея]\s+ясн|ориентирован|без\s+спутан)\b/.test(text)
        ? false
        : null;

  const chf = /\b(хсн|сердечн[а-я\s-]{0,20}недостаточ|chf)\b/.test(text) ? true : null;
  const hypertension =
    /\b(гипертенз|гипертони|аг\s*\d|arterial hypertension)\b/.test(text) ? true : null;
  const diabetes = /\b(сахарн[а-я\s-]{0,15}диабет|diabetes|dm2|dm1)\b/.test(text) ? true : null;
  const strokeTia = /\b(инсульт|tia|транзиторн[а-я\s-]{0,10}ишемическ)\b/.test(text) ? true : null;
  const vascularDisease =
    /\b(ибс|инфаркт|окклюз|атеросклер|периферическ[а-я\s-]{0,10}артер|vascular)\b/.test(text) ? true : null;

  return {
    age: age ?? null,
    female,
    systolicBp: systolic ?? null,
    diastolicBp: diastolic ?? null,
    respiratoryRate: respiratoryRate ?? null,
    ureaMmolL: urea ?? null,
    confusion,
    chf,
    hypertension,
    diabetes,
    strokeTia,
    vascularDisease,
  };
}

function scoreCha2Ds2Vasc(signals: ParsedClinicalSignals): PrognosticScoreResult {
  const missing: string[] = [];
  let score = 0;

  if (signals.age === null) missing.push('возраст');
  if (signals.female === null) missing.push('пол');
  if (signals.chf === null) missing.push('ХСН');
  if (signals.hypertension === null) missing.push('АГ');
  if (signals.diabetes === null) missing.push('СД');
  if (signals.strokeTia === null) missing.push('инсульт/ТИА');
  if (signals.vascularDisease === null) missing.push('сосудистые заболевания');

  if (signals.chf) score += 1;
  if (signals.hypertension) score += 1;
  if (signals.age !== null && signals.age >= 75) score += 2;
  else if (signals.age !== null && signals.age >= 65) score += 1;
  if (signals.diabetes) score += 1;
  if (signals.strokeTia) score += 2;
  if (signals.vascularDisease) score += 1;
  if (signals.female) score += 1;

  const level: PrognosticLevel =
    signals.age === null && missing.length > 4 ? 'unknown' : score <= 1 ? 'low' : score <= 3 ? 'moderate' : 'high';

  const interpretation =
    level === 'unknown'
      ? 'Недостаточно данных для надежной оценки риска.'
      : `Оценка риска тромбоэмболических событий: ${level === 'low' ? 'низкий' : level === 'moderate' ? 'умеренный' : 'высокий'}.`;

  return {
    key: 'CHA2DS2-VASc',
    score: level === 'unknown' ? null : score,
    level,
    interpretation,
    missing,
  };
}

function scoreCurb65(signals: ParsedClinicalSignals): PrognosticScoreResult {
  const missing: string[] = [];
  if (signals.age === null) missing.push('возраст');
  if (signals.confusion === null) missing.push('сознание');
  if (signals.ureaMmolL === null) missing.push('мочевина');
  if (signals.respiratoryRate === null) missing.push('ЧДД');
  if (signals.systolicBp === null || signals.diastolicBp === null) missing.push('АД');

  let score = 0;
  if (signals.confusion) score += 1;
  if (signals.ureaMmolL !== null && signals.ureaMmolL > 7) score += 1;
  if (signals.respiratoryRate !== null && signals.respiratoryRate >= 30) score += 1;
  if (
    (signals.systolicBp !== null && signals.systolicBp < 90) ||
    (signals.diastolicBp !== null && signals.diastolicBp <= 60)
  ) {
    score += 1;
  }
  if (signals.age !== null && signals.age >= 65) score += 1;

  const hasMinimal = signals.age !== null && signals.systolicBp !== null && signals.diastolicBp !== null;
  const level: PrognosticLevel = !hasMinimal
    ? 'unknown'
    : score <= 1
      ? 'low'
      : score === 2
        ? 'moderate'
        : score <= 3
          ? 'high'
          : 'critical';

  const interpretation =
    level === 'unknown'
      ? 'Недостаточно данных для CURB-65.'
      : `Риск неблагоприятного течения пневмонии: ${
          level === 'low'
            ? 'низкий'
            : level === 'moderate'
              ? 'умеренный'
              : level === 'high'
                ? 'высокий'
                : 'критический'
        }.`;

  return {
    key: 'CURB-65',
    score: level === 'unknown' ? null : score,
    level,
    interpretation,
    missing,
  };
}

function unknownScore(key: PrognosticScoreResult['key'], missing: string[], hint: string): PrognosticScoreResult {
  return {
    key,
    score: null,
    level: 'unknown',
    interpretation: hint,
    missing,
  };
}

export function computePrognosticScores(rawText: string, protocolText: string): PrognosticScoreResult[] {
  const signals = extractClinicalSignals(rawText, protocolText);

  return [
    scoreCha2Ds2Vasc(signals),
    scoreCurb65(signals),
    unknownScore(
      'SOFA',
      ['PaO2/FiO2', 'тромбоциты', 'билирубин', 'MAP/вазопрессоры', 'GCS', 'креатинин/диурез'],
      'Для SOFA требуется ICU-набор параметров; автоматический расчет пропущен из-за неполных данных.'
    ),
    unknownScore(
      'APACHE II',
      ['температура', 'MAP', 'ЧСС', 'ЧДД', 'pH/HCO3', 'Na/K', 'креатинин', 'Ht', 'WBC', 'GCS'],
      'Для APACHE II требуется расширенный набор физиологических параметров за 24 часа.'
    ),
    unknownScore(
      'GRACE',
      ['возраст', 'ЧСС', 'САД', 'креатинин', 'Killip', 'ST-deviation', 'остановка сердца', 'тропонин'],
      'Для GRACE нужны кардиоспецифические параметры (в т.ч. Killip/ST/troponin).'
    ),
  ];
}

export function renderPrognosticScoresMarkdown(scores: PrognosticScoreResult[]): string {
  const displayKey = (key: PrognosticScoreResult['key']): string => {
    if (key === 'CHA2DS2-VASc') return 'CHA₂DS₂-VASc';
    return key;
  };

  const lines: string[] = [
    '### Prognostic Scoring (авторасчет)',
    '',
    '_Расчет строится по наиболее часто встречающимся в протоколе клиническим факторам (возраст, АД, ЧДД, коморбидность и др.)._',
    '',
  ];

  for (const score of scores) {
    const scoreText = score.score === null ? 'н/д' : String(score.score);
    const levelRu =
      score.level === 'low'
        ? 'низкий'
        : score.level === 'moderate'
          ? 'умеренный'
          : score.level === 'high'
            ? 'высокий'
            : score.level === 'critical'
              ? 'критический'
              : 'недостаточно данных';
    lines.push(`- **${displayKey(score.key)}**: ${scoreText} (${levelRu}). ${score.interpretation}`);
    if (score.missing.length > 0) {
      lines.push(`  - Недостающие данные: ${score.missing.join(', ')}`);
    }
  }

  return lines.join('\n');
}

