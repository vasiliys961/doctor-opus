# Финальная сквозная приемка (RU→EN, без оплаты/STT/glucose/admin-clinics)

Цель: формально зафиксировать, что новые сценарии работают end-to-end в EN-ветке.  
Формат: пройти чек-лист вручную, отметить `✅/❌`, приложить 1-2 скриншота на блок.

## 0) Подготовка окружения

- [ ] Открыт EN-интерфейс (`Language: English`), страница обновлена без кеша.
- [ ] Пользователь авторизован (если требуется для конкретной страницы).
- [ ] Нет критических ошибок в консоли браузера на стартовой странице.

## 1) Device Hub / Lab Devices (USB)

Страницы: `app/devices/page.tsx`, `app/spirometry/page.tsx`, вкладки ECG/Spirometry/Ultrasound.

### 1.1 UI и i18n
- [ ] Все ключевые блоки на английском: `What is happening now`, `Adapter status`, `Data flow`, `Auto-ingest`, `Real hardware check`.
- [ ] Нет смешения EN/RU в кнопках и подсказках вкладки `Ultrasound / Endoscopy`.

### 1.2 Статусы адаптеров
- [ ] В блоке `Adapter status` отображаются browser-адаптеры и hot-folder адаптеры.
- [ ] Статусы видны и читаемы (`Idle/Connected/Streaming/Error`).
- [ ] При действиях пользователя статус меняется логично (например, `Start` камеры -> `Streaming`).

### 1.3 Маршрут данных (без железа)
- [ ] В блоке `Data flow` шаги подсвечиваются по мере прохождения.
- [ ] В `Auto-ingest` кнопки `Check: X-ray/CT/MRI` создают test result.
- [ ] После mock-ingest появляется `Last real ingest`/целевой маршрут и активна кнопка `Open section`.

### 1.4 (Опционально) Реальное железо, если появится
- [ ] Реальный захват/поток с устройства проходит в целевой модуль.
- [ ] Для hot-folder реальное исследование попадает в нужный модуль автоматически.

## 2) Mobile Bridge (desktop + send + inbox)

Страницы: `app/mobile-bridge/page.tsx`, `app/mobile-bridge/send/page.tsx`, `app/mobile-bridge/inbox/page.tsx`.

- [ ] На desktop-странице создается/обновляется сессия, виден токен/QR.
- [ ] На `send` можно отправить файл в сессию (с выбором target).
- [ ] На desktop/inbox появляется новый элемент.
- [ ] `Use now`/`Use in section` переносит данные в нужный модуль (через draft) и открывает нужный маршрут.
- [ ] `Clear`/удаление в inbox очищает элементы без ошибок.

## 3) Links (поиск, коллекция, OA)

Страница: `app/links/page.tsx`, API: `app/api/links/search/route.ts`, `app/api/links/oa/route.ts`.

- [ ] Поиск ссылок возвращает результаты.
- [ ] Мультивыбор и bulk-действия работают (`add/copy/delete selected`).
- [ ] Ручное добавление URL работает.
- [ ] Дедупликация URL работает (дубликат не плодится повторно).
- [ ] Bulk OA lookup для выбранных ссылок выполняется и показывает результат.
- [ ] `pushToProtocol` переносит выбранные ссылки в draft протокола.

## 4) Hot-folder API и авто-маршрутизация

API: `app/api/devices/hot-folder/route.ts`, `app/api/devices/hot-folder/setup/route.ts`.

- [ ] `setup` возвращает валидный статус конфигурации.
- [ ] Polling на `devices` не падает, нет циклических ошибок в консоли.
- [ ] Данные hot-folder корректно раскладываются в draft ключи модулей (`xray/ct/mri`).

## 5) Reference links в результатах анализа

Компонент: `components/AnalysisResult.tsx`, библиотеки `lib/*-reference-links.ts`, `lib/dermnet-links.ts`, `lib/ecg-reference-links.ts`.

- [ ] Для подходящих модальностей (derm/ecg/xray/ct/mri/ultrasound) показываются релевантные reference links.
- [ ] Общие search links также доступны.
- [ ] Ссылки не дублируются и открываются корректно.

## 6) FableUpgradeModal (встраивание в поток анализа)

Компонент: `components/FableUpgradeModal.tsx`.

- [ ] В сценарии, где нужен выбор модели, модалка открывается.
- [ ] Кнопки `stay on Opus` / `use Fable` работают корректно.
- [ ] `Esc`/клик вне модалки обрабатываются ожидаемо.
- [ ] После выбора модель реально применяется в последующем запросе.

## 7) Prescription normalize + TTS API

API: `app/api/prescription/normalize/route.ts`, `app/api/tts/route.ts`.

- [ ] Нормализация рецепта возвращает форматированный результат без 500.
- [ ] TTS endpoint отвечает валидным payload (аудио/JSON в ожидаемом формате).

## 8) Формальная фиксация “готово”

Считаем блок завершенным, если:
- [ ] Все обязательные пункты (кроме опционального реального железа) отмечены `✅`.
- [ ] Нет блокирующих багов уровня P1/P2.
- [ ] На каждый крупный блок есть короткое подтверждение (скрин/видео/заметка).

---

## Краткий шаблон отчета

Заполнить после прохода:

- Device Hub: `✅/❌` (комментарий)
- Mobile Bridge: `✅/❌` (комментарий)
- Links + OA: `✅/❌` (комментарий)
- Hot-folder routing: `✅/❌` (комментарий)
- Reference links: `✅/❌` (комментарий)
- Fable modal: `✅/❌` (комментарий)
- Prescription + TTS API: `✅/❌` (комментарий)

Итоговый статус: `READY / NOT READY`  
Дата и кто принимал: `...`
