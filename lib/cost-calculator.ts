/**
 * Утилита для расчета стоимости использования моделей OpenRouter
 */

// Цены моделей в USD за 1M токенов (актуальные цены OpenRouter - обновлено 05.01.2026)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4.6': { input: 5.0, output: 25.0 },
  'anthropic/claude-opus-4.7': { input: 5.0, output: 25.0 },
  'anthropic/claude-sonnet-4.5': { input: 3.0, output: 15.0 },
  'anthropic/claude-sonnet-4.6': { input: 3.0, output: 15.0 },
  'openai/gpt-5.2-chat': { input: 2.5, output: 10.0 }, // Legacy pricing key (for historical logs)
  'openai/gpt-5.4': { input: 2.5, output: 10.0 }, // GPT-5.4 (update from GPT-5.2 path)
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'meta-llama/llama-3.2-90b-vision-instruct': { input: 0.15, output: 0.60 },
  'google/gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'google/gemini-3.1-pro-preview': { input: 2.00, output: 12.00 },
  'perplexity/sonar': { input: 1.0, output: 1.0 },
};

// Цена за 1 минуту аудио транскрипции в условных единицах (у.е.)
// 1 у.е. за минуту — это примерно $0.01 (при PRICE_MULTIPLIER = 100)
export const AUDIO_TRANSCRIPTION_PRICE_PER_MINUTE = 1.0;

// Множитель для перевода в условные единицы (USD * 100)
const PRICE_MULTIPLIER = 100;

export interface CostInfo {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  totalCostUnits: number;
}

export interface UsageStage {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
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
    return { input: 0.25, output: 1.25 };
  } else if (modelLower.includes('gemini-3.1-pro')) {
    return { input: 2.00, output: 12.00 };
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
 * Рассчитать суммарную стоимость нескольких этапов (разные модели).
 */
export function calculateCombinedCost(stages: UsageStage[]) {
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let totalCostUnits = 0;

  for (const stage of stages) {
    const prompt = stage.prompt_tokens || 0;
    const completion = stage.completion_tokens || 0;
    const stageCost = calculateCost(prompt, completion, stage.model);

    totalPromptTokens += prompt;
    totalCompletionTokens += completion;
    totalCostUsd += stageCost.totalCostUsd;
    totalCostUnits += stageCost.totalCostUnits;
  }

  return {
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens: totalPromptTokens + totalCompletionTokens,
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
  const total = totalTokens ?? (inputTokens + outputTokens);
  const costInfo = calculateCost(inputTokens, outputTokens, model);
  
  // Используем ANSI-коды для цветов в терминале
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const magenta = '\x1b[35m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  const modelDisplay = model.split('/').pop() || model;

  return `
${cyan}╔══════════════════════════════════════════════════════════════╗${reset}
${cyan}║${reset} ${bold}${green}                💰 ОТЧЕТ ОБ ИСПОЛЬЗОВАНИИ${reset}                     ${cyan}║${reset}
${cyan}╠══════════════════════════════════════════════════════════════╣${reset}
${cyan}║${reset} 🤖 ${bold}Модель:${reset}   ${yellow}${modelDisplay.padEnd(43)}${reset} ${cyan}║${reset}
${cyan}║${reset} 📊 ${bold}Токены:${reset}   ${magenta}${total.toLocaleString('ru-RU').padEnd(43)}${reset} ${cyan}║${reset}
${cyan}║${reset}    (Вход: ${inputTokens.toLocaleString('ru-RU')} / Выход: ${outputTokens.toLocaleString('ru-RU')})             ${cyan}║${reset}
${cyan}╠══════════════════════════════════════════════════════════════╣${reset}
${cyan}║${reset} 💎 ${bold}Единицы:${reset}  ${bold}${green}${costInfo.totalCostUnits.toFixed(2).padEnd(43)}${reset} ${cyan}║${reset}
${cyan}║${reset} 💵 USD:${reset}      $${costInfo.totalCostUsd.toFixed(4).padEnd(42)} ${cyan}║${reset}
${cyan}╚══════════════════════════════════════════════════════════════╝${reset}
`;
}
