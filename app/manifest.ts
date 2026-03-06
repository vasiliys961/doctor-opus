import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Medical AI Assistant Optima',
    short_name: 'MedAI Optima',
    description: 'Unified AI workspace for medical image, ECG, lab, and genetics analysis',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#064e3b',
    icons: [
      {
        src: 'https://vrachirf.ru/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'AI Chat',
        short_name: 'Chat',
        description: 'Open AI Assistant',
        url: '/chat',
      },
      {
        name: 'ECG Analysis',
        short_name: 'ECG',
        description: 'Open ECG analysis',
        url: '/ecg',
      },
      {
        name: 'Patient Database',
        short_name: 'Patients',
        description: 'Open patient records',
        url: '/patients',
      },
    ],
    categories: ['medical', 'health', 'productivity'],
  }
}

