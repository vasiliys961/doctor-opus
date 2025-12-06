# genetic_analyzer.py
# genetic_analyzer.py
# -*- coding: utf-8 -*-
"""
Модуль анализа генетических данных для Enhanced Medical AI Analyzer
Поддерживает: VCF файлы, фармакогенетику, патогенные варианты, наследственные заболевания
"""

import json
import gzip
import re
import datetime
import io
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import os

# Импорты для OCR
try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

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

class GeneticDatabase:
    """База данных клинически значимых генетических вариантов"""
    
    def __init__(self):
        self.pathogenic_variants = self._load_pathogenic_variants()
        self.pharmacogenetic_variants = self._load_pharmacogenetic_variants()
        self.trait_variants = self._load_trait_variants()
        self.gene_disease_associations = self._load_gene_disease_associations()
    
    def _load_pathogenic_variants(self) -> Dict[str, ClinicalVariant]:
        """Загрузка патогенных вариантов"""
        variants = {}
        
        # BRCA1 варианты
        variants["17:43094464:C:T"] = ClinicalVariant(
            gene="BRCA1",
            variant_name="c.5266dupC",
            protein_change="p.Gln1756ProfsTer74",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный рак молочной железы и яичников",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая (60-80%)",
            clinical_action="усиленное наблюдение, профилактическая хирургия",
            evidence_level="очень сильная",
            population_frequency=0.0002
        )
        
        variants["17:43091434:A:G"] = ClinicalVariant(
            gene="BRCA1", 
            variant_name="c.185delAG",
            protein_change="p.Glu62ValfsTer19",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный рак молочной железы и яичников",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая (60-80%)",
            clinical_action="усиленное наблюдение, профилактическая хирургия",
            evidence_level="очень сильная",
            population_frequency=0.00015
        )
        
        # BRCA2 варианты
        variants["13:32890665:A:G"] = ClinicalVariant(
            gene="BRCA2",
            variant_name="c.2808_2811delACAA", 
            protein_change="p.Ala936ProfsTer39",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный рак молочной железы и яичников",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая (55-85%)",
            clinical_action="усиленное наблюдение, профилактическая хирургия",
            evidence_level="очень сильная",
            population_frequency=0.0001
        )
        
        # CFTR варианты
        variants["7:117230206:CTT:C"] = ClinicalVariant(
            gene="CFTR",
            variant_name="c.1521_1523delCTT",
            protein_change="p.Phe508del",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Муковисцидоз",
            inheritance_pattern="аутосомно-рецессивный",
            penetrance="полная при гомозиготности",
            clinical_action="генетическое консультирование, носительство",
            evidence_level="очень сильная",
            population_frequency=0.025
        )
        
        # HFE варианты (гемохроматоз)
        variants["6:26090951:G:A"] = ClinicalVariant(
            gene="HFE",
            variant_name="c.845G>A",
            protein_change="p.Cys282Tyr",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Наследственный гемохроматоз",
            inheritance_pattern="аутосомно-рецессивный",
            penetrance="неполная (мужчины > женщины)",
            clinical_action="мониторинг железа, флеботомия при необходимости",
            evidence_level="сильная",
            population_frequency=0.065
        )
        
        # LDLR (семейная гиперхолестеринемия)
        variants["19:45051059:T:C"] = ClinicalVariant(
            gene="LDLR",
            variant_name="c.2312delG",
            protein_change="p.Cys771TrpfsTer22",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Семейная гиперхолестеринемия",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="высокая",
            clinical_action="агрессивная липидснижающая терапия",
            evidence_level="очень сильная",
            population_frequency=0.002
        )
        
        # TP53 (синдром Ли-Фраумени)
        variants["17:7673803:G:A"] = ClinicalVariant(
            gene="TP53",
            variant_name="c.524G>A",
            protein_change="p.Arg175His",
            pathogenicity=VariantPathogenicity.PATHOGENIC,
            disease="Синдром Ли-Фраумени",
            inheritance_pattern="аутосомно-доминантный",
            penetrance="очень высокая (90%)",
            clinical_action="интенсивное онкологическое наблюдение",
            evidence_level="очень сильная",
            population_frequency=0.00001
        )
        
        return variants
    
    def _load_pharmacogenetic_variants(self) -> Dict[str, PharmacogeneticVariant]:
        """Загрузка фармакогенетических вариантов"""
        variants = {}
        
        # CYP2D6 варианты
        variants["22:42522613:G:A"] = PharmacogeneticVariant(
            gene="CYP2D6",
            variant="*4",
            phenotype="медленный метаболизатор",
            drugs=["кодеин", "трамадол", "метопролол", "рисперидон", "атомоксетин"],
            recommendation="избегать кодеин (неэффективен), снизить дозы других субстратов",
            evidence_level="сильная",
            clinical_annotation="повышенный риск побочных эффектов"
        )
        
        variants["22:42523805:C:T"] = PharmacogeneticVariant(
            gene="CYP2D6",
            variant="*3",
            phenotype="медленный метаболизатор",
            drugs=["кодеин", "трамадол", "метопролол"],
            recommendation="избегать кодеин, коррекция доз других препаратов",
            evidence_level="сильная",
            clinical_annotation="полная потеря функции фермента"
        )
        
        # CYP2C19 варианты
        variants["10:94762706:G:A"] = PharmacogeneticVariant(
            gene="CYP2C19",
            variant="*2",
            phenotype="медленный метаболизатор",
            drugs=["клопидогрел", "омепразол", "эсциталопрам", "вориконазол"],
            recommendation="альтернативная антиагрегантная терапия, увеличение дозы ИПП",
            evidence_level="очень сильная",
            clinical_annotation="снижение эффективности клопидогрела"
        )
        
        variants["10:94775489:G:A"] = PharmacogeneticVariant(
            gene="CYP2C19",
            variant="*3",
            phenotype="медленный метаболизатор", 
            drugs=["клопидогрел", "омепразол"],
            recommendation="альтернативная антиагрегантная терапия",
            evidence_level="сильная",
            clinical_annotation="полная потеря функции"
        )
        
        # DPYD варианты
        variants["1:97740410:G:A"] = PharmacogeneticVariant(
            gene="DPYD",
            variant="c.1679T>G",
            phenotype="дефицит дигидропиримидиндегидрогеназы",
            drugs=["5-фторурацил", "капецитабин", "тегафур"],
            recommendation="ПРОТИВОПОКАЗАНЫ - высокий риск тяжелой токсичности",
            evidence_level="очень сильная",
            clinical_annotation="риск летального исхода при стандартных дозах"
        )
        
        # HLA-B варианты
        variants["6:31353872:G:A"] = PharmacogeneticVariant(
            gene="HLA-B",
            variant="*57:01",
            phenotype="предрасположенность к гиперчувствительности",
            drugs=["абакавир"],
            recommendation="ПРОТИВОПОКАЗАН - высокий риск тяжелых аллергических реакций",
            evidence_level="очень сильная",
            clinical_annotation="обязательное тестирование перед назначением"
        )
        
        variants["6:31353876:T:C"] = PharmacogeneticVariant(
            gene="HLA-B",
            variant="*58:01",
            phenotype="предрасположенность к СJS/TEN",
            drugs=["аллопуринол"],
            recommendation="избегать аллопуринол, альтернативные урикозурики",
            evidence_level="сильная",
            clinical_annotation="риск синдрома Стивенса-Джонсона"
        )
        
        # VKORC1 варианты (варфарин)
        variants["16:31093557:C:T"] = PharmacogeneticVariant(
            gene="VKORC1",
            variant="c.-1639G>A",
            phenotype="повышенная чувствительность к варфарину",
            drugs=["варфарин"],
            recommendation="снижение начальной дозы на 25-50%",
            evidence_level="сильная",
            clinical_annotation="требуется частый мониторинг МНО"
        )
        
        return variants
    
    def _load_trait_variants(self) -> Dict[str, Dict[str, Any]]:
        """Загрузка вариантов, связанных с полигенными признаками"""
        variants = {}
        
        # Сердечно-сосудистые заболевания
        variants["9:22125504:C:G"] = {
            "gene": "CDKN2A/CDKN2B",
            "trait": "ишемическая болезнь сердца",
            "risk": "повышенный",
            "odds_ratio": 1.29,
            "population_frequency": 0.47,
            "effect_size": "умеренный",
            "evidence": "геномные ассоциативные исследования"
        }
        
        variants["1:55053079:C:T"] = {
            "gene": "PCSK9",
            "trait": "уровень холестерина ЛПНП",
            "risk": "пониженный",
            "odds_ratio": 0.85,
            "population_frequency": 0.02,
            "effect_size": "большой",
            "evidence": "функциональные исследования"
        }
        
        # Диабет 2 типа
        variants["10:114758349:C:T"] = {
            "gene": "TCF7L2",
            "trait": "сахарный диабет 2 типа",
            "risk": "повышенный",
            "odds_ratio": 1.37,
            "population_frequency": 0.28,
            "effect_size": "умеренный",
            "evidence": "множественные исследования"
        }
        
        # Болезнь Альцгеймера
        variants["19:45411941:T:C"] = {
            "gene": "APOE",
            "variant": "ε4",
            "trait": "болезнь Альцгеймера",
            "risk": "значительно повышенный",
            "odds_ratio": 3.68,
            "population_frequency": 0.14,
            "effect_size": "большой",
            "evidence": "десятилетия исследований"
        }
        
        # Венозная тромбоэмболия
        variants["1:169519049:T:C"] = {
            "gene": "F5",
            "variant": "Лейденская мутация",
            "trait": "венозная тромбоэмболия",
            "risk": "повышенный",
            "odds_ratio": 4.9,
            "population_frequency": 0.05,
            "effect_size": "большой",
            "evidence": "клинические исследования"
        }
        
        return variants
    
    def _load_gene_disease_associations(self) -> Dict[str, Dict[str, Any]]:
        """Загрузка ассоциаций ген-заболевание"""
        return {
            "BRCA1": {
                "diseases": ["рак молочной железы", "рак яичников", "рак поджелудочной железы"],
                "surveillance": ["МРТ молочных желез", "трансвагинальное УЗИ", "CA-125"],
                "prevention": ["профилактическая мастэктомия", "овариэктомия"]
            },
            "BRCA2": {
                "diseases": ["рак молочной железы", "рак яичников", "рак простаты", "меланома"],
                "surveillance": ["МРТ молочных желез", "трансвагинальное УЗИ", "ПСА"],
                "prevention": ["профилактическая мастэктомия", "овариэктомия"]
            },
            "TP53": {
                "diseases": ["саркомы", "рак молочной железы", "опухоли мозга", "лейкемия"],
                "surveillance": ["МРТ всего тела", "маммография", "МРТ мозга"],
                "prevention": ["избегание радиации", "регулярные обследования"]
            },
            "CFTR": {
                "diseases": ["муковисцидоз"],
                "surveillance": ["функция легких", "панкреатическая функция"],
                "prevention": ["генетическое консультирование"]
            }
        }

class VCFParser:
    """Парсер VCF файлов"""
    
    def __init__(self):
        self.supported_formats = ["VCFv4.0", "VCFv4.1", "VCFv4.2", "VCFv4.3"]
    
    def parse_file(self, file_path: str) -> Tuple[Dict[str, Any], List[VCFVariant]]:
        """Основная функция парсинга VCF файла"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"VCF файл не найден: {file_path}")
        
        # Валидация формата
        is_valid, validation_errors = self.validate_format(file_path)
        if not is_valid:
            raise ValueError(f"Некорректный VCF формат: {'; '.join(validation_errors)}")
        
        metadata = {}
        variants = []
        
        try:
            # Определяем тип файла (сжатый или нет)
            file_handle = gzip.open(file_path, 'rt', encoding='utf-8') if file_path.endswith('.gz') else open(file_path, 'r', encoding='utf-8')
            
            with file_handle as f:
                header_info = self._parse_header(f)
                metadata.update(header_info)
                
                # Парсинг вариантов
                sample_names = metadata.get('samples', [])
                variant_count = 0
                
                for line_num, line in enumerate(f, start=metadata.get('header_lines', 0) + 1):
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    
                    variant = self._parse_variant_line(line, sample_names, line_num)
                    if variant:
                        variants.append(variant)
                        variant_count += 1
                        
                        # Ограничиваем количество для больших файлов
                        if variant_count > 100000:
                            print(f"⚠️ Файл содержит более 100,000 вариантов. Обработаны первые {variant_count}")
                            break
                
                metadata['total_variants_parsed'] = len(variants)
                metadata['file_size'] = os.path.getsize(file_path)
                
                return metadata, variants
                
        except Exception as e:
            raise Exception(f"Ошибка при парсинге VCF файла: {str(e)}")
    
    def _parse_header(self, file_handle) -> Dict[str, Any]:
        """Парсинг заголовка VCF файла"""
        metadata = {
            'format_version': None,
            'reference': None,
            'samples': [],
            'info_fields': {},
            'format_fields': {},
            'header_lines': 0,
            'contigs': [],
            'filters': {}
        }
        
        for line in file_handle:
            line = line.strip()
            metadata['header_lines'] += 1
            
            if line.startswith('##'):
                # Метаданные
                if line.startswith('##fileformat='):
                    metadata['format_version'] = line.split('=', 1)[1]
                elif line.startswith('##reference='):
                    metadata['reference'] = line.split('=', 1)[1]
                elif line.startswith('##INFO='):
                    info_data = self._parse_meta_line(line)
                    if info_data:
                        metadata['info_fields'][info_data['ID']] = info_data
                elif line.startswith('##FORMAT='):
                    format_data = self._parse_meta_line(line)
                    if format_data:
                        metadata['format_fields'][format_data['ID']] = format_data
                elif line.startswith('##contig='):
                    contig_data = self._parse_meta_line(line)
                    if contig_data:
                        metadata['contigs'].append(contig_data)
                elif line.startswith('##FILTER='):
                    filter_data = self._parse_meta_line(line)
                    if filter_data:
                        metadata['filters'][filter_data['ID']] = filter_data
            
            elif line.startswith('#CHROM'):
                # Заголовок столбцов
                columns = line.split('\t')
                if len(columns) > 9:
                    metadata['samples'] = columns[9:]
                metadata['column_headers'] = columns
                break
        
        return metadata
    
    def _parse_meta_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Парсинг мета-строк (INFO, FORMAT, etc.)"""
        try:
            # Извлекаем содержимое между < >
            match = re.search(r'<(.+)>', line)
            if not match:
                return None
            
            content = match.group(1)
            meta_dict = {}
            
            # Парсим ключ=значение пары
            current_key = None
            current_value = ""
            in_quotes = False
            
            i = 0
            while i < len(content):
                char = content[i]
                
                if char == '=' and not in_quotes and current_key is None:
                    # Ключ найден
                    current_key = current_value.strip()
                    current_value = ""
                elif char == ',' and not in_quotes:
                    # Конец пары ключ=значение
                    if current_key:
                        meta_dict[current_key] = current_value.strip(' "')
                    current_key = None
                    current_value = ""
                elif char == '"':
                    in_quotes = not in_quotes
                else:
                    current_value += char
                
                i += 1
            
            # Последняя пара
            if current_key:
                meta_dict[current_key] = current_value.strip(' "')
            
            return meta_dict
            
        except Exception:
            return None
    
    def _parse_variant_line(self, line: str, samples: List[str], line_num: int) -> Optional[VCFVariant]:
        """Парсинг строки с вариантом"""
        try:
            fields = line.split('\t')
            if len(fields) < 8:
                print(f"⚠️ Строка {line_num}: недостаточно полей")
                return None
            
            # Основные поля
            chrom = fields[0]
            pos = int(fields[1])
            id_field = fields[2] if fields[2] != '.' else f"{chrom}:{pos}"
            ref = fields[3]
            alt = fields[4]
            
            # Качество
            try:
                qual = float(fields[5]) if fields[5] != '.' else 0.0
            except ValueError:
                qual = 0.0
            
            filter_field = fields[6]
            info_field = fields[7]
            
            # Парсинг INFO
            info_dict = self._parse_info_field(info_field)
            
            # FORMAT и образцы
            format_field = fields[8] if len(fields) > 8 else ""
            sample_data = {}
            
            if len(fields) > 9 and format_field:
                format_keys = format_field.split(':')
                for i, sample_name in enumerate(samples):
                    if i + 9 < len(fields):
                        sample_values = fields[i + 9].split(':')
                        sample_dict = {}
                        for j, key in enumerate(format_keys):
                            value = sample_values[j] if j < len(sample_values) else '.'
                            sample_dict[key] = value
                        sample_data[sample_name] = sample_dict
            
            return VCFVariant(
                chromosome=chrom,
                position=pos,
                id=id_field,
                ref=ref,
                alt=alt,
                quality=qual,
                filter=filter_field,
                info=info_dict,
                format=format_field,
                samples=sample_data
            )
            
        except Exception as e:
            print(f"⚠️ Ошибка парсинга строки {line_num}: {e}")
            return None
    
    def _parse_info_field(self, info_field: str) -> Dict[str, Any]:
        """Парсинг INFO поля"""
        info = {}
        
        if info_field and info_field != '.':
            for item in info_field.split(';'):
                if '=' in item:
                    key, value = item.split('=', 1)
                    # Пытаемся преобразовать в число
                    try:
                        if '.' in value:
                            info[key] = float(value)
                        else:
                            info[key] = int(value)
                    except ValueError:
                        info[key] = value
                else:
                    # Флаг без значения
                    info[item] = True
        
        return info
    
    def validate_format(self, file_path: str) -> Tuple[bool, List[str]]:
        """Валидация формата VCF файла"""
        errors = []
        
        try:
            file_handle = gzip.open(file_path, 'rt', encoding='utf-8') if file_path.endswith('.gz') else open(file_path, 'r', encoding='utf-8')
            
            with file_handle as f:
                first_line = f.readline().strip()
                
                # Проверка первой строки
                if not first_line.startswith('##fileformat=VCF'):
                    errors.append("Файл должен начинаться с ##fileformat=VCF")
                
                # Проверка версии
                if first_line.startswith('##fileformat='):
                    version = first_line.split('=')[1]
                    if version not in self.supported_formats:
                        errors.append(f"Неподдерживаемая версия VCF: {version}")
                
                # Поиск заголовка
                has_header = False
                line_count = 0
                
                for line in f:
                    line_count += 1
                    line = line.strip()
                    
                    if line.startswith('#CHROM'):
                        has_header = True
                        columns = line.split('\t')
                        required_cols = ['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO']
                        
                        for req_col in required_cols:
                            if req_col not in columns:
                                errors.append(f"Отсутствует обязательный столбец: {req_col}")
                        break
                    
                    if line_count > 1000:  # Ограничиваем поиск
                        break
                
                if not has_header:
                    errors.append("Отсутствует заголовок с названиями столбцов (#CHROM)")
                
        except Exception as e:
            errors.append(f"Ошибка чтения файла: {str(e)}")
        
        return len(errors) == 0, errors

class GeneticAnalyzer:
    """Основной анализатор генетических данных"""
    
    def __init__(self):
        self.database = GeneticDatabase()
        self.parser = VCFParser()
        self.analysis_cache = {}
    
    def analyze_vcf_file(self, file_path: str, 
                        patient_info: Optional[Dict[str, Any]] = None,
                        clinical_context: str = "") -> GeneticAnalysisResult:
        """Полный анализ VCF файла"""
        
        analysis_id = f"genetic_analysis_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # Парсинг VCF файла
            print(f"📁 Парсинг VCF файла: {file_path}")
            metadata, variants = self.parser.parse_file(file_path)
            
            if not variants:
                raise ValueError("Варианты не найдены в файле")
            
            print(f"✅ Загружено {len(variants)} вариантов")
            
            # Классификация вариантов
            classified_variants = self._classify_variants(variants)
            
            # Клиническая интерпретация
            clinical_interpretations = self._get_clinical_interpretations(
                classified_variants['pathogenic'] + classified_variants['likely_pathogenic']
            )
            
            # Фармакогенетическая интерпретация
            pharmacogenetic_interpretations = self._get_pharmacogenetic_interpretations(
                classified_variants['pharmacogenetic']
            )
            
            # Оценка рисков
            risk_assessment = self._assess_genetic_risks(
                classified_variants, clinical_interpretations, patient_info
            )
            
            # Генерация рекомендаций
            recommendations = self._generate_recommendations(
                classified_variants, clinical_interpretations, pharmacogenetic_interpretations
            )
            
            # Определение срочных флагов
            urgent_flags = self._determine_urgent_flags(
                classified_variants, clinical_interpretations
            )
            
            # Присвоение ICD-10 кодов
            icd10_codes = self._assign_icd10_codes(clinical_interpretations)
            
            # Расчет уверенности
            confidence_score = self._calculate_confidence_score(
                classified_variants, len(variants)
            )
            
            # Обновление метаданных
            metadata.update({
                'analysis_id': analysis_id,
                'patient_info': patient_info or {},
                'clinical_context': clinical_context,
                'file_path': file_path
            })
            
            result = GeneticAnalysisResult(
                analysis_id=analysis_id,
                timestamp=datetime.datetime.now().isoformat(),
                total_variants=len(variants),
                pathogenic_variants=classified_variants['pathogenic'],
                likely_pathogenic_variants=classified_variants['likely_pathogenic'],
                pharmacogenetic_variants=classified_variants['pharmacogenetic'],
                trait_variants=classified_variants['trait'],
                clinical_interpretations=clinical_interpretations,
                pharmacogenetic_interpretations=pharmacogenetic_interpretations,
                risk_assessment=risk_assessment,
                recommendations=recommendations,
                urgent_flags=urgent_flags,
                icd10_codes=icd10_codes,
                confidence_score=confidence_score,
                metadata=metadata
            )
            
            # Кэшируем результат
            self.analysis_cache[analysis_id] = result
            
            print(f"✅ Анализ завершен. ID: {analysis_id}")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка анализа: {e}")
            
            # Возвращаем результат с ошибкой
            error_metadata = {
                'analysis_id': analysis_id,
                'error': str(e),
                'file_path': file_path
            }
            
            return GeneticAnalysisResult(
                analysis_id=analysis_id,
                timestamp=datetime.datetime.now().isoformat(),
                total_variants=0,
                pathogenic_variants=[],
                likely_pathogenic_variants=[],
                pharmacogenetic_variants=[],
                trait_variants=[],
                clinical_interpretations=[],
                pharmacogenetic_interpretations=[],
                risk_assessment=GeneticRiskAssessment(
                    overall_risk_level="неопределен",
                    high_penetrance_diseases=[],
                    moderate_risk_conditions=[],
                    pharmacogenetic_considerations=[],
                    reproductive_risks=[],
                    surveillance_recommendations=[],
                    lifestyle_recommendations=[]
                ),
                recommendations=["Обратиться к врачу-генетику"],
                urgent_flags=["Ошибка анализа генетических данных"],
                icd10_codes=[],
                confidence_score=0.0,
                metadata=error_metadata
            )
    
    def analyze_text_report(
        self,
        report_text: str,
        patient_info: Optional[Dict[str, Any]] = None,
        clinical_context: str = "",
        source: str = "text_report"
    ) -> GeneticAnalysisResult:
        """
        Анализ текстового генетического отчета (PDF после извлечения текста или OCR).
        
        Цель: аккуратно извлечь строки, содержащие потенциальные генетические варианты
        (гены, cDNA/p-перемены, rsID), и оформить результат в стандартной структуре
        GeneticAnalysisResult.
        """
        analysis_id = f"genetic_text_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        text = report_text or ""
        
        # Ищем строки, где с высокой вероятностью описаны варианты:
        # содержат c.- или p.-нотацию, rsID или явные генные символы в контексте варианта
        variant_lines: List[str] = []
        all_lines = text.splitlines()
        
        # Паттерны для поиска генетических вариантов
        rsid_pattern = re.compile(r'rs\d+', re.IGNORECASE)
        gene_pattern = re.compile(r'\b(CYP|SLC|MTHFR|BRCA|TP53|APOE|F5|F2|COMT|ESR1|ESR2|GNRH1|AMH|PGR|FSHR|LHCGR|AMHR2)\w*\b', re.IGNORECASE)
        genotype_pattern = re.compile(r'\b([ATCG])/([ATCG])\b')
        protein_pattern = re.compile(r'p\.([A-Z][a-z]{2})(\d+)([A-Z][a-z]{2})', re.IGNORECASE)
        cdna_pattern = re.compile(r'c\.(\d+)([ATCG])>([ATCG])', re.IGNORECASE)
        
        for line in all_lines:
            line_lower = line.lower()
            # Проверяем наличие признаков генетического варианта
            has_rsid = bool(rsid_pattern.search(line))
            has_gene = bool(gene_pattern.search(line))
            has_genotype = bool(genotype_pattern.search(line))
            has_protein = bool(protein_pattern.search(line))
            has_cdna = bool(cdna_pattern.search(line))
            
            # Если есть хотя бы один признак - добавляем строку
            if has_rsid or (has_gene and (has_genotype or has_protein or has_cdna)):
                variant_lines.append(line.strip())
        
        # Формируем метаданные
        metadata = {
            'analysis_id': analysis_id,
            'source': source,
            'total_lines': len(all_lines),
            'variant_lines_count': len(variant_lines),
            'text_variants_raw': variant_lines,
            'patient_info': patient_info or {},
            'clinical_context': clinical_context
        }
        
        # Формируем результат
        return GeneticAnalysisResult(
            analysis_id=analysis_id,
            timestamp=datetime.datetime.now().isoformat(),
            total_variants=len(variant_lines),
            pathogenic_variants=[],
            likely_pathogenic_variants=[],
            pharmacogenetic_variants=[],
            trait_variants=[],
            clinical_interpretations=[],
            pharmacogenetic_interpretations=[],
            risk_assessment=GeneticRiskAssessment(
                overall_risk_level="неопределен",
                high_penetrance_diseases=[],
                moderate_risk_conditions=[],
                pharmacogenetic_considerations=[],
                reproductive_risks=[],
                surveillance_recommendations=[],
                lifestyle_recommendations=[]
            ),
            recommendations=["Для детального анализа используйте функцию ИИ-интерпретации"],
            urgent_flags=[],
            icd10_codes=[],
            confidence_score=0.5 if variant_lines else 0.0,
            metadata=metadata
        )
    
    def _extract_text_with_tesseract(self, file_path: str, max_pages: int = 8) -> Tuple[str, List[str]]:
        """
        Извлечение текста из PDF с помощью Tesseract OCR.
        
        Returns:
            Tuple[str, List[str]]: (extracted_text, errors)
        """
        if not TESSERACT_AVAILABLE:
            return "", ["Tesseract OCR не установлен (pip install pytesseract)"]
        
        if not PYMUPDF_AVAILABLE:
            return "", ["PyMuPDF не установлен (pip install PyMuPDF)"]
        
        ocr_text_parts = []
        errors = []
        
        try:
            pdf_document = fitz.open(file_path)
            total_pages = len(pdf_document)
            max_pages = min(total_pages, max_pages)
            
            for page_num in range(max_pages):
                try:
                    page = pdf_document.load_page(page_num)
                    # Конвертируем страницу в изображение с высоким разрешением
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom для лучшего качества
                    img_bytes = pix.tobytes("png")
                    image = Image.open(io.BytesIO(img_bytes))
                    
                    # Применяем OCR с поддержкой английского и русского
                    try:
                        text = pytesseract.image_to_string(image, lang='eng+rus')
                    except Exception as lang_error:
                        # Если мультиязычный режим не работает, пробуем только английский
                        try:
                            text = pytesseract.image_to_string(image, lang='eng')
                        except Exception:
                            text = pytesseract.image_to_string(image)
                    
                    if text.strip():
                        ocr_text_parts.append(f"\n--- OCR страница {page_num + 1}/{total_pages} ---\n{text.strip()}\n")
                        
                except Exception as e:
                    errors.append(f"OCR страница {page_num+1}: {str(e)}")
                    continue
            
            pdf_document.close()
            return "\n".join(ocr_text_parts).strip(), errors
            
        except Exception as e:
            return "", [f"Ошибка Tesseract OCR: {str(e)}"]
    
    def analyze_pdf_file(
        self,
        file_path: str,
        patient_info: Optional[Dict[str, Any]] = None,
        clinical_context: str = ""
    ) -> GeneticAnalysisResult:
        """
        Анализ генетического PDF-отчета.
        
        Стратегия:
        1. Попробовать извлечь текст через AdvancedLabProcessor._extract_from_pdf (таблицы + текст).
        2. Применить Tesseract OCR к страницам с изображениями (если доступен).
        3. Если Tesseract недоступен - fallback на Vision API (старый метод).
        4. Передать извлеченный текст в analyze_text_report для поиска строк с вариантами.
        """
        extracted_text = ""
        extract_errors: List[str] = []
        
        # 1) Пытаемся извлечь текст стандартным способом (pdfplumber/PyPDF2)
        try:
            from modules.advanced_lab_processor import AdvancedLabProcessor
            processor = AdvancedLabProcessor()
            extracted_text = processor._extract_from_pdf(file_path)
        except Exception as e:
            extract_errors.append(f"Стандартное извлечение: {str(e)}")
        
        # 2) Tesseract OCR (новый метод - приоритетный)
        tesseract_text = ""
        tesseract_errors = []
        if TESSERACT_AVAILABLE and PYMUPDF_AVAILABLE:
            tesseract_text, tesseract_errors = self._extract_text_with_tesseract(file_path, max_pages=8)
            extract_errors.extend(tesseract_errors)
        else:
            extract_errors.append("Tesseract OCR недоступен, используется fallback на Vision API")
        
        # 3) Fallback на Vision API только если Tesseract не дал результатов
        vision_text = ""
        if not tesseract_text and TESSERACT_AVAILABLE:
            # Vision API как резервный вариант (старая реализация)
            try:
                import pdfplumber
                from claude_assistant import OpenRouterAssistant
                import numpy as np
                
                assistant = OpenRouterAssistant()
                
                with pdfplumber.open(file_path) as pdf:
                    total_pages = len(pdf.pages)
                    max_pages = min(total_pages, 8)
                    
                    for page_num in range(max_pages):
                        page = pdf.pages[page_num]
                        try:
                            page_image = page.to_image(resolution=200).original
                            image_array = np.array(page_image)
                            
                            ocr_prompt = """
Вы — эксперт по OCR генетических отчетов.
Аккуратно извлеките ВЕСЬ текст с этой страницы PDF (особенно таблицы с генами, SNP/rsID и генотипами).
Верните ТОЛЬКО распознанный текст без интерпретации и без клинических выводов.
"""
                            ocr_result = assistant.send_vision_request(
                                ocr_prompt,
                                image_array,
                                metadata={"task": "doc_ocr", "page": page_num + 1}
                            )
                            if isinstance(ocr_result, list):
                                ocr_result = "\n\n".join(str(x.get("result", x)) for x in ocr_result)
                            
                            if ocr_result and str(ocr_result).strip():
                                vision_text += f"\n--- Vision API страница {page_num + 1}/{total_pages} ---\n{str(ocr_result).strip()}\n"
                        except Exception as pe:
                            extract_errors.append(f"Vision API page {page_num+1}: {str(pe)}")
                            continue
            except Exception as e:
                extract_errors.append(f"Vision API init error: {str(e)}")
        
        # 4) Объединяем все результаты
        combined_text_parts: List[str] = []
        if extracted_text and str(extracted_text).strip():
            combined_text_parts.append(str(extracted_text))
        if tesseract_text:
            combined_text_parts.append(tesseract_text)
        if vision_text:
            combined_text_parts.append(vision_text)
        
        combined_text = "\n\n".join(combined_text_parts).strip()
        
        if combined_text:
            # Анализируем объединенный текстовой отчет
            source = "pdf_report_combined" if (extracted_text and (tesseract_text or vision_text)) else (
                "pdf_report_tesseract" if tesseract_text else (
                    "pdf_report_vision" if vision_text else "pdf_report"
                )
            )
            return self.analyze_text_report(
                report_text=combined_text,
                patient_info=patient_info,
                clinical_context=clinical_context,
                source=source
            )
        
        # 5) Ничего не удалось извлечь
        warn_text = "Не удалось извлечь текст из PDF. " + "; ".join(extract_errors[:3])
        return self.analyze_text_report(
            report_text="",
            patient_info=patient_info,
            clinical_context=clinical_context + f"\n\n[PDF extraction warning] {warn_text}",
            source="pdf_report_empty"
            )
    
    def _classify_variants(self, variants: List[VCFVariant]) -> Dict[str, List[VCFVariant]]:
        """Классификация вариантов по клинической значимости"""
        
        classified = {
            'pathogenic': [],
            'likely_pathogenic': [],
            'pharmacogenetic': [],
            'trait': [],
            'uncertain': [],
            'benign': []
        }
        
        for variant in variants:
            variant_key = variant.variant_key
            
            # Поиск в базе патогенных вариантов
            if variant_key in self.database.pathogenic_variants:
                clinical_var = self.database.pathogenic_variants[variant_key]
                if clinical_var.pathogenicity == VariantPathogenicity.PATHOGENIC:
                    classified['pathogenic'].append(variant)
                elif clinical_var.pathogenicity == VariantPathogenicity.LIKELY_PATHOGENIC:
                    classified['likely_pathogenic'].append(variant)
                continue
            
            # Поиск в фармакогенетических вариантах
            if variant_key in self.database.pharmacogenetic_variants:
                classified['pharmacogenetic'].append(variant)
                continue
            
            # Поиск в вариантах признаков
            if variant_key in self.database.trait_variants:
                classified['trait'].append(variant)
                continue
            
            # Дополнительная фильтрация по качеству и частоте
            if variant.quality < 10:
                continue  # Пропускаем низкокачественные варианты
            
            # Частота в популяции из INFO поля
            population_freq = self._extract_population_frequency(variant)
            if population_freq > 0.01:  # Частые варианты скорее всего доброкачественные
                classified['benign'].append(variant)
            else:
                classified['uncertain'].append(variant)
        
        return classified
    
    def _extract_population_frequency(self, variant: VCFVariant) -> float:
        """Извлечение частоты в популяции из INFO поля"""
        info = variant.info
        
        # Проверяем различные поля частоты
        freq_fields = ['AF', 'MAF', 'gnomAD_AF', 'ExAC_AF', '1000G_AF']
        
        for field in freq_fields:
            if field in info:
                try:
                    freq = float(info[field])
                    return freq
                except (ValueError, TypeError):
                    continue
        
        return 0.0  # Неизвестная частота
    
    def _get_clinical_interpretations(self, variants: List[VCFVariant]) -> List[ClinicalVariant]:
        """Получение клинических интерпретаций для вариантов"""
        interpretations = []
        
        for variant in variants:
            variant_key = variant.variant_key
            if variant_key in self.database.pathogenic_variants:
                interpretations.append(self.database.pathogenic_variants[variant_key])
        
        return interpretations
    
    def _get_pharmacogenetic_interpretations(self, variants: List[VCFVariant]) -> List[PharmacogeneticVariant]:
        """Получение фармакогенетических интерпретаций"""
        interpretations = []
        
        for variant in variants:
            variant_key = variant.variant_key
            if variant_key in self.database.pharmacogenetic_variants:
                interpretations.append(self.database.pharmacogenetic_variants[variant_key])
        
        return interpretations
    
    def _assess_genetic_risks(self, classified_variants: Dict[str, List[VCFVariant]], 
                            clinical_interpretations: List[ClinicalVariant],
                            patient_info: Optional[Dict[str, Any]]) -> GeneticRiskAssessment:
        """Комплексная оценка генетических рисков"""
        
        # Определение общего уровня риска
        if classified_variants['pathogenic']:
            overall_risk = "высокий"
        elif classified_variants['likely_pathogenic']:
            overall_risk = "умеренно повышенный"
        elif classified_variants['pharmacogenetic']:
            overall_risk = "умеренный (фармакогенетический)"
        else:
            overall_risk = "базовый популяционный"
        
        # Заболевания высокой пенетрантности
        high_penetrance_diseases = []
        for interp in clinical_interpretations:
            if "высокая" in interp.penetrance:
                high_penetrance_diseases.append({
                    "disease": interp.disease,
                    "gene": interp.gene,
                    "inheritance": interp.inheritance_pattern,
                    "penetrance": interp.penetrance,
                    "clinical_action": interp.clinical_action
                })
        
        # Фармакогенетические соображения
        pharmacogenetic_considerations = []
        for variant in classified_variants['pharmacogenetic']:
            variant_key = variant.variant_key
            if variant_key in self.database.pharmacogenetic_variants:
                pg_var = self.database.pharmacogenetic_variants[variant_key]
                pharmacogenetic_considerations.append({
                    "gene": pg_var.gene,
                    "drugs": pg_var.drugs,
                    "phenotype": pg_var.phenotype,
                    "recommendation": pg_var.recommendation
                })
        
        # Репродуктивные риски
        reproductive_risks = []
        for interp in clinical_interpretations:
            if "рецессивный" in interp.inheritance_pattern:
                reproductive_risks.append({
                    "condition": interp.disease,
                    "inheritance": interp.inheritance_pattern,
                    "carrier_risk": "носительство",
                    "offspring_risk": "25% при браке с носителем"
                })
            elif "доминантный" in interp.inheritance_pattern:
                reproductive_risks.append({
                    "condition": interp.disease,
                    "inheritance": interp.inheritance_pattern,
                    "offspring_risk": "50% для каждого ребенка"
                })
        
        # Рекомендации по наблюдению
        surveillance_recommendations = []
        affected_genes = [interp.gene for interp in clinical_interpretations]
        
        for gene in set(affected_genes):
            if gene in self.database.gene_disease_associations:
                gene_info = self.database.gene_disease_associations[gene]
                surveillance_recommendations.extend(gene_info.get('surveillance', []))
        
        # Рекомендации по образу жизни
        lifestyle_recommendations = self._generate_lifestyle_recommendations(
            clinical_interpretations, patient_info
        )
        
        return GeneticRiskAssessment(
            overall_risk_level=overall_risk,
            high_penetrance_diseases=high_penetrance_diseases,
            moderate_risk_conditions=[],  # Можно расширить
            pharmacogenetic_considerations=pharmacogenetic_considerations,
            reproductive_risks=reproductive_risks,
            surveillance_recommendations=list(set(surveillance_recommendations)),
            lifestyle_recommendations=lifestyle_recommendations
        )
    
    def _generate_lifestyle_recommendations(self, clinical_interpretations: List[ClinicalVariant],
                                          patient_info: Optional[Dict[str, Any]]) -> List[str]:
        """Генерация рекомендаций по образу жизни"""
        recommendations = []
        
        diseases = [interp.disease.lower() for interp in clinical_interpretations]
        
        if any("рак" in disease for disease in diseases):
            recommendations.extend([
                "Здоровое питание с ограничением обработанных продуктов",
                "Регулярная физическая активность",
                "Отказ от курения и ограничение алкоголя",
                "Поддержание здорового веса"
            ])
        
        if any("сердечно-сосудистый" in disease or "холестерин" in disease for disease in diseases):
            recommendations.extend([
                "Диета с низким содержанием насыщенных жиров",
                "Регулярные кардиотренировки",
                "Контроль артериального давления",
                "Управление стрессом"
            ])
        
        if any("диабет" in disease for disease in diseases):
            recommendations.extend([
                "Контроль углеводов в рационе",
                "Регулярный мониторинг глюкозы",
                "Поддержание здорового веса"
            ])
        
        return list(set(recommendations))  # Убираем дубликаты
    
    def _generate_recommendations(self, classified_variants: Dict[str, List[VCFVariant]],
                                clinical_interpretations: List[ClinicalVariant],
                                pharmacogenetic_interpretations: List[PharmacogeneticVariant]) -> List[str]:
        """Генерация клинических рекомендаций"""
        recommendations = []
        
        # Рекомендации при патогенных вариантах
        if classified_variants['pathogenic']:
            recommendations.extend([
                "СРОЧНО: Консультация врача-генетика",
                "Медико-генетическое консультирование для семьи",
                "Обсуждение вариантов профилактики с онкологом",
                "Разработка индивидуального плана скрининга"
            ])
            
            # Специфические рекомендации по генам
            for interp in clinical_interpretations:
                if interp.pathogenicity == VariantPathogenicity.PATHOGENIC:
                    recommendations.append(f"Ген {interp.gene}: {interp.clinical_action}")
        
        # Рекомендации при вероятно патогенных вариантах
        if classified_variants['likely_pathogenic']:
            recommendations.extend([
                "Консультация врача-генетика",
                "Рассмотрение дополнительного генетического тестирования",
                "Усиленное наблюдение у соответствующих специалистов"
            ])
        
        # Фармакогенетические рекомендации
        if pharmacogenetic_interpretations:
            recommendations.extend([
                "Предоставить информацию о фармакогенетике лечащему врачу",
                "Уведомить всех врачей о особенностях метаболизма лекарств",
                "Рассмотреть ношение медицинского браслета/карточки"
            ])
            
            for pg_interp in pharmacogenetic_interpretations:
                if "ПРОТИВОПОКАЗАН" in pg_interp.recommendation.upper():
                    recommendations.append(f"КРИТИЧНО: {pg_interp.recommendation}")
        
        # Общие рекомендации
        if not any([classified_variants['pathogenic'], 
                   classified_variants['likely_pathogenic'],
                   pharmacogenetic_interpretations]):
            recommendations.extend([
                "Регулярные профилактические осмотры согласно возрасту",
                "Поддержание здорового образа жизни"
            ])
        
        return recommendations
    
    def _determine_urgent_flags(self, classified_variants: Dict[str, List[VCFVariant]],
                              clinical_interpretations: List[ClinicalVariant]) -> List[str]:
        """Определение срочных флагов"""
        urgent_flags = []
        
        if classified_variants['pathogenic']:
            urgent_flags.extend([
                "🚨 КРИТИЧНО: Обнаружены патогенные варианты",
                "Требуется СРОЧНАЯ консультация генетика",
                "Необходимо семейное скрининговое тестирование"
            ])
            
            # Специфические флаги для онкогенов
            oncogenes = ['BRCA1', 'BRCA2', 'TP53', 'APC', 'MLH1', 'MSH2']
            for interp in clinical_interpretations:
                if interp.gene in oncogenes and interp.pathogenicity == VariantPathogenicity.PATHOGENIC:
                    urgent_flags.append(f"🎯 Онкоген {interp.gene}: высокий риск рака")
        
        if classified_variants['pharmacogenetic']:
            # Проверяем критические фармакогенетические варианты
            critical_drugs = ['абакавир', '5-фторурацил', 'капецитабин']
            for variant in classified_variants['pharmacogenetic']:
                variant_key = variant.variant_key
                if variant_key in self.database.pharmacogenetic_variants:
                    pg_var = self.database.pharmacogenetic_variants[variant_key]
                    if any(drug in critical_drugs for drug in pg_var.drugs):
                        urgent_flags.append(f"💊 КРИТИЧНО: Противопоказание к {', '.join(pg_var.drugs)}")
        
        return urgent_flags
    
    def _assign_icd10_codes(self, clinical_interpretations: List[ClinicalVariant]) -> List[str]:
        """Присвоение кодов МКБ-10"""
        
        disease_to_icd10 = {
            "наследственный рак молочной железы и яичников": ["Z15.01", "Z80.3"],
            "муковисцидоз": ["E84.9"],
            "наследственный гемохроматоз": ["E83.110"],
            "семейная гиперхолестеринемия": ["E78.01"],
            "синдром ли-фраумени": ["Z15.09"],
            "венозная тромбоэмболия": ["Z83.79"],
            "болезнь альцгеймера": ["Z83.521"]
        }
        
        icd10_codes = []
        
        for interp in clinical_interpretations:
            disease_lower = interp.disease.lower()
            for disease_key, codes in disease_to_icd10.items():
                if disease_key in disease_lower:
                    icd10_codes.extend(codes)
        
        return list(set(icd10_codes))  # Убираем дубликаты
    
    def _calculate_confidence_score(self, classified_variants: Dict[str, List[VCFVariant]], 
                                  total_variants: int) -> float:
        """Расчет уверенности анализа"""
        
        base_confidence = 0.7
        
        # Повышаем уверенность при наличии клинически значимых вариантов
        if classified_variants['pathogenic']:
            base_confidence += 0.2
        
        if classified_variants['likely_pathogenic']:
            base_confidence += 0.1
        
        if classified_variants['pharmacogenetic']:
            base_confidence += 0.05
        
        # Учитываем качество данных
        high_quality_variants = sum(1 for variants in classified_variants.values() 
                                  for variant in variants if variant.quality >= 30)
        
        if total_variants > 0:
            quality_ratio = high_quality_variants / total_variants
            base_confidence *= (0.8 + 0.2 * quality_ratio)
        
        return min(base_confidence, 1.0)
    
    def generate_report(self, analysis_result: GeneticAnalysisResult,
                       patient_info: Optional[Dict[str, Any]] = None,
                       include_technical_details: bool = True) -> str:
        """Генерация детального отчета"""
        
        report_parts = []
        
        # Заголовок
        report_parts.append("=" * 80)
        report_parts.append("ОТЧЕТ ПО ГЕНЕТИЧЕСКОМУ АНАЛИЗУ")
        report_parts.append("=" * 80)
        
        # Информация о пациенте
        if patient_info:
            report_parts.append("ИНФОРМАЦИЯ О ПАЦИЕНТЕ:")
            report_parts.append(f"  ФИО: {patient_info.get('name', 'Не указано')}")
            report_parts.append(f"  Дата рождения: {patient_info.get('birth_date', 'Не указана')}")
            report_parts.append(f"  Пол: {patient_info.get('gender', 'Не указан')}")
            report_parts.append(f"  ID пациента: {patient_info.get('patient_id', 'Не указан')}")
            report_parts.append("")
        
        # Метаинформация анализа
        report_parts.append("ИНФОРМАЦИЯ ОБ АНАЛИЗЕ:")
        report_parts.append(f"  ID анализа: {analysis_result.analysis_id}")
        report_parts.append(f"  Дата и время: {analysis_result.timestamp}")
        report_parts.append(f"  Уверенность анализа: {analysis_result.confidence_score:.1%}")
        report_parts.append("")
        
        # Общая статистика
        report_parts.append("ОБЩИЕ РЕЗУЛЬТАТЫ:")
        report_parts.append(f"  Всего вариантов: {analysis_result.total_variants}")
        report_parts.append(f"  Патогенных: {len(analysis_result.pathogenic_variants)}")
        report_parts.append(f"  Вероятно патогенных: {len(analysis_result.likely_pathogenic_variants)}")
        report_parts.append(f"  Фармакогенетических: {len(analysis_result.pharmacogenetic_variants)}")
        report_parts.append(f"  Связанных с признаками: {len(analysis_result.trait_variants)}")
        report_parts.append("")
        
        # Срочные уведомления
        if analysis_result.urgent_flags:
            report_parts.append("🚨 СРОЧНЫЕ УВЕДОМЛЕНИЯ:")
            for flag in analysis_result.urgent_flags:
                report_parts.append(f"  {flag}")
            report_parts.append("")
        
        # Патогенные варианты
        if analysis_result.clinical_interpretations:
            report_parts.append("🧬 КЛИНИЧЕСКИ ЗНАЧИМЫЕ ВАРИАНТЫ:")
            report_parts.append("-" * 50)
            
            for i, interp in enumerate(analysis_result.clinical_interpretations, 1):
                report_parts.append(f"{i}. Ген: {interp.gene}")
                report_parts.append(f"   Вариант: {interp.variant_name}")
                report_parts.append(f"   Белковое изменение: {interp.protein_change}")
                report_parts.append(f"   Патогенность: {interp.pathogenicity.value}")
                report_parts.append(f"   Заболевание: {interp.disease}")
                report_parts.append(f"   Наследование: {interp.inheritance_pattern}")
                report_parts.append(f"   Пенетрантность: {interp.penetrance}")
                report_parts.append(f"   Клинические действия: {interp.clinical_action}")
                report_parts.append(f"   Частота в популяции: {interp.population_frequency:.4f}")
                report_parts.append("")
        
        # Фармакогенетика
        if analysis_result.pharmacogenetic_interpretations:
            report_parts.append("💊 ФАРМАКОГЕНЕТИЧЕСКИЕ ВАРИАНТЫ:")
            report_parts.append("-" * 50)
            
            for i, pg_interp in enumerate(analysis_result.pharmacogenetic_interpretations, 1):
                report_parts.append(f"{i}. Ген: {pg_interp.gene}")
                report_parts.append(f"   Вариант: {pg_interp.variant}")
                report_parts.append(f"   Фенотип: {pg_interp.phenotype}")
                report_parts.append(f"   Препараты: {', '.join(pg_interp.drugs)}")
                report_parts.append(f"   Рекомендация: {pg_interp.recommendation}")
                report_parts.append(f"   Уровень доказательств: {pg_interp.evidence_level}")
                report_parts.append("")
        
        # Оценка рисков
        risk = analysis_result.risk_assessment
        report_parts.append("📊 ОЦЕНКА РИСКОВ:")
        report_parts.append("-" * 30)
        report_parts.append(f"Общий уровень риска: {risk.overall_risk_level.upper()}")
        
        if risk.high_penetrance_diseases:
            report_parts.append("\nЗаболевания высокой пенетрантности:")
            for disease in risk.high_penetrance_diseases:
                report_parts.append(f"  • {disease['disease']} (ген: {disease['gene']})")
                report_parts.append(f"    Наследование: {disease['inheritance']}")
                report_parts.append(f"    Действие: {disease['clinical_action']}")
        
        if risk.reproductive_risks:
            report_parts.append("\nРепродуктивные риски:")
            for rep_risk in risk.reproductive_risks:
                report_parts.append(f"  • {rep_risk['condition']}")
                report_parts.append(f"    Риск для потомства: {rep_risk.get('offspring_risk', 'Не определен')}")
        
        if risk.surveillance_recommendations:
            report_parts.append("\nРекомендации по наблюдению:")
            for rec in risk.surveillance_recommendations:
                report_parts.append(f"  • {rec}")
        
        if risk.lifestyle_recommendations:
            report_parts.append("\nРекомендации по образу жизни:")
            for rec in risk.lifestyle_recommendations:
                report_parts.append(f"  • {rec}")
        
        report_parts.append("")
        
        # Клинические рекомендации
        if analysis_result.recommendations:
            report_parts.append("💡 КЛИНИЧЕСКИЕ РЕКОМЕНДАЦИИ:")
            report_parts.append("-" * 35)
            for i, rec in enumerate(analysis_result.recommendations, 1):
                report_parts.append(f"{i}. {rec}")
            report_parts.append("")
        
        # Коды МКБ-10
        if analysis_result.icd10_codes:
            report_parts.append(f"🏥 Коды МКБ-10: {', '.join(analysis_result.icd10_codes)}")
            report_parts.append("")
        
        # Техническая информация
        if include_technical_details and analysis_result.metadata:
            meta = analysis_result.metadata
            report_parts.append("🔧 ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ:")
            report_parts.append(f"  Формат VCF: {meta.get('format_version', 'Неизвестен')}")
            report_parts.append(f"  Референсный геном: {meta.get('reference', 'Неизвестен')}")
            report_parts.append(f"  Образцы: {', '.join(meta.get('samples', []))}")
            if 'file_size' in meta:
                file_size_mb = meta['file_size'] / (1024 * 1024)
                report_parts.append(f"  Размер файла: {file_size_mb:.1f} МБ")
            report_parts.append("")
        
        # Заключение
        report_parts.append("ЗАКЛЮЧЕНИЕ:")
        report_parts.append("-" * 15)
        
        if analysis_result.pathogenic_variants:
            report_parts.append("🚨 КРИТИЧНО: Обнаружены патогенные варианты!")
            report_parts.append("Требуется СРОЧНАЯ консультация врача-генетика.")
        elif analysis_result.likely_pathogenic_variants:
            report_parts.append("⚠️ Обнаружены вероятно патогенные варианты.")
            report_parts.append("Рекомендуется консультация врача-генетика.")
        elif analysis_result.pharmacogenetic_variants:
            report_parts.append("💊 Обнаружены фармакогенетически значимые варианты.")
            report_parts.append("Передайте информацию лечащему врачу и фармацевту.")
        else:
            report_parts.append("✅ Клинически значимых патогенных вариантов не обнаружено.")
            report_parts.append("Рекомендуются стандартные профилактические мероприятия.")
        
        # Дисклеймер
        report_parts.append("")
        report_parts.append("ВАЖНОЕ УВЕДОМЛЕНИЕ:")
        report_parts.append("• Данный анализ основан на современных научных данных")
        report_parts.append("• Интерпретация может изменяться с развитием генетики")
        report_parts.append("• Обязательна консультация врача-генетика для окончательной интерпретации")
        report_parts.append("• Результат не заменяет клиническую диагностику")
        
        report_parts.append("")
        report_parts.append("=" * 80)
        
        return "\n".join(report_parts)
    
    def export_results(self, analysis_result: GeneticAnalysisResult, 
                      file_path: str, format_type: str = "json") -> bool:
        """Экспорт результатов анализа"""
        try:
            if format_type.lower() == "json":
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(analysis_result.to_dict(), f, ensure_ascii=False, indent=2)
            
            elif format_type.lower() == "txt":
                report = self.generate_report(analysis_result)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(report)
            
            else:
                raise ValueError(f"Неподдерживаемый формат: {format_type}")
            
            print(f"✅ Результаты экспортированы в {file_path}")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка экспорта: {e}")
            return False

# Интеграционный класс для связи с основным анализатором
class GeneticAnalyzerIntegration:
    """Класс для интеграции генетического анализатора с основным медицинским ИИ"""
    
    def __init__(self, medical_analyzer_instance=None):
        self.genetic_analyzer = GeneticAnalyzer()
        self.medical_analyzer = medical_analyzer_instance
    
    def analyze_genetic_data_for_medical_ai(self, vcf_file_path: str, 
                                           clinical_context: str = "",
                                           patient_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Анализ генетических данных для интеграции с медицинским ИИ"""
        
        try:
            # Генетический анализ
            genetic_result = self.genetic_analyzer.analyze_vcf_file(
                vcf_file_path, patient_info, clinical_context
            )
            
            # Преобразование в формат для медицинского анализатора
            medical_ai_format = {
                "data_type": "genetic",
                "confidence": genetic_result.confidence_score,
                "technical_assessment": {
                    "quality": "хорошее" if genetic_result.confidence_score > 0.8 else "удовлетворительное",
                    "total_variants": genetic_result.total_variants,
                    "file_info": genetic_result.metadata.get('format_version', 'VCF'),
                    "samples": genetic_result.metadata.get('samples', [])
                },
                "clinical_findings": {
                    "pathogenic_variants": [
                        {
                            "finding": f"Патогенный вариант в гене {interp.gene}",
                            "location": f"{interp.gene} ({interp.variant_name})",
                            "severity": "критическая" if interp.pathogenicity == VariantPathogenicity.PATHOGENIC else "умеренная",
                            "description": f"{interp.disease}, {interp.inheritance_pattern}",
                            "clinical_significance": interp.clinical_action
                        } for interp in genetic_result.clinical_interpretations
                    ],
                    "pharmacogenetic_variants": [
                        {
                            "finding": f"Фармакогенетический вариант {pg.gene}",
                            "drugs_affected": pg.drugs,
                            "recommendation": pg.recommendation,
                            "phenotype": pg.phenotype
                        } for pg in genetic_result.pharmacogenetic_interpretations
                    ]
                },
                "diagnosis": {
                    "primary_diagnosis": self._generate_primary_genetic_diagnosis(genetic_result),
                    "genetic_risk_level": genetic_result.risk_assessment.overall_risk_level,
                    "icd10_codes": genetic_result.icd10_codes,
                    "confidence_level": "высокая" if genetic_result.confidence_score > 0.8 else "средняя"
                },
                "recommendations": {
                    "urgent_actions": genetic_result.urgent_flags,
                    "follow_up": genetic_result.recommendations,
                    "genetic_counseling": self._get_genetic_counseling_recommendations(genetic_result),
                    "surveillance": genetic_result.risk_assessment.surveillance_recommendations,
                    "lifestyle": genetic_result.risk_assessment.lifestyle_recommendations
                },
                "risk_assessment": {
                    "urgency_level": "ЭКСТРЕННО" if genetic_result.pathogenic_variants else "планово",
                    "genetic_risk": genetic_result.risk_assessment.overall_risk_level,
                    "reproductive_implications": len(genetic_result.risk_assessment.reproductive_risks) > 0,
                    "family_screening_needed": len(genetic_result.pathogenic_variants) > 0
                }
            }
            
            # Если доступен медицинский ИИ - запрашиваем дополнительную интерпретацию
            if self.medical_analyzer:
                ai_interpretation = self._get_ai_interpretation(genetic_result, clinical_context)
                medical_ai_format["ai_interpretation"] = ai_interpretation
            
            return medical_ai_format
            
        except Exception as e:
            return {
                "data_type": "genetic",
                "error": str(e),
                "confidence": 0.0,
                "recommendations": {
                    "urgent_actions": ["Ошибка анализа генетических данных"],
                    "follow_up": ["Обратиться к врачу-генетику"]
                },
                "risk_assessment": {
                    "urgency_level": "планово"
                }
            }
    
    def _generate_primary_genetic_diagnosis(self, genetic_result: GeneticAnalysisResult) -> str:
        """Генерация основного генетического диагноза"""
        
        if genetic_result.pathogenic_variants:
            diseases = [interp.disease for interp in genetic_result.clinical_interpretations 
                       if interp.pathogenicity == VariantPathogenicity.PATHOGENIC]
            if diseases:
                return f"Носительство патогенных вариантов: {', '.join(set(diseases))}"
        
        if genetic_result.likely_pathogenic_variants:
            return "Носительство вероятно патогенных генетических вариантов"
        
        if genetic_result.pharmacogenetic_variants:
            return "Обнаружены фармакогенетически значимые варианты"
        
        return "Клинически значимых патогенных вариантов не обнаружено"
    
    def _get_genetic_counseling_recommendations(self, genetic_result: GeneticAnalysisResult) -> List[str]:
        """Рекомендации по генетическому консультированию"""
        recommendations = []
        
        if genetic_result.pathogenic_variants:
            recommendations.extend([
                "Срочное медико-генетическое консультирование",
                "Семейный анамнез и составление родословной",
                "Каскадное тестирование родственников",
                "Обсуждение репродуктивных рисков"
            ])
        
        if genetic_result.risk_assessment.reproductive_risks:
            recommendations.append("Преконцепционное консультирование")
        
        if genetic_result.pharmacogenetic_variants:
            recommendations.append("Консультация по персонализированной фармакотерапии")
        
        return recommendations
    
    def _get_ai_interpretation(self, genetic_result: GeneticAnalysisResult, 
                              clinical_context: str) -> str:
        """Получение ИИ-интерпретации генетических результатов"""
        
        if not self.medical_analyzer:
            return "ИИ-интерпретация недоступна"
        
        # Формируем промпт для ИИ
        prompt = f"""
Проанализируйте результаты генетического тестирования:

КЛИНИЧЕСКИЙ КОНТЕКСТ: {clinical_context}

РЕЗУЛЬТАТЫ:
- Патогенных вариантов: {len(genetic_result.pathogenic_variants)}
- Фармакогенетических вариантов: {len(genetic_result.pharmacogenetic_variants)}
- Общий риск: {genetic_result.risk_assessment.overall_risk_level}

ДЕТАЛИ ПАТОГЕННЫХ ВАРИАНТОВ:
{chr(10).join([f"- {interp.gene}: {interp.disease} ({interp.inheritance_pattern})" 
               for interp in genetic_result.clinical_interpretations])}

Предоставьте:
1. Клиническую значимость
2. Приоритеты в ведении пациента
3. Интеграцию с общим медицинским планом
4. Специфические предупреждения

Ответ в краткой структурированной форме.
"""
        
        try:
            # Используем метод медицинского анализатора для отправки запроса
            # (упрощенная версия без изображения)
            payload = {
                "model": self.medical_analyzer.models[0],
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1500,
                "temperature": 0.1
            }
            
            response = requests.post(
                self.medical_analyzer.base_url,
                headers=self.medical_analyzer.headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                return "ИИ-анализ временно недоступен"
                
        except Exception as e:
            return f"Ошибка ИИ-анализа: {str(e)}"

# Утилиты для работы с модулем
def create_test_vcf_file(output_path: str = "test_genetic_sample.vcf") -> str:
    """Создание тестового VCF файла"""
    
    test_vcf_content = """##fileformat=VCFv4.2
##reference=GRCh37
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Read Depth">
##contig=<ID=1,length=249250621>
##contig=<ID=6,length=171115067>
##contig=<ID=7,length=159138663>
##contig=<ID=17,length=81195210>
##contig=<ID=22,length=51304566>
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	PATIENT_001
17	43094464	rs80357906	C	T	100	PASS	DP=50;AF=0.5	GT:DP	0/1:30
7	117230206	rs113993960	CTT	C	95	PASS	DP=45;AF=1.0	GT:DP	1/1:25
22	42522613	rs3892097	G	A	98	PASS	DP=40;AF=0.5	GT:DP	0/1:35
6	26090951	rs1800562	G	A	92	PASS	DP=38;AF=0.5	GT:DP	0/1:28
19	45051059	rs121908424	T	C	89	PASS	DP=42;AF=0.5	GT:DP	0/1:32
10	94762706	rs4244285	G	A	96	PASS	DP=44;AF=0.5	GT:DP	0/1:36
1	97740410	rs3918290	G	A	85	PASS	DP=35;AF=0.5	GT:DP	0/1:25
"""
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(test_vcf_content)
        
        print(f"✅ Тестовый VCF файл создан: {output_path}")
        return output_path
        
    except Exception as e:
        print(f"❌ Ошибка создания тестового файла: {e}")
        return ""

def run_genetic_analysis_example():
    """Пример запуска генетического анализа"""
    
    print("🧬 ПРИМЕР АНАЛИЗА ГЕНЕТИЧЕСКИХ ДАННЫХ")
    print("=" * 60)
    
    # Создаем тестовый VCF файл
    test_file = create_test_vcf_file()
    
    if not test_file:
        print("❌ Не удалось создать тестовый файл")
        return
    
    # Создаем анализатор
    analyzer = GeneticAnalyzer()
    
    # Информация о пациенте
    patient_info = {
        "name": "Иванов Иван Иванович",
        "birth_date": "1985-03-15",
        "gender": "мужской",
        "patient_id": "P001"
    }
    
    try:
        # Запускаем анализ
        print("🔄 Запуск генетического анализа...")
        result = analyzer.analyze_vcf_file(
            test_file, 
            patient_info,
            "Семейная история онкологических заболеваний"
        )
        
        # Выводим основные результаты
        print(f"\n📊 РЕЗУЛЬТАТЫ АНАЛИЗА:")
        print(f"ID анализа: {result.analysis_id}")
        print(f"Уверенность: {result.confidence_score:.1%}")
        print(f"Всего вариантов: {result.total_variants}")
        print(f"Патогенных: {len(result.pathogenic_variants)}")
        print(f"Фармакогенетических: {len(result.pharmacogenetic_variants)}")
        
        # Срочные уведомления
        if result.urgent_flags:
            print(f"\n🚨 СРОЧНЫЕ УВЕДОМЛЕНИЯ:")
            for flag in result.urgent_flags:
                print(f"  {flag}")
        
        # Основные находки
        if result.clinical_interpretations:
            print(f"\n🧬 КЛИНИЧЕСКИЕ НАХОДКИ:")
            for interp in result.clinical_interpretations:
                print(f"  • {interp.gene}: {interp.disease}")
                print(f"    Патогенность: {interp.pathogenicity.value}")
                print(f"    Действие: {interp.clinical_action}")
        
        # Фармакогенетика
        if result.pharmacogenetic_interpretations:
            print(f"\n💊 ФАРМАКОГЕНЕТИКА:")
            for pg_interp in result.pharmacogenetic_interpretations:
                print(f"  • {pg_interp.gene}: {pg_interp.phenotype}")
                print(f"    Препараты: {', '.join(pg_interp.drugs)}")
                print(f"    Рекомендация: {pg_interp.recommendation}")
        
        # Рекомендации
        if result.recommendations:
            print(f"\n💡 РЕКОМЕНДАЦИИ:")
            for i, rec in enumerate(result.recommendations[:5], 1):  # Первые 5
                print(f"  {i}. {rec}")
        
        # Экспорт отчета
        report_file = "genetic_analysis_report.txt"
        analyzer.export_results(result, report_file, "txt")
        
        # Экспорт JSON
        json_file = "genetic_analysis_results.json"
        analyzer.export_results(result, json_file, "json")
        
        print(f"\n✅ Анализ завершен успешно!")
        print(f"📄 Отчет сохранен: {report_file}")
        print(f"📊 JSON данные: {json_file}")
        
        return result
        
    except Exception as e:
        print(f"❌ Ошибка анализа: {e}")
        return None
    
    finally:
        # Удаляем тестовый файл
        try:
            os.remove(test_file)
            print(f"🗑️ Тестовый файл удален")
        except:
            pass

# Экспорт основных классов и функций
__all__ = [
    'GeneticAnalyzer',
    'GeneticAnalyzerIntegration', 
    'VCFParser',
    'GeneticDatabase',
    'GeneticAnalysisResult',
    'GeneticDataType',
    'VCFVariant',
    'ClinicalVariant',
    'PharmacogeneticVariant',
    'create_test_vcf_file',
    'run_genetic_analysis_example'
]

if __name__ == "__main__":
    # Запуск примера при прямом выполнении модуля
    run_genetic_analysis_example()