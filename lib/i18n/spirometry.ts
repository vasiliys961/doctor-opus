import type { Locale } from './config'

export type SpirometryMessages = {
  browserNotSupported: string
  title: string
  subtitle: string
  connectDevice: string
  manualEntry: string
  supportedDevices: string
  deviceNotSelected: string
  autoDetecting: string
  checkingBaudRate: string
  noDataDetected: string
  enterDataManually: string
  detectedBaudRate: string
  receivingData: string
  performManeuver: string
  rowsReceived: string
  cancel: string
  patientData: string
  age: string
  heightCm: string
  weightKg: string
  sex: string
  male: string
  female: string
  metrics: string
  saveAndContinue: string
  provideAtLeastOneMetric: string
  dataReceived: string
  startOver: string
  flowVolumeCurve: string
  runAnalysis: string
  analyzing: string
  analyzingSubtitle: string
  interpretationTitle: string
  newStudy: string
  analysisError: string
  genericError: string
  noPrompt: string
  insufficientBalance: string
  aiError: string
  serverError: string
}

const EN: SpirometryMessages = {
  browserNotSupported: 'Use Google Chrome or Microsoft Edge to connect serial devices.',
  title: 'Spirometry',
  subtitle: 'Pulmonary function workflow with AI interpretation',
  connectDevice: 'Connect spirometer (USB)',
  manualEntry: 'Enter metrics manually',
  supportedDevices: 'Typical USB serial spirometers are supported (MicroLab, Spirobank, BTL and similar).',
  deviceNotSelected: 'No device selected.',
  autoDetecting: 'Connecting spirometer...',
  checkingBaudRate: 'Checking',
  noDataDetected: 'No valid spirometry data detected automatically.',
  enterDataManually: 'Please enter available metrics manually.',
  detectedBaudRate: 'Detected baud rate',
  receivingData: 'Receiving data from spirometer...',
  performManeuver: 'Perform the breathing maneuver on the device.',
  rowsReceived: 'Rows received',
  cancel: 'Cancel',
  patientData: 'Patient data (used for interpretation context)',
  age: 'Age',
  heightCm: 'Height (cm)',
  weightKg: 'Weight (kg)',
  sex: 'Sex',
  male: 'Male',
  female: 'Female',
  metrics: 'Spirometry metrics (fill in available values)',
  saveAndContinue: 'Save and continue',
  provideAtLeastOneMetric: 'Provide at least one metric.',
  dataReceived: 'Data received',
  startOver: 'Start over',
  flowVolumeCurve: 'Flow-volume curve',
  runAnalysis: 'Get AI second opinion',
  analyzing: 'Analyzing spirometry...',
  analyzingSubtitle: 'Generating ATS/ERS and GOLD-oriented interpretation.',
  interpretationTitle: 'Spirometry interpretation',
  newStudy: 'New study',
  analysisError: 'Analysis error',
  genericError: 'Error',
  noPrompt: 'No prompt provided',
  insufficientBalance: 'Insufficient balance',
  aiError: 'AI error',
  serverError: 'Spirometry analysis error',
}

const OVERRIDES: Partial<Record<Locale, Partial<SpirometryMessages>>> = {
  es: {
    title: 'Espirometria',
    connectDevice: 'Conectar espirometro (USB)',
    manualEntry: 'Ingresar metricas manualmente',
    runAnalysis: 'Obtener segunda opinion con IA',
    newStudy: 'Nuevo estudio',
  },
  fr: {
    title: 'Spirometrie',
    connectDevice: 'Connecter le spirometre (USB)',
    manualEntry: 'Saisir les metriques manuellement',
    runAnalysis: "Obtenir un deuxieme avis IA",
    newStudy: 'Nouvelle etude',
  },
}

export function getSpirometryMessages(locale: Locale): SpirometryMessages {
  const override = OVERRIDES[locale]
  return override ? { ...EN, ...override } : EN
}
