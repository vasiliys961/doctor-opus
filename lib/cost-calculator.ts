/**
 * Утилита для расчета стоимости использования моделей OpenRouter
 */

// Цены моделей в USD за 1M токенов (актуальные цены OpenRouter)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4.5': { input: 15.0, output: 75.0 },
  'anthropic/claude-sonnet-4.5': { input: 3.0, output: 15.0 },
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'meta-llama/llama-3.2-90b-vision-instruct': { input: 0.50, output: 2.50 },
  'google/gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'google/gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'google/gemini-3-flash': { input: 0.50, output: 3.00 },
  'google/gemini-3-pro-preview': { input: 1.25, output: 5.00 },
  'google/gemini-3-pro': { input: 1.25, output: 5.00 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
};

// Множитель для перевода в условные единицы (USD * 100)
const PRICE_MULTIPLIER = 100;

export interface CostInfo {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  totalCostUnits: number;
}

/**
 * Получить цены для модели
 */
function getModelPricing(model: string): { input: number; output: number } {
  const modelLower = model.toLowerCase();
  
  // Точное совпадение
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }
  
  // Поиск по частичному совпадению
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (key.toLowerCase().includes(modelLower) || modelLower.includes(key.toLowerCase())) {
      return pricing;
    }
  }
  
  // Дефолтные цены по типу модели
  if (modelLower.includes('opus')) {
    return { input: 15.0, output: 75.0 };
  } else if (modelLower.includes('sonnet')) {
    return { input: 3.0, output: 15.0 };
  } else if (modelLower.includes('haiku')) {
    return { input: 1.0, output: 5.0 };
  } else if (modelLower.includes('gemini-3-pro')) {
    return { input: 1.25, output: 5.00 };
  } else if (modelLower.includes('gemini-3-flash')) {
    return { input: 0.50, output: 3.00 };
  } else if (modelLower.includes('gemini') || modelLower.includes('flash')) {
    return { input: 0.30, output: 2.50 };
  } else if (modelLower.includes('llama')) {
    return { input: 0.50, output: 2.50 };
  } else {
    // Дефолт для неизвестных моделей
    return { input: 1.0, output: 5.0 };
  }
}

/**
 * Рассчитать стоимость использования модели
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): CostInfo {
  const pricing = getModelPricing(model);
  
  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output;
  const totalCostUsd = inputCostUsd + outputCostUsd;
  const totalCostUnits = totalCostUsd * PRICE_MULTIPLIER;
  
  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,
    totalCostUnits,
  };
}

/**
 * Форматировать строку логирования с информацией о стоимости
 */
export function formatCostLog(
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens?: number
): string {
  const total = totalTokens ?? inputTokens + outputTokens;
  const costInfo = calculateCost(inputTokens, outputTokens, model);
  
  return (
    `Модель: ${model} | ` +
    `Токены: ${total.toLocaleString('ru-RU')} (вход: ${inputTokens.toLocaleString('ru-RU')}, выход: ${outputTokens.toLocaleString('ru-RU')}) | ` +
    `Стоимость: $${costInfo.totalCostUsd.toFixed(6)} USD (${costInfo.totalCostUnits.toFixed(4)} у.е.)`
  );
}

