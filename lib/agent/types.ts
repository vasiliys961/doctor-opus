export type GuidePlacement = 'top' | 'bottom' | 'left' | 'right'

export type AgentAction =
  | { type: 'navigate'; href: string }
  | { type: 'highlight'; selector: string; title: string; text: string; on?: GuidePlacement }
  | { type: 'message'; text: string }

export interface AgentOption {
  label: string
  actions?: AgentAction[]
  next?: string
}

export interface AgentStep {
  id: string
  message: string
  onEnter?: AgentAction[]
  options?: AgentOption[]
}

export interface AgentScenario {
  id: string
  title: string
  icon: string
  keywords: string[]
  start: string
  steps: Record<string, AgentStep>
  featured?: boolean
}

export interface AgentMessage {
  role: 'bot' | 'user'
  text: string
}

