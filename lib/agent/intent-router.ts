import type { AgentScenario } from './types'
import { SCENARIOS } from './scenarios'

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

