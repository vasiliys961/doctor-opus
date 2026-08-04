'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Locale } from '@/lib/i18n/config'
import { cancelGuide, highlightElement } from '@/lib/agent/guide'
import { routeIntent } from '@/lib/agent/intent-router'
import { SCENARIOS } from '@/lib/agent/scenarios'
import type { AgentAction, AgentMessage, AgentOption, AgentScenario } from '@/lib/agent/types'

type Props = {
  locale: Locale
}

const ENABLED = process.env.NEXT_PUBLIC_AGENT_NAVIGATOR !== '0'

const UI_TEXT: Record<
  Locale,
  { open: string; title: string; placeholder: string; reset: string; close: string; send: string; unknown: string; greeting: string }
> = {
  en: { open: 'Navigator', title: 'AI Navigator', placeholder: 'Describe your task...', reset: 'Home', close: 'Close', send: 'Send', unknown: 'I am not sure which module matches this request. Try one of the quick scenarios below.', greeting: 'I can guide you to the right module. Choose a scenario below or describe your task.' },
  es: { open: 'Navegador', title: 'Navegador IA', placeholder: 'Describe tu tarea...', reset: 'Inicio', close: 'Cerrar', send: 'Enviar', unknown: 'No estoy seguro de qué módulo corresponde. Prueba uno de los escenarios rápidos.', greeting: 'Puedo guiarte al módulo correcto. Elige un escenario o describe tu tarea.' },
  fr: { open: 'Navigateur', title: 'Navigateur IA', placeholder: 'Décrivez votre tâche...', reset: 'Accueil', close: 'Fermer', send: 'Envoyer', unknown: 'Je ne suis pas sûr du module approprié. Essayez un scénario rapide ci-dessous.', greeting: 'Je peux vous guider vers le bon module. Choisissez un scénario ou décrivez votre tâche.' },
  ar: { open: 'الموجّه', title: 'الموجّه الذكي', placeholder: 'صف المهمة...', reset: 'الرئيسية', close: 'إغلاق', send: 'إرسال', unknown: 'لست متأكدًا من الوحدة المناسبة. جرّب أحد السيناريوهات السريعة.', greeting: 'يمكنني إرشادك إلى الوحدة المناسبة. اختر سيناريو أو اكتب مهمتك.' },
  hi: { open: 'नेविगेटर', title: 'AI नेविगेटर', placeholder: 'अपना कार्य लिखें...', reset: 'होम', close: 'बंद करें', send: 'भेजें', unknown: 'यह स्पष्ट नहीं है कि कौन सा मॉड्यूल चाहिए। नीचे से एक क्विक सीनारियो चुनें।', greeting: 'मैं आपको सही मॉड्यूल तक ले जा सकता हूँ। एक सीनारियो चुनें या अपना कार्य लिखें।' },
  'pt-BR': { open: 'Navegador', title: 'Navegador IA', placeholder: 'Descreva sua tarefa...', reset: 'Início', close: 'Fechar', send: 'Enviar', unknown: 'Não tenho certeza de qual módulo corresponde. Tente um cenário rápido abaixo.', greeting: 'Posso guiar você ao módulo certo. Escolha um cenário ou descreva sua tarefa.' },
  id: { open: 'Navigator', title: 'Navigator AI', placeholder: 'Jelaskan tugas Anda...', reset: 'Beranda', close: 'Tutup', send: 'Kirim', unknown: 'Saya belum yakin modul yang tepat. Coba salah satu skenario cepat di bawah.', greeting: 'Saya bisa mengarahkan Anda ke modul yang tepat. Pilih skenario atau tulis tugas Anda.' },
  ms: { open: 'Navigator', title: 'Navigator AI', placeholder: 'Terangkan tugasan anda...', reset: 'Utama', close: 'Tutup', send: 'Hantar', unknown: 'Saya tidak pasti modul yang sesuai. Cuba salah satu senario pantas di bawah.', greeting: 'Saya boleh bimbing anda ke modul yang betul. Pilih senario atau terangkan tugasan.' },
  tr: { open: 'Gezgin', title: 'YZ Gezgin', placeholder: 'Görevinizi yazın...', reset: 'Ana', close: 'Kapat', send: 'Gönder', unknown: 'Bu isteğe uygun modülden emin değilim. Aşağıdaki hızlı senaryolardan birini seçin.', greeting: 'Sizi doğru modüle yönlendirebilirim. Bir senaryo seçin veya görevinizi yazın.' },
  'zh-CN': { open: '导航器', title: 'AI 导航器', placeholder: '请描述你的任务...', reset: '首页', close: '关闭', send: '发送', unknown: '我暂时无法确定对应模块，请先选择下面的快速场景。', greeting: '我可以引导你到正确模块。请选择场景或直接描述任务。' },
}

const FEATURED_SCENARIOS = SCENARIOS.filter((item) => item.featured)

export default function AgentNavigator({ locale }: Props) {
  const { status } = useSession()
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [scenario, setScenario] = useState<AgentScenario | null>(null)
  const [stepId, setStepId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const translationsRef = useRef<Map<string, string>>(new Map())
  const [translationsVersion, setTranslationsVersion] = useState(0)

  const t = UI_TEXT[locale]
  const greeting = useMemo(() => t.greeting, [t.greeting])

  const translateBatch = useCallback(async (texts: string[]) => {
    if (locale === 'en') return
    const uniqueTexts = Array.from(new Set(texts.map((text) => text.trim()).filter(Boolean)))
    const missing = uniqueTexts.filter((text) => !translationsRef.current.has(text))
    if (missing.length === 0) return

    try {
      const response = await fetch('/api/agent/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, texts: missing }),
      })
      const data = await response.json()
      const translated = Array.isArray(data?.translations) ? data.translations : []

      missing.forEach((text, index) => {
        const value = String(translated[index] || text).trim() || text
        translationsRef.current.set(text, value)
      })

      setTranslationsVersion((prev) => prev + 1)
    } catch {
      // Keep original text on translation failure.
    }
  }, [locale])

  const resolveText = useCallback(async (text: string) => {
    if (!text) return text
    if (locale === 'en') return text
    const cached = translationsRef.current.get(text)
    if (cached) return cached
    await translateBatch([text])
    return translationsRef.current.get(text) || text
  }, [locale, translateBatch])

  const displayText = useCallback((text: string) => {
    if (locale === 'en') return text
    return translationsRef.current.get(text) || text
  }, [locale, translationsVersion])

  useEffect(() => {
    setMessages([{ role: 'bot', text: greeting }])
  }, [greeting])

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
            void (async () => {
              const title = await resolveText(action.title)
              const text = await resolveText(action.text)
              await highlightElement({
                selector: action.selector,
                title,
                text,
                on: action.on,
              })
            })()
            break
          case 'message':
            void resolveText(action.text).then((localized) => addBot(localized))
            break
        }
      }
    },
    [router, addBot, resolveText]
  )

  const goToStep = useCallback(
    async (target: AgentScenario, nextStepId?: string) => {
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
      const localizedMessage = await resolveText(step.message)
      addBot(localizedMessage)
      runActions(step.onEnter)
    },
    [addBot, runActions, resolveText]
  )

  const startScenario = useCallback(
    (target: AgentScenario) => {
      cancelGuide()
      setScenario(target)
      void goToStep(target, target.start)
    },
    [goToStep]
  )

  const resetToMenu = useCallback(() => {
    cancelGuide()
    setScenario(null)
    setStepId(null)
    setMessages([{ role: 'bot', text: greeting }])
  }, [greeting])

  const handleOption = useCallback(
    (option: AgentOption) => {
      if (!scenario) return
      addUser(displayText(option.label))
      runActions(option.actions)
      void goToStep(scenario, option.next)
    },
    [scenario, addUser, runActions, goToStep, displayText]
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
      addBot(t.unknown)
      setScenario(null)
      setStepId(null)
    }
  }, [input, addUser, addBot, startScenario, t.unknown])

  const currentStep = scenario && stepId ? scenario.steps[stepId] : null
  const showMenu = !currentStep

  useEffect(() => {
    if (locale === 'en') return
    const texts: string[] = FEATURED_SCENARIOS.map((item) => item.title)
    if (currentStep) {
      texts.push(currentStep.message)
      if (currentStep.options) {
        texts.push(...currentStep.options.map((option) => option.label))
      }
    }
    void translateBatch(texts)
  }, [locale, currentStep, translateBatch])

  useEffect(() => () => cancelGuide(), [])

  if (!ENABLED || status !== 'authenticated') return null

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t.open}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3 text-white shadow-xl transition-transform hover:scale-105 hover:bg-primary-700 active:scale-95"
        >
          <span className="text-lg">🧭</span>
          <span className="text-sm font-semibold">{t.open}</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-5 right-5 z-[60] flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-primary-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-primary-700 to-primary-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <span className="text-sm font-bold">{t.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetToMenu}
                className="rounded px-2 py-1 text-[11px] font-medium text-white/90 transition-colors hover:bg-white/15"
              >
                {t.reset}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t.close}
                className="rounded px-2 py-1 text-sm transition-colors hover:bg-white/15"
              >
                ✕
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-3 py-4">
            {messages.map((message, index) => (
              <div key={index} className={message.role === 'bot' ? 'flex justify-start' : 'flex justify-end'}>
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
                        addUser(displayText(item.title))
                        startScenario(item)
                      }}
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-100"
                    >
                      {item.icon} {displayText(item.title)}
                    </button>
                  ))
                : currentStep?.options?.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => handleOption(option)}
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-100"
                    >
                      {displayText(option.label)}
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
                placeholder={t.placeholder}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <button
                onClick={handleSubmit}
                className="shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                {t.send}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

