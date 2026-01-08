/**
 * Специфичные диагностические критерии для каждого типа медицинского изображения.
 * Основано на глубокой экспертизе из профессиональных модулей (diagnostic_prompts.py).
 * ПРЕДНАЗНАЧЕНО ДЛЯ ИСПОЛЬЗОВАНИЯ ПРОФЕССОРОМ КЛИНИЧЕСКОЙ МЕДИЦИНЫ.
 */

// === ОБЩИЕ ТРЕБОВАНИЯ К ФОРМАТУ (ПРОФЕССОР - ШАГ 2) ===
export const COMMON_FORMAT = `
Игнорируй требования о таблицах ссылок и логах веб‑поиска: ссылки и логи НЕ НУЖНЫ.
Не используй табличный формат. Все параметры описывай в виде структурированного текста.
ФОКУС НА ДИАГНОСТИКЕ: минимизируй описание нормы, концентрируйся на патологиях.
БУДЬ ЛАКОНИЧНЫМ: Сразу к синтезу и клиническим выводам.
Указывай только реально выявленные отклонения.
Всегда указывай ТОЧНУЮ локализацию патологии (какая структура, какая часть, сторона).
Используй международную медицинскую терминологию.

### СТАНДАРТ МЕДИЦИНСКИХ ШКАЛ (ОБЯЗАТЕЛЬНО):
Если применимо, рассчитай и укажи баллы по следующим шкалам:
- ЭКГ: CHA2DS2-VASc (риск инсульта), HAS-BLED (риск кровотечений).
- МАММОГРАФИЯ: Категория BI-RADS (0-6).
- КТ ЛЕГКИХ: Fleischner criteria / Lung-RADS.
- УЗИ ЩИТОВИДНОЙ ЖЕЛЕЗЫ: TI-RADS.
- ДЕРМАТОСКОПИЯ: Алгоритм ABCDE и оценка по шкале Ардженциано (CASH).
`;

// === СПЕЦИАЛИЗИРОВАННЫЕ КРИТЕРИИ ДЛЯ СПЕЦИАЛИСТОВ (ШАГ 1: ИЗВЛЕЧЕНИЕ) ===
// Эти данные используются Gemini Flash для максимально точного описания изображения в сжатом JSON

export const SPECIALIST_CRITERIA = {
  ecg: {
    title: 'ЭКГ (Advanced Electrophysiology Analysis)',
    requirements: `
1. Ритм: Тип ритма, регулярность, наличие зубцов P перед каждым QRS.
2. ЧСС: Точный расчет (уд/мин).
3. Интервалы (мс): PR (норм/удлинен/укорочен), QRS (узкий/широкий), QT, QTc (Bazzett/Fridericia).
4. ЭОС: Положение электрической оси сердца в градусах.
5. Сегмент ST: Оценка изолинии, наличие элевации или депрессии (мм) в конкретных отведениях.
6. Зубец T: Полярность (положительный, отрицательный, двухфазный), амплитуда.
7. Зубец Q: Патологические зубцы Q (ширина >0.04с или амплитуда >1/4 R).
8. Дополнительно: Признаки гипертрофии (Sokolow-Lyon, Cornell), блокады ножек пучка Гиса.
`,
    pathologies: 'ОИМ (локализация по стенкам), ишемия, фибрилляция/трепетание предсердий, AV-блокады (I-III ст), экстрасистолия.'
  },
  xray: {
    title: 'Рентгенография (Multi-Anatomical Expert Protocol)',
    requirements: `
1. ИДЕНТИФИКАЦИЯ ОБЛАСТИ: Определи область (ОГК, сустав, кость, таз, позвоночник).
2. ЕСЛИ ЭТО ОГК: Оцени легочные поля (инфильтрация, фокусы), корни легких, тень сердца (КТИ), синусы и диафрагму.
3. ЕСЛИ ЭТО КОСТИ И СУСТАВЫ: 
   - Оцени целостность костных структур (ищи только явные переломы или трещины).
   - Оцени суставные щели (ширина, симметричность).
   - Оцени признаки артроза (остеофиты, склероз, кисты).
   - Оцени структуру кости (остеопороз, деструкция).
4. ЕСЛИ ЭТО БРЮШНАЯ ПОЛОСТЬ: Газ, уровни жидкости, конкременты.
`,
    pathologies: 'Пневмония, переломы, артроз (степень), плевральный выпот, костная деструкция.'
  },
  ct: {
    title: 'КТ (Advanced Volumetric Analysis)',
    requirements: `
1. Плотность (HU): Измеряй плотность подозрительных очагов.
2. Окно просмотра: Оценка в легочном, костном, мягкотканом окнах.
3. Морфология: Форма, контуры, структура образований.
4. Сосуды: Дефекты наполнения, аневризмы.
5. Лимфоузлы: Размеры, количество.
`,
    pathologies: 'ТЭЛА, аневризмы, опухоли, абсцессы, кровоизлияния.'
  },
  mri: {
    title: 'МРТ (Multiparametric Tissue Analysis)',
    requirements: `
1. Сигнал: Характеристика сигнала в T1, T2, FLAIR, STIR.
2. Диффузия (DWI/ADC): Ограничение диффузии.
3. Анатомия: Анатомические соотношения, масс-эффект.
4. Контрастирование: Характер накопления контраста.
`,
    pathologies: 'Инсульты, демиелинизация, грыжи дисков, опухоли.'
  },
  ultrasound: {
    title: 'УЗИ (Expert Echo-Morphology Scan)',
    requirements: `
1. Эхогенность: Структура и плотность ткани.
2. Контуры и Капсула: Четкость, непрерывность.
3. Васкуляризация: Наличие кровотока (ЦДК).
4. Измерения: Размеры органов и образований.
`,
    pathologies: 'ЖКБ, МКБ, тиреоидиты, образования.'
  },
  dermatoscopy: {
    title: 'Дерматоскопия (Professional Dermoscopy Protocol)',
    requirements: `
1. Алгоритм ABCDE: Asymmetry, Border, Color, Differential Structures, Evolution.
2. Оценка по шкале Ардженциано.
3. Сосудистые паттерны и специфические признаки.
`,
    pathologies: 'Меланома, Базалиома, Невусы.'
  },
  genetics: {
    title: 'Генетический анализ (Genomic Clinical Review)',
    requirements: `
1. Варианты: Номенклатура HGVS, rsID.
2. Интерпретация: ACMG классификация.
3. Ассоциации: Фенотип по OMIM.
`,
    pathologies: 'Наследственные синдромы, генетические риски.'
  },
  mammography: {
    title: 'Маммография (BI-RADS Expert Protocol)',
    requirements: `
1. Тип плотности ткани: ACR.
2. Массы: Форма, края, плотность.
3. Кальцинаты: Тип и распределение.
4. BI-RADS категория.
`,
    pathologies: 'BI-RADS 1-6, подозрение на рак.'
  },
  histology: {
    title: 'Гистология (Digital Pathology Analysis)',
    requirements: `
1. Клеточный состав: Полиморфизм, митозы.
2. Архитектура: Инвазия, слои.
3. Границы резекции.
`,
    pathologies: 'Карциномы, саркомы, дисплазии.'
  },
  retinal: {
    title: 'Офтальмоскопия (Expert Retinal Scan)',
    requirements: `
1. Сетчатка: Цвет, геморрагии, экссудаты.
2. ДЗН: Границы, экскавация.
3. Сосуды: Калибр, ход, симптомы перекреста.
`,
    pathologies: 'Ретинопатия, ангиопатия, ВМД, глаукома.'
  },
  universal: {
    title: 'Медицинская Визуализация (Expert Systematic Review)',
    requirements: `
1. Системный поиск: Оценка всех видимых структур.
2. Характеристика находок: Локализация, размер, форма, плотность.
`,
    pathologies: 'Любые видимые патологические изменения.'
  }
};

export type ImageType = keyof typeof SPECIALIST_CRITERIA;

export type Specialty = 
  | 'universal' 
  | 'cardiology' 
  | 'neurology' 
  | 'radiology' 
  | 'oncology' 
  | 'hematology' 
  | 'endocrinology' 
  | 'gynecology' 
  | 'rheumatology'
  | 'traumatology'
  | 'gastroenterology'
  | 'dermatology'
  | 'pediatrics';

export const SPECIALTY_CONTEXTS: Record<Specialty, string> = {
  universal: '',
  cardiology: `### КАРДИОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: ишемия, аритмии, сердечная недостаточность.`,
  neurology: `### НЕВРОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: инсульт, демиелинизация, объемные образования.`,
  radiology: `### РЕНТГЕНОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Стандарт RSNA, морфология, плотность (HU).`,
  oncology: `### ОНКОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: TNM стадирование, границы, лимфоузлы.`,
  hematology: `### ГЕМАТОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: морфология клеток, бласты.`,
  endocrinology: `### ЭНДОКРИНОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: объем желез, структура, TI-RADS.`,
  gynecology: `### ГИНЕКОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: эндометрий, яичники, миомы.`,
  rheumatology: `### РЕВМАТОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: синовит, эрозии, сужение щелей.`,
  traumatology: `### ТРАВМАТОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: переломы, вывихи, смещения.`,
  gastroenterology: `### ГАСТРОЭНТЕРОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: заболевания ЖКТ и печени.`,
  dermatology: `### ДЕРМАТОЛОГИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: кожные новообразования.`,
  pediatrics: `### ПЕДИАТРИЧЕСКИЙ КОНТЕКСТ:\n- Приоритет: возрастные нормы.`,
};

export const TITAN_CONTEXTS: Record<Specialty, string> = {
  universal: '',
  cardiology: `### РОЛЬ: КАРДИОЛОГ (ШКОЛА ЮДЖИНА БРАУНВАЛЬДА)\nТы — эксперт мирового уровня. База: Braunwald's Heart Disease 12th Ed (2024).`,
  neurology: `### РОЛЬ: НЕВРОЛОГ / НЕЙРОРАДИОЛОГ (ШКОЛА ЭНН ОСБОРН)\nТы — эксперт нейровизуализации. База: Osborn's Brain 3rd Ed (2024).`,
  radiology: `### РОЛЬ: РЕНТГЕНОЛОГ (МЕТОДОЛОГИЯ БЕНДЖАМИНА ФЕЛСОНА)\nТы — врач-рентгенолог экспертного уровня.`,
  oncology: `### РОЛЬ: ОНКОЛОГ (ШКОЛА ВИНСЕНТА ДЕ ВИТА)\nТы — онколог экспертного уровня. База: DeVita's Oncology 12th Ed (2024).`,
  hematology: `### РОЛЬ: ГЕМАТОЛОГ (ШКОЛА МАКСВЕЛЛА ВИНТРОБА)\nТы — эксперт в области заболеваний крови.`,
  endocrinology: `### РОЛЬ: АКАДЕМИК РАН\nТы — эксперт академического уровня. База: Williams Textbook of Endocrinology 15th Ed (2024) и протоколы ЭНЦ / РАЭ.`,
  gynecology: `### РОЛЬ: ГИНЕКОЛОГ (ШКОЛА УИЛЬЯМСА / НОВАКА)\nТы — эксперт в области репродуктивного здоровья.`,
  rheumatology: `### РОЛЬ: РЕВМАТОЛОГ (ШКОЛА КЕЛЛИ / ФАЙРШТЕЙНА)\nТы — эксперт в системных заболеваниях соединительной ткани.`,
  traumatology: `### РОЛЬ: ТРАВМАТОЛОГ-ОРТОПЕД (ШКОЛА КЭМПБЕЛЛА / РОКВУДА)\nТы — эксперт в области повреждений опорно-двигательного аппарата.`,
  gastroenterology: `### РОЛЬ: ГАСТРОЭНТЕРОЛОГ (ШКОЛА СЛЕЙЗЕНДЖЕРА)\nТы — эксперт в заболеваниях ЖКТ и печени.`,
  dermatology: `### РОЛЬ: ДЕРМАТОЛОГ (ШКОЛА ТОМАСА ФИЦПАТРИКА)\nТы — эксперт в дерматологии.`,
  pediatrics: `### РОЛЬ: ПЕДИАТР (ШКОЛА УОЛДО НЕЛЬСОНА)\nТы — детский врач экспертного уровня.`,
};

export function getDescriptionPrompt(imageType: ImageType, specialty?: Specialty): string {
  const criteria = SPECIALIST_CRITERIA[imageType] || SPECIALIST_CRITERIA.universal;
  const specialtyContext = specialty && SPECIALTY_CONTEXTS[specialty] ? SPECIALTY_CONTEXTS[specialty] : '';
  
  return `
Ты — Vision-AI эксперт (роль: Специалист, профиль: ${criteria.title}).
${specialtyContext}

Твоя задача: найти ПАТОЛОГИИ и выдать их в СЖАТОМ JSON для анализа Профессором.

### АЛГОРИТМ:
${criteria.requirements}

### ИСКАТЬ:
${criteria.pathologies}

### ФОРМАТ JSON:
{
  "mod": "${imageType}",
  "findings": [
    {
      "loc": "локализация",
      "sign": "признак",
      "desc": "детали",
      "sev": 1-3
    }
  ]
}
`;
}

export function getObjectiveDescriptionPrompt(imageType: ImageType, specialty?: Specialty): string {
  const criteria = SPECIALIST_CRITERIA[imageType] || SPECIALIST_CRITERIA.universal;
  const specialtyContext = specialty && SPECIALTY_CONTEXTS[specialty] ? SPECIALTY_CONTEXTS[specialty] : '';
  
  return `
Ты — Vision-AI эксперт (роль: Специалист, профиль: ${criteria.title}).
${specialtyContext}

Твоя задача: дать профессиональное описание выявленных изменений в стиле медицинского протокола.

### ТРЕБОВАНИЯ:
${criteria.requirements}

### ФОКУС:
${criteria.pathologies}

### ФОРМАТ:
- Пиши подробный ТЕКСТ (не JSON).
- Используй Markdown.
- Будь точен в измерениях и локализации.
`;
}

export function getDirectivePrompt(imageType: ImageType, userPrompt: string = '', specialty?: Specialty): string {
  const criteria = SPECIALIST_CRITERIA[imageType] || SPECIALIST_CRITERIA.universal;
  let roleTitle = "Профессор клинической медицины (Board Certified)";
  let academicBase = "Универсальный междисциплинарный подход, доказательная медицина.";
  
  let prompt = `
Ты — ${roleTitle}. Проанализируй данные от Специалиста и сформируй КЛИНИЧЕСКУЮ ДИРЕКТИВУ.
База: ${academicBase}

### ЗАДАЧИ:
1. Синтез данных.
2. Оценка клинической значимости.
3. Пошаговый план (диагностика, терапия, мониторинг).

### ЗАПРОС:
${userPrompt || 'Сформируй полный клинический план.'}
`;

  if (specialty && TITAN_CONTEXTS[specialty]) {
    prompt += `\n${TITAN_CONTEXTS[specialty]}`;
  } else if (specialty && SPECIALTY_CONTEXTS[specialty]) {
    prompt += `\n${SPECIALTY_CONTEXTS[specialty]}`;
  }

  prompt += `\n${COMMON_FORMAT}`;
  return prompt;
}

export function getSpecializedPrompt(imageType: ImageType, specialty?: Specialty, userPrompt?: string): string {
  return getDirectivePrompt(imageType, userPrompt, specialty);
}

export function getPrompt(imageType: ImageType, mode: 'fast' | 'optimized', specialty?: Specialty): string {
  return mode === 'fast' ? getDescriptionPrompt(imageType, specialty) : getDirectivePrompt(imageType, '', specialty);
}

export function getFastAnalysisPrompt(imageType: ImageType, specialty?: Specialty): string {
  return getDirectivePrompt(imageType, 'Дай краткий разбор основных патологий.', specialty);
}
