/**
 * Утилиты для парсинга лабораторных данных из текстовых заключений
 */

export interface ParsedLabValue {
  name: string
  value: number
  unit: string
  date: string
}

const COMMON_LABS = [
  { names: ['гемоглобин', 'hb', 'hgb'], label: 'Гемоглобин', unit: 'г/л' },
  { names: ['глюкоза', 'сахар', 'glucose'], label: 'Глюкоза', unit: 'ммоль/л' },
  { names: ['креатинин', 'creatinine'], label: 'Креатинин', unit: 'мкмоль/л' },
  { names: ['холестерин', 'cholesterol', 'хс'], label: 'Холестерин', unit: 'ммоль/л' },
  { names: ['ферритин', 'ferritin'], label: 'Ферритин', unit: 'нг/мл' },
  { names: ['ттг', 'tsh'], label: 'ТТГ', unit: 'мкМЕ/мл' },
];

/**
 * Пытается извлечь числовые значения из текста заключения
 */
export function extractLabTrends(conclusions: Array<{date: string, text: string}>): Record<string, any[]> {
  const trends: Record<string, any[]> = {};

  conclusions.forEach(record => {
    const text = record.text.toLowerCase();
    
    COMMON_LABS.forEach(lab => {
      for (const name of lab.names) {
        // Ищем паттерн: название + пробел/двоеточие + число
        // Пример: "Гемоглобин: 120" или "Hb 13.5"
        const regex = new RegExp(`${name}[\\s:\\-]+(\\d+[.,]?\\d*)`, 'i');
        const match = text.match(regex);
        
        if (match && match[1]) {
          const value = parseFloat(match[1].replace(',', '.'));
          if (!isNaN(value)) {
            if (!trends[lab.label]) trends[lab.label] = [];
            trends[lab.label].push({
              date: record.date,
              value: value,
              unit: lab.unit
            });
            break; // Нашли одно название из группы, идем к следующему лабу
          }
        }
      }
    });
  });

  return trends;
}
