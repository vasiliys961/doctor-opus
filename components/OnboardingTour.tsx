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

  const showCompletionStep = () => {
    if (isOnboardingCompletionPromptSeen()) return

    const completionTour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shadow-xl',
        cancelIcon: { enabled: false },
        scrollTo: false,
      },
    })

    completionTour.addStep({
      id: 'completion-step',
      title: 'Обучение завершено',
      text: 'Отлично! Первый анализ выполнен, +5 единиц начислено. Откройте руководство врача для быстрого обзора сценариев работы.',
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
      if (pathname === '/lab' && !isOnboardingCompletionPromptSeen()) {
        showCompletionStep()
      }
      return
    }

    activeTourRef.current?.cancel()

    if (pathname !== '/lab' && onboardingStatus === 'new') {
      if (!canLaunchOnboarding()) return

      const introTour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: 'shadow-xl',
          cancelIcon: { enabled: false },
          scrollTo: false,
        },
      })

      introTour.addStep({
        id: 'welcome-step',
        title: 'Добро пожаловать в Doctor Opus',
        text: 'Давайте выполним ваш первый лабораторный анализ примерно за 60 секунд.',
        buttons: [
          {
            text: 'Начать',
            action: introTour.next,
          },
        ],
      })

      introTour.addStep({
        id: 'menu-step',
        title: 'Шаг 1 из 4',
        text: 'Откройте раздел «Интерпретация лабораторных данных». Нажмите кнопку ниже, и я сразу переведу вас туда.',
        attachTo: { element: '[data-tour="menu-lab"]', on: 'right' },
        beforeShowPromise: () => waitForElement('[data-tour="menu-lab"]'),
        buttons: [
          {
            text: 'Открыть Lab',
            action: () => {
              setOnboardingStatus('menu_done')
              introTour.complete()
              router.push('/lab')
            },
          },
        ],
      })

      activeTourRef.current = introTour
      registerOnboardingLaunch()
      introTour.start()
      return
    }

    if (pathname === '/lab' && (onboardingStatus === 'new' || onboardingStatus === 'menu_done' || onboardingStatus === 'file_uploaded')) {
      if (!canLaunchOnboarding()) return

      if (onboardingStatus === 'new') {
        setOnboardingStatus('menu_done')
      }

      const labTour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: 'shadow-xl',
          cancelIcon: { enabled: false },
          scrollTo: { behavior: 'smooth', block: 'center' },
        },
      })

      labTour.addStep({
        id: 'upload-step',
        title: 'Шаг 2 из 4',
        text: 'Загрузите любой лабораторный файл (PDF/CSV/изображение), затем продолжите.',
        attachTo: { element: '[data-tour="lab-upload-zone"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="lab-upload-zone"]'),
        buttons: [
          {
            text: 'Файл загружен',
            action: () => {
              const runButton = document.querySelector('[data-tour="lab-run-analysis"]')
              if (!runButton) return
              setOnboardingStatus('file_uploaded')
              labTour.next()
            },
          },
        ],
      })

      labTour.addStep({
        id: 'run-step',
        title: 'Шаг 3 из 4',
        text: 'Нажмите «Run Analysis». После успешного результата вы получите +5 единиц и откроется финальный шаг.',
        attachTo: { element: '[data-tour="lab-run-analysis"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="lab-run-analysis"]', 10000),
        buttons: [
          {
            text: 'Понятно',
            action: labTour.complete,
          },
        ],
      })

      activeTourRef.current = labTour
      registerOnboardingLaunch()
      labTour.start()
    }
  }, [pathname, router, sessionStatus])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return

    const handler = () => {
      if (pathname === '/lab') {
        showCompletionStep()
      }
    }

    window.addEventListener('onboardingCompleted', handler)
    return () => window.removeEventListener('onboardingCompleted', handler)
  }, [pathname, sessionStatus])

  return null
}
