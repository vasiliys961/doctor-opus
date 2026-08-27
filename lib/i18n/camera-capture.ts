import type { Locale } from './config'

export type CameraCaptureMessages = {
  analysisTypes: {
    ultrasound: string
    endoscopy: string
    general: string
  }
  prompts: {
    ultrasound: string
    endoscopy: string
    general: string
  }
  errors: {
    cameraBlocked: string
    noCameraFound: string
    generic: string
    cameraStart: string
    analysis: string
    allowAccessTitle: string
    allowAccessBody: string
    allowAccessHint: string
  }
  ui: {
    howItWorksTitle: string
    howItWorksDescription: string
    ultrasoundCardTitle: string
    ultrasoundCardDescription: string
    endoscopyCardTitle: string
    endoscopyCardDescription: string
    anyCameraCardTitle: string
    anyCameraCardDescription: string
    whatAiAnalyzesTitle: string
    aiAnalyzeItems: [string, string, string, string, string, string]
    disclaimer: string
    cameraDeviceLabel: string
    refreshHint: string
    refreshButton: string
    startButton: string
    stopButton: string
    captureHint: string
    captureButton: string
    capturedFrameTitle: string
    resetButton: string
    clinicalContextLabel: string
    clinicalContextPlaceholder: string
    analyzeButton: string
    analyzingButton: string
    retryButton: string
    analysisResultTitle: string
    cameraFallbackName: string
  }
}

const EN: CameraCaptureMessages = {
  analysisTypes: {
    ultrasound: 'Ultrasound',
    endoscopy: 'Endoscopy',
    general: 'General',
  },
  prompts: {
    ultrasound:
      'Analyze this ultrasound image. Describe tissue echogenicity, structure, focal findings (size, shape, margins, echogenicity), and fluid if present. Provide clinical interpretation and follow-up recommendations.',
    endoscopy:
      'Analyze this endoscopic image. Describe mucosa appearance, color, vascular pattern, and any pathological findings (polyps, erosions, ulcers, masses), plus secretions if visible. Provide clinical interpretation.',
    general:
      'Analyze this medical image. Describe all relevant visual findings, their possible clinical significance, and practical recommendations.',
  },
  errors: {
    cameraBlocked:
      'Camera access is blocked. Click the camera icon in the Chrome address bar, allow access, then reload the page.',
    noCameraFound: 'No camera found. Connect a device and click Refresh.',
    generic: 'Error',
    cameraStart: 'Camera start error',
    analysis: 'Analysis error',
    allowAccessTitle: 'Allow camera access',
    allowAccessBody: 'The browser will request permission. Click Allow in the popup.',
    allowAccessHint:
      'If no prompt appears, check camera permission in browser settings (camera icon in address bar).',
  },
  ui: {
    howItWorksTitle: 'How it works',
    howItWorksDescription:
      'AI reviews the frame from your device and provides a structured second-opinion style analysis.',
    ultrasoundCardTitle: 'Ultrasound machine',
    ultrasoundCardDescription:
      'Connect through an HDMI capture card (Elgato, AVerMedia). It will appear as a camera source.',
    endoscopyCardTitle: 'Endoscope',
    endoscopyCardDescription:
      'USB endoscopes connect directly and are detected by the browser as camera devices.',
    anyCameraCardTitle: 'Any camera',
    anyCameraCardDescription:
      'You can also capture from monitor output, dermatoscope, or any USB camera-like source.',
    whatAiAnalyzesTitle: 'What AI analyzes',
    aiAnalyzeItems: [
      'Ultrasound findings: echogenicity, focal lesions, fluid',
      'Endoscopy findings: mucosa, polyps, erosions',
      'Size and margins of suspicious areas',
      'Warning patterns that need attention',
      'Clinical hypotheses',
      'Practical next-step recommendations',
    ],
    disclaimer:
      'AI is an assistive tool and does not replace clinician judgment. Final interpretation remains with the specialist.',
    cameraDeviceLabel: 'Camera / Device',
    refreshHint: 'Click Refresh to detect camera sources',
    refreshButton: 'Refresh',
    startButton: 'Start',
    stopButton: 'Stop',
    captureHint:
      'For HDMI ultrasound/endoscopy output, connect through a capture card (Elgato, AVerMedia) — it will show as a camera.',
    captureButton: 'Capture frame',
    capturedFrameTitle: 'Captured frame',
    resetButton: 'Reset',
    clinicalContextLabel: 'Clinical context (optional)',
    clinicalContextPlaceholder: 'Example: 55 y/o, right upper abdominal pain, abdominal ultrasound.',
    analyzeButton: 'Analyze',
    analyzingButton: 'Analyzing...',
    retryButton: 'Retry',
    analysisResultTitle: 'Analysis result',
    cameraFallbackName: 'Camera',
  },
}

const OVERRIDES: Partial<Record<Locale, Partial<CameraCaptureMessages>>> = {}

export function getCameraCaptureMessages(locale: Locale): CameraCaptureMessages {
  const override = OVERRIDES[locale]
  return override ? { ...EN, ...override } : EN
}
