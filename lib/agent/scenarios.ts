import type { AgentScenario } from './types'

const DONE = {
  id: 'done',
  message: 'Done. You can press "Home" in the navigator to start another workflow.',
}

function buildImageScenario(input: {
  id: string
  title: string
  icon: string
  href: string
  uploadTarget: string
  keywords: string[]
  featured?: boolean
}): AgentScenario {
  return {
    id: input.id,
    title: input.title,
    icon: input.icon,
    keywords: input.keywords,
    featured: input.featured,
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message: `I will open ${input.title}. Upload ${input.uploadTarget} in the upload zone, then run analysis.`,
        onEnter: [
          { type: 'navigate', href: input.href },
          {
            type: 'highlight',
            selector: '[data-tour="upload-zone"]',
            title: 'Upload zone',
            text: `Upload ${input.uploadTarget} here. Use anonymization before analysis when needed.`,
            on: 'bottom',
          },
        ],
        options: [
          { label: 'Uploaded, continue', next: 'run' },
          { label: 'Open from phone', next: 'phone' },
        ],
      },
      phone: {
        id: 'phone',
        message:
          'Open Mobile Bridge, scan QR from your phone camera, send the image, then come back and upload it in this section.',
        onEnter: [{ type: 'navigate', href: '/mobile-bridge' }],
        options: [{ label: 'Done, return', actions: [{ type: 'navigate', href: input.href }], next: 'run' }],
      },
      run: {
        id: 'run',
        message:
          'Choose analysis mode: Fast, Optimized, or Expert Validated. After result appears, you can transfer it to protocol or continue in chat.',
        options: [{ label: 'Got result', next: 'done' }],
      },
      done: DONE,
    },
  }
}

export const SCENARIOS: AgentScenario[] = [
  {
    id: 'consult',
    title: 'Ask AI Assistant',
    icon: '🤖',
    featured: true,
    keywords: ['assistant', 'chat', 'consult', 'question', 'help', 'ask', 'مساعد', '助手', 'ayuda'],
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message:
          'I will open AI Assistant. Type your question, optionally set specialty, and send. For complex cases use Consilium toggle.',
        onEnter: [
          { type: 'navigate', href: '/chat' },
          {
            type: 'highlight',
            selector: '[data-tour="chat-question-input"]',
            title: 'Question input',
            text: 'Type your clinical question here.',
            on: 'top',
          },
        ],
        options: [{ label: 'Done', next: 'done' }],
      },
      done: DONE,
    },
  },
  {
    id: 'protocol',
    title: 'Create Visit Protocol',
    icon: '📝',
    featured: true,
    keywords: ['protocol', 'soap', 'note', 'visit', 'report', 'протокол', 'بروتوكول'],
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message:
          'I will open Visit Protocol. Paste or dictate notes, then click Generate Protocol. Export as .docx when done.',
        onEnter: [
          { type: 'navigate', href: '/protocol' },
          {
            type: 'highlight',
            selector: '[data-tour="protocol-input"]',
            title: 'Protocol input',
            text: 'Add clinical notes here before generation.',
            on: 'top',
          },
        ],
        options: [{ label: 'Done', next: 'done' }],
      },
      done: DONE,
    },
  },
  {
    id: 'guidelines',
    title: 'Find Clinical Guidelines',
    icon: '📚',
    featured: true,
    keywords: ['guideline', 'protocols', 'evidence', 'recommendation', 'источник', 'دليل', '指南'],
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message: 'I will open Clinical Guidelines search. Enter condition or question and choose search depth.',
        onEnter: [{ type: 'navigate', href: '/protocols' }],
        options: [{ label: 'Done', next: 'done' }],
      },
      done: DONE,
    },
  },
  buildImageScenario({
    id: 'image',
    title: 'Medical Image Analysis',
    icon: '🔍',
    href: '/image-analysis',
    uploadTarget: 'medical image',
    keywords: ['image', 'scan', 'dicom', 'photo', 'x-ray', 'ct', 'mri', 'ultrasound', 'imagen', '影像'],
    featured: true,
  }),
  buildImageScenario({
    id: 'ecg',
    title: 'ECG Analysis',
    icon: '📈',
    href: '/ecg',
    uploadTarget: 'ECG image',
    keywords: ['ecg', 'ekg', 'arrhythmia', 'rhythm', 'cardiogram', 'تخطيط', '心电图'],
    featured: true,
  }),
  buildImageScenario({
    id: 'xray',
    title: 'X-Ray Report',
    icon: '🩻',
    href: '/xray',
    uploadTarget: 'X-Ray image',
    keywords: ['xray', 'x-ray', 'radiograph', 'fracture'],
  }),
  buildImageScenario({
    id: 'mri',
    title: 'MRI Report',
    icon: '🧠',
    href: '/mri',
    uploadTarget: 'MRI image',
    keywords: ['mri', 'magnetic resonance'],
  }),
  buildImageScenario({
    id: 'ct',
    title: 'CT Report',
    icon: '🩻',
    href: '/ct',
    uploadTarget: 'CT image',
    keywords: ['ct', 'computed tomography'],
  }),
  buildImageScenario({
    id: 'ultrasound',
    title: 'Ultrasound Report',
    icon: '🔊',
    href: '/ultrasound',
    uploadTarget: 'ultrasound image',
    keywords: ['ultrasound', 'usg', 'sono'],
  }),
  buildImageScenario({
    id: 'dermatoscopy',
    title: 'Dermoscopy Analysis',
    icon: '🔬',
    href: '/dermatoscopy',
    uploadTarget: 'dermoscopy image',
    keywords: ['dermatoscopy', 'skin', 'nevus', 'lesion', 'melanoma'],
  }),
  buildImageScenario({
    id: 'lab',
    title: 'Lab Data Interpretation',
    icon: '🧪',
    href: '/lab',
    uploadTarget: 'lab report file',
    keywords: ['lab', 'blood', 'biochemistry', 'cbc', 'urinalysis'],
  }),
  buildImageScenario({
    id: 'video',
    title: 'Video Case Review',
    icon: '🎬',
    href: '/video',
    uploadTarget: 'medical video',
    keywords: ['video', 'endoscopy', 'scope', 'clip'],
  }),
  buildImageScenario({
    id: 'document',
    title: 'Document Scan',
    icon: '📄',
    href: '/document',
    uploadTarget: 'document scan',
    keywords: ['document', 'pdf', 'scan', 'note image'],
  }),
  {
    id: 'library',
    title: 'Personal Library',
    icon: '📖',
    featured: true,
    keywords: ['library', 'book', 'guideline pdf', 'rag', 'atlas', 'کتاب', '书'],
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message: 'I will open Personal Library. Upload PDF references there, then use chat with library search enabled.',
        onEnter: [{ type: 'navigate', href: '/library' }],
        options: [{ label: 'Done', next: 'done' }],
      },
      done: DONE,
    },
  },
  {
    id: 'devices',
    title: 'Connect Medical Device',
    icon: '🔌',
    keywords: ['device', 'usb', 'spirometry', 'camera', 'sensor', 'прибор'],
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message: 'I will open Devices. This module works in Chrome and supports USB/device data capture workflows.',
        onEnter: [{ type: 'navigate', href: '/devices' }],
        options: [{ label: 'Done', next: 'done' }],
      },
      done: DONE,
    },
  },
  {
    id: 'patients',
    title: 'Patient Database',
    icon: '👤',
    keywords: ['patient', 'database', 'history', 'record', 'card'],
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message: 'I will open Patient Database. Use anonymized entries and save results from analysis pages into patient context.',
        onEnter: [{ type: 'navigate', href: '/patients' }],
        options: [{ label: 'Done', next: 'done' }],
      },
      done: DONE,
    },
  },
  {
    id: 'balance',
    title: 'Check Balance',
    icon: '💳',
    keywords: ['balance', 'credits', 'billing', 'payment', 'cost'],
    start: 'open',
    steps: {
      open: {
        id: 'open',
        message: 'I will open Balance where you can top up credits and review payment status.',
        onEnter: [{ type: 'navigate', href: '/balance' }],
        options: [{ label: 'Done', next: 'done' }],
      },
      done: DONE,
    },
  },
]

