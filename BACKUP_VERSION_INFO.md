# Информация о версии для отката

## Дата создания: 2025-01-20

## Текущее состояние проекта

### Ветка
- **Текущая ветка**: experimental
- **Коммит для отката**: `4303fb2b0cc466a299f66332009e4d5665323c86`
- **Сообщение коммита**: "feat: использование Haiku для сканирования документов и добавление превью"
- **Git тег для отката**: `backup-before-migration-2025-01-20` (создан)

### Статус
- Проект задеплоен на Vercel
- Большая часть функционала уже перенесена из Streamlit в Next.js
- Работают все основные страницы и API

### Что работает (НЕ ТРОГАТЬ)

#### Страницы
- `/app/image-analysis/page.tsx` - анализ медицинских изображений
- `/app/ecg/page.tsx` - анализ ЭКГ
- `/app/mri/page.tsx` - анализ МРТ
- `/app/ct/page.tsx` - анализ КТ
- `/app/xray/page.tsx` - анализ рентгена
- `/app/ultrasound/page.tsx` - анализ УЗИ
- `/app/dermatoscopy/page.tsx` - анализ дерматоскопии
- `/app/lab/page.tsx` - анализ лабораторных данных
- `/app/document/page.tsx` - сканирование документов
- `/app/chat/page.tsx` - ИИ-консультант
- `/app/protocol/page.tsx` - протокол приёма
- `/app/genetic/page.tsx` - генетический анализ
- `/app/patients/page.tsx` - база данных пациентов
- `/app/statistics/page.tsx` - статистика
- `/app/video/page.tsx` - анализ видео

#### Компоненты
- `components/ImageUpload.tsx` - загрузка изображений
- `components/AnalysisResult.tsx` - отображение результатов
- `components/AnalysisModeSelector.tsx` - выбор режима анализа
- `components/Sidebar.tsx` - боковая панель навигации
- `components/Navigation.tsx` - навигация

#### API Endpoints
- `/app/api/analyze/image/route.ts` - анализ изображений
- `/app/api/analyze/ecg/route.ts` - анализ ЭКГ
- `/app/api/analyze/lab/route.ts` - анализ лабораторных данных
- `/app/api/chat/route.ts` - чат с ИИ
- `/app/api/protocol/route.ts` - протокол
- `/app/api/scan/document/route.ts` - сканирование документов
- `/app/api/transcribe/route.ts` - транскрипция

#### Режимы анализа
- `fast` - быстрый анализ (Gemini Flash)
- `precise` - точный анализ (Opus 4.5)
- `validated` - с валидацией (Gemini JSON + Opus)
- `optimized` - оптимизированный (Opus двухшаговый)

#### Модели
- Opus 4.5 - для клинических задач
- Sonnet 4.5 - для лабораторных данных
- Haiku 4.5 - для документов
- Gemini Flash - для быстрого режима

### Заглушки (требуют реализации)

- `/app/advanced/page.tsx` - расширенный анализ (заглушка)
- `/app/comparative/page.tsx` - сравнительный анализ (заглушка)
- `/app/medical-protocols/page.tsx` - медицинские протоколы (заглушка)
- `/app/context/page.tsx` - клинический контекст (заглушка)

### План миграции

Файл плана: `.cursor/plans/миграция_с_streamlit_на_next.js_e4fa1b6a.plan.md`

**Что нужно доперенести:**
1. Пакетный режим - расширить ImageUpload для multiple файлов
2. Сравнительный анализ - реализовать /app/comparative
3. Медицинские протоколы - реализовать /app/medical-protocols
4. Клинический контекст - упрощенная версия /app/context

### Команды для отката

```bash
# Откат к сохраненному коммиту
git checkout 4303fb2b0cc466a299f66332009e4d5665323c86

# Или откат к текущей ветке
git checkout experimental
git reset --hard 4303fb2b0cc466a299f66332009e4d5665323c86

# Просмотр истории коммитов
git log --oneline -10

# Откат по тегу (уже создан)
git checkout backup-before-migration-2025-01-20

# Или откат по коммиту
git checkout 4303fb2b0cc466a299f66332009e4d5665323c86
```

### Важные файлы для сохранения

- `components/Sidebar.tsx` - навигация
- `app/layout.tsx` - основной layout
- `lib/openrouter.ts` - логика работы с моделями
- `lib/openrouter-streaming.ts` - streaming логика
- Все страницы в `/app/` (кроме заглушек)

### Примечания

- Проект работает на Vercel
- Используется Next.js
- Все API endpoints работают
- Streaming работает для всех режимов
- НЕ ТРОГАТЬ работающий функционал при миграции

