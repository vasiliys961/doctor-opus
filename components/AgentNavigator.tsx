'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { SCENARIOS } from '@/lib/agent/scenarios'
import { routeIntent } from '@/lib/agent/intent-router'
import { cancelGuide, highlightElement } from '@/lib/agent/guide'
import type { AgentAction, AgentMessage, AgentOption, AgentScenario } from '@/lib/agent/types'

/**
 * AI-Навигатор — агент-надстройка поверх готовых разделов.
 *
 * Живёт в layout (как OnboardingTour), поэтому состояние диалога сохраняется
 * при переходах между страницами. Ядро приложения не модифицируется:
 * агент только переходит по разделам и подсвечивает существующие элементы.
 *
 * Включён по умолчанию; выключается флагом NEXT_PUBLIC_AGENT_NAVIGATOR=0.
 */

const ENABLED = process.env.NEXT_PUBLIC_AGENT_NAVIGATOR !== '0'

const GREETING =
  'Я навигатор приложения. Скажите, что нужно — например «обработать ЭКГ», «разобрать снимок рентгена», «сколько осталось денег» — или выберите частые сценарии ниже.'

const FEATURED_SCENARIOS = SCENARIOS.filter((item) => item.featured)

export default function AgentNavigator() {
  const { status } = useSession()
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([{ role: 'bot', text: GREETING }])
  const [scenario, setScenario] = useState<AgentScenario | null>(null)
  const [stepId, setStepId] = useState<string | null>(null)
  const [input, setInput] = useState('')

  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isOpen])

  const addBot = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'bot', text }])
  }, [])

  const addUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }])
  }, [])

  const runActions = useCallback(
    (actions?: AgentAction[]) => {
      if (!actions) return
      for (const action of actions) {
        switch (action.type) {
          case 'navigate':
            router.push(action.href)
            break
          case 'highlight':
            void highlightElement({
              selector: action.selector,
              title: action.title,
              text: action.text,
              on: action.on,
            })
            break
          case 'message':
            addBot(action.text)
            break
        }
      }
    },
    [router, addBot]
  )

  const goToStep = useCallback(
    (target: AgentScenario, nextStepId?: string) => {
      if (!nextStepId) {
        setStepId(null)
        return
      }
      const step = target.steps[nextStepId]
      if (!step) {
        setStepId(null)
        return
      }
      setStepId(step.id)
      addBot(step.message)
      runActions(step.onEnter)
    },
    [addBot, runActions]
  )

  const startScenario = useCallback(
    (target: AgentScenario) => {
      cancelGuide()
      setScenario(target)
      goToStep(target, target.start)
    },
    [goToStep]
  )

  const resetToMenu = useCallback(() => {
    cancelGuide()
    setScenario(null)
    setStepId(null)
    setMessages([{ role: 'bot', text: GREETING }])
  }, [])

  const handleOption = useCallback(
    (option: AgentOption) => {
      if (!scenario) return
      addUser(option.label)
      runActions(option.actions)
      goToStep(scenario, option.next)
    },
    [scenario, addUser, runActions, goToStep]
  )

  const handleSubmit = useCallback(() => {
    const text = input.trim()
    if (!text) return
    addUser(text)
    setInput('')

    const matched = routeIntent(text)
    if (matched) {
      startScenario(matched)
    } else {
      addBot('Не уверен, какой раздел нужен. Выберите один из вариантов ниже.')
      setScenario(null)
      setStepId(null)
    }
  }, [input, addUser, addBot, startScenario])

  useEffect(() => () => cancelGuide(), [])

  if (!ENABLED || status !== 'authenticated') return null

  const currentStep = scenario && stepId ? scenario.steps[stepId] : null
  const showMenu = !currentStep

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Открыть AI-навигатор"
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-white shadow-xl transition-transform hover:scale-105 hover:bg-primary-700 active:scale-95"
        >
          <span className="text-lg">🧭</span>
          <span className="text-sm font-semibold">Навигатор</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-[60] flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-primary-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-primary-700 to-primary-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <span className="text-sm font-bold">AI-Навигатор</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetToMenu}
                className="rounded px-2 py-1 text-[11px] font-medium text-white/90 transition-colors hover:bg-white/15"
              >
                В начало
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Свернуть навигатор"
                className="rounded px-2 py-1 text-sm transition-colors hover:bg-white/15"
              >
                ✕
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === 'bot' ? 'flex justify-start' : 'flex justify-end'}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    message.role === 'bot'
                      ? 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
                      : 'rounded-br-sm bg-primary-600 text-white'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 bg-white px-3 py-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {showMenu
                ? FEATURED_SCENARIOS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        addUser(item.title)
                        startScenario(item)
                      }}
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-100"
                    >
                      {item.icon} {item.title}
                    </button>
                  ))
                : currentStep?.options?.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => handleOption(option)}
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-100"
                    >
                      {option.label}
                    </button>
                  ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSubmit()
                }}
                placeholder="Опишите задачу…"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <button
                onClick={handleSubmit}
                className="shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
