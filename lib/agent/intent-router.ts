import type { AgentScenario } from './types'
import { SCENARIOS } from './scenarios'

/**
 * Простой словарь-роутер интентов.
 *
 * Намеренно без LLM: при ~5–25 разделах задача надёжно решается совпадением
 * по ключевым словам — это быстро, бесплатно и предсказуемо (KISS).
 * LLM-классификацию можно подключить позже как fallback, не меняя контракта.
 */
export function routeIntent(rawText: string): AgentScenario | null {
  const text = rawText.toLowerCase().trim()
  if (!text) return null

  for (const scenario of SCENARIOS) {
    if (scenario.keywords.some((keyword) => text.includes(keyword))) {
      return scenario
    }
  }

  return null
}
