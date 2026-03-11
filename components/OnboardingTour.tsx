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
      title: 'Onboarding Complete',
      text: 'Great job! Your first analysis is finished. Open the Physician Guide for a quick workflow overview.',
      buttons: [
        {
          text: 'Open Physician Guide',
          action: () => {
            markOnboardingCompletionPromptSeen()
            completionTour.complete()
            router.push('/manual')
          },
        },
        {
          text: 'Stay Here',
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

    if (onboardingStatus === 'new' && !canLaunchOnboarding()) return

    if (onboardingStatus === 'new' && pathname !== '/chat') {
      const navTour = createTour()
      navTour.addStep({
        id: 'open-chat',
        title: 'Step 1 of 4',
        text: 'Open AI Assistant and ask a medical question. GPT-5 will answer.',
        attachTo: { element: '[data-tour="menu-chat"]', on: 'right' },
        beforeShowPromise: () => waitForElement('[data-tour="menu-chat"]'),
        buttons: [
          {
            text: 'Next',
            action: () => {
              navTour.complete()
              router.push('/chat')
            },
          },
        ],
      })

      activeTourRef.current = navTour
      registerOnboardingLaunch()
      navTour.start()
      return
    }

    if (onboardingStatus === 'new' && pathname === '/chat') {
      const chatTour = createTour()
      chatTour.addStep({
        id: 'chat-input',
        title: 'Step 1 of 4',
        text: 'Type a medical question in this field.',
        attachTo: { element: '[data-tour="chat-question-input"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="chat-question-input"]'),
        buttons: [{ text: 'Next', action: chatTour.next }],
      })

      chatTour.addStep({
        id: 'chat-send',
        title: 'Step 1 of 4',
        text: 'Click Send to receive a GPT-5 response, then continue.',
        attachTo: { element: '[data-tour="chat-send-button"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="chat-send-button"]'),
        buttons: [
          {
            text: 'Next',
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
        title: 'Step 2 of 4',
        text: 'Open Visit Protocol. Add a few exam phrases and generate a protocol.',
        attachTo: { element: '[data-tour="menu-protocol"]', on: 'right' },
        beforeShowPromise: () => waitForElement('[data-tour="menu-protocol"]'),
        buttons: [
          {
            text: 'Next',
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
        title: 'Step 2 of 4',
        text: 'Enter a few patient exam phrases in this input area.',
        attachTo: { element: '[data-tour="protocol-input"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="protocol-input"]'),
        buttons: [{ text: 'Next', action: protocolTour.next }],
      })

      protocolTour.addStep({
        id: 'protocol-generate',
        title: 'Step 2 of 4',
        text: 'Click Generate Protocol when possible. You can continue now and return later.',
        attachTo: { element: '[data-tour="protocol-generate-button"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="protocol-generate-button"]'),
        buttons: [
          {
            text: 'Next',
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
        title: 'Step 3 of 4',
        text: 'Open Image Analysis. Upload any medical image and run Fast Analysis.',
        attachTo: { element: '[data-tour="menu-image-analysis"]', on: 'right' },
        beforeShowPromise: () => waitForElement('[data-tour="menu-image-analysis"]'),
        buttons: [
          {
            text: 'Next',
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
        title: 'Step 3 of 4',
        text: 'Upload any medical image here. If inconvenient now, you can continue and return later.',
        attachTo: { element: '[data-tour="image-upload-zone"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="image-upload-zone"]'),
        buttons: [
          {
            text: 'Next',
            action: () => {
              setOnboardingStatus('image_uploaded')
              imageTour.next()
            },
          },
        ],
      })

      imageTour.addStep({
        id: 'image-fast-analysis',
        title: 'Step 4 of 4',
        text: 'Run Fast Analysis when convenient. Onboarding will complete automatically after the first successful analysis.',
        attachTo: { element: '[data-tour="image-upload-zone"]', on: 'top' },
        beforeShowPromise: () => waitForElement('[data-tour="image-upload-zone"]'),
        buttons: [{ text: 'Got It', action: imageTour.complete }],
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
