import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Medical AI Assistant Optima',
    short_name: 'MedAI Optima',
    description: 'Единый ИИ-центр для анализа медицинских изображений, ЭКГ, лабораторных данных и генетики',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#064e3b',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Чат',
        short_name: 'Чат',
        description: 'Открыть ИИ-ассистент',
        url: '/chat',
      },
      {
        name: 'Анализ ЭКГ',
        short_name: 'ЭКГ',
        description: 'Анализ ЭКГ',
        url: '/ecg',
      },
      {
        name: 'База пациентов',
        short_name: 'Пациенты',
        description: 'База данных пациентов',
        url: '/patients',
      },
    ],
    categories: ['medical', 'health', 'productivity'],
  }
}

