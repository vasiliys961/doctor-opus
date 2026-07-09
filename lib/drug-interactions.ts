import { MODELS, sendTextRequest } from './openrouter';

export type InteractionSeverity = 'minor' | 'moderate' | 'major';

export interface DrugInteractionResult {
  pair: [string, string];
  severity: InteractionSeverity;
  mechanism: string;
  recommendation: string;
  explanation: string;
}

type InteractionRule = {
  a: string[];
  b: string[];
  severity: InteractionSeverity;
  mechanism: string;
  recommendation: string;
};

const RULES: InteractionRule[] = [
  {
    a: ['warfarin', 'варфарин'],
    b: ['ibuprofen', 'ибупрофен', 'diclofenac', 'диклофенак', 'ketorolac', 'кеторолак'],
    severity: 'major',
    mechanism: 'Фармакодинамический синергизм антикоагуляции/антиагрегации + повреждение слизистой ЖКТ',
    recommendation: 'Избегать сочетания; при необходимости — защита ЖКТ и усиленный контроль МНО/кровотечений.',
  },
  {
    a: ['warfarin', 'варфарин'],
    b: ['amiodarone', 'амиодарон', 'clarithromycin', 'кларитромицин', 'metronidazole', 'метронидазол'],
    severity: 'major',
    mechanism: 'Фармакокинетическое ингибирование метаболизма варфарина',
    recommendation: 'Корректировать дозу варфарина, частый контроль МНО.',
  },
  {
    a: ['enalapril', 'эналаприл', 'lisinopril', 'лизиноприл', 'losartan', 'лозартан'],
    b: ['spironolactone', 'спиронолактон', 'eplerenone', 'эплеренон'],
    severity: 'major',
    mechanism: 'Суммирование калийсберегающего эффекта',
    recommendation: 'Контроль K+/креатинина, осторожное титрование, оценка риска гиперкалиемии.',
  },
  {
    a: ['azithromycin', 'азитромицин', 'clarithromycin', 'кларитромицин', 'levofloxacin', 'левофлоксацин'],
    b: ['amiodarone', 'амиодарон', 'sotalol', 'соталол', 'haloperidol', 'галоперидол'],
    severity: 'major',
    mechanism: 'Аддитивное удлинение QT',
    recommendation: 'По возможности избегать; ЭКГ-контроль QTc, коррекция K+/Mg2+.',
  },
  {
    a: ['simvastatin', 'симвастатин', 'atorvastatin', 'аторвастатин'],
    b: ['clarithromycin', 'кларитромицин', 'erythromycin', 'эритромицин'],
    severity: 'major',
    mechanism: 'Ингибирование CYP3A4 и рост экспозиции статина',
    recommendation: 'Временно отменить/снизить дозу статина, мониторинг миопатии.',
  },
  {
    a: ['metformin', 'метформин'],
    b: ['contrast', 'контраст', 'йодсодержащий контраст'],
    severity: 'moderate',
    mechanism: 'Риск лактоацидоза при ухудшении функции почек после контраста',
    recommendation: 'Оценить eGFR; временно приостановить метформин по клиническим рекомендациям.',
  },
];

const DRUG_ALIASES: Record<string, string[]> = {
  warfarin: ['warfarin', 'варфарин'],
  ibuprofen: ['ibuprofen', 'ибупрофен', 'нурофен'],
  diclofenac: ['diclofenac', 'диклофенак', 'вольтарен'],
  enalapril: ['enalapril', 'эналаприл', 'ренитек'],
  lisinopril: ['lisinopril', 'лизиноприл', 'диротон'],
  losartan: ['losartan', 'лозартан'],
  spironolactone: ['spironolactone', 'спиронолактон', 'верошпирон'],
  eplerenone: ['eplerenone', 'эплеренон'],
  amiodarone: ['amiodarone', 'амиодарон', 'кордарон'],
  azithromycin: ['azithromycin', 'азитромицин', 'сумамед'],
  clarithromycin: ['clarithromycin', 'кларитромицин', 'клацид'],
  levofloxacin: ['levofloxacin', 'левофлоксацин'],
  simvastatin: ['simvastatin', 'симвастатин'],
  atorvastatin: ['atorvastatin', 'аторвастатин'],
  metformin: ['metformin', 'метформин', 'сиофор', 'глюкофаж'],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function extractCandidateMedicationLines(protocolText: string): string[] {
  return protocolText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      /(назнач|терап|лечени|rp\.|таб|капс|sol\.|ung\.|инъ|в\/м|в\/в|по\s+\d+|мг|mg|ml|мл)/i.test(line)
    )
    .slice(0, 80);
}

function detectMedicationTokens(text: string): string[] {
  const normalized = normalize(text);
  const found = new Set<string>();

  for (const [token, aliases] of Object.entries(DRUG_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(normalize(alias)))) {
      found.add(token);
    }
  }
  return Array.from(found);
}

function hasAnyAlias(text: string, aliases: string[]): boolean {
  const normalized = normalize(text);
  return aliases.some((alias) => normalized.includes(normalize(alias)));
}

function findLocalInteractions(protocolText: string): DrugInteractionResult[] {
  const lines = extractCandidateMedicationLines(protocolText);
  const fullText = lines.join('\n');
  const foundTokens = detectMedicationTokens(fullText);
  const foundText = `${fullText}\n${foundTokens.join('\n')}`;

  const results: DrugInteractionResult[] = [];
  for (const rule of RULES) {
    if (hasAnyAlias(foundText, rule.a) && hasAnyAlias(foundText, rule.b)) {
      const left = rule.a[0];
      const right = rule.b[0];
      results.push({
        pair: [left, right],
        severity: rule.severity,
        mechanism: rule.mechanism,
        recommendation: rule.recommendation,
        explanation: '',
      });
    }
  }

  return results.slice(0, 6);
}

async function enrichInteractionExplanations(
  interactions: DrugInteractionResult[],
  protocolText: string
): Promise<DrugInteractionResult[]> {
  if (interactions.length === 0) return interactions;

  const model = process.env.DRUG_INTERACTION_EXPLAINER_MODEL?.trim() || MODELS.GEMINI_3_FLASH;
  const systemPrompt = `Ты клинический фармаколог. Кратко объясни клиническую значимость лекарственных взаимодействий.
Верни строго JSON:
{
  "items": [
    { "pair": "drugA + drugB", "explanation": "..." }
  ]
}
Ограничения:
- 1-2 предложения на взаимодействие.
- Никаких новых лекарств, только пары из входа.
- Русский язык.`;

  const userPrompt = `Клинический контекст (фрагмент протокола):
${protocolText.slice(0, 2500)}

Пары взаимодействий:
${JSON.stringify(interactions.map((i) => ({ pair: `${i.pair[0]} + ${i.pair[1]}`, mechanism: i.mechanism })), null, 2)}`;

  try {
    const raw = await sendTextRequest(userPrompt, [], model, undefined, systemPrompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    const items: Array<{ pair?: string; explanation?: string }> = Array.isArray(parsed?.items) ? parsed.items : [];
    const byPair = new Map(items.map((i) => [normalize(String(i.pair || '')), String(i.explanation || '').trim()]));

    return interactions.map((item) => {
      const key = normalize(`${item.pair[0]} + ${item.pair[1]}`);
      const explanation = byPair.get(key) || `Риск: ${item.mechanism}.`;
      return { ...item, explanation };
    });
  } catch {
    return interactions.map((item) => ({
      ...item,
      explanation: `Риск: ${item.mechanism}.`,
    }));
  }
}

export function resolveDrugInteractionExplainerModel(): string {
  return process.env.DRUG_INTERACTION_EXPLAINER_MODEL?.trim() || MODELS.GEMINI_3_FLASH;
}

export async function buildDrugInteractions(protocolText: string): Promise<DrugInteractionResult[]> {
  const local = findLocalInteractions(protocolText);
  return enrichInteractionExplanations(local, protocolText);
}

export function renderDrugInteractionsMarkdown(interactions: DrugInteractionResult[]): string {
  const lines: string[] = ['### Drug Interaction Checker (MVP, локальный справочник)', ''];
  if (interactions.length === 0) {
    lines.push('- Клинически значимые взаимодействия из локального справочника не выявлены.');
    lines.push('- Важно: это MVP-покрытие; финальное решение принимает врач.');
    return lines.join('\n');
  }

  for (const item of interactions) {
    const severityRu = item.severity === 'major' ? 'высокий риск' : item.severity === 'moderate' ? 'умеренный риск' : 'низкий риск';
    lines.push(`- **${item.pair[0]} + ${item.pair[1]}** — ${severityRu}.`);
    lines.push(`  - Механизм: ${item.mechanism}`);
    lines.push(`  - Пояснение: ${item.explanation}`);
    lines.push(`  - Тактика: ${item.recommendation}`);
  }

  return lines.join('\n');
}

