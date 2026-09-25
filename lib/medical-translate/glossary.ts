/**
 * Small, extendable vocabulary for the realtime medical translator.
 *
 * This is not a prompt and it is not sent to the speech model.
 * gpt-realtime-translate does not accept custom instructions.
 * The fidelity check uses these forms only to compare a finished
 * transcript with its translation.
 *
 * Add a form when a real conversation shows a gap. Keep each list short.
 */

export type GlossaryEntry = {
  id: string
  forms: readonly string[]
  /** Meanings a short form must not be expanded into without the source saying so. */
  expansions?: readonly string[]
  ambiguous?: boolean
}

export const MEDICAL_GLOSSARY = {
  drugs: [
    { id: 'metoprolol', forms: ['метопролол', 'metoprolol', '美托洛尔', 'メトプロロール'] },
    { id: 'penicillin', forms: ['пенициллин', 'penicil', '青霉素', 'ペニシリン'] },
    { id: 'aspirin', forms: ['аспирин', 'aspirin'] },
    { id: 'ibuprofen', forms: ['ибупрофен', 'ibuprofen'] },
    { id: 'paracetamol', forms: ['парацетамол', 'paracetamol', 'acetaminophen'] },
    { id: 'amoxicillin', forms: ['амоксициллин', 'amoxicillin'] },
    { id: 'warfarin', forms: ['варфарин', 'warfarin'] },
    { id: 'insulin', forms: ['инсулин', 'insulin'] },
    { id: 'lisinopril', forms: ['лизиноприл', 'lisinopril'] },
    { id: 'enalapril', forms: ['эналаприл', 'enalapril'] },
    { id: 'amlodipine', forms: ['амлодипин', 'amlodipine'] },
    { id: 'bisoprolol', forms: ['бисопролол', 'bisoprolol'] },
    { id: 'atorvastatin', forms: ['аторвастатин', 'atorvastatin'] },
    { id: 'clopidogrel', forms: ['клопидогрел', 'clopidogrel'] },
    { id: 'omeprazole', forms: ['омепразол', 'omeprazole'] },
    { id: 'losartan', forms: ['лозартан', 'losartan'] },
    { id: 'metformin', forms: ['метформин', 'metformin'] },
    { id: 'salbutamol', forms: ['сальбутамол', 'salbutamol', 'albuterol'] },
  ],
  terms: [
    { id: 'dyspnea', forms: ['одыш', 'dyspnea', 'shortness of breath', 'short of breath', 'disnea', 'dispneia', 'essoufflement', 'dyspnee', '呼吸困难', '呼吸困難', '息切れ'] },
    { id: 'edema', forms: ['отек', 'edema', 'oedeme', '水肿', '浮腫'] },
    { id: 'myocardial-infarction', forms: ['инфаркт', 'myocardial infarction', 'heart attack', 'infarto', 'infarctus', 'enfarte', '心肌梗死', '心肌梗塞', '心筋梗塞'] },
    { id: 'arrhythmia', forms: ['аритм', 'arrhythmia', 'фибрилляц', 'fibrillation', 'arritmi', 'arythmi', '心律失常', '不整脈'] },
    { id: 'anticoagulant', forms: ['антикоагулянт', 'anticoagulant', 'anticoagul', '抗凝'] },
    { id: 'hypertension', forms: ['гипертенз', 'hypertension', 'hipertens', '高血压', '高血圧'] },
    { id: 'hypotension', forms: ['гипотенз', 'hypotension', 'hipotens', '低血压', '低血圧'] },
    { id: 'glucose', forms: ['глюкоз', 'glucose', 'blood sugar', 'glucos', 'glicose', 'glicem', 'glycem', '血糖'] },
    { id: 'allergy', forms: ['аллерги', 'allerg', 'alergi', '过敏', 'アレルギー'] },
    { id: 'angina', forms: ['стенокард', 'angin', '心绞痛', '狭心症'] },
    { id: 'paresthesia', forms: ['парестез', 'paresthesia'] },
  ],
  abbreviations: [
    { id: 'bp', forms: ['bp', 'blood pressure', 'артериальное давление', 'давление'] },
    { id: 'hr', forms: ['hr', 'heart rate', 'чсс', 'пульс'] },
    { id: 'ecg', forms: ['ecg', 'ekg', 'экг', 'электрокардиограм'] },
    { id: 'ct', forms: ['ct', 'кт'] },
    { id: 'mri', forms: ['mri', 'мрт'] },
    { id: 'cbc', forms: ['cbc', 'оак'] },
    { id: 'hb', forms: ['hb', 'hgb', 'гемоглобин'] },
    { id: 'inr', forms: ['inr', 'мно'] },
    { id: 'spo2', forms: ['spo2', 'сатурац'] },
    { id: 'icu', forms: ['icu', 'орит'] },
    { id: 'er', forms: ['er', 'ed', 'приемн'] },
    { id: 'bid', forms: ['bid', 'twice a day', 'twice daily', 'два раза в день', 'dos veces al dia', 'deux fois par jour', 'duas vezes por dia', '每天两次', '一日两次', '1日2回'] },
    { id: 'tid', forms: ['tid', 'three times a day', 'три раза в день', 'tres veces al dia', 'trois fois par jour', '每天三次'] },
    { id: 'qid', forms: ['qid', 'four times a day', 'четыре раза в день'] },
    { id: 'prn', forms: ['prn', 'as needed', 'при необходимости', 'по необходимости', 'si es necesario', 'au besoin', 'se necessario', '必要时', '必要時'] },
    {
      id: 'ms',
      forms: ['ms'],
      expansions: ['multiple sclerosis', 'рассеянный склероз', 'morphine sulfate'],
      ambiguous: true,
    },
    {
      id: 'cp',
      forms: ['cp'],
      expansions: ['cerebral palsy', 'chest pain', 'детский церебральный'],
      ambiguous: true,
    },
  ] as GlossaryEntry[],
  anatomy: [
    { id: 'heart', forms: ['сердц', 'серце', 'heart', 'corazon', 'coeur', 'herz', 'cuore', '心脏', '心臓', '심장', 'हृदय', 'jantung', 'tim', 'قلب', 'kalp', 'serce'] },
    { id: 'lung', forms: ['легк', 'леген', 'lung', 'pulmones', 'el pulmon', 'poumon', 'lunge', 'polmone', '肺部', '肺', '폐', 'फेफड़', 'paru', 'phổi', 'رئة', 'akciğer', 'płuco'] },
    { id: 'arm', forms: ['рук', 'рука', 'arm', 'hand', 'brazo', 'le bras', 'au bras', 'braccio', '手臂', '腕', '팔', 'बांह', 'lengan', 'cánh tay', 'ذراع', 'kol', 'ramię'] },
    { id: 'pulmonary-artery', forms: ['легочной артери', 'pulmonary artery'] },
    { id: 'knee', forms: ['колен', 'колін', 'knee', 'rodilla', 'genou', 'knie', 'ginocchio', 'joelho', '膝盖', '膝', '무릎', 'घुटन', 'lutut', 'đầu gối', 'ركبة', 'diz', 'kolano'] },
    { id: 'shoulder', forms: ['плеч', 'shoulder', 'hombro', 'epaule', 'schulter', 'spalla', 'ombro', '肩膀', '肩', '어깨', 'कंध', 'bahu', 'bả vai', 'كتف', 'omuz', 'bark'] },
    { id: 'liver', forms: ['печен', 'печін', 'liver', 'higado', 'foie', 'leber', 'fegato', 'figado', '肝脏', '肝臓', '간', 'यकृत', 'hati', 'gan', 'كبد', 'karaciğer', 'wątroba'] },
    { id: 'kidney', forms: ['почк', 'нирк', 'kidney', 'rinon', 'reins', 'niere', 'i reni', 'rim', 'rins', '肾脏', '腎臓', '신장', 'गुर्द', 'ginjal', 'thận', 'كلية', 'böbrek', 'buah pinggang', 'nerka'] },
  ],
  laterality: [
    { id: 'left', forms: ['left', 'лево', 'левый', 'левая', 'левое', 'левой', 'левом', 'левую', 'izquierd', 'gauche', 'links', 'sinistra', 'sinistro', 'esquerd', '左侧', '左边', '左側', '左', '왼쪽', '좌측', 'बाईं', 'बायां', 'kiri', 'bên trái', 'أيسر', 'يسار', 'sol', 'ліви', 'ліво', 'lewy', 'lewa', 'lewe'] },
    { id: 'right', forms: ['right', 'право', 'правый', 'правая', 'правое', 'правой', 'правом', 'правую', 'derech', 'droit', 'rechts', 'destra', 'direit', '右侧', '右边', '右側', '右', '오른쪽', '우측', 'दाईं', 'दायां', 'kanan', 'bên phải', 'أيمن', 'يمين', 'sağ', 'правий', 'права', 'праве', 'prawy', 'prawa', 'prawe'] },
    { id: 'bilateral', forms: ['bilateral', 'both sides', 'двусторон', 'bilateral', 'bilatéral', 'beidseitig', 'bilaterale', '双侧', '両側', '양쪽', 'दोनों तरफ़', 'kedua sisi', 'hai bên', 'كلا الجانبين', 'iki taraf', 'двосторон', 'kedua-dua belah', 'obustron'] },
  ],
  routes: [
    { id: 'oral', forms: ['orally', 'by mouth', 'per os', 'внутрь', 'пероральн', 'via oral', 'por la boca', 'voie orale', 'durch den mund', 'per bocca', 'pela boca', '口服', '経口', '경구', 'मुंह से', 'diminum', 'đường uống', 'عن طريق الفم', 'ağızdan', 'перорально', 'melalui mulut', 'doustnie'] },
    { id: 'intravenous', forms: ['intravenously', 'intravenous', 'внутривенн', 'intravenos', 'intraveineus', 'endovenos', '静脉', '静脈', '정맥', 'नस में', 'intravena', 'tĩnh mạch', 'عن طريق الوريد', 'damardan', 'внутрішньовен', 'dożylnie'] },
    { id: 'intramuscular', forms: ['intramuscularly', 'intramuscular', 'внутримышечн', 'intramusculaire', 'intramuskulär', 'intramuscolare', '肌肉注射', '筋肉', '근육', 'मांसपेशी', 'suntikan otot', 'tiêm bắp', 'في العضل', 'kas içine', 'внутрішньомʼязов', 'domięśniow'] },
    { id: 'subcutaneous', forms: ['subcutaneously', 'subcutaneous', 'подкожн', 'subcutan', 'sous-cutan', 'sottocutan', 'subkutan', '皮下', '피하', 'bawah kulit', 'تحت الجلد', 'deri altına', 'підшкірн', 'podskórn'] },
    { id: 'topical', forms: ['topically', 'topical', 'местно', 'наружно', 'topica', 'topique', 'äußerlich', '外用', '외용', 'oleskan', 'bôi ngoài', 'موضعي', 'haricen', 'зовнішньо', 'miejscowo'] },
  ],
  units: [
    { id: 'mcg', forms: ['мкг', 'mcg', 'ug', '微克', 'マイクログラム'] },
    { id: 'mg', forms: ['мг', 'mg', '毫克', 'ミリグラム'] },
    { id: 'g', forms: ['г', 'g', '克'] },
    { id: 'ml', forms: ['мл', 'ml', '毫升', 'ミリリットル'] },
    { id: 'iu', forms: ['ме', 'iu'] },
    {
      id: 'mmol_l',
      forms: ['ммоль/л', 'mmol/l', 'ммоль на литр', 'mmol per liter', 'mmol per litre'],
    },
    { id: 'mg_dl', forms: ['мг/дл', 'mg/dl'] },
    { id: 'bpm', forms: ['bpm', 'уд/мин', 'ударов в минуту'] },
    { id: 'mmhg', forms: ['mmhg', 'мм рт. ст.', 'мм рт.ст.'] },
    { id: 'celsius', forms: ['celsius', 'градус', 'grados', 'degres', 'graus', '度'] },
  ],
  phrases: [
    { id: 'pulmonary-embolism', forms: ['тромбоэмбол', 'pulmonary embolism', 'embolia pulmonar', 'embolie pulmonaire', '肺栓塞', '肺塞栓'] },
  ],
} as const satisfies Record<string, readonly GlossaryEntry[]>

export type GlossaryCategory = keyof typeof MEDICAL_GLOSSARY

const DIAGNOSIS_IDS = new Set([
  'angina',
  'hypertension',
  'hypotension',
  'arrhythmia',
  'paresthesia',
  'myocardial-infarction',
  'pulmonary-embolism',
])

export function diagnosisEntries(): readonly GlossaryEntry[] {
  return [...MEDICAL_GLOSSARY.terms, ...MEDICAL_GLOSSARY.phrases].filter((entry) => DIAGNOSIS_IDS.has(entry.id))
}

export function isCjkText(value: string): boolean {
  return /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(value)
}

export function normalizeMedicalText(text: string): string {
  return text
    .replace(/℃/g, ' celsius ')
    .replace(/°\s*c\b/gi, ' celsius ')
    .replace(/mm\s*hg/gi, 'mmhg')
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/œ/gi, 'oe')
    .replace(/\b([dlnj])['’]/gi, '$1 ')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c')
    .replace(/ß/g, 'ss')
    .replace(/₂/g, '2')
    .replace(/μ/g, 'u')
    .replace(/[’']/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formPattern(form: string): string {
  const needle = normalizeMedicalText(form).trim()
  if (isCjkText(needle)) return escapeRegExp(needle)
  const parts = needle.split(/\s+/).map(escapeRegExp)
  const body = parts.join('\\s+')
  const lastIsShort = parts[parts.length - 1].length <= 3 && parts.length === 1
  const inflected = lastIsShort ? body : `${body}[\\p{L}\\p{N}]*`
  return `(?:^|[^\\p{L}\\p{N}])${inflected}(?=$|[^\\p{L}\\p{N}])`
}

/** True when a glossary form appears, including a Russian inflection of a single word. */
export function textHasForm(text: string, form: string): boolean {
  const needle = normalizeMedicalText(form).trim()
  if (!needle) return false
  return new RegExp(formPattern(form), 'iu').test(normalizeMedicalText(text))
}

export function entryAppears(text: string, forms: readonly string[]): boolean {
  return forms.some((form) => textHasForm(text, form))
}

export function formSpans(text: string, form: string): Array<{ start: number; end: number }> {
  const hay = normalizeMedicalText(text)
  const needle = normalizeMedicalText(form).trim().split(/\s+/)[0] ?? ''
  const spans: Array<{ start: number; end: number }> = []
  for (const match of hay.matchAll(new RegExp(formPattern(form), 'giu'))) {
    const rawStart = match.index ?? 0
    const local = needle ? match[0].indexOf(needle) : 0
    const start = rawStart + (local >= 0 ? local : 0)
    spans.push({ start, end: rawStart + match[0].length })
  }
  return spans
}
