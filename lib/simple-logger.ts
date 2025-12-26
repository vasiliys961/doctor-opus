/**
 * Простое логирование использования моделей по разделам
 */

import { calculateCost } from './cost-calculator';

// Маппинг URL разделов на русские названия
const SECTION_NAMES: Record<string, string> = {
  'lab': 'Лабораторные данные',
  'ecg': 'ЭКГ',
  'mri': 'МРТ',
  'ct': 'КТ',
  'xray': 'Рентген',
  'ultrasound': 'УЗИ',
  'genetic': 'Генетика',
  'video': 'Видео',
  'document': 'Сканирование документов',
  'dermatoscopy': 'Дерматоскопия',
  'image-analysis': 'Анализ изображений',
  'chat': 'ИИ-Консультант',
};

interface UsageBySectionData {
  [section: string]: {
    sectionName: string;
    calls: number;
    costUnits: number;
    models: { [model: string]: number };
  };
}

/**
 * Логировать использование модели
 */
export function logUsage(params: {
  section: string; // 'lab', 'ecg', 'mri', etc
  model: string;
  inputTokens: number;
  outputTokens: number;
}): void {
  try {
    // Проверка и очистка при смене месяца
    checkAndResetMonth();

    // Рассчитать стоимость
    const costInfo = calculateCost(params.inputTokens, params.outputTokens, params.model);

    // Загрузить текущую статистику
    const savedData = localStorage.getItem('usageBySections');
    const data: UsageBySectionData = savedData ? JSON.parse(savedData) : {};

    // Получить название раздела
    const sectionName = SECTION_NAMES[params.section] || params.section;

    // Инициализировать раздел, если его нет
    if (!data[params.section]) {
      data[params.section] = {
        sectionName,
        calls: 0,
        costUnits: 0,
        models: {},
      };
    }

    // Обновить данные
    data[params.section].calls += 1;
    data[params.section].costUnits += costInfo.totalCostUnits;
    
    // Учесть модель
    if (!data[params.section].models[params.model]) {
      data[params.section].models[params.model] = 0;
    }
    data[params.section].models[params.model] += 1;

    // Сохранить обратно
    localStorage.setItem('usageBySections', JSON.stringify(data));

    console.log(`📊 [USAGE] Logged: ${sectionName}, ${params.model}, ${costInfo.totalCostUnits.toFixed(2)} у.е.`);
  } catch (error) {
    console.error('❌ [USAGE] Error logging usage:', error);
  }
}

/**
 * Проверить текущий месяц и очистить данные при необходимости
 */
function checkAndResetMonth(): void {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthKey = `${currentYear}-${currentMonth}`;

  const savedMonth = localStorage.getItem('statsMonth');

  if (savedMonth !== monthKey) {
    // Месяц изменился - очистить данные
    localStorage.removeItem('usageBySections');
    localStorage.setItem('statsMonth', monthKey);
    console.log('📅 [USAGE] New month detected, stats reset');
  }
}

/**
 * Получить статистику по разделам
 */
export function getUsageBySections(): UsageBySectionData {
  try {
    const savedData = localStorage.getItem('usageBySections');
    return savedData ? JSON.parse(savedData) : {};
  } catch (error) {
    console.error('❌ [USAGE] Error loading usage data:', error);
    return {};
  }
}

/**
 * Получить название текущего месяца
 */
export function getCurrentMonthName(): string {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  return `${months[currentMonth]} ${currentYear}`;
}

/**
 * Очистить статистику текущего месяца
 */
export function clearCurrentMonthStats(): void {
  localStorage.removeItem('usageBySections');
  console.log('🗑️ [USAGE] Current month stats cleared');
}

