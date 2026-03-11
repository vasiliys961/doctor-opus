'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Shepherd from 'shepherd.js'
import {
  canLaunchOnboarding,
  getOnboardingStatus,
  isOnboardingCompletionPromptSeen,
  markOnboardingCompletionPromptSeen,
  registerOnboardingLaunch,
  setOnboardingStatus,
} from '@/lib/onboarding'

function waitForElement(selector: string, timeoutMs = 4000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    const check = () => {
      const element = document.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Element not found: ${selector}`))
        return
      }

      window.setTimeout(check, 120)
    }

    check()
  })
}

export default function OnboardingTour() {
  const { status: sessionStatus } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const activeTourRef = useRef<Shepherd.Tour | null>(null)

  const createTour = () =>
    new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shadow-xl',
        cancelIcon: { enabled: false },
        scrollTo: { behavior: 'smooth', block: 'center' },
      },
    })

  const showCompletionStep = () => {
    if (isOnboardingCompletionPromptSeen()) return

    const completionTour = createTour()

    completionTour.addStep({
      id: 'completion-step',
      title: 'Обучение завершено',
      text: 'Отлично! Первый анализ выполнен. Откройте руководство врача для быстрого обзора сценариев работы.',
      buttons: [
        {
          text: 'Открыть руководство врача',
          action: () => {
            markOnboardingCompletionPromptSeen()
            completionTour.complete()
            router.push('/manual')
          },
        },
        {
          text: 'Остаться здесь',
          action: () => {
            markOnboardingCompletionPromptSeen()
            completionTour.complete()
          },
        },
      ],
    })

    activeTourRef.current?.cancel()
    activeTourRef.current = completionTour
    completionTour.start()
  }

  useEffect(() => {
    return () => {
      activeTourRef.current?.cancel()
    }
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    if (pathname.startsWith('/auth')) return

    const onboardingStatus = getOnboardingStatus()
    if (onboardingStatus === 'completed') {
      if (pathname === '/image-analysis' && !isOnboardingCompletionPromptSeen()) {
        showCompletionStep()
      }
      return
    }

    activeTourRef.current?.cancel()

    if (onboardingStatus === 'new' && pathname !== '/chat') {
      if (!canLaunchOnboarding()) return

      const navTour = createTour()
      navTour.addStep({
        id: 'open-chat',
        title: 'Шаг 1 из 4',
        text: 'Откройте ИИ-Ассистент и задайте медицинский вопрос. Ответ формирует GPT‑5.',
        attachTo: { element: '[data-tour="menu-chat"]', on: 'right' },
        beforeShowPromise: () => waitForElement('[data-tour="menu-chat"]'),
        buttons: [
          {
            text: 'Далее',
            action: () => {
              navTour.complete()
              router.push('/chat')
            },
          },
        ],
      })

      activeTourRef.current = navTour
      navTour.start()
      return
    }

    if (onboardingStatus === 'new' && pathname === '/chat') {
      if (!canLaunchOnboarding()) return

      const chatTour = createTour()
      chatTour.addStep({
        id: 'chat-input',
        title: 'Шаг 1 из 4',
        text: 'Введите медицинский вопрос в это поле.',
        attachTo: { element: '[data-tour="chat-question-input"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="chat-question-input"]'),
        buttons: [{ text: 'Далее', action: chatTour.next }],
      })

      chatTour.addStep({
        id: 'chat-send',
        title: 'Шаг 1 из 4',
        text: 'Нажмите «Отправить» и получите ответ GPT‑5, затем продолжите.',
        attachTo: { element: '[data-tour="chat-send-button"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="chat-send-button"]'),
        buttons: [
          {
            text: 'Далее',
            action: () => {
              setOnboardingStatus('chat_done')
              chatTour.complete()
              router.push('/protocol')
            },
          },
        ],
      })

      activeTourRef.current = chatTour
      registerOnboardingLaunch()
      chatTour.start()
      return
    }

    if (onboardingStatus === 'chat_done' && pathname !== '/protocol') {
      const navTour = createTour()
      navTour.addStep({
        id: 'open-protocol',
        title: 'Шаг 2 из 4',
        text: 'Откройте Протокол приёма. Внесите несколько фраз осмотра и сгенерируйте протокол.',
        attachTo: { element: '[data-tour="menu-protocol"]', on: 'right' },
        beforeShowPromise: () => waitForElement('[data-tour="menu-protocol"]'),
        buttons: [
          {
            text: 'Далее',
            action: () => {
              navTour.complete()
              router.push('/protocol')
            },
          },
        ],
      })

      activeTourRef.current = navTour
      navTour.start()
      return
    }

    if (onboardingStatus === 'chat_done' && pathname === '/protocol') {
      const protocolTour = createTour()
      protocolTour.addStep({
        id: 'protocol-input',
        title: 'Шаг 2 из 4',
        text: 'Введите 2–3 фразы осмотра пациента в это поле.',
        attachTo: { element: '[data-tour="protocol-input"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="protocol-input"]'),
        buttons: [{ text: 'Далее', action: protocolTour.next }],
      })

      protocolTour.addStep({
        id: 'protocol-generate',
        title: 'Шаг 2 из 4',
        text: 'Нажмите «Создать протокол» при возможности. Можно перейти дальше и вернуться позже.',
        attachTo: { element: '[data-tour="protocol-generate-button"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="protocol-generate-button"]'),
        buttons: [
          {
            text: 'Далее',
            action: () => {
              setOnboardingStatus('protocol_done')
              protocolTour.complete()
              router.push('/image-analysis')
            },
          },
        ],
      })

      activeTourRef.current = protocolTour
      protocolTour.start()
      return
    }

    if (onboardingStatus === 'protocol_done' && pathname !== '/image-analysis') {
      const navTour = createTour()
      navTour.addStep({
        id: 'open-image-analysis',
        title: 'Шаг 3 из 4',
        text: 'Откройте раздел анализа изображений. Загрузите любое медицинское изображение и запустите быстрый анализ.',
        attachTo: { element: '[data-tour="menu-image-analysis"]', on: 'right' },
        beforeShowPromise: () => waitForElement('[data-tour="menu-image-analysis"]'),
        buttons: [
          {
            text: 'Далее',
            action: () => {
              navTour.complete()
              router.push('/image-analysis')
            },
          },
        ],
      })

      activeTourRef.current = navTour
      navTour.start()
      return
    }

    if ((onboardingStatus === 'protocol_done' || onboardingStatus === 'image_uploaded') && pathname === '/image-analysis') {
      const imageTour = createTour()
      imageTour.addStep({
        id: 'image-upload',
        title: 'Шаг 3 из 4',
        text: 'Загрузите любое медицинское изображение здесь. Если неудобно сейчас, можно перейти дальше.',
        attachTo: { element: '[data-tour="image-upload-zone"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="image-upload-zone"]'),
        buttons: [
          {
            text: 'Далее',
            action: () => {
              setOnboardingStatus('image_uploaded')
              imageTour.next()
            },
          },
        ],
      })

      imageTour.addStep({
        id: 'image-fast-analysis',
        title: 'Шаг 4 из 4',
        text: 'Запустите быстрый анализ, когда будет удобно. Обучение завершится автоматически после первого успешного анализа.',
        attachTo: { element: '[data-tour="image-upload-zone"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="image-upload-zone"]'),
        buttons: [{ text: 'Понятно', action: imageTour.complete }],
      })

      activeTourRef.current = imageTour
      imageTour.start()
    }
  }, [pathname, router, sessionStatus])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return

    const handler = () => {
      if (pathname === '/image-analysis') {
        showCompletionStep()
      }
    }

    window.addEventListener('onboardingCompleted', handler)
    return () => window.removeEventListener('onboardingCompleted', handler)
  }, [pathname, sessionStatus])

  return null
}
