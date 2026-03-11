import { Specialty } from './prompts';

export interface ChatSpecialist {
  id: Specialty;
  label: string;
  icon: string;
  description: string;
}

export const CHAT_SPECIALISTS: ChatSpecialist[] = [
  {
    id: 'universal',
    label: 'Универсальная Консультация-Эксперт',
    icon: '👨‍⚕️',
    description: 'Общий клинический разбор и междисциплинарный подход.'
  },
  {
    id: 'cardiology',
    label: 'Консультация кардиолога (школа Браунвальда)',
    icon: '❤️',
    description: 'Эксперт в области гемодинамики, ЭКГ и заболеваний сердца.'
  },
  {
    id: 'neurology',
    label: 'Консультация невролога (школа Энн Осборн)',
    icon: '🧠',
    description: 'Специалист по заболеваниям ЦНС и нейровизуализации.'
  },
  {
    id: 'endocrinology',
    label: 'Консультация эндокринолога (Академик РАН)',
    icon: '🦋',
    description: 'Академический подход к гормональным нарушениям и диабету.'
  },
  {
    id: 'radiology',
    label: 'Консультация рентгенолога (школа Фелсона)',
    icon: '☢️',
    description: 'Мастер структурного анализа рентгена, КТ и МРТ.'
  },
  {
    id: 'oncology',
    label: 'Консультация онколога (критерии Де Виты)',
    icon: '🧬',
    description: 'Эксперт по стадированию и современным протоколам терапии.'
  },
  {
    id: 'hematology',
    label: 'Консультация гематолога (школа Винтроба)',
    icon: '🩸',
    description: 'Специалист по патологии крови и костного мозга.'
  },
  {
    id: 'gynecology',
    label: 'Консультация гинеколога (школа Уильямса)',
    icon: '🌸',
    description: 'Эксперт в области женского здоровья и акушерства.'
  },
  {
    id: 'rheumatology',
    label: 'Консультация ревматолога (школа Келли)',
    icon: '🦴',
    description: 'Специалист по системным аутоиммунным заболеваниям.'
  },
  {
    id: 'traumatology',
    label: 'Консультация травматолога (школа Кэмпбелла)',
    icon: '🦾',
    description: 'Эксперт в области повреждений опорно-двигательного аппарата.'
  },
  {
    id: 'gastroenterology',
    label: 'Консультация гастроэнтеролога (школа Слейзенджера)',
    icon: '🧪',
    description: 'Эксперт по заболеваниям ЖКТ и печени.'
  },
  {
    id: 'dermatology',
    label: 'Консультация дерматолога (школа Фицпатрика)',
    icon: '🔍',
    description: 'Специалист по дерматоскопии и патологии кожи.'
  },
  {
    id: 'pediatrics',
    label: 'Консультация педиатра (школа Нельсона)',
    icon: '👶',
    description: 'Эксперт в области детских болезней и развития.'
  },
  {
    id: 'openevidence',
    label: 'Академический поиск',
    icon: '🌐',
    description: 'Поиск по медицинским базам данных и академической литературе.'
  },
  {
    id: 'ai_consultant',
    label: 'ИИ-Ассистент (Медицина)',
    icon: '🦾',
    description: 'Эксперт по внедрению нейросетей в клиническую практику: подбор инструментов и обучение.'
  },
  {
    id: 'longevai',
    label: 'Dr. LongevAI',
    icon: '🧬',
    description: 'A4M + IHS + 5P медицина: anti-aging, гормональная оптимизация, longevity-биомаркеры.'
  }
];

