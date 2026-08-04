import Shepherd from 'shepherd.js'
import type { GuidePlacement } from './types'

let activeTour: Shepherd.Tour | null = null

function waitForElement(selector: string, timeoutMs = 6000): Promise<Element> {
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

export function cancelGuide(): void {
  activeTour?.cancel()
  activeTour = null
}

export interface HighlightOptions {
  selector: string
  title: string
  text: string
  on?: GuidePlacement
}

export async function highlightElement(options: HighlightOptions): Promise<void> {
  cancelGuide()

  try {
    await waitForElement(options.selector)
  } catch {
    return
  }

  const tour = new Shepherd.Tour({
    useModalOverlay: false,
    defaultStepOptions: {
      classes: 'shadow-xl',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
    },
  })

  tour.addStep({
    id: 'agent-highlight',
    title: options.title,
    text: options.text,
    attachTo: { element: options.selector, on: options.on || 'bottom' },
    buttons: [{ text: 'Got it', action: () => tour.complete() }],
  })

  activeTour = tour
  tour.start()
}

