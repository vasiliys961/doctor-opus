import { describe, expect, it } from 'vitest'
import { assessMedicalFidelity, type FidelityCode } from './fidelity'
import { MEDICAL_GLOSSARY } from './glossary'

function codesOf(source: string, translation: string, priorSources: string[] = []): FidelityCode[] {
  return assessMedicalFidelity({ source, translation, priorSources }).findings.map((finding) => finding.code)
}

function expectFaithful(source: string, translation: string, priorSources: string[] = []): void {
  const report = assessMedicalFidelity({ source, translation, priorSources })
  expect(report.findings, JSON.stringify(report.findings)).toEqual([])
}

const faithful = [
  {
    id: 'medication',
    ru: 'Я принимаю метопролол 50 мг два раза в день.',
    en: 'I take metoprolol 50 mg twice a day.',
  },
  {
    id: 'allergy',
    ru: 'У меня никогда не было аллергии на пенициллин.',
    en: 'I have never had an allergy to penicillin.',
  },
  {
    id: 'symptom',
    ru: 'Одышка появилась около двух часов назад.',
    en: 'Shortness of breath started about two hours ago.',
  },
  {
    id: 'uncertainty',
    ru: 'Возможно, боль связана с физической нагрузкой.',
    en: 'The pain may be related to physical exertion.',
  },
  {
    id: 'blood-pressure',
    ru: 'Моё давление сегодня было 160 на 95.',
    en: 'My blood pressure today was 160 over 95.',
  },
  {
    id: 'temperature',
    ru: 'Температура поднялась до 38,7.',
    en: 'The temperature rose to 38.7.',
  },
  {
    id: 'laboratory',
    ru: 'Глюкоза крови была 5,4 ммоль на литр.',
    en: 'Blood glucose was 5.4 mmol per liter.',
  },
  {
    id: 'history',
    ru: 'Я перенёс инфаркт пять лет назад.',
    en: 'I had a myocardial infarction five years ago.',
  },
  {
    id: 'colloquial',
    ru: 'У меня сердце как-то странно колотится.',
    en: 'My heart is beating strangely.',
  },
  {
    id: 'doctor',
    ru: 'Нам необходимо исключить тромбоэмболию лёгочной артерии.',
    en: 'We need to rule out pulmonary embolism.',
  },
] as const

describe('medical fidelity phrases', () => {
  it('keeps the glossary extendable and small', () => {
    expect(Object.keys(MEDICAL_GLOSSARY).sort()).toEqual([
      'abbreviations',
      'anatomy',
      'drugs',
      'phrases',
      'terms',
      'units',
    ])
    expect(MEDICAL_GLOSSARY.drugs.some((entry) => entry.id === 'metoprolol')).toBe(true)
    expect(MEDICAL_GLOSSARY.abbreviations.some((entry) => entry.id === 'bid')).toBe(true)
    expect(MEDICAL_GLOSSARY.units.some((entry) => entry.id === 'mg')).toBe(true)
  })

  for (const phrase of faithful) {
    it(`${phrase.id}: russian to english keeps clinical meaning`, () => {
      expectFaithful(phrase.ru, phrase.en)
    })

    it(`${phrase.id}: english to russian keeps clinical meaning`, () => {
      expectFaithful(phrase.en, phrase.ru)
    })
  }

  it('accepts dyspnea and heart attack as the same clinical terms', () => {
    expectFaithful(
      'Одышка появилась около двух часов назад.',
      'Dyspnea started about two hours ago.'
    )
    expectFaithful('Я перенёс инфаркт пять лет назад.', 'I had a heart attack five years ago.')
  })

  it('flags a changed dose, unit, and frequency', () => {
    expect(codesOf('Я принимаю метопролол 50 мг два раза в день.', 'I take metoprolol 500 mg twice a day.')).toContain(
      'number'
    )
    expect(codesOf('Я принимаю метопролол 50 мг два раза в день.', 'I take metoprolol 50 mcg twice a day.')).toContain(
      'unit'
    )
    expect(codesOf('Я принимаю метопролол 50 мг два раза в день.', 'I take metoprolol 50 mg once a day.')).toContain(
      'frequency'
    )
    expect(codesOf('I take metoprolol 50 mg twice a day.', 'Я принимаю метопролол 5 мг два раза в день.')).toContain(
      'number'
    )
  })

  it('flags a dropped or swapped drug, including one invented from context', () => {
    expect(codesOf('Я принимаю метопролол 50 мг два раза в день.', 'I take lisinopril 50 mg twice a day.')).toContain(
      'drug'
    )
    const prior = ['Я принимаю метопролол 50 мг два раза в день.']
    expectFaithful('По одной таблетке вечером.', 'One metoprolol tablet in the evening.', prior)
    expectFaithful('По одной таблетке вечером.', 'One tablet in the evening.', prior)
    expect(codesOf('По одной таблетке вечером.', 'One aspirin tablet in the evening.', prior)).toContain('drug')
  })

  it('flags a lost negation and keeps a real negation', () => {
    expect(codesOf('У меня никогда не было аллергии на пенициллин.', 'I had an allergy to penicillin.')).toContain(
      'negation'
    )
    expect(
      codesOf('I have never had an allergy to penicillin.', 'У меня была аллергия на пенициллин.')
    ).toContain('negation')
    expectFaithful('Patient denies penicillin allergy.', 'Пациент отрицает аллергию на пенициллин.')
  })

  it('flags changed time, uncertainty, blood pressure, temperature, and lab units', () => {
    expect(codesOf('Одышка появилась около двух часов назад.', 'Shortness of breath started two days ago.')).toEqual(
      expect.arrayContaining(['duration', 'uncertainty'])
    )
    expect(codesOf('Возможно, боль связана с физической нагрузкой.', 'The pain is related to physical exertion.')).toContain(
      'uncertainty'
    )
    expect(codesOf('Моё давление сегодня было 160 на 95.', 'My blood pressure today was 160 over 90.')).toContain(
      'number'
    )
    expect(codesOf('Температура поднялась до 38,7.', 'The temperature rose to 39.')).toContain('number')
    expect(codesOf('Глюкоза крови была 5,4 ммоль на литр.', 'Blood glucose was 5.4 mg/dl.')).toContain('unit')
    expect(codesOf('Я перенёс инфаркт пять лет назад.', 'I had a myocardial infarction five months ago.')).toContain(
      'duration'
    )
  })

  it('does not turn patient wording into a diagnosis and does not simplify the doctor', () => {
    expect(codesOf('У меня сердце колет.', 'I have angina.')).toContain('diagnosis')
    expect(codesOf('У меня сердце как-то странно колотится.', 'I have an arrhythmia.')).toContain('diagnosis')
    expect(codesOf('Мне кажется, у меня давление высокое.', 'The patient has hypertension.')).toEqual(
      expect.arrayContaining(['diagnosis', 'uncertainty'])
    )
    expectFaithful('Мне кажется, у меня давление высокое.', 'I think my blood pressure is high.')
    expectFaithful('У меня немеет рука.', 'My arm is numb.')
    expect(codesOf('У меня немеет рука.', 'I have paresthesia of the upper limb.')).toContain('diagnosis')
    expect(codesOf('Нам необходимо исключить тромбоэмболию лёгочной артерии.', 'We need to check the lungs.')).toContain(
      'term'
    )
    expect(
      codesOf('We need to rule out pulmonary embolism.', 'Нам нужно проверить лёгкие.')
    ).toContain('term')
  })

  it('does not treat a preposition as clinical uncertainty', () => {
    expectFaithful('Расскажите о боли.', 'Tell me about the pain.')
  })

  it('does not guess an ambiguous abbreviation', () => {
    expect(codesOf('MS is unchanged.', 'Multiple sclerosis is unchanged.')).toContain('abbreviation')
    expectFaithful('MS is unchanged.', 'MS is unchanged.')
    expectFaithful('ECG shows sinus rhythm.', 'ЭКГ показывает синусовый ритм.')
  })

  it('keeps an as-needed dose and notices when it disappears', () => {
    expectFaithful('Метопролол 50 мг при необходимости.', 'Metoprolol 50 mg as needed.')
    expect(codesOf('Метопролол 50 мг при необходимости.', 'Metoprolol 50 mg twice a day.')).toContain('frequency')
  })
})

const englishPairs = [
  {
    id: 'es',
    medication: 'Tomo metoprolol 50 mg dos veces al día.',
    allergy: 'Nunca he tenido alergia a la penicilina.',
    allergyLost: 'Tuve alergia a la penicilina.',
    symptom: 'La disnea empezó hace unas dos horas.',
    pressure: 'Mi presión hoy fue 160 sobre 95.',
    doctor: 'Hay que descartar una embolia pulmonar.',
    uncertainty: 'Es posible que el dolor se relacione con el esfuerzo.',
  },
  {
    id: 'fr',
    medication: 'Je prends du métoprolol 50 mg deux fois par jour.',
    allergy: "Je n'ai jamais eu d'allergie à la pénicilline.",
    allergyLost: "J'ai eu une allergie à la pénicilline.",
    symptom: 'La dyspnée a commencé il y a environ deux heures.',
    pressure: 'Ma tension était de 160 sur 95.',
    doctor: 'Il faut écarter une embolie pulmonaire.',
    uncertainty: 'Il est possible que la douleur soit liée à l’effort.',
  },
  {
    id: 'pt',
    medication: 'Tomo metoprolol 50 mg duas vezes por dia.',
    allergy: 'Nunca tive alergia à penicilina.',
    allergyLost: 'Tive alergia à penicilina.',
    symptom: 'A dispneia começou há cerca de duas horas.',
    pressure: 'A minha pressão hoje foi 160 por 95.',
    doctor: 'É preciso excluir uma embolia pulmonar.',
    uncertainty: 'É possível que a dor esteja relacionada com o esforço.',
  },
  {
    id: 'zh',
    medication: '美托洛尔50毫克，每天两次。',
    allergy: '我从来没有青霉素过敏。',
    allergyLost: '我有青霉素过敏。',
    symptom: '呼吸困难大约两小时前开始。',
    pressure: '我今天的血压是160/95。',
    doctor: '需要排除肺栓塞。',
    uncertainty: '疼痛可能与用力有关。',
  },
  {
    id: 'ja',
    medication: 'メトプロロール50mgを1日2回服用しています。',
    allergy: 'ペニシリンアレルギーはありません。',
    allergyLost: 'ペニシリンアレルギーがあります。',
    symptom: '息切れは約2時間前から始まりました。',
    pressure: '今日の血圧は160/95でした。',
    doctor: '肺塞栓を除外する必要があります。',
    uncertainty: '痛みは運動と関係があるかもしれません。',
  },
] as const

describe('english paired with es, fr, pt, zh, ja', () => {
  const english = {
    medication: 'I take metoprolol 50 mg twice a day.',
    allergy: 'I have never had an allergy to penicillin.',
    symptom: 'Shortness of breath started about two hours ago.',
    pressure: 'My blood pressure today was 160 over 95.',
    doctor: 'We need to rule out pulmonary embolism.',
    uncertainty: 'The pain may be related to physical exertion.',
  }

  for (const pair of englishPairs) {
    it(`${pair.id}: keeps dose, negation, time, pressure, and the doctor’s term`, () => {
      expectFaithful(english.medication, pair.medication)
      expectFaithful(pair.medication, english.medication)
      expectFaithful(english.allergy, pair.allergy)
      expectFaithful(pair.allergy, english.allergy)
      expectFaithful(english.symptom, pair.symptom)
      expectFaithful(pair.symptom, english.symptom)
      expectFaithful(english.pressure, pair.pressure)
      expectFaithful(pair.pressure, english.pressure)
      expectFaithful(english.doctor, pair.doctor)
      expectFaithful(pair.doctor, english.doctor)
      expectFaithful(english.uncertainty, pair.uncertainty)
      expectFaithful(pair.uncertainty, english.uncertainty)
    })

    it(`${pair.id}: flags a lost negation and a changed dose`, () => {
      expect(codesOf(english.allergy, pair.allergyLost)).toContain('negation')
      expect(codesOf(pair.allergy, english.allergy.replace('never had an allergy', 'had an allergy'))).toContain(
        'negation'
      )
      expect(codesOf(english.medication, pair.medication.replace('50', '500'))).toContain('number')
    })
  }

  it('does not upgrade spanish chest pain into angina', () => {
    expect(codesOf('Me duele el pecho.', 'I have angina.')).toContain('diagnosis')
    expectFaithful('Me duele el pecho.', 'I have chest pain.')
  })
})
