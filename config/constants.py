"""
Константы для медицинского ассистента
Все магические числа и строки вынесены сюда для централизованного управления
"""

# ============================================================================
# ЭКГ КОНСТАНТЫ
# ============================================================================

# Частота сердечных сокращений
HR_NORMAL_MIN = 60  # Минимальная нормальная ЧСС (уд/мин)
HR_NORMAL_MAX = 100  # Максимальная нормальная ЧСС (уд/мин)
HR_BRADYCARDIA_THRESHOLD = 60  # Порог брадикардии (уд/мин)
HR_TACHYCARDIA_THRESHOLD = 100  # Порог тахикардии (уд/мин)
HR_SEVERE_BRADYCARDIA = 45  # Выраженная брадикардия (уд/мин)
HR_SEVERE_TACHYCARDIA = 150  # Выраженная тахикардия (уд/мин)

# RR интервалы
RR_VARIATION_COEFFICIENT_THRESHOLD = 0.15  # Порог коэффициента вариации RR (15%)
RR_VARIATION_COEFFICIENT_SEVERE = 0.25  # Выраженная вариация (25%)
RR_MIN_INTERVALS_FOR_ANALYSIS = 5  # Минимальное количество интервалов для анализа
RR_MIN_INTERVALS_FOR_TRIANGULAR_INDEX = 20  # Минимальное количество для треугольного индекса

# Треугольный индекс
TRIANGULAR_INDEX_BIN_WIDTH_MS = 7.8125  # Ширина бина для гистограммы (мс)
TRIANGULAR_INDEX_BIN_WIDTH_SEC = TRIANGULAR_INDEX_BIN_WIDTH_MS / 1000  # В секундах

# Детекция R-пиков
R_PEAK_MIN_DISTANCE_RATIO = 0.2  # Минимальное расстояние между пиками (от sampling_rate)
R_PEAK_WINDOW_SIZE_RATIO = 0.15  # Размер окна интегрирования (150 мс)
R_PEAK_CORRECTION_WINDOW_RATIO = 0.05  # Окно коррекции позиций пиков (±50 мс)

# QRS комплекс
QRS_DURATION_NORMAL_MAX_MS = 120  # Максимальная нормальная длительность QRS (мс)
QRS_SEARCH_WINDOW_BEFORE_MS = 40  # Окно поиска Q волны перед R (мс)
QRS_SEARCH_WINDOW_AFTER_MS = 80  # Окно поиска S волны после R (мс)

# QT интервал
QT_INTERVAL_MIN_MS = 300  # Минимальный реалистичный QT (мс)
QT_INTERVAL_MAX_MS = 500  # Максимальный реалистичный QT (мс)
QT_INTERVAL_SEARCH_START_MS = 200  # Начало поиска T волны после R (мс)
QT_INTERVAL_SEARCH_END_MS = 100  # Конец поиска перед следующим R (мс)
QT_INTERVAL_BASELINE_WINDOW_BEFORE_MS = 100  # Окно для определения baseline перед R (мс)
QT_INTERVAL_BASELINE_WINDOW_AFTER_MS = 50  # Окно для определения baseline после R (мс)
QT_INTERVAL_Q_START_OFFSET_MS = 40  # Смещение начала Q от R (мс)
QT_QTc_NORMAL_MAX_MS = 440  # Максимальный нормальный QTc (мс)
QT_QTc_SHORT_MAX_MS = 350  # Максимальный укороченный QTc (мс)

# Частота дискретизации
ECG_DEFAULT_SAMPLING_RATE = 500  # Стандартная частота дискретизации ЭКГ (Гц)

# Оценка качества сигнала
SIGNAL_QUALITY_SNR_LOG_MULTIPLIER = 10  # Множитель для логарифма SNR
SIGNAL_QUALITY_PEAK_DETECTION_MULTIPLIER = 50  # Множитель для отношения обнаруженных пиков
SIGNAL_QUALITY_BASE_SCORE = 50  # Базовый балл качества сигнала
SIGNAL_QUALITY_EXPECTED_HR = 1.2  # Ожидаемая ЧСС для расчета (уд/сек)

# Регулярность ритма
RHYTHM_REGULARITY_CV_THRESHOLD_1 = 0.05  # Порог для "Регулярный"
RHYTHM_REGULARITY_CV_THRESHOLD_2 = 0.15  # Порог для "Слегка нерегулярный"
RHYTHM_REGULARITY_CV_THRESHOLD_3 = 0.25  # Порог для "Умеренно нерегулярный"

# Вариабельность сердечного ритма (ВСР)
HRV_SDNN_LOW_THRESHOLD = 50  # Низкий SDNN (мс)
HRV_SDNN_HIGH_THRESHOLD = 150  # Высокий SDNN (мс)
HRV_NN50_THRESHOLD_MS = 50  # Порог для pNN50 (мс)
HRV_NN50_THRESHOLD_SEC = HRV_NN50_THRESHOLD_MS / 1000  # В секундах

# ============================================================================
# ИЗОБРАЖЕНИЯ
# ============================================================================

# Размеры изображений
IMAGE_MAX_SIZE_AI = (1024, 1024)  # Максимальный размер для AI анализа
IMAGE_MOBILE_MAX_SIZE = (1024, 1024)  # Максимальный размер для мобильных устройств
IMAGE_MIN_SIZE = (100, 100)  # Минимальный размер изображения
IMAGE_MAX_SIZE = (10000, 10000)  # Максимальный размер изображения

# PIL лимиты
PIL_MAX_IMAGE_PIXELS = 500000000  # ~500M пикселей (защита от decompression bomb)

# ============================================================================
# ФАЙЛЫ
# ============================================================================

# Размеры файлов
MAX_UPLOAD_SIZE_MB = 50  # Максимальный размер загрузки (MB)
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
MAX_CSV_SIZE_MB = 200  # Максимальный размер CSV файла (MB) - для ЭКГ данных
MAX_CSV_SIZE_BYTES = MAX_CSV_SIZE_MB * 1024 * 1024

# ============================================================================
# API КОНСТАНТЫ
# ============================================================================

# Таймауты
API_TIMEOUT_SECONDS = 120  # Таймаут для обычных запросов
API_TIMEOUT_LONG_SECONDS = 180  # Таймаут для длинных запросов (видео, консенсус)

# Токены
MAX_TOKENS_ECG = 2500  # Максимальное количество токенов для ЭКГ
MAX_TOKENS_DEFAULT = 4000  # Максимальное количество токенов по умолчанию
MAX_TOKENS_LLAMA = 1000  # Максимальное количество токенов для Llama
EXTENDED_THINKING_BUDGET = 10000  # Бюджет токенов для Extended Thinking

# Консенсус
MIN_CONSENSUS_RESULTS = 2  # Минимальное количество результатов для консенсуса
MAX_CONSENSUS_MODELS = 4  # Максимальное количество моделей для консенсуса

# Кеш промптов
MAX_CACHED_PROMPTS = 10  # Максимальное количество кешированных промптов

# ============================================================================
# БАЗА ДАННЫХ
# ============================================================================

# Названия таблиц
TABLE_PATIENT_NOTES = "patient_notes"
TABLE_SPECIALIST_PROMPTS = "specialist_prompts"
TABLE_ANALYSIS_FEEDBACK = "analysis_feedback"

# Названия колонок
COLUMN_ID = "id"
COLUMN_PATIENT_ID = "patient_id"
COLUMN_CREATED_AT = "created_at"
COLUMN_UPDATED_AT = "updated_at"

# ============================================================================
# ВАЛИДАЦИЯ
# ============================================================================

# Пациент
PATIENT_NAME_MIN_LENGTH = 2  # Минимальная длина имени пациента
PATIENT_AGE_MIN = 0  # Минимальный возраст
PATIENT_AGE_MAX = 150  # Максимальный возраст
PATIENT_SEX_VALID_VALUES = ["М", "Ж", "м", "ж"]  # Валидные значения пола

# ============================================================================
# ОБРАБОТКА СИГНАЛОВ
# ============================================================================

# Фильтрация ЭКГ
BASELINE_DRIFT_CUTOFF_FREQ = 0.5  # Частота среза для удаления дрейфа (Гц)
BANDPASS_FILTER_LOW_FREQ = 0.5  # Нижняя частота полосового фильтра (Гц)
BANDPASS_FILTER_HIGH_FREQ = 40  # Верхняя частота полосового фильтра (Гц)
POWERLINE_INTERFERENCE_FREQ = 50  # Частота сетевой наводки (Гц)
POWERLINE_INTERFERENCE_Q = 30  # Добротность режекторного фильтра

# ============================================================================
# МОРФОЛОГИЯ ЭКГ
# ============================================================================

# Окна для анализа
BEAT_WINDOW_MS = 600  # Окно для извлечения комплекса (мс)
BEAT_WINDOW_RATIO = BEAT_WINDOW_MS / 1000  # В секундах (относительно sampling_rate)

# ============================================================================
# ОЦЕНКА КАЧЕСТВА
# ============================================================================

# Пороги для оценки качества сигнала
SIGNAL_QUALITY_SNR_THRESHOLD = 1.0  # Минимальный SNR
SIGNAL_QUALITY_PEAK_DETECTION_RATIO_MIN = 0.5  # Минимальное отношение обнаруженных пиков

# Пороги для оценки регулярности
RHYTHM_REGULARITY_MIN_INTERVALS = 3  # Минимальное количество интервалов для оценки

# ============================================================================
# СООБЩЕНИЯ ОБ ОШИБКАХ (для централизованного управления)
# ============================================================================

ERROR_IMAGE_EMPTY = "Изображение пустое или не загружено"
ERROR_IMAGE_TOO_SMALL = "Изображение слишком маленькое. Минимум: {min_size[0]}x{min_size[1]}"
ERROR_IMAGE_TOO_LARGE = "Изображение слишком большое. Максимум: {max_size[0]}x{max_size[1]}"
ERROR_FILE_TOO_LARGE = "Файл слишком большой. Максимум: {max_size_mb} MB"
ERROR_INVALID_DATA_TYPE = "Неподдерживаемый тип данных: {dtype}"
ERROR_INVALID_VALUES = "Изображение содержит невалидные значения (NaN или Inf)"
ERROR_PATIENT_NAME_TOO_SHORT = "Имя пациента должно содержать минимум {min_length} символа"
ERROR_PATIENT_AGE_INVALID = "Возраст должен быть от {min_age} до {max_age} лет"
ERROR_PATIENT_SEX_INVALID = "Пол должен быть 'М' или 'Ж'"

# ============================================================================
# СТАТУСЫ И ОЦЕНКИ
# ============================================================================

# Статусы лабораторных параметров
LAB_STATUS_NORMAL = "normal"
LAB_STATUS_HIGH = "high"
LAB_STATUS_LOW = "low"
LAB_STATUS_CRITICAL_HIGH = "critical_high"
LAB_STATUS_CRITICAL_LOW = "critical_low"

# Выраженность аритмий
ARRHYTHMIA_SEVERITY_MILD = "Легкая"
ARRHYTHMIA_SEVERITY_MODERATE = "Умеренная"
ARRHYTHMIA_SEVERITY_SEVERE = "Выраженная"

# Оценка качества изображения
IMAGE_QUALITY_EXCELLENT = "отличное"
IMAGE_QUALITY_GOOD = "хорошее"
IMAGE_QUALITY_FAIR = "удовлетворительное"
IMAGE_QUALITY_POOR = "плохое"
IMAGE_QUALITY_UNDEFINED = "неопределено"

# Уровни срочности
URGENCY_EMERGENCY = "экстренно"
URGENCY_URGENT = "срочно"
URGENCY_ROUTINE = "планово"

# Прогноз
PROGNOSIS_FAVORABLE = "благоприятный"
PROGNOSIS_CAUTIOUS = "осторожный"
PROGNOSIS_UNFAVORABLE = "неблагоприятный"
PROGNOSIS_UNDEFINED = "неопределенный"

