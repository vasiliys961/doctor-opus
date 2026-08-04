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

type LlmDetectedInteraction = {
  drugA?: string;
  drugB?: string;
  severity?: string;
  mechanism?: string;
  recommendation?: string;
};

const RULES: InteractionRule[] = [
  {
    a: ['warfarin', 'варфарин'],
    b: ['ibuprofen', 'ибупрофен', 'diclofenac', 'диклофенак', 'ketorolac', 'кеторолак'],
    severity: 'major',
    mechanism: 'Additive anticoagulant/platelet effects and GI mucosal injury increase bleeding risk.',
    recommendation: 'Avoid when possible; if required, monitor INR and bleeding signs and consider GI protection.',
  },
  {
    a: ['warfarin', 'варфарин'],
    b: ['amiodarone', 'амиодарон', 'clarithromycin', 'кларитромицин', 'metronidazole', 'метронидазол'],
    severity: 'major',
    mechanism: 'Metabolic inhibition can increase warfarin exposure.',
    recommendation: 'Adjust warfarin dose and monitor INR more frequently.',
  },
  {
    a: ['enalapril', 'эналаприл', 'lisinopril', 'лизиноприл', 'losartan', 'лозартан'],
    b: ['spironolactone', 'спиронолактон', 'eplerenone', 'эплеренон'],
    severity: 'major',
    mechanism: 'Combined potassium-retaining effects increase hyperkalemia risk.',
    recommendation: 'Monitor potassium/creatinine and titrate carefully.',
  },
  {
    a: ['azithromycin', 'азитромицин', 'clarithromycin', 'кларитромицин', 'levofloxacin', 'левофлоксацин'],
    b: ['amiodarone', 'амиодарон', 'sotalol', 'соталол', 'haloperidol', 'галоперидол'],
    severity: 'major',
    mechanism: 'Additive QT prolongation risk.',
    recommendation: 'Avoid if possible; monitor ECG/QTc and correct K+/Mg2+.',
  },
  {
    a: ['simvastatin', 'симвастатин', 'atorvastatin', 'аторвастатин'],
    b: ['clarithromycin', 'кларитромицин', 'erythromycin', 'эритромицин'],
    severity: 'major',
    mechanism: 'CYP3A4 inhibition may increase statin exposure and myopathy risk.',
    recommendation: 'Temporarily hold or reduce statin dose and monitor for muscle toxicity.',
  },
  {
    a: ['metformin', 'метформин'],
    b: ['contrast', 'контраст', 'йодсодержащий контраст'],
    severity: 'moderate',
    mechanism: 'Renal function decline after contrast may increase lactic acidosis risk.',
    recommendation: 'Check eGFR and temporarily hold metformin according to local protocol.',
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
      /(prescrib|medicat|treat|therapy|rp\.|tab|caps|sol\.|inj|iv|im|dose|mg|ml|назнач|терап|лечени|таб|капс|инъ|в\/м|в\/в|мг|мл)/i.test(line)
    )
    .slice(0, 100);
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
      results.push({
        pair: [rule.a[0], rule.b[0]],
        severity: rule.severity,
        mechanism: rule.mechanism,
        recommendation: rule.recommendation,
        explanation: '',
      });
    }
  }
  return results.slice(0, 6);
}

function normalizeSeverity(value: unknown): InteractionSeverity {
  const severity = String(value || '').toLowerCase();
  if (severity === 'major' || severity.includes('high') || severity.includes('высок')) return 'major';
  if (severity === 'moderate' || severity.includes('medium') || severity.includes('умерен')) return 'moderate';
  return 'minor';
}

function dedupeInteractions(items: DrugInteractionResult[]): DrugInteractionResult[] {
  const map = new Map<string, DrugInteractionResult>();
  for (const item of items) {
    const [a, b] = item.pair;
    const key = [normalize(a), normalize(b)].sort().join('|');
    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }

    const existing = map.get(key)!;
    const rank = { minor: 1, moderate: 2, major: 3 };
    if (rank[item.severity] > rank[existing.severity]) {
      map.set(key, item);
    }
  }
  return Array.from(map.values()).slice(0, 8);
}

export function resolveDrugInteractionDetectorModel(): string {
  return process.env.DRUG_INTERACTION_DETECTOR_MODEL?.trim() || MODELS.GEMINI_3_FLASH;
}

async function detectInteractionsWithLlm(protocolText: string): Promise<DrugInteractionResult[]> {
  const model = resolveDrugInteractionDetectorModel();
  const systemPrompt = `You are a clinical pharmacology assistant.
Find clinically significant medication interactions only among drugs explicitly mentioned in the input text.
Return strictly valid JSON:
{
  "items": [
    {
      "drugA": "name 1",
      "drugB": "name 2",
      "severity": "major|moderate|minor",
      "mechanism": "short mechanism",
      "recommendation": "short action"
    }
  ]
}
If no interactions are found, return {"items":[]}.
Do not invent drugs that are not present in the input.`;

  const userPrompt = `Protocol text:
${protocolText.slice(0, 6000)}`;

  try {
    const raw = await sendTextRequest(userPrompt, [], model, undefined, systemPrompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    const items: LlmDetectedInteraction[] = Array.isArray(parsed?.items) ? parsed.items : [];

    const normalizedItems: DrugInteractionResult[] = items
      .map((item) => {
        const drugA = String(item?.drugA || '').trim();
        const drugB = String(item?.drugB || '').trim();
        if (!drugA || !drugB) return null;
        return {
          pair: [drugA, drugB],
          severity: normalizeSeverity(item?.severity),
          mechanism: String(item?.mechanism || '').trim() || 'Potentially significant pharmacologic interaction.',
          recommendation: String(item?.recommendation || '').trim() || 'Review this combination and adjust therapy if needed.',
          explanation: '',
        } as DrugInteractionResult;
      })
      .filter(Boolean) as DrugInteractionResult[];

    return dedupeInteractions(normalizedItems);
  } catch {
    return [];
  }
}

async function enrichInteractionExplanations(
  interactions: DrugInteractionResult[],
  protocolText: string
): Promise<DrugInteractionResult[]> {
  if (interactions.length === 0) return interactions;

  const model = process.env.DRUG_INTERACTION_EXPLAINER_MODEL?.trim() || MODELS.GEMINI_3_FLASH;
  const systemPrompt = `You are a clinical pharmacology assistant.
Return strictly valid JSON:
{
  "items": [
    { "pair": "drugA + drugB", "explanation": "..." }
  ]
}
Rules:
- 1-2 concise sentences per pair.
- Use only pairs provided in input.
- Keep language consistent with the protocol text language.`;

  const userPrompt = `Protocol excerpt:
${protocolText.slice(0, 2500)}

Interaction pairs:
${JSON.stringify(interactions.map((i) => ({ pair: `${i.pair[0]} + ${i.pair[1]}`, mechanism: i.mechanism })), null, 2)}`;

  try {
    const raw = await sendTextRequest(userPrompt, [], model, undefined, systemPrompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    const items: Array<{ pair?: string; explanation?: string }> = Array.isArray(parsed?.items) ? parsed.items : [];
    const byPair = new Map(items.map((i) => [normalize(String(i.pair || '')), String(i.explanation || '').trim()]));

    return interactions.map((item) => {
      const key = normalize(`${item.pair[0]} + ${item.pair[1]}`);
      const explanation = byPair.get(key) || `Risk signal: ${item.mechanism}`;
      return { ...item, explanation };
    });
  } catch {
    return interactions.map((item) => ({
      ...item,
      explanation: `Risk signal: ${item.mechanism}`,
    }));
  }
}

export function resolveDrugInteractionExplainerModel(): string {
  return process.env.DRUG_INTERACTION_EXPLAINER_MODEL?.trim() || MODELS.GEMINI_3_FLASH;
}

export async function buildDrugInteractions(protocolText: string): Promise<DrugInteractionResult[]> {
  const local = findLocalInteractions(protocolText);
  const llmOnly = await detectInteractionsWithLlm(protocolText);
  const merged = dedupeInteractions([...local, ...llmOnly]);
  return enrichInteractionExplanations(merged, protocolText);
}
