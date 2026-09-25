/**
 * Compares one spoken utterance with the realtime translation.
 *
 * It does not translate, rewrite, or call a model. The speech session is
 * unchanged. A mismatch becomes a warning; the original wording stays.
 */

import {
  MEDICAL_GLOSSARY,
  diagnosisEntries,
  entryAppears,
  formSpans,
  isCjkText,
  normalizeMedicalText,
  textHasForm,
  type GlossaryEntry,
} from './glossary'

export type FidelityCode =
  | 'number'
  | 'unit'
  | 'negation'
  | 'drug'
  | 'frequency'
  | 'duration'
  | 'uncertainty'
  | 'term'
  | 'diagnosis'
  | 'abbreviation'
  | 'laterality'
  | 'route'
  | 'anatomy'
  | 'relation'

export type FidelityFinding = {
  severity: 'critical' | 'important'
  code: FidelityCode
  detail: string
  /** Short span taken from the source utterance. Omitted when the match is not unique. */
  sourceFragment?: string
  /** Short span taken from the translation. Omitted when the match is not unique. */
  translationFragment?: string
}

export type MedicalFidelityReport = {
  findings: FidelityFinding[]
}

export type MedicalFidelityInput = {
  source: string
  translation: string
  priorSources?: readonly string[]
}

type Quantity = {
  value: string
  unit: string
  surface: string
}

const NUMBER_WORDS: Record<string, string> = {
  один: '1',
  одна: '1',
  одно: '1',
  одного: '1',
  одной: '1',
  one: '1',
  два: '2',
  две: '2',
  двух: '2',
  two: '2',
  twice: '2',
  три: '3',
  трёх: '3',
  трех: '3',
  three: '3',
  thrice: '3',
  четыре: '4',
  четырёх: '4',
  четырех: '4',
  four: '4',
  пять: '5',
  пяти: '5',
  five: '5',
  шесть: '6',
  шести: '6',
  six: '6',
  семь: '7',
  семи: '7',
  seven: '7',
  восемь: '8',
  восьми: '8',
  eight: '8',
  девять: '9',
  девяти: '9',
  nine: '9',
  десять: '10',
  десяти: '10',
  ten: '10',
  одиннадцать: '11',
  eleven: '11',
  двенадцать: '12',
  twelve: '12',
  uno: '1',
  una: '1',
  un: '1',
  une: '1',
  uma: '1',
  dos: '2',
  deux: '2',
  dois: '2',
  duas: '2',
  tres: '3',
  trois: '3',
  cuatro: '4',
  quatre: '4',
  cinco: '5',
  cinq: '5',
  seis: '6',
  siete: '7',
  sept: '7',
  oito: '8',
  huit: '8',
  nueve: '9',
  neuf: '9',
  diez: '10',
  dix: '10',
  dez: '10',
  once: '11',
  onze: '11',
  doce: '12',
  douze: '12',
}

const UNCERTAINTY_MARKERS = [
  'не уверен',
  'не уверена',
  'not sure',
  'i suspect',
  'i think',
  'возможно',
  'вероятно',
  'кажется',
  'подозреваю',
  'думаю',
  'possibly',
  'probably',
  'perhaps',
  'sometimes',
  'maybe',
  'seems',
  'seem',
  'often',
  'rarely',
  'may be',
  'may have',
  'might',
  'иногда',
  'часто',
  'редко',
  'es posible',
  'posible',
  'posiblemente',
  'il est possible',
  'peut-etre',
  'possivelmente',
  'possivel',
  'talvez',
  '可能',
  '也许',
  '大约',
  '大概',
  'かもしれません',
  'かもしれない',
  'おそらく',
]

const NEGATION_CUES = [
  'никогда не было',
  'никогда не',
  'не было',
  'n ai jamais',
  'n a jamais',
  'n ai pas',
  'n a pas',
  'nunca he tenido',
  'nunca tive',
  '从来没有',
  'ではありません',
  'ではない',
  'no history of',
  'have never',
  'has never',
  'never had',
  'did not',
  'does not',
  'do not',
  'have not',
  'has not',
  'had not',
  'отрицает',
  'отсутствует',
  'никогда',
  'denies',
  'denied',
  'without',
  'never',
  'none',
  'not',
  'no',
  'без',
  'не',
  'нет',
  'nunca',
  'jamas',
  'jamais',
  'ninguna',
  'nenhuma',
  'nenhum',
  'sans',
  'sem',
  'nao',
  'aucune',
  'aucun',
  'niega',
  'nega',
  '没有',
  '从未',
  '从不',
  'ありません',
  'なかった',
  'ません',
  'ない',
]

const QUANTITY_ABBREVIATIONS = new Set(['bid', 'tid', 'qid', 'prn', 'bp', 'hr'])

const DURATION_UNITS: Array<{ unit: string; pattern: string }> = [
  { unit: 'minute', pattern: 'минут(?:а|ы|у|е)?|minutes?|mins?|minutos?' },
  { unit: 'hour', pattern: 'час(?:а|ов)?|hours?|horas?|heures?' },
  { unit: 'day', pattern: 'день|дня|дней|сутки|суток|days?|dias?|jours?' },
  { unit: 'week', pattern: 'недел(?:ь|я|и|ю|ей)?|weeks?|semanas?|semaines?' },
  { unit: 'month', pattern: 'месяц(?:а|ев)?|months?|mes(?:es)?|mois' },
  { unit: 'year', pattern: 'лет|год(?:а|ов)?|years?|anos?|ans?|annees?' },
]

function canonNumber(token: string): string {
  const word = NUMBER_WORDS[normalizeMedicalText(token)]
  if (word) return word
  const parsed = Number(token)
  if (!Number.isFinite(parsed)) return ''
  const rounded = Math.round(parsed * 1000) / 1000
  return String(rounded)
}

const CJK_DIGIT_VALUE: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

function canonCjkNumber(token: string): string {
  const digits = normalizeMedicalText(token)
  if (/^\d+(?:\.\d+)?$/.test(digits)) return canonNumber(digits)
  if (digits === '十') return '10'
  if (digits.startsWith('十') && digits.length === 2) {
    const ones = CJK_DIGIT_VALUE[digits[1]]
    if (ones) return String(10 + ones)
  }
  if (digits.endsWith('十') && digits.length === 2) {
    const tens = CJK_DIGIT_VALUE[digits[0]]
    if (tens) return String(tens * 10)
  }
  if (CJK_DIGIT_VALUE[digits]) return String(CJK_DIGIT_VALUE[digits])
  return canonNumber(digits)
}

function numberSource(): string {
  const words = Object.keys(NUMBER_WORDS).sort((left, right) => right.length - left.length)
  return `(?:${words.join('|')}|\\d+(?:\\.\\d+)?)`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function unitAlternative(form: string): string {
  const parts = normalizeMedicalText(form).trim().split(/\s+/).map(escapeRegExp)
  const body = parts.join('\\s+')
  if (isCjkText(body)) return body
  if (parts.length === 1 && parts[0].length <= 2) {
    return `(?<![A-Za-z])${body}(?![A-Za-z])`
  }
  return body
}

function measurementText(raw: string): string {
  return normalizeMedicalText(raw).replace(/(\d),(\d)/g, '$1.$2')
}

function unitsCompatible(source: string, target: string): boolean {
  if (source === target) return true
  if (source === 'number') return true
  if (source === 'celsius' && target === 'number') return true
  if ((source === 'bp' && target === 'mmhg') || (source === 'mmhg' && target === 'bp')) return true
  if ((source === 'per_day' && target === 'times') || (source === 'times' && target === 'per_day')) return true
  return false
}

function family(unit: string): 'frequency' | 'duration' | 'unit' | 'number' {
  if (unit === 'per_day' || unit === 'times') return 'frequency'
  if (unit.endsWith('_ago') || DURATION_UNITS.some((item) => item.unit === unit)) return 'duration'
  if (unit === 'number' || unit === 'bp') return 'number'
  return 'unit'
}

type Range = { start: number; end: number }

function overlaps(ranges: Range[], start: number, end: number): boolean {
  return ranges.some((range) => start < range.end && end > range.start)
}

function extractQuantities(raw: string): Quantity[] {
  const text = measurementText(raw)
  const found: Quantity[] = []
  const taken: Range[] = []

  const claim = (start: number, end: number, value: string, unit: string) => {
    if (!value || overlaps(taken, start, end)) return
    taken.push({ start, end })
    const surface = text.slice(start, end).replace(/\s+/g, ' ').trim()
    found.push({ value, unit, surface })
  }

  const bp =
    /(?<!\d)(\d{2,3})\s*(?:\/|на|over|to|sobre|sur|por)\s*(\d{2,3})(?!\d)(?:\s*(?:mmhg|мм\s*рт\.?\s*ст\.?))?(?!\s*(?:mg|мг|mcg|мкг|ml|мл|毫克))/giu
  for (const match of text.matchAll(bp)) {
    const start = match.index ?? 0
    claim(start, start + match[0].length, `${canonNumber(match[1])}/${canonNumber(match[2])}`, 'bp')
  }

  const units = [...MEDICAL_GLOSSARY.units].sort(
    (left, right) =>
      Math.max(...right.forms.map((form) => form.length)) - Math.max(...left.forms.map((form) => form.length))
  )
  for (const unit of units) {
    if (unit.id === 'mmhg') continue
    const pattern = unit.forms.map(unitAlternative).join('|')
    const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${pattern})`, 'giu')
    for (const match of text.matchAll(re)) {
      const start = match.index ?? 0
      claim(start, start + match[0].length, canonNumber(match[1]), unit.id)
    }
  }

  const amount = numberSource()
  const frequencies: Array<{ re: RegExp; unit: string; value?: string }> = [
    { re: /(?:^|[^\p{L}\p{N}])bid(?=$|[^\p{L}\p{N}])/giu, unit: 'per_day', value: '2' },
    { re: /(?:^|[^\p{L}\p{N}])tid(?=$|[^\p{L}\p{N}])/giu, unit: 'per_day', value: '3' },
    { re: /(?:^|[^\p{L}\p{N}])qid(?=$|[^\p{L}\p{N}])/giu, unit: 'per_day', value: '4' },
    { re: new RegExp(`(?:once|twice|thrice)\\s+(?:a|per)\\s+day`, 'giu'), unit: 'per_day' },
    { re: new RegExp(`${amount}\\s+times\\s+(?:a|per)\\s+day`, 'giu'), unit: 'per_day' },
    { re: new RegExp(`${amount}\\s+раз(?:а)?\\s+в\\s+(?:день|сутки)`, 'giu'), unit: 'per_day' },
    { re: new RegExp(`(${amount})\\s+veces\\s+(?:al|por)\\s+dia`, 'giu'), unit: 'per_day' },
    { re: new RegExp(`(${amount})\\s+fois\\s+par\\s+jour`, 'giu'), unit: 'per_day' },
    { re: new RegExp(`(${amount})\\s+vezes\\s+(?:ao|por)\\s+dia`, 'giu'), unit: 'per_day' },
    { re: /дважды\s+в\s+день/giu, unit: 'per_day', value: '2' },
    { re: /(?:每天|每日|一天|一日|1日)([0-9]{1,2}|十[一二三四五六七八九]?|[一二三四五六七八九两兩]十|[一二两三兩四五六七八九十])次/gu, unit: 'per_day' },
    { re: /(?:毎日|一日|1日)([0-9]{1,2}|[一二三四五六七八九十両])回/gu, unit: 'per_day' },
    { re: /(?:once|twice|thrice|дважды)/giu, unit: 'times' },
  ]
  for (const frequency of frequencies) {
    for (const match of text.matchAll(frequency.re)) {
      const start = match.index ?? 0
      const token = match[1] || match[0].split(/\s+/)[0]
      claim(start, start + match[0].length, frequency.value || canonCjkNumber(token), frequency.unit)
    }
  }

  for (const duration of DURATION_UNITS) {
    const leading = new RegExp(
      `(?:hace|il y a|ha)(?:\\s+(?:unos|unas|environ|aproximadamente|cerca de))*\\s+(${amount})\\s+(?:${duration.pattern})(?![\\p{L}\\p{N}])`,
      'giu'
    )
    for (const match of text.matchAll(leading)) {
      const start = match.index ?? 0
      claim(start, start + match[0].length, canonCjkNumber(match[1]), `${duration.unit}_ago`)
    }
    const re = new RegExp(
      `(${amount})\\s+(?:${duration.pattern})(?![\\p{L}\\p{N}])(?:\\s+(?:назад|ago|ранее|раньше|previously|atras|en arriere))?`,
      'giu'
    )
    for (const match of text.matchAll(re)) {
      const start = match.index ?? 0
      const ago = /назад|ago|ранее|раньше|previously|atras|en arriere/iu.test(match[0])
      claim(start, start + match[0].length, canonCjkNumber(match[1]), ago ? `${duration.unit}_ago` : duration.unit)
    }
  }

  const cjkAmount = '(?:[0-9]{1,2}|十[一二三四五六七八九]?|[一二三四五六七八九两兩]十|[一二两三兩四五六七八九十])'
  const cjkDurations: Array<{ re: RegExp; unit: string; ago?: boolean }> = [
    { re: new RegExp(`(?:大约|大概|約)?(${cjkAmount})\\s*个?\\s*(?:小时|小時|時間)前`, 'gu'), unit: 'hour', ago: true },
    { re: new RegExp(`(?:大约|大概|約)?(${cjkAmount})\\s*个?\\s*(?:小时|小時|時間)`, 'gu'), unit: 'hour' },
    { re: new RegExp(`(${cjkAmount})\\s*(?:分钟|分鐘)前`, 'gu'), unit: 'minute', ago: true },
    { re: new RegExp(`(${cjkAmount})\\s*(?:分钟|分鐘|分)(?!钟)`, 'gu'), unit: 'minute' },
    { re: new RegExp(`(${cjkAmount})(?:天|日)前`, 'gu'), unit: 'day', ago: true },
    { re: new RegExp(`(${cjkAmount})年(?:前)?`, 'gu'), unit: 'year' },
  ]
  for (const duration of cjkDurations) {
    for (const match of text.matchAll(duration.re)) {
      const start = match.index ?? 0
      const ago = duration.ago || /前/u.test(match[0])
      claim(start, start + match[0].length, canonCjkNumber(match[1]), ago ? `${duration.unit}_ago` : duration.unit)
    }
  }

  for (const match of text.matchAll(/(\d{1,4}(?:\.\d+)?)/g)) {
    if (/^\d{4}$/.test(match[1]) && Number(match[1]) >= 1900 && Number(match[1]) <= 2099) continue
    const start = match.index ?? 0
    claim(start, start + match[0].length, canonNumber(match[1]), 'number')
  }

  return found
}

function mismatchCode(item: Quantity, others: Quantity[]): FidelityCode {
  const group = family(item.unit)
  const sameValueDifferentUnit = others.some(
    (other) => other.value === item.value && !unitsCompatible(item.unit, other.unit)
  )
  const sameUnitDifferentValue = others.some(
    (other) => unitsCompatible(item.unit, other.unit) && other.value !== item.value
  )
  if (sameValueDifferentUnit && group === 'duration') return 'duration'
  if (sameValueDifferentUnit && group === 'frequency') return 'frequency'
  if (sameValueDifferentUnit) return 'unit'
  if (sameUnitDifferentValue && group === 'frequency') return 'frequency'
  if (sameUnitDifferentValue && group === 'duration') return 'duration'
  if (sameUnitDifferentValue) return 'number'
  if (group === 'frequency') return 'frequency'
  if (group === 'duration') return 'duration'
  if (group === 'unit') return 'unit'
  return 'number'
}

function compareQuantities(source: Quantity[], target: Quantity[]): FidelityFinding[] {
  const used = new Set<number>()
  const unmatchedSource: Quantity[] = []
  for (const item of source) {
    const index = target.findIndex(
      (candidate, candidateIndex) =>
        !used.has(candidateIndex) && candidate.value === item.value && unitsCompatible(item.unit, candidate.unit)
    )
    if (index >= 0) {
      used.add(index)
      continue
    }
    unmatchedSource.push(item)
  }
  const unmatchedTarget = target.filter((_, index) => !used.has(index))
  const findings: FidelityFinding[] = []
  const groups = new Set([...unmatchedSource, ...unmatchedTarget].map((item) => family(item.unit)))
  for (const group of groups) {
    const left = unmatchedSource.filter((item) => family(item.unit) === group)
    const right = unmatchedTarget.filter((item) => family(item.unit) === group)
    if (left.length === 1 && right.length === 1 && left[0].surface && right[0].surface) {
      findings.push({
        severity: 'critical',
        code: mismatchCode(left[0], right),
        detail: `${left[0].value} ${left[0].unit}`,
        sourceFragment: left[0].surface,
        translationFragment: right[0].surface,
      })
      continue
    }
    for (const item of left) {
      findings.push({
        severity: 'critical',
        code: mismatchCode(item, right),
        detail: `${item.value} ${item.unit}`,
      })
    }
    for (const item of right) {
      findings.push({
        severity: 'critical',
        code: mismatchCode(item, left),
        detail: `extra ${item.value} ${item.unit}`,
      })
    }
  }
  return findings
}

function tokenPattern(phrase: string): RegExp {
  const normalized = normalizeMedicalText(phrase).trim()
  if (isCjkText(normalized)) return new RegExp(escapeRegExp(normalized), 'iu')
  const parts = normalized.split(/\s+/).map(escapeRegExp)
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${parts.join('\\s+')}(?=$|[^\\p{L}\\p{N}])`, 'iu')
}

function hasMarker(text: string, marker: string): boolean {
  return tokenPattern(marker).test(normalizeMedicalText(text))
}

function blankUncertainty(text: string): string {
  let blanked = text
  const markers = [...UNCERTAINTY_MARKERS].sort((left, right) => right.length - left.length)
  for (const marker of markers) {
    blanked = blanked.replace(new RegExp(tokenPattern(marker).source, 'giu'), (match) => ' '.repeat(match.length))
  }
  return blanked
}

function negationWindows(text: string): Range[] {
  const windows: Range[] = []
  const used: Range[] = []
  for (const cue of NEGATION_CUES) {
    const re = new RegExp(tokenPattern(cue).source, 'giu')
    for (const match of text.matchAll(re)) {
      const start = match.index ?? 0
      const end = start + match[0].length
      if (overlaps(used, start, end)) continue
      used.push({ start, end })
      const back = Math.max(0, start - 50)
      const punct = Math.max(
        text.lastIndexOf('.', start),
        text.lastIndexOf('!', start),
        text.lastIndexOf('?', start),
        text.lastIndexOf(';', start)
      )
      const from = Math.max(back, punct + 1)
      let to = Math.min(text.length, end + 80)
      for (const mark of ['.', '!', '?', ';']) {
        const at = text.indexOf(mark, end)
        if (at >= 0) to = Math.min(to, at)
      }
      windows.push({ start: from, end: to })
    }
  }
  return windows
}

function anchorNegated(text: string, forms: readonly string[]): boolean | null {
  const normalized = normalizeMedicalText(text)
  const windows = negationWindows(blankUncertainty(normalized))
  const spans = forms.flatMap((form) => formSpans(normalized, form))
  if (spans.length === 0) return null
  return spans.every((span) => windows.some((window) => span.start >= window.start && span.start < window.end))
}

function pushUnique(findings: FidelityFinding[], finding: FidelityFinding): void {
  const key = `${finding.severity}:${finding.code}`
  const index = findings.findIndex((item) => `${item.severity}:${item.code}` === key)
  if (index < 0) {
    findings.push(finding)
    return
  }
  const current = findings[index]
  if (!current.sourceFragment && finding.sourceFragment && finding.translationFragment) {
    findings[index] = finding
  }
}

function drugIds(text: string): string[] {
  return MEDICAL_GLOSSARY.drugs.filter((entry) => entryAppears(text, entry.forms)).map((entry) => entry.id)
}

function compareNegation(source: string, translation: string, entries: readonly GlossaryEntry[]): FidelityFinding[] {
  const findings: FidelityFinding[] = []
  for (const entry of entries) {
    const sourceNegated = anchorNegated(source, entry.forms)
    const translationNegated = anchorNegated(translation, entry.forms)
    if (sourceNegated === null || translationNegated === null || sourceNegated === translationNegated) continue
    pushUnique(findings, { severity: 'critical', code: 'negation', detail: entry.id })
  }
  return findings
}

function compareDrugs(source: string, translation: string, priorSources: readonly string[]): FidelityFinding[] {
  const sourceDrugs = new Set(drugIds(source))
  const known = new Set([...sourceDrugs, ...priorSources.flatMap((prior) => drugIds(prior))])
  const translated = drugIds(translation)
  const findings: FidelityFinding[] = []
  for (const id of sourceDrugs) {
    if (!translated.includes(id)) pushUnique(findings, { severity: 'critical', code: 'drug', detail: `dropped:${id}` })
  }
  for (const id of translated) {
    if (!known.has(id)) pushUnique(findings, { severity: 'critical', code: 'drug', detail: `invented:${id}` })
  }
  return findings
}

function hasNumericHedge(text: string): boolean {
  const normalized = normalizeMedicalText(text)
  const amount = numberSource()
  const latin = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:около|примерно|approximately|around|about|unos|unas|environ|aproximadamente|cerca de)\\s+${amount}`,
    'iu'
  )
  const cjk = /(?:大约|大概|約)\s*[0-9一二两三兩]/u
  const after = new RegExp(`${amount}\\s*(?:左右|くらい|ぐらい)`, 'iu')
  return latin.test(normalized) || cjk.test(normalized) || after.test(normalized)
}

function matchedForm(text: string, forms: readonly string[]): string | undefined {
  return forms.find((form) => textHasForm(text, form))
}

function singleEntry(text: string, entries: readonly GlossaryEntry[]): { id: string; surface: string } | null {
  const hits = entries.flatMap((entry) => {
    const surface = matchedForm(text, entry.forms)
    return surface ? [{ id: entry.id, surface }] : []
  })
  if (hits.length !== 1) return null
  return hits[0]
}

const AFTER_LOAD = [
  'after exercise', 'after exertion', 'после нагрузки', 'после физической нагрузки',
  'despues del ejercicio', 'despues del esfuerzo', 'apres l effort', 'apres l exercice',
  'nach belastung', 'nach dem training', 'dopo lo sforzo', 'dopo l esercizio',
  'apos o exercicio', 'depois do exercicio', '运动后', '運動後', '労作後', '운동 후',
  'व्यायाम के बाद', 'setelah olahraga', 'sau khi vận động', 'بعد المجهود',
  'egzersizden sonra', 'після навантаження', 'selepas senaman', 'po wysiłku',
]
const BEFORE_LOAD = [
  'before exercise', 'before exertion', 'до нагрузки', 'до физической нагрузки',
  'antes del ejercicio', 'antes del esfuerzo', 'avant l effort', 'avant l exercice',
  'vor belastung', 'vor dem training', 'prima dello sforzo', 'prima dellesercizio',
  'antes do exercicio', '运动前', '労作前', '운동 전',
  'व्यायाम से पहले', 'sebelum olahraga', 'trước khi vận động', 'قبل المجهود',
  'egzersizden önce', 'до навантаження', 'sebelum senaman', 'przed wysiłkiem',
]

function compareClinical(source: string, translation: string): FidelityFinding[] {
  const findings: FidelityFinding[] = []
  const sourceSide = singleEntry(source, MEDICAL_GLOSSARY.laterality)
  const translatedSide = singleEntry(translation, MEDICAL_GLOSSARY.laterality)
  if (sourceSide && translatedSide && sourceSide.id !== translatedSide.id) {
    findings.push({
      severity: 'critical',
      code: 'laterality',
      detail: `${sourceSide.id}->${translatedSide.id}`,
      sourceFragment: sourceSide.surface,
      translationFragment: translatedSide.surface,
    })
  }

  const sourceSite = singleEntry(source, MEDICAL_GLOSSARY.anatomy)
  const translatedSite = singleEntry(translation, MEDICAL_GLOSSARY.anatomy)
  if (sourceSite && translatedSite && sourceSite.id !== translatedSite.id) {
    findings.push({
      severity: 'critical',
      code: 'anatomy',
      detail: `${sourceSite.id}->${translatedSite.id}`,
      sourceFragment: sourceSite.surface,
      translationFragment: translatedSite.surface,
    })
  }

  const sourceHasDrug = drugIds(source).length > 0
  const sourceRoute = singleEntry(source, MEDICAL_GLOSSARY.routes)
  const translatedRoute = singleEntry(translation, MEDICAL_GLOSSARY.routes)
  if (sourceHasDrug && sourceRoute && translatedRoute && sourceRoute.id !== translatedRoute.id) {
    findings.push({
      severity: 'critical',
      code: 'route',
      detail: `${sourceRoute.id}->${translatedRoute.id}`,
      sourceFragment: sourceRoute.surface,
      translationFragment: translatedRoute.surface,
    })
  }

  const sourceAfter = matchedForm(source, AFTER_LOAD)
  const sourceBefore = matchedForm(source, BEFORE_LOAD)
  const translatedAfter = matchedForm(translation, AFTER_LOAD)
  const translatedBefore = matchedForm(translation, BEFORE_LOAD)
  const sourceOrder = sourceAfter && !sourceBefore ? 'after' : sourceBefore && !sourceAfter ? 'before' : null
  const translatedOrder = translatedAfter && !translatedBefore ? 'after' : translatedBefore && !translatedAfter ? 'before' : null
  if (sourceOrder && translatedOrder && sourceOrder !== translatedOrder) {
    findings.push({
      severity: 'important',
      code: 'relation',
      detail: `${sourceOrder}->${translatedOrder}`,
      sourceFragment: sourceOrder === 'after' ? sourceAfter : sourceBefore,
      translationFragment: translatedOrder === 'after' ? translatedAfter : translatedBefore,
    })
  }
  return findings
}

function uncertain(text: string): boolean {
  return hasNumericHedge(text) || UNCERTAINTY_MARKERS.some((marker) => hasMarker(text, marker))
}

export function assessMedicalFidelity(input: MedicalFidelityInput): MedicalFidelityReport {
  const source = input.source.trim()
  const translation = input.translation.trim()
  if (!source || !translation) return { findings: [] }

  const priorSources = input.priorSources ?? []
  const findings: FidelityFinding[] = []

  for (const finding of compareQuantities(extractQuantities(source), extractQuantities(translation))) {
    pushUnique(findings, finding)
  }
  for (const finding of compareNegation(source, translation, [
    ...MEDICAL_GLOSSARY.drugs,
    ...MEDICAL_GLOSSARY.terms,
    ...MEDICAL_GLOSSARY.phrases,
  ])) {
    pushUnique(findings, finding)
  }
  for (const finding of compareDrugs(source, translation, priorSources)) {
    pushUnique(findings, finding)
  }

  const knownText = [source, ...priorSources]
  for (const entry of diagnosisEntries()) {
    const known = knownText.some((text) => entryAppears(text, entry.forms))
    if (!known && entryAppears(translation, entry.forms)) {
      pushUnique(findings, { severity: 'critical', code: 'diagnosis', detail: entry.id })
    }
  }

  if (uncertain(source) !== uncertain(translation)) {
    pushUnique(findings, {
      severity: 'important',
      code: 'uncertainty',
      detail: uncertain(source) ? 'dropped' : 'added',
    })
  }

  for (const entry of [...MEDICAL_GLOSSARY.terms, ...MEDICAL_GLOSSARY.phrases]) {
    if (!entryAppears(source, entry.forms) || entryAppears(translation, entry.forms)) continue
    pushUnique(findings, { severity: 'important', code: 'term', detail: entry.id })
  }

  for (const entry of MEDICAL_GLOSSARY.abbreviations) {
    if (QUANTITY_ABBREVIATIONS.has(entry.id)) continue
    if (entry.ambiguous) {
      const sourceHasShort = entry.forms.some((form) => form.length <= 4 && hasMarker(source, form))
      const sourceExpanded = (entry.expansions ?? []).some((form) => textHasForm(source, form))
      const translationExpanded = (entry.expansions ?? []).some((form) => textHasForm(translation, form))
      if (sourceHasShort && !sourceExpanded && translationExpanded) {
        pushUnique(findings, { severity: 'important', code: 'abbreviation', detail: entry.id })
      }
      continue
    }
    const sourceHasShort = entry.forms.some((form) => form.length <= 4 && hasMarker(source, form))
    if (!sourceHasShort || entryAppears(translation, entry.forms)) continue
    pushUnique(findings, { severity: 'important', code: 'abbreviation', detail: entry.id })
  }

  for (const finding of compareClinical(source, translation)) {
    pushUnique(findings, finding)
  }

  const prn = MEDICAL_GLOSSARY.abbreviations.find((entry) => entry.id === 'prn')
  if (prn && entryAppears(source, prn.forms) !== entryAppears(translation, prn.forms)) {
    pushUnique(findings, { severity: 'critical', code: 'frequency', detail: 'prn' })
  }

  return { findings }
}
