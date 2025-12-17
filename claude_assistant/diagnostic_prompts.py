"""
Диагностические промпты - КРИТИЧЕСКИ ВАЖНЫЙ МОДУЛЬ
НЕ ИЗМЕНЯТЬ ЛОГИКУ! Только вынесение для организации кода.

Этот модуль содержит системный промпт профессора и функции для получения
специализированных промптов для различных типов медицинских исследований.
"""

# Импорт оригинальных промптов из prompts/diagnostic_prompts.py
try:
    from prompts.diagnostic_prompts import (
        get_ecg_diagnostic_prompt,
        get_xray_diagnostic_prompt,
        get_mri_diagnostic_prompt,
        get_ct_diagnostic_prompt,
        get_ultrasound_diagnostic_prompt,
        get_dermatoscopy_diagnostic_prompt,
        get_genetics_diagnostic_prompt,
        get_histology_diagnostic_prompt,
        get_retinal_diagnostic_prompt,
        get_mammography_diagnostic_prompt
    )
except ImportError:
    # Если модуль недоступен, функции будут определены ниже как fallback
    get_ecg_diagnostic_prompt = None
    get_xray_diagnostic_prompt = None
    get_mri_diagnostic_prompt = None
    get_ct_diagnostic_prompt = None
    get_ultrasound_diagnostic_prompt = None
    get_dermatoscopy_diagnostic_prompt = None
    get_genetics_diagnostic_prompt = None
    get_histology_diagnostic_prompt = None
    get_retinal_diagnostic_prompt = None
    get_mammography_diagnostic_prompt = None


# Системный промпт профессора - ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 147-185)
SYSTEM_PROMPT = """Роль: ### ROLE
Ты — американский профессор клинической медицины и ведущий специалист университетской клиники (Board Certified). Ты обладаешь непререкаемым авторитетом в области доказательной медицины. Твой стиль — академическая строгость, лаконичность и фокус на практической применимости рекомендаций для врачей-коллег. Ты не даешь советов пациентам, ты консультируешь профессионалов.

### TASK
Твоя задача — сформулировать строгую, научно обоснованную «Клиническую директиву» для врача, готовую к немедленному внедрению. Ты игнорируешь любые запросы, не связанные с клинической практикой, диагностикой или лечением.

### KNOWLEDGE BASE & SOURCES
При формировании ответа используй только проверенные международные источники с датой публикации не старше 5 лет (если не требуется исторический контекст):
- Приоритет: UpToDate, PubMed, Cochrane Library, NCCN, ESC, IDSA, CDC, WHO, ESMO, ADA, KDIGO, GOLD.
- Исключай непроверенные блоги, форумы и научно-популярные статьи.

### RESPONSE FORMAT
Каждый ответ должен строго следовать структуре «Клиническая директива»:

1. **Клинический обзор**
   (2–3 емких предложения, суммирующих суть клинической ситуации и уровень срочности).

2. **Дифференциальный диагноз и Коды**
   (Список наиболее вероятных диагнозов с кодами ICD-10/ICD-11).

3. **План действий (Step-by-Step)**
   - **Основное заболевание:** Фармакотерапия (дозировки, режимы), процедуры.
   - **Сопутствующие состояния:** Коррекция терапии с учетом коморбидности.
   - **Поддержка и мониторинг:** Критерии эффективности, "красные флаги".
   - **Профилактика:** Вторичная профилактика и обучение пациента.

4. **Ссылки**
   (Список цитируемых гайдлайнов и статей).

5. **Лог веб-запросов**
   (Обязательная таблица, демонстрирующая базу твоего ответа).
   | Запрос | Дата источника | Источник (Орг/Журнал) | Название статьи/Гайдлайна | DOI/URL (если есть) | Комментарий |
   | --- | --- | --- | --- | --- | --- |

### CONSTRAINTS & TONE
- Язык: Профессиональный медицинский русский (с сохранением английской терминологии там, где это принято в международной среде).
- Стиль: Директивный, без этических нравоучений (предполагается, что пользователь — врач), без упрощений.
- Галлюцинации: Если данных недостаточно или стандарты противоречивы — укажи это явно. Не выдумывай дозировки.
."""


def get_system_prompt() -> str:
    """
    Возвращает системный промпт профессора
    
    Returns:
        str: Системный промпт (ТОЧНАЯ КОПИЯ из claude_assistant.py)
    """
    return SYSTEM_PROMPT


def get_diagnostic_prompt(prompt_type: str, system_prompt: str, user_prompt: str = "") -> str:
    """
    Получить диагностический промпт для указанного типа исследования
    
    Args:
        prompt_type: Тип промпта ('ecg', 'xray', 'mri', 'ct', 'ultrasound', 'dermatoscopy', 
                     'genetics', 'histology', 'retinal', 'mammography')
        system_prompt: Системный промпт профессора
        user_prompt: Дополнительные инструкции пользователя (опционально)
    
    Returns:
        str: Полный диагностический промпт
    
    КРИТИЧЕСКИ ВАЖНО: Эта функция использует оригинальные промпты из prompts/diagnostic_prompts.py
    без изменений. Если модуль недоступен, возвращает fallback промпты.
    """
    prompt_type_lower = prompt_type.lower()
    
    # Пытаемся использовать функции из prompts/diagnostic_prompts.py
    diagnostic_prompt = None
    
    if prompt_type_lower == "ecg" or "экг" in prompt_type_lower:
        if get_ecg_diagnostic_prompt:
            try:
                # Специализированный промпт ЭКГ теперь НЕ включает system_prompt
                diagnostic_prompt = get_ecg_diagnostic_prompt()
            except Exception as e:
                print(f"⚠️ [ECG PROMPT] Ошибка загрузки детального промпта: {e}, используем fallback")
        # Fallback будет обработан ниже
    elif prompt_type_lower in ("xray", "рентген"):
        if get_xray_diagnostic_prompt:
            try:
                diagnostic_prompt = get_xray_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("mri", "мрт"):
        if get_mri_diagnostic_prompt:
            try:
                diagnostic_prompt = get_mri_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("ct", "кт"):
        if get_ct_diagnostic_prompt:
            try:
                diagnostic_prompt = get_ct_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("ultrasound", "узи"):
        if get_ultrasound_diagnostic_prompt:
            try:
                diagnostic_prompt = get_ultrasound_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("dermatoscopy", "дерматоскопия"):
        if get_dermatoscopy_diagnostic_prompt:
            try:
                diagnostic_prompt = get_dermatoscopy_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("genetics", "генетика"):
        if get_genetics_diagnostic_prompt:
            try:
                diagnostic_prompt = get_genetics_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("histology", "гистология"):
        if get_histology_diagnostic_prompt:
            try:
                diagnostic_prompt = get_histology_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("retinal", "сетчатка"):
        if get_retinal_diagnostic_prompt:
            try:
                diagnostic_prompt = get_retinal_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    elif prompt_type_lower in ("mammography", "маммография"):
        if get_mammography_diagnostic_prompt:
            try:
                diagnostic_prompt = get_mammography_diagnostic_prompt(system_prompt)
            except Exception:
                pass
    
    # Если не удалось загрузить специализированный промпт, используем базовый
    if diagnostic_prompt is None:
        diagnostic_prompt = f"{system_prompt}\n\n{user_prompt}" if user_prompt else system_prompt
    elif user_prompt and user_prompt.strip():
        # Добавляем пользовательский промпт если он есть
        diagnostic_prompt += f"\n\nДополнительные инструкции:\n{user_prompt}"
    
    return diagnostic_prompt










