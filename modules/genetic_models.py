# -*- coding: utf-8 -*-
"""
Модели данных для генетического анализа
"""
from typing import List, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum


class GeneticDataType(Enum):
    """Типы генетических данных"""
    VCF = "vcf"
    GENETIC_REPORT = "genetic_report"
    PHARMACOGENETIC = "pharmacogenetic"
    FAMILY_HISTORY = "family_history"


class VariantPathogenicity(Enum):
    """Классификация патогенности вариантов (ACMG)"""
    PATHOGENIC = "pathogenic"
    LIKELY_PATHOGENIC = "likely_pathogenic"
    UNCERTAIN_SIGNIFICANCE = "uncertain_significance"
    LIKELY_BENIGN = "likely_benign"
    BENIGN = "benign"


@dataclass
class VCFVariant:
    """Структура для хранения информации о варианте из VCF"""
    chromosome: str
    position: int
    id: str
    ref: str
    alt: str
    quality: float
    filter: str
    info: Dict[str, Any]
    format: str
    samples: Dict[str, Dict[str, Any]]
    
    def to_dict(self) -> Dict[str, Any]:
        """Конвертация в словарь"""
        return asdict(self)
    
    @property
    def variant_key(self) -> str:
        """Уникальный ключ варианта"""
        return f"{self.chromosome}:{self.position}:{self.ref}:{self.alt}"
    
    @property
    def is_snv(self) -> bool:
        """Является ли вариант SNV"""
        return len(self.ref) == 1 and len(self.alt) == 1
    
    @property
    def is_indel(self) -> bool:
        """Является ли вариант инделом"""
        return len(self.ref) != len(self.alt)


@dataclass
class ClinicalVariant:
    """Клинически значимый вариант"""
    gene: str
    variant_name: str
    protein_change: str
    pathogenicity: VariantPathogenicity
    disease: str
    inheritance_pattern: str
    penetrance: str
    clinical_action: str
    evidence_level: str
    population_frequency: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PharmacogeneticVariant:
    """Фармакогенетический вариант"""
    gene: str
    variant: str
    phenotype: str
    drugs: List[str]
    recommendation: str
    evidence_level: str
    clinical_annotation: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class GeneticRiskAssessment:
    """Оценка генетических рисков"""
    overall_risk_level: str
    high_penetrance_diseases: List[Dict[str, Any]]
    moderate_risk_conditions: List[Dict[str, Any]]
    pharmacogenetic_considerations: List[Dict[str, Any]]
    reproductive_risks: List[Dict[str, Any]]
    surveillance_recommendations: List[str]
    lifestyle_recommendations: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class GeneticAnalysisResult:
    """Результат генетического анализа"""
    analysis_id: str
    timestamp: str
    total_variants: int
    pathogenic_variants: List[VCFVariant]
    likely_pathogenic_variants: List[VCFVariant]
    pharmacogenetic_variants: List[VCFVariant]
    trait_variants: List[VCFVariant]
    clinical_interpretations: List[ClinicalVariant]
    pharmacogenetic_interpretations: List[PharmacogeneticVariant]
    risk_assessment: GeneticRiskAssessment
    recommendations: List[str]
    urgent_flags: List[str]
    icd10_codes: List[str]
    confidence_score: float
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Конвертация в словарь для JSON сериализации"""
        return {
            'analysis_id': self.analysis_id,
            'timestamp': self.timestamp,
            'total_variants': self.total_variants,
            'pathogenic_variants': [v.to_dict() for v in self.pathogenic_variants],
            'likely_pathogenic_variants': [v.to_dict() for v in self.likely_pathogenic_variants],
            'pharmacogenetic_variants': [v.to_dict() for v in self.pharmacogenetic_variants],
            'trait_variants': [v.to_dict() for v in self.trait_variants],
            'clinical_interpretations': [c.to_dict() for c in self.clinical_interpretations],
            'pharmacogenetic_interpretations': [p.to_dict() for p in self.pharmacogenetic_interpretations],
            'risk_assessment': self.risk_assessment.to_dict(),
            'recommendations': self.recommendations,
            'urgent_flags': self.urgent_flags,
            'icd10_codes': self.icd10_codes,
            'confidence_score': self.confidence_score,
            'metadata': self.metadata
        }










