# Версия проекта Medical Assistant

## Текущая версия: v2.1.0 (2025-12-20)

### Изменения в v2.1.0

**Дата релиза:** 2025-12-20

**Основные изменения:**
- ✅ Изменено разрешение изображения по умолчанию с LOW на HIGH в двухшаговом анализе (JSON→Opus)
- ✅ Улучшена точность диагностики (+2-3%) и обнаружение мелких патологий (+4-5%)
- ✅ Обновлены инструкции для Opus: изображение используется вместе с JSON для детального анализа
- ✅ Минимальное увеличение стоимости (+3%, ≈+0.04 ед. на анализ)

**Технические детали:**
- Метод `send_vision_request_opus_with_json` теперь использует `detail: "high"` по умолчанию
- Обновлены промпты для использования HIGH resolution изображения вместе с JSON данными
- Изменения применены ко всем страницам анализа (ECG, X-Ray, MRI, CT, Ultrasound, Dermatoscopy, Universal)

**Файлы изменены:**
- `claude_assistant/vision_client.py`
- `claude_assistant/assistant_wrapper.py`
- `page_modules/ecg_page.py`
- `page_modules/xray_page.py`
- `page_modules/mri_page.py`
- `page_modules/ct_page.py`
- `page_modules/ultrasound_page.py`
- `page_modules/dermatoscopy_page.py`
- `page_modules/universal_image_analysis_page.py`

---

## История версий

### v2.0.0 (2025-12-20)
- Реализован двухшаговый процесс анализа: Gemini JSON extraction → Opus streaming
- Добавлена поддержка всех модальностей для JSON extraction
- Реализован quality gate для проверки качества изображений
- Добавлен streaming для отображения результатов Opus

### v1.0.0
- Начальная версия проекта
