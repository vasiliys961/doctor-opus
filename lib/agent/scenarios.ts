import type { AgentScenario, AgentStep } from './types'

/**
 * Сценарии AI-Навигатора как данные.
 *
 * Принципы:
 * - Переиспользуем существующий механизм подсветки (shepherd.js + data-tour).
 * - Универсальный якорь `upload-zone` объявлен в компоненте ImageUpload —
 *   работает на всех разделах с загрузкой файла.
 * - Перенос результата делаем через ГОТОВЫЕ кнопки на странице результата
 *   (`result-to-protocol`, `result-to-consultant`): они корректно переносят
 *   данные в протокол и подбирают профильного специалиста. Агент только
 *   подсвечивает их, не дублируя логику (KISS + переиспользование).
 */

/** Общий завершающий шаг: подсветка готовых кнопок переноса результата. */
function buildTransferStep(): AgentStep {
  return {
    id: 'next',
    message:
      'Результат готов. Перенесите его готовыми кнопками под разбором — данные подставятся автоматически.',
    options: [
      {
        label: '📋 В протокол',
        actions: [
          {
            type: 'highlight',
            selector: '[data-tour="result-to-protocol"]',
            title: 'Перенос в протокол',
            text: 'Нажмите эту кнопку — очищенный разбор сам перенесётся в раздел «Протокол».',
            on: 'top',
          },
        ],
        next: 'done',
      },
      {
        label: '👨‍⚕️ Обсудить со специалистом',
        actions: [
          {
            type: 'highlight',
            selector: '[data-tour="result-to-consultant"]',
            title: 'Обсудить тактику',
            text: 'Нажмите — откроется чат с автоматически подобранным профильным специалистом и готовым контекстом.',
            on: 'top',
          },
        ],
        next: 'done',
      },
      { label: 'Готово, спасибо', next: 'done' },
    ],
  }
}

/** Общий шаг «загрузить со смартфона» с возвратом на нужную страницу. */
function buildPhoneStep(returnHref: string, backStepId = 'source'): AgentStep {
  return {
    id: 'phone',
    message:
      'Чтобы прислать снимок с телефона:\n1) Открываю «Подключить смартфон».\n2) Отсканируйте QR-код камерой телефона.\n3) Сделайте фото — оно попадёт в приложение.\n4) Вернитесь и нажмите «Загрузить из смартфона» в зоне загрузки.',
    onEnter: [{ type: 'navigate', href: '/mobile-bridge' }],
    options: [
      {
        label: '✅ Снимок прислал',
        actions: [
          { type: 'navigate', href: returnHref },
          {
            type: 'highlight',
            selector: '[data-tour="upload-zone"]',
            title: 'Загрузка со смартфона',
            text: 'Нажмите «Загрузить из смартфона» в этой области и выберите присланный снимок.',
            on: 'bottom',
          },
        ],
        next: 'run',
      },
      { label: 'Назад', next: backStepId },
    ],
  }
}

const DONE_STEP: AgentStep = {
  id: 'done',
  message: 'Готово. Если понадобится другой сценарий — нажмите «В начало».',
}

interface ImageFlowConfig {
  id: string
  title: string
  icon: string
  keywords: string[]
  href: string
  uploadNoun: string
  featured?: boolean
}

/** Типовой поток с загрузкой изображения и анализом. */
function buildImageFlow(config: ImageFlowConfig): AgentScenario {
  return {
    id: config.id,
    title: config.title,
    icon: config.icon,
    keywords: config.keywords,
    featured: config.featured,
    start: 'source',
    steps: {
      source: {
        id: 'source',
        message: `Открываю «${config.title}». Загрузите ${config.uploadNoun} — файлом, фото или со смартфона.`,
        onEnter: [
          { type: 'navigate', href: config.href },
          {
            type: 'highlight',
            selector: '[data-tour="upload-zone"]',
            title: 'Загрузка файла',
            text: `Загрузите ${config.uploadNoun} сюда. Рекомендую заранее закрасить персональные данные кнопкой анонимизации.`,
            on: 'bottom',
          },
        ],
        options: [
          { label: '✅ Загрузил', next: 'run' },
          { label: '📲 Загрузить со смартфона', next: 'phone' },
        ],
      },
      phone: buildPhoneStep(config.href),
      run: {
        id: 'run',
        message:
          'Выберите режим точности и запустите анализ: ⚡ Быстрый — скрининг, ⭐ Оптимизированный — рекомендуемый баланс, 🧠 С валидацией — для сложных случаев.',
        options: [{ label: '✅ Получил результат', next: 'next' }],
      },
      next: buildTransferStep(),
      done: DONE_STEP,
    },
  }
}

interface NavInfoConfig {
  id: string
  title: string
  icon: string
  keywords: string[]
  href: string
  hint: string
  featured?: boolean
}

/** Простой поток: открыть раздел и дать пояснение. */
function buildNavInfo(config: NavInfoConfig): AgentScenario {
  return {
    id: config.id,
    title: config.title,
    icon: config.icon,
    keywords: config.keywords,
    featured: config.featured,
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message: config.hint,
        onEnter: [{ type: 'navigate', href: config.href }],
        options: [{ label: 'Готово', next: 'done' }],
      },
      done: DONE_STEP,
    },
  }
}

/** Полный поток ЭКГ — расширенный референс с подсветкой конкретных кнопок. */
const ecgScenario: AgentScenario = {
  id: 'ecg',
  title: 'Обработать ЭКГ',
  icon: '📈',
  featured: true,
  keywords: ['экг', 'ecg', 'кардиограмма', 'электрокардиограмма', 'ритм сердца'],
  start: 'source',
  steps: {
    source: {
      id: 'source',
      message: 'Помогу обработать ЭКГ. Откуда возьмём изображение?',
      options: [
        {
          label: '📷 Сделать фото / выбрать файл',
          actions: [
            { type: 'navigate', href: '/ecg' },
            {
              type: 'highlight',
              selector: '[data-tour="ecg-upload-zone"]',
              title: 'Загрузка ЭКГ',
              text: 'Загрузите фото или файл ЭКГ в эту область. Можно снять камерой телефона.',
              on: 'bottom',
            },
          ],
          next: 'uploaded',
        },
        {
          label: '📲 Подключить телефон',
          actions: [{ type: 'navigate', href: '/mobile-bridge' }],
          next: 'phone',
        },
      ],
    },
    phone: {
      id: 'phone',
      message:
        'Открыл «Подключить смартфон». Отсканируйте QR-код камерой телефона, сделайте фото ЭКГ — оно прилетит в приложение. Затем вернитесь сюда.',
      options: [{ label: '✅ Фото загружено', next: 'anon', actions: [{ type: 'navigate', href: '/ecg' }] }],
    },
    uploaded: {
      id: 'uploaded',
      message: 'Когда ЭКГ загружена, переходим к настройке разбора.',
      options: [{ label: '✅ Загрузил', next: 'anon' }],
    },
    anon: {
      id: 'anon',
      message:
        'Рекомендую разовый анонимный разбор: результат не сохранится в базу пациентов (максимальная защита персональных данных). Включить?',
      options: [
        {
          label: '🛡️ Включить анонимный',
          actions: [
            {
              type: 'highlight',
              selector: '[data-tour="ecg-anonymous"]',
              title: 'Анонимный режим',
              text: 'Поставьте эту галочку — анализ не будет сохранён в базу.',
              on: 'bottom',
            },
          ],
          next: 'mode',
        },
        { label: 'Пропустить', next: 'mode' },
      ],
    },
    mode: {
      id: 'mode',
      message: 'Какой режим точности нужен?',
      options: [
        {
          label: '⚡ Быстрый',
          actions: [
            {
              type: 'highlight',
              selector: '[data-tour="ecg-analyze-fast"]',
              title: 'Быстрый анализ',
              text: 'Нажмите эту кнопку для быстрого скрининга ЭКГ.',
              on: 'top',
            },
          ],
          next: 'run',
        },
        {
          label: '⭐ Оптимизированный',
          actions: [
            {
              type: 'highlight',
              selector: '[data-tour="ecg-analyze-optimized"]',
              title: 'Оптимизированный анализ',
              text: 'Рекомендуемый баланс точности и качества. Нажмите эту кнопку.',
              on: 'top',
            },
          ],
          next: 'run',
        },
        {
          label: '🧠 С валидацией',
          actions: [
            {
              type: 'highlight',
              selector: '[data-tour="ecg-analyze-validated"]',
              title: 'Экспертный анализ',
              text: 'Максимальная точность для сложных случаев. Нажмите эту кнопку.',
              on: 'top',
            },
          ],
          next: 'run',
        },
      ],
    },
    run: {
      id: 'run',
      message: 'Нажмите подсвеченную кнопку анализа и дождитесь результата.',
      options: [{ label: '✅ Получил результат', next: 'next' }],
    },
    next: buildTransferStep(),
    done: DONE_STEP,
  },
}

/**
 * Универсальный анализ изображения с выбором модальности (п.2):
 * врач сразу выбирает рентген/МРТ/КТ/УЗИ/дерматоскопию или «другое».
 */
const imageChooserScenario: AgentScenario = {
  id: 'image',
  title: 'Анализ изображения',
  icon: '🔍',
  featured: true,
  keywords: ['изображен', 'снимок', 'фото', 'картинк', 'проанализир изображен'],
  start: 'choose',
  steps: {
    choose: {
      id: 'choose',
      message:
        'Что именно анализируем? Выберите вид исследования (или просто напишите словами: «МРТ», «рентген» и т.д.).',
      options: [
        {
          label: '🩻 Рентген',
          actions: [
            { type: 'navigate', href: '/xray' },
            { type: 'highlight', selector: '[data-tour="upload-zone"]', title: 'Загрузка снимка', text: 'Загрузите снимок рентгена сюда.', on: 'bottom' },
          ],
          next: 'run',
        },
        {
          label: '🧠 МРТ',
          actions: [
            { type: 'navigate', href: '/mri' },
            { type: 'highlight', selector: '[data-tour="upload-zone"]', title: 'Загрузка снимка', text: 'Загрузите снимок МРТ сюда.', on: 'bottom' },
          ],
          next: 'run',
        },
        {
          label: '🩻 КТ',
          actions: [
            { type: 'navigate', href: '/ct' },
            { type: 'highlight', selector: '[data-tour="upload-zone"]', title: 'Загрузка снимка', text: 'Загрузите снимок КТ сюда.', on: 'bottom' },
          ],
          next: 'run',
        },
        {
          label: '🔊 УЗИ',
          actions: [
            { type: 'navigate', href: '/ultrasound' },
            { type: 'highlight', selector: '[data-tour="upload-zone"]', title: 'Загрузка снимка', text: 'Загрузите изображение УЗИ сюда.', on: 'bottom' },
          ],
          next: 'run',
        },
        {
          label: '🔬 Дерматоскопия',
          actions: [
            { type: 'navigate', href: '/dermatoscopy' },
            { type: 'highlight', selector: '[data-tour="upload-zone"]', title: 'Загрузка снимка', text: 'Загрузите снимок дерматоскопии сюда.', on: 'bottom' },
          ],
          next: 'run',
        },
        {
          label: '📷 Другое изображение',
          actions: [
            { type: 'navigate', href: '/image-analysis' },
            { type: 'highlight', selector: '[data-tour="upload-zone"]', title: 'Загрузка изображения', text: 'Загрузите медицинское изображение сюда.', on: 'bottom' },
          ],
          next: 'run',
        },
        { label: '📲 Загрузить со смартфона', next: 'phone' },
      ],
    },
    phone: buildPhoneStep('/image-analysis', 'choose'),
    run: {
      id: 'run',
      message:
        'Выберите режим точности и запустите анализ: ⚡ Быстрый, ⭐ Оптимизированный (рекомендуемый), 🧠 С валидацией.\n\nПосле результата смотрите блок «Релевантные источники»: он подбирает ссылки по вероятным диагнозам/находкам, а не только по типу изображения.',
      options: [{ label: '✅ Получил результат', next: 'next' }],
    },
    next: buildTransferStep(),
    done: DONE_STEP,
  },
}

/** Клинический разбор: изображение + контекст ИЛИ только текст → в чат (п.5). */
const advancedScenario: AgentScenario = {
  id: 'advanced',
  title: 'Клинический разбор',
  icon: '🔬',
  keywords: ['клиническ разбор', 'разбор случа', 'консилиум', 'сложн случа', 'разбор пациент'],
  start: 'intro',
  steps: {
    intro: {
      id: 'intro',
      message:
        '«Клинический разбор» работает со снимком + клиническим контекстом. Если у вас только текстовое описание случая (без снимка) — лучше подойдёт ИИ-Ассистент. Что у вас есть?',
      options: [
        {
          label: '🖼️ Есть снимок + описание',
          actions: [
            { type: 'navigate', href: '/advanced' },
            { type: 'highlight', selector: '[data-tour="upload-zone"]', title: 'Основное изображение', text: 'Загрузите снимок, ниже добавьте клинический контекст в текстовое поле.', on: 'bottom' },
          ],
          next: 'run',
        },
        {
          label: '📝 Только текст случая',
          actions: [
            { type: 'navigate', href: '/chat' },
            { type: 'highlight', selector: '[data-tour="chat-question-input"]', title: 'Описание случая', text: 'Опишите клинический случай здесь. При желании выберите профильную специальность над полем.', on: 'top' },
          ],
          next: 'text',
        },
      ],
    },
    run: {
      id: 'run',
      message: 'Заполните клинический контекст и нажмите «Полный анализ + клиническая директива».',
      options: [{ label: '✅ Получил результат', next: 'next' }],
    },
    next: buildTransferStep(),
    text: {
      id: 'text',
      message: 'Введите описание случая и нажмите «Отправить». Ассистент даст разбор и тактику.',
      options: [{ label: 'Готово', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/** Консультация у ИИ-ассистента с пояснением RAG (п.1). */
const consultScenario: AgentScenario = {
  id: 'consult',
  title: 'Спросить ассистента',
  icon: '🤖',
  featured: true,
  keywords: ['спрос', 'вопрос', 'консультац', 'ассистент', 'чат', 'спросить специалиста'],
  start: 'ask',
  steps: {
    ask: {
      id: 'ask',
      message:
        'Открываю ИИ-Ассистента. Сформулируйте вопрос в подсвеченном поле.\n\nМожно выбрать профильную специальность и режим RAG. RAG (Retrieval-Augmented Generation) — это ответ с опорой на источники: система сначала находит релевантные фрагменты в клинических рекомендациях и вашей загруженной литературе, а затем отвечает на их основе со ссылками. Так ответ обоснован, а не «из памяти» модели.',
      onEnter: [
        { type: 'navigate', href: '/chat' },
        {
          type: 'highlight',
          selector: '[data-tour="chat-question-input"]',
          title: 'Поле вопроса',
          text: 'Введите вопрос здесь. Над полем можно выбрать специальность и источник знаний (рекомендации / литература / RAG).',
          on: 'top',
        },
      ],
      options: [{ label: 'Готово', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/** Протокол приёма (с подсветкой поля ввода). */
const protocolScenario: AgentScenario = {
  id: 'protocol',
  title: 'Протокол приёма',
  icon: '📝',
  featured: true,
  keywords: ['протокол приёма', 'протокол приема', 'оформить приём', 'оформить прием', 'заключение приёма', 'варианты ввода', 'как вводить данные'],
  start: 'open',
  steps: {
    open: {
      id: 'open',
      message:
        'Открываю протокол приёма.\n\nВарианты ввода данных в этом разделе:\n1) 🎙️ Запись беседы с пациентом — для длинной записи и авто-черновика.\n2) 🎤 Голосовой ввод данных врачом — короткая диктовка прямо в поле.\n3) 📁 Аудио файл — загрузка готовой записи.\n4) ✍️ Ручной ввод текста.\n\nПосле ввода нажмите «Создать протокол».\n\nПодсказка: если вы пришли из готового разбора (ЭКГ, снимок), используйте на странице результата кнопку «В протокол» — текст подставится автоматически.',
      onEnter: [
        { type: 'navigate', href: '/protocol' },
        {
          type: 'highlight',
          selector: '[data-tour="protocol-input"]',
          title: 'Текст осмотра',
          text: 'Опишите осмотр обезличенно — на основе этого будет сформирован протокол.',
          on: 'top',
        },
      ],
      options: [{ label: 'Готово', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/** Пошаговое подключение приборов (п.4). */
const devicesScenario: AgentScenario = {
  id: 'devices',
  title: 'Подключить прибор',
  icon: '🔌',
  featured: true,
  keywords: ['прибор', 'подключ прибор', 'устройств', 'спиромет', 'серийн порт', 'датчик', 'аппарат'],
  start: 'choose',
  steps: {
    choose: {
      id: 'choose',
      message: 'Открываю «Подключение приборов». Важно: работает только в Google Chrome. Какой прибор подключаем?',
      onEnter: [{ type: 'navigate', href: '/devices' }],
      options: [
        {
          label: '📈 ЭКГ',
          actions: [{ type: 'highlight', selector: '[data-tour="device-tab-ecg"]', title: 'Вкладка ЭКГ', text: 'Откройте эту вкладку.', on: 'bottom' }],
          next: 'serial',
        },
        {
          label: '🫁 Спирометр',
          actions: [{ type: 'highlight', selector: '[data-tour="device-tab-spirometry"]', title: 'Вкладка спирометрии', text: 'Откройте эту вкладку.', on: 'bottom' }],
          next: 'serial',
        },
        {
          label: '🩸 Глюкоза (CGM)',
          actions: [{ type: 'highlight', selector: '[data-tour="device-tab-glucose"]', title: 'Вкладка глюкозы', text: 'Откройте эту вкладку.', on: 'bottom' }],
          next: 'glucose',
        },
        {
          label: '🔊 УЗИ / Эндоскоп',
          actions: [{ type: 'highlight', selector: '[data-tour="device-tab-camera"]', title: 'Вкладка камеры', text: 'Откройте эту вкладку.', on: 'bottom' }],
          next: 'camera',
        },
      ],
    },
    serial: {
      id: 'serial',
      message:
        'Подключение по USB:\n1) Подключите прибор USB-кабелем к компьютеру.\n2) Нажмите «Подключить» и выберите порт в окне браузера.\n3) Запустите запись.\n4) После сбора данных нажмите «Анализировать».',
      options: [{ label: 'Готово', next: 'done' }],
    },
    glucose: {
      id: 'glucose',
      message:
        'Глюкозный профиль:\n1) Экспортируйте CSV из FreeStyle LibreLink или Dexcom Clarity.\n2) Загрузите файл — построится AGP-профиль.\n3) Нажмите «Анализировать» для интерпретации.',
      options: [{ label: 'Готово', next: 'done' }],
    },
    camera: {
      id: 'camera',
      message:
        'УЗИ / Эндоскоп:\n1) USB-эндоскоп — в USB; УЗИ — через HDMI → capture-карту → USB.\n2) Нажмите «Запустить» и выберите камеру.\n3) Поймайте нужный кадр → «Захватить кадр».\n4) Добавьте контекст → «Анализировать».',
      options: [{ label: 'Готово', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/** Понятный гид по базе пациентов (п.6). */
const patientsScenario: AgentScenario = {
  id: 'patients',
  title: 'База пациентов',
  icon: '👤',
  keywords: ['пациент', 'база пациент', 'карточк', 'история болезн', 'карта пациент'],
  start: 'open',
  steps: {
    open: {
      id: 'open',
      message:
        'Открываю базу пациентов. Здесь хранятся обезличенные карточки и накопленный контекст. Что показать?',
      onEnter: [{ type: 'navigate', href: '/patients' }],
      options: [
        { label: 'Как добавить пациента?', next: 'add' },
        { label: 'Как отправить данные в карту?', next: 'send' },
        { label: 'Готово', next: 'done' },
      ],
    },
    add: {
      id: 'add',
      message:
        'Добавление пациента:\n1) Нажмите «Создать пациента».\n2) Заполните обезличенные данные (например «Пациент М., 45 лет», без ФИО).\n3) Сохраните — карточка появится в списке.',
      options: [
        { label: 'А как отправлять данные?', next: 'send' },
        { label: 'Готово', next: 'done' },
      ],
    },
    send: {
      id: 'send',
      message:
        'Отправка данных в карту:\nПосле любого анализа (ЭКГ, снимок, лаборатория) на странице результата есть кнопка «📌 В карту пациента». Нажмите её и выберите пациента — заключение сохранится в его карточку.',
      options: [{ label: 'Понятно', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/** 3D-визуализация: загрузить папку DICOM и смотреть (это не анализ). */
const advanced3dScenario: AgentScenario = {
  id: 'advanced3d',
  title: '3D-визуализация',
  icon: '🧊',
  keywords: ['3d', '3д', 'трёхмерн', 'трехмерн', 'объёмн', 'реконструкц', 'визуализац'],
  start: 'open',
  steps: {
    open: {
      id: 'open',
      message:
        'Открываю 3D-визуализацию. Это просмотр объёмной модели, а не анализ. Загрузите всю папку с серией DICOM (МРТ/КТ) в подсвеченную область.',
      onEnter: [
        { type: 'navigate', href: '/advanced-3d' },
        {
          type: 'highlight',
          selector: '[data-tour="dicom-folder-upload"]',
          title: 'Загрузка серии DICOM',
          text: 'Загрузите папку целиком — из серии срезов соберётся 3D-модель.',
          on: 'bottom',
        },
      ],
      options: [{ label: '✅ Папка загружена', next: 'view' }],
    },
    view: {
      id: 'view',
      message:
        'Дождитесь сборки модели, затем вращайте её мышью и переключайтесь между режимами Clinical и Cinematic.',
      options: [{ label: 'Готово', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/** Найти в книге: загрузить книгу в библиотеку → искать по ней в чате через RAG. */
const libraryScenario: AgentScenario = {
  id: 'library',
  title: 'Найти в книге',
  icon: '📖',
  featured: true,
  keywords: ['книг', 'библиотек', 'учебник', 'загруз книг', 'найти ответ в книг'],
  start: 'upload',
  steps: {
    upload: {
      id: 'upload',
      message:
        'Открываю персональную библиотеку. Загрузите книгу (PDF) — она проиндексируется для поиска. Когда загрузка завершится, продолжим.',
      onEnter: [{ type: 'navigate', href: '/library' }],
      options: [{ label: '✅ Книга загружена', next: 'search' }],
    },
    search: {
      id: 'search',
      message:
        'Теперь ищем ответ по книге через источники библиотеки. Перехожу в ИИ-Ассистент:\n1) Включите подсвеченный тумблер «Искать по моей библиотеке».\n2) Задайте вопрос в поле и нажмите «Отправить».\nАссистент найдёт релевантные фрагменты в вашей книге и ответит со ссылками на источники.',
      onEnter: [
        { type: 'navigate', href: '/chat' },
        {
          type: 'highlight',
          selector: '[data-tour="chat-rag-toggle"]',
          title: 'Тумблер «Искать по моей библиотеке»',
          text: 'Включите его — ответы будут опираться на содержимое вашей загруженной литературы.',
          on: 'bottom',
        },
      ],
      options: [{ label: 'Готово', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/**
 * Атлас и поиск по картинке: пошаговый гид для не-специалиста.
 * Загрузить атлас (ЭКГ/дерматология) с индексацией изображений → искать
 * похожие иллюстрации по описанию или по своему фото.
 */
const atlasScenario: AgentScenario = {
  id: 'atlas',
  title: 'Поиск по картинке (атлас)',
  icon: '🖼',
  featured: true,
  keywords: [
    'атлас', 'поиск по картинк', 'поиск по изображен', 'похож снимок', 'похож картинк',
    'сравнить фото', 'сравнить экг', 'фицпатрик', 'fitzpatrick', 'найти картинк', 'визуальн поиск',
  ],
  start: 'intro',
  steps: {
    intro: {
      id: 'intro',
      message:
        'Помогу найти похожие иллюстрации в медицинском атласе — по описанию словами или по вашему фото (например, ЭКГ или родинка).\n\nСначала атлас нужно один раз загрузить с галочкой «индексировать изображения». Что у вас уже есть?',
      options: [
        { label: '📥 Загрузить новый атлас', next: 'upload' },
        { label: '🔎 Атлас уже загружен — искать', next: 'search' },
      ],
    },
    upload: {
      id: 'upload',
      message:
        'Шаг 1. Нажмите подсвеченную кнопку «Загрузить PDF» и выберите файл атласа.',
      onEnter: [
        { type: 'navigate', href: '/library' },
        {
          type: 'highlight',
          selector: '[data-tour="library-upload-pdf"]',
          title: 'Загрузка атласа',
          text: 'Нажмите и выберите PDF-атлас (например, по дерматологии или ЭКГ).',
          on: 'top',
        },
      ],
      options: [{ label: '✅ Файл выбрал', next: 'mark' }],
    },
    mark: {
      id: 'mark',
      message:
        'Шаг 2. Обязательно поставьте галочку «🖼 Это атлас — индексировать изображения». Без неё поиск по картинкам работать не будет.',
      onEnter: [
        {
          type: 'highlight',
          selector: '[data-tour="library-index-images"]',
          title: 'Включите индексацию картинок',
          text: 'Поставьте эту галочку — программа разберёт картинки атласа, а не только текст.',
          on: 'top',
        },
      ],
      options: [{ label: '✅ Галочку поставил', next: 'range' }],
    },
    range: {
      id: 'range',
      message:
        'Шаг 3 (для больших атласов, 200–300+ МБ). Чтобы не перегрузить память, укажите диапазон страниц, например с 1 по 100. Оставите пустым — обработается весь файл.\n\nВажно: подготовка атласа может идти долго (часто 10–30+ минут) — это нормально и того стоит: после индексации поиск похожих изображений становится заметно точнее. Большой атлас можно загрузить частями: сначала 1–100, потом 101–200 и т.д. — найденное суммируется.',
      onEnter: [
        {
          type: 'highlight',
          selector: '[data-tour="library-image-range"]',
          title: 'Диапазон страниц',
          text: 'Укажите страницы для тяжёлых атласов. Появляется после включения галочки выше.',
          on: 'top',
        },
      ],
      options: [{ label: '✅ Атлас обработан', next: 'search' }],
    },
    search: {
      id: 'search',
      message:
        'Теперь ищем в разделе «Медицинские изображения». В подсвеченном блоке:\n• Введите описание (например «меланома», «элевация ST») и нажмите «Найти по описанию», либо\n• Загрузите своё фото, либо используйте «По текущему снимку».\n\nЭто помощник для сравнения, а не готовый диагноз.',
      onEnter: [
        { type: 'navigate', href: '/image-analysis' },
        {
          type: 'highlight',
          selector: '[data-tour="image-library-visual-search"]',
          title: 'Поиск похожих снимков',
          text: 'Ищите по описанию, по фото или по текущему снимку — результаты покажут книгу и страницу.',
          on: 'top',
        },
      ],
      options: [{ label: 'Готово', next: 'done' }],
    },
    done: DONE_STEP,
  },
}

/** Краткая справка по релевантным источникам (в т.ч. для PDF/сканов). */
const relevanceSourcesScenario: AgentScenario = {
  id: 'relevance-sources',
  title: 'Как работают релевантные источники',
  icon: '🔗',
  featured: true,
  keywords: [
    'релевантные источники',
    'источники по диагнозу',
    'поиск в источниках',
    'ссылки по диагнозу',
    'pdf',
    'пдф',
    'скан',
  ],
  start: 'info',
  steps: {
    info: {
      id: 'info',
      message:
        'В «Медицинских изображениях» блок «Релевантные источники» подбирает ссылки по вероятным диагнозам/находкам из результата (а не только по типу исследования).\n\nЕсли у вас PDF/скан:\n1) откройте «Сканирование документов» и извлеките текст,\n2) при возможности отправьте ключевой фрагмент в «Медицинские изображения» как клинический контекст,\n3) если диагноз не выделился — вручную выберите тип исследования (рентген/КТ/МРТ/УЗИ/дерматоскопия), тогда ссылки станут точнее.',
      options: [
        {
          label: '📄 Открыть сканирование документов',
          actions: [{ type: 'navigate', href: '/document' }],
          next: 'done',
        },
        {
          label: '🔍 Открыть медицинские изображения',
          actions: [{ type: 'navigate', href: '/image-analysis' }],
          next: 'done',
        },
        { label: 'Понятно', next: 'done' },
      ],
    },
    done: DONE_STEP,
  },
}

/** Реестр всех сценариев. Порядок задаёт приоритет распознавания. */
export const SCENARIOS: AgentScenario[] = [
  // Расширенные потоки
  ecgScenario,

  // Разделы с загрузкой изображений (типовой поток, точное распознавание по ключевым словам)
  buildImageFlow({
    id: 'xray',
    title: 'Рентген',
    icon: '🩻',
    keywords: ['рентген', 'ренгеновск', 'рентгенограм', 'флюорограф'],
    href: '/xray',
    uploadNoun: 'снимок рентгена',
  }),
  buildImageFlow({
    id: 'mri',
    title: 'МРТ',
    icon: '🧠',
    keywords: ['мрт', 'mri', 'магнитно-резонанс', 'магнитно резонанс'],
    href: '/mri',
    uploadNoun: 'снимок МРТ',
  }),
  buildImageFlow({
    id: 'ct',
    title: 'КТ',
    icon: '🩻',
    keywords: ['компьютерная томограф', 'компьютерн томограф', 'кт-сним', 'кт сним', 'сделать кт', 'обработать кт'],
    href: '/ct',
    uploadNoun: 'снимок КТ',
  }),
  buildImageFlow({
    id: 'ultrasound',
    title: 'УЗИ',
    icon: '🔊',
    keywords: ['узи', 'ультразвук', 'сонограф'],
    href: '/ultrasound',
    uploadNoun: 'изображение УЗИ',
  }),
  buildImageFlow({
    id: 'dermatoscopy',
    title: 'Дерматоскопия',
    icon: '🔬',
    keywords: ['дерматоск', 'родинк', 'невус', 'кожа', 'кожн', 'меланом'],
    href: '/dermatoscopy',
    uploadNoun: 'снимок дерматоскопии',
  }),
  buildImageFlow({
    id: 'comparative',
    title: 'Сравнение снимков',
    icon: '📊',
    keywords: ['сравн', 'динамик', 'было стало', 'предыдущ', 'в сравнении'],
    href: '/comparative',
    uploadNoun: 'снимки для сравнения',
  }),
  buildImageFlow({
    id: 'video',
    title: 'Разбор видео',
    icon: '🎬',
    keywords: ['видео', 'эндоскоп', 'видеозапис', 'видеоролик'],
    href: '/video',
    uploadNoun: 'видеофайл',
  }),
  buildImageFlow({
    id: 'document',
    title: 'Сканирование документов',
    icon: '📄',
    keywords: ['документ', 'скан', 'pdf', 'выписк', 'направлени'],
    href: '/document',
    uploadNoun: 'документ или его фото',
  }),
  buildImageFlow({
    id: 'lab',
    title: 'Лабораторные анализы',
    icon: '🧪',
    keywords: ['анализ кров', 'лаборатор', 'биохими', 'оак', 'оам', 'результаты анализов'],
    href: '/lab',
    uploadNoun: 'бланк анализов или его фото',
  }),
  buildImageFlow({
    id: 'glucose',
    title: 'Гликемический профиль',
    icon: '🩸',
    keywords: ['глюкоз', 'сахар', 'гликем', 'диабет'],
    href: '/glucose',
    uploadNoun: 'CSV-файл с данными глюкозы',
  }),
  buildImageFlow({
    id: 'genetic',
    title: 'Генетический профиль',
    icon: '🧬',
    keywords: ['генетик', 'днк', 'мутаци', 'геном', 'генетическ профиль'],
    href: '/genetic',
    uploadNoun: 'файл генетического отчёта',
  }),

  // Кастомные расширенные потоки
  advancedScenario,
  advanced3dScenario,
  imageChooserScenario,
  consultScenario,
  protocolScenario,
  devicesScenario,
  patientsScenario,

  // Простые навигационные разделы
  buildNavInfo({
    id: 'protocols',
    title: 'Клинические рекомендации',
    icon: '📚',
    keywords: ['клиническ рекомендац', 'клинрек', 'стандарт лечени', 'порядок оказан', 'guidelines'],
    href: '/protocols',
    hint: 'Открываю «Клинические рекомендации».',
    featured: true,
  }),
  buildNavInfo({
    id: 'calculators',
    title: 'Мед. калькуляторы',
    icon: '🧮',
    keywords: ['калькулятор', 'посчита', 'рассчита', 'шкал', 'индекс массы', 'доза расч', 'скоринг'],
    href: '/calculators',
    hint: 'Открываю медицинские калькуляторы: шкалы, индексы и расчёты доз.',
    featured: true,
  }),
  buildNavInfo({
    id: 'mobile',
    title: 'Подключить смартфон',
    icon: '📲',
    keywords: ['смартфон', 'телефон', 'камера телефон', 'связать телефон', 'мобильн'],
    href: '/mobile-bridge',
    hint: 'Открываю «Подключить смартфон». Отсканируйте QR-код камерой телефона — после этого фото с телефона будут попадать прямо в нужный раздел приложения.',
  }),
  libraryScenario,
  atlasScenario,
  relevanceSourcesScenario,
  buildNavInfo({
    id: 'balance',
    title: 'Проверить баланс',
    icon: '💳',
    keywords: ['баланс', 'денег', 'деньги', 'оплат', 'платеж', 'счёт', 'счет', 'единиц', 'тариф', 'пополн'],
    href: '/balance',
    hint: 'Открываю раздел баланса и платежей — здесь виден остаток и история списаний.',
    featured: true,
  }),
  buildNavInfo({
    id: 'statistics',
    title: 'Расход единиц',
    icon: '📊',
    keywords: ['статистик', 'расход', 'потрачен', 'аналитик использован'],
    href: '/statistics',
    hint: 'Открываю статистику расхода единиц.',
  }),
  buildNavInfo({
    id: 'manual',
    title: 'Инструкция',
    icon: '📘',
    keywords: ['инструкци', 'руководств', 'как пользоват', 'помощь по приложен', 'справк'],
    href: '/manual',
    hint: 'Открываю инструкцию для врача с обзором сценариев работы.',
  }),
]
