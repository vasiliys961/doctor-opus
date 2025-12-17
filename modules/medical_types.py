# -*- coding: utf-8 -*-
"""
Типы данных для медицинского анализатора
Выделено из medical_ai_analyzer.py для лучшей организации кода
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, List
import datetime


class ImageType(Enum):
    """Типы медицинских изображений"""
    ECG = "ecg"
    XRAY = "xray"
    MRI = "mri"
    CT = "ct"
    ULTRASOUND = "ultrasound"
    DERMATOSCOPY = "dermatoscopy"
    HISTOLOGY = "histology"
    RETINAL = "retinal"
    MAMMOGRAPHY = "mammography"


@dataclass
class AnalysisResult:
    """Результат анализа изображения"""
    image_type: ImageType
    confidence: float
    structured_findings: Dict[str, Any]
    clinical_interpretation: str
    recommendations: List[str]
    urgent_flags: List[str]
    icd10_codes: List[str]
    timestamp: str
    metadata: Dict[str, Any]
    model_name: str = ""  # Название модели, которая выполнила анализ
    tokens_used: int = 0  # Количество использованных токенов
