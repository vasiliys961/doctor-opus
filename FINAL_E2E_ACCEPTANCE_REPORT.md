# Финальный отчет сквозной приемки (автопрогон)

Дата: 2026-08-10  
Среда: локальный `npm run dev`, `http://localhost:3000`  
Режим: без физического оборудования

## Что проверено автоматически

## 1) Device Hub / маршрутизация hot-folder

- ✅ `GET /api/devices/hot-folder/setup` -> `success: true`, `supportedModalities: [xray, ct, mri]`
- ✅ `GET /api/devices/hot-folder?since=0` -> корректный ответ
- ✅ `POST /api/devices/hot-folder` (multipart + `study.dcm`) -> событие создано
- ✅ повторный `GET /api/devices/hot-folder?since=0` -> созданное событие присутствует

Факт: mock/ingest цепочка серверной части рабочая.

## 2) Mobile Bridge

- ✅ `POST /api/mobile-bridge/session` -> токен создается
- ✅ `POST /api/mobile-bridge/upload` (target=`chat`) -> `success: true`, `eventId` выдан
- ✅ `GET /api/mobile-bridge/events?token=...` -> событие получено
- ✅ `POST /api/mobile-bridge/clear` -> успешно
- ✅ `GET /api/mobile-bridge/events?token=...` после clear -> пусто
- ✅ проверен fallback: `target=auto_route` с неопределимым payload -> ожидаемый `409 route_uncertain` + candidates

Факт: полный цикл bridge API рабочий.

## 3) Links API

- ✅ `GET /api/links/search?q=hypertension&source=pubmed` -> возвращены реальные результаты
- ✅ `GET /api/links/oa?url=https://doi.org/10.1038/nature12373` -> `found: true` (Unpaywall URL)

Факт: поиск и OA lookup рабочие.

## 4) Доступность ключевых страниц

- ✅ `GET /devices` -> 200
- ✅ `GET /mobile-bridge` -> 200
- ✅ `GET /mobile-bridge/send` -> 200
- ✅ `GET /mobile-bridge/inbox` -> 200
- ✅ `GET /links` -> 200
- ✅ `GET /spirometry` -> 200

## Что не подтверждено автопрогоном

- ⏸️ Реальный hardware E2E (нет прибора/реального источника)
- ⏸️ UI-клики внутри браузера на уровне DOM (частично подтверждены по вашим скриншотам)
- ⏸️ `FableUpgradeModal` в живом сценарии с выбором модели (нужен запуск соответствующего анализа)
- ⏸️ `Prescription normalize` и `TTS` бизнес-ответ: endpoints закрыты авторизацией в неавторизованном curl-сеансе

## Что показал автопрогон по auth-ограничениям

- `POST /api/prescription/normalize` -> `UNAUTHORIZED`
- `POST /api/tts` -> `401 Unauthorized`

Это ожидаемо для неавторизованного серверного запроса; не является багом.

## Итоговый статус

- **READY (без железа / без auth-only сценариев)**: ✅
- **Полный READY (включая real hardware + auth-only ручные сценарии)**: ⏸️ требуется финальный ручной проход в авторизованной сессии.
