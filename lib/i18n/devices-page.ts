import type { Locale } from './config'

export type DevicesPageMessages = {
  title: string
  description: string
  labels: {
    stepByStep: string
    autoOpenOnNewStudy: string
    noDataYet: string
  }
  tabs: {
    ecg: { label: string; desc: string }
    spirometry: { label: string; desc: string }
    camera: { label: string; desc: string }
  }
  modalityLabels: {
    xray: string
    ct: string
    mri: string
  }
  adapterLabels: {
    ecg: string
    spirometry: string
    camera: string
    xrayHotFolder: string
    ctHotFolder: string
    mriHotFolder: string
  }
  status: {
    title: string
    selectedSection: string
    adapterStatusTitle: string
    adapterTypeBrowser: string
    adapterTypeHotFolder: string
    connectedLabel: string
    streamingLabel: string
    errorLabel: string
    idleLabel: string
    autoOpenEnabled: string
    autoOpenDisabled: string
    lastStudy: string
    noStudies: string
  }
  dataFlow: {
    title: string
    subtitle: string
    steps: [string, string, string, string]
  }
  quickStartTitle: string
  quickStartList: [string, string, string]
  hotFolder: {
    title: string
    description: string
    modeTitle: string
    autoOpenLabel: string
    testTitle: string
    testButtonPrefix: string
    testResult: string
    lastRealIngest: string
    openSection: string
  }
  realHardware: {
    title: string
    subtitle: string
    checklist: [string, string, string, string, string]
  }
}

const EN: DevicesPageMessages = {
  title: 'Lab Devices (USB)',
  description:
    'Connect your device, capture data, and send it to AI analysis in one place.',
  labels: {
    stepByStep: 'Step by step',
    autoOpenOnNewStudy: 'Auto-open on new study',
    noDataYet: 'no data yet',
  },
  tabs: {
    ecg: {
      label: 'ECG',
      desc: 'Live waveform capture from ECG device',
    },
    spirometry: {
      label: 'Spirometry',
      desc: 'Pulmonary function metrics and flow-volume curve',
    },
    camera: {
      label: 'Ultrasound / Endoscopy',
      desc: 'Frame capture from camera or capture card',
    },
  },
  modalityLabels: {
    xray: 'X-ray',
    ct: 'CT',
    mri: 'MRI',
  },
  adapterLabels: {
    ecg: 'ECG USB',
    spirometry: 'Spirometry USB',
    camera: 'Camera capture',
    xrayHotFolder: 'X-ray hot-folder',
    ctHotFolder: 'CT hot-folder',
    mriHotFolder: 'MRI hot-folder',
  },
  status: {
    title: 'What is happening now',
    selectedSection: 'Selected section',
    adapterStatusTitle: 'Adapter status',
    adapterTypeBrowser: 'Browser',
    adapterTypeHotFolder: 'Hot-folder',
    connectedLabel: 'Connected',
    streamingLabel: 'Streaming',
    errorLabel: 'Error',
    idleLabel: 'Idle',
    autoOpenEnabled: 'enabled',
    autoOpenDisabled: 'disabled',
    lastStudy: 'Last received study',
    noStudies: 'none yet',
  },
  dataFlow: {
    title: 'Data flow',
    subtitle: 'From device to ready-to-analyze study',
    steps: [
      '1) Data is captured on the device',
      '2) Data arrives into Device Hub',
      '3) Study is routed to the target module draft',
      '4) Study is ready for AI analysis',
    ],
  },
  quickStartTitle: 'Start in 3 steps',
  quickStartList: [
    'Connect your device (or camera) to the computer.',
    'Open this page in Google Chrome.',
    'Allow device access and press Connect in the selected tab.',
  ],
  hotFolder: {
    title: 'Auto-ingest for X-ray / CT / MRI',
    description: 'New studies can be routed into the correct module automatically.',
    modeTitle: 'Mode',
    autoOpenLabel: 'Automatically open the target module when a new study arrives',
    testTitle: 'Check if ingest is working',
    testButtonPrefix: 'Check',
    testResult: 'Test result',
    lastRealIngest: 'Last real ingest',
    openSection: 'Open section',
  },
  realHardware: {
    title: 'Real hardware check',
    subtitle: 'Quick checklist before field use',
    checklist: [
      'Open this page in Google Chrome on the target workstation.',
      'Connect the real device/capture card and confirm it appears in the source list.',
      'Run one real capture and confirm result appears in the selected module.',
      'For radiology, send one real study to hot-folder and confirm auto-routing.',
      'Open the target module and run analysis to verify full end-to-end flow.',
    ],
  },
}

const OVERRIDES: Partial<Record<Locale, Partial<DevicesPageMessages>>> = {
  es: {
    title: 'Laboratorio de dispositivos',
  },
  fr: {
    title: 'Laboratoire des appareils',
  },
}

export function getDevicesPageMessages(locale: Locale): DevicesPageMessages {
  const override = OVERRIDES[locale]
  return override ? { ...EN, ...override } : EN
}
