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
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import os

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
                        
                        # Ограничиваем количество для больших файлов (увеличено для больших геномов)
                        if variant_count > 500000:
                            print(f"⚠️ Файл содержит более 500,000 вариантов. Обработаны первые {variant_count}")
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

class PDFGeneticParser:
    """Парсер PDF файлов с генетическими данными"""
    
    def __init__(self):
        self.supported_formats = ["PDF"]
    
    def _convert_pdf_to_images(self, file_path: str, max_pages: int = 10) -> List[Any]:
        """Конвертация PDF страниц в изображения для vision-анализа
        
        Args:
            file_path: Путь к PDF файлу
            max_pages: Максимальное количество страниц для конвертации
            
        Returns:
            Список PIL.Image объектов
        """
        images = []
        try:
            from pdf2image import convert_from_path
            import tempfile
            import os
            
            print(f"🖼️ Конвертация PDF в изображения (первые {max_pages} страниц)...")
            images = convert_from_path(file_path, first_page=1, last_page=max_pages, dpi=200)
            print(f"✅ Конвертировано {len(images)} страниц в изображения")
            return images
        except ImportError:
            print("⚠️ pdf2image не установлен. Установите: pip install pdf2image")
            print("⚠️ Также требуется poppler: brew install poppler (macOS) или apt-get install poppler-utils (Linux)")
            return []
        except Exception as e:
            print(f"⚠️ Ошибка конвертации PDF в изображения: {e}")
            return []
    
    def extract_text_from_pdf(self, file_path: str, max_pages: int = None) -> str:
        """Извлечение текста из PDF файла
        
        Args:
            file_path: Путь к PDF файлу
            max_pages: Максимальное количество страниц для извлечения (None = все страницы)
        """
        text = ""
        errors = []
        
        # Проверяем доступность библиотек
        pdfplumber_available = False
        pypdf2_available = False
        
        try:
            import pdfplumber
            pdfplumber_available = True
        except ImportError:
            pass
        
        try:
            import PyPDF2
            pypdf2_available = True
        except ImportError:
            pass
        
        if not pdfplumber_available and not pypdf2_available:
            raise ImportError("Для работы с PDF установите: pip install PyPDF2 pdfplumber")
        
        # Попробуем с pdfplumber (лучше для таблиц)
        if pdfplumber_available:
            try:
                with pdfplumber.open(file_path) as pdf:
                    total_pages = len(pdf.pages)
                    pages_to_extract = min(max_pages, total_pages) if max_pages else total_pages
                    print(f"📄 Всего страниц в PDF: {total_pages}, извлекаем: {pages_to_extract}")
                    
                    for page_num, page in enumerate(pdf.pages[:pages_to_extract], 1):
                        try:
                            page_text = page.extract_text()
                            page_text_len = len(page_text) if page_text else 0
                            
                            if page_text and page_text.strip():
                                text += f"\n--- Страница {page_num}/{total_pages} ---\n"
                                text += page_text + "\n"
                                if page_num <= 5 or page_num % 10 == 0:  # Логируем первые 5 и каждые 10 страниц
                                    print(f"  📄 Страница {page_num}: извлечено {page_text_len} символов текста")
                            else:
                                if page_num <= 5 or page_num % 10 == 0:
                                    print(f"  ⚠️ Страница {page_num}: текст не найден (возможно, только изображения)")
                            
                            # Извлечение таблиц (важно для генетических отчетов!)
                            try:
                                tables = page.extract_tables()
                                if tables:
                                    table_text = ""
                                    for table_num, table in enumerate(tables, 1):
                                        table_text += f"\n--- Таблицы со страницы {page_num} ---\n"
                                        table_text += f"\nТаблица {table_num}:\n"
                                        for row in table:
                                            if row and any(cell for cell in row if cell):
                                                row_text = "\t".join([str(cell).strip() if cell else "" for cell in row])
                                                if row_text.strip():
                                                    table_text += row_text + "\n"
                                    
                                    if table_text.strip():
                                        text += table_text
                                        if page_num <= 5 or page_num % 10 == 0:
                                            print(f"  📊 Страница {page_num}: найдено {len(tables)} таблиц, добавлено {len(table_text)} символов")
                            except Exception as e:
                                errors.append(f"Ошибка извлечения таблиц со страницы {page_num}: {str(e)}")
                                
                        except Exception as e:
                            errors.append(f"Ошибка обработки страницы {page_num}: {str(e)}")
                            continue
                    
                    avg_chars_per_page = len(text) / pages_to_extract if pages_to_extract > 0 else 0
                    print(f"✅ pdfplumber: извлечено {len(text)} символов из {pages_to_extract} страниц (~{avg_chars_per_page:.0f} символов/страницу)")
                    
                    # Если извлечено мало текста, предупреждаем
                    if avg_chars_per_page < 100 and pages_to_extract >= 5:
                        print(f"⚠️ ВНИМАНИЕ: Мало текста извлечено ({len(text)} символов из {pages_to_extract} страниц, ~{avg_chars_per_page:.0f} символов/страницу)")
                        print(f"⚠️ Возможные причины:")
                        print(f"   - PDF содержит изображения (сканированный документ) - требуется OCR")
                        print(f"   - Текст встроен как изображения, а не как текст")
                        print(f"   - PDF защищен или имеет нестандартный формат")
                        print(f"⚠️ Пробуем альтернативный метод извлечения (PyPDF2)...")
                            
            except Exception as e:
                errors.append(f"Ошибка pdfplumber: {str(e)}")
        
        # Если pdfplumber извлек мало текста или не сработал, пробуем PyPDF2
        pages_extracted = pages_to_extract if 'pages_to_extract' in locals() else (max_pages if max_pages else 100)
        avg_chars = len(text.strip()) / pages_extracted if pages_extracted > 0 and text.strip() else 0
        
        if (not text.strip() or avg_chars < 100) and pypdf2_available:
            if not text.strip():
                print(f"🔄 pdfplumber не извлек текст. Пробуем PyPDF2...")
            else:
                print(f"🔄 pdfplumber извлек мало текста (~{avg_chars:.0f} символов/страницу). Пробуем PyPDF2 для улучшения...")
            try:
                import PyPDF2
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    total_pages = len(pdf_reader.pages)
                    pages_to_extract = min(max_pages, total_pages) if max_pages else total_pages
                    print(f"📄 PyPDF2: всего страниц в PDF: {total_pages}, извлекаем: {pages_to_extract}")
                    
                    pypdf2_text = ""
                    original_text_len = len(text)
                    for page_num, page in enumerate(pdf_reader.pages[:pages_to_extract], 1):
                        try:
                            page_text = page.extract_text()
                            if page_text and page_text.strip():
                                pypdf2_text += f"\n--- Страница {page_num}/{total_pages} (PyPDF2) ---\n"
                                pypdf2_text += page_text + "\n"
                                # Логируем первые 5 страниц для диагностики
                                if page_num <= 5:
                                    print(f"  📄 Страница {page_num} (PyPDF2): извлечено {len(page_text)} символов")
                        except Exception as e2:
                            errors.append(f"Ошибка PyPDF2 на странице {page_num}: {str(e2)}")
                    
                    # Используем PyPDF2 результат, если он лучше
                    if len(pypdf2_text.strip()) > original_text_len:
                        print(f"✅ PyPDF2 извлек больше текста: {len(pypdf2_text)} vs {original_text_len} символов. Используем PyPDF2 результат.")
                        text = pypdf2_text
                    elif pypdf2_text.strip():
                        # Объединяем результаты, если PyPDF2 нашел дополнительный текст
                        text += "\n" + pypdf2_text
                        print(f"✅ PyPDF2: добавлено {len(pypdf2_text)} символов. Итого: {len(text)} символов")
                    else:
                        print(f"⚠️ PyPDF2 также извлек мало текста: {len(pypdf2_text)} символов")
            except Exception as e2:
                errors.append(f"Ошибка PyPDF2: {str(e2)}")
        
        if errors:
            print(f"⚠️ Предупреждения при извлечении PDF: {'; '.join(errors)}")
        
        print(f"📊 ИТОГО извлечено: {len(text)} символов текста из PDF")
        return text
    
    def _extract_variants_from_text(self, text: str) -> List[VCFVariant]:
        """Извлечение вариантов из текста через regex (Этап 2)"""
        variants = []
        
        # Паттерны для поиска вариантов в различных форматах
        variant_patterns = [
            # Стандартный VCF: chr:pos:ref:alt
            (r'(\d+|X|Y|MT|M|chr\d+|chrX|chrY|chrMT|chrM)[:\s]+(\d+)[:\s]+([ACGTN]+)[:\s]+([ACGTN]+)', 'vcf'),
            # С rsID: rs123456 (chr:pos)
            (r'rs(\d+)\s*[\(]?(\d+|X|Y|MT)[:\s]+(\d+)[:\s]*([ACGTN]+)[:\s]*([ACGTN]+)', 'rsid'),
            # HGVS нотация: c.123A>G
            (r'c\.(\d+)([ACGTN]+)>([ACGTN]+)', 'hgvs_c'),
            # С геном: GENE c.123A>G
            (r'([A-Z0-9_-]+)\s+c\.(\d+)([ACGTN]+)>([ACGTN]+)', 'gene_hgvs'),
        ]
        
        # Поиск генов
        gene_pattern = r'([A-Z0-9_-]+)\s+(?:gene|Gene|GENE)'
        genes_found = re.findall(gene_pattern, text, re.IGNORECASE)
        
        # Поиск патогенности
        pathogenicity_pattern = r'(pathogenic|likely pathogenic|uncertain significance|likely benign|benign)'
        pathogenicity_matches = re.findall(pathogenicity_pattern, text, re.IGNORECASE)
        
        for pattern, pattern_type in variant_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    if pattern_type == 'vcf':
                        chrom, pos, ref, alt = match.groups()
                        variant_id = f"{chrom}:{pos}:{ref}:{alt}"
                    elif pattern_type == 'rsid':
                        rsid, chrom, pos, ref, alt = match.groups()
                        variant_id = f"rs{rsid}"
                    elif pattern_type == 'hgvs_c':
                        pos, ref, alt = match.groups()
                        chrom = "Unknown"
                        variant_id = f"c.{pos}{ref}>{alt}"
                    elif pattern_type == 'gene_hgvs':
                        gene, pos, ref, alt = match.groups()
                        chrom = "Unknown"
                        variant_id = f"{gene}_c.{pos}{ref}>{alt}"
                    else:
                        continue
                    
                    # Валидация: проверка, что ref и alt содержат только нуклеотиды
                    if not all(c in 'ACGTNacgtn' for c in ref + alt):
                        continue
                    
                    # Определение патогенности
                    pathogenicity = VariantPathogenicity.UNCERTAIN_SIGNIFICANCE
                    if pathogenicity_matches:
                        path_str = pathogenicity_matches[0].lower()
                        if 'pathogenic' in path_str and 'likely' not in path_str:
                            pathogenicity = VariantPathogenicity.PATHOGENIC
                        elif 'likely pathogenic' in path_str:
                            pathogenicity = VariantPathogenicity.LIKELY_PATHOGENIC
                        elif 'benign' in path_str and 'likely' not in path_str:
                            pathogenicity = VariantPathogenicity.BENIGN
                        elif 'likely benign' in path_str:
                            pathogenicity = VariantPathogenicity.LIKELY_BENIGN
                    
                    # Определение гена
                    gene = genes_found[0] if genes_found else "Unknown"
                    
                    variant = VCFVariant(
                        chromosome=chrom.replace('chr', '') if chrom.startswith('chr') else chrom,
                        position=int(pos) if pos.isdigit() else 0,
                        id=variant_id,
                        ref=ref.upper(),
                        alt=alt.upper(),
                        quality=0.0,
                        filter="PASS",
                        info={
                            'gene': gene,
                            'pathogenicity': pathogenicity.value,
                            'source': 'PDF_regex',
                            'extraction_method': 'regex'
                        },
                        format="GT",
                        samples={}
                    )
                    variants.append(variant)
                except Exception as e:
                    continue
        
        return variants
    
    def extract_tables_from_pdf(self, file_path: str) -> List[Dict]:
        """Извлечение таблиц из PDF (Этап 3)"""
        tables = []
        
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        page_tables = page.extract_tables()
                        for table_num, table in enumerate(page_tables, 1):
                            if table and len(table) > 1:  # Есть заголовок и данные
                                tables.append({
                                    'page': page_num,
                                    'table_num': table_num,
                                    'data': table
                                })
                    except Exception as e:
                        continue
        except ImportError:
            print("⚠️ pdfplumber недоступен для извлечения таблиц")
        except Exception as e:
            print(f"⚠️ Ошибка извлечения таблиц: {e}")
        
        return tables
    
    def parse_genetic_report_pdf(self, file_path: str) -> Tuple[Dict, List[VCFVariant]]:
        """Парсинг генетического отчета из PDF с трехуровневым подходом"""
        metadata = {
            'source': 'PDF',
            'file_type': 'genetic_report',
            'extraction_method': 'multi_level'
        }
        variants = []
        
        # Этап 1: Извлечение текста (первые 10 страниц для оптимизации)
        print("📄 Этап 1: Извлечение текста из PDF (первые 10 страниц)...")
        text = self.extract_text_from_pdf(file_path, max_pages=10)
        
        if not text or len(text.strip()) < 100:
            raise ValueError("Не удалось извлечь достаточное количество текста из PDF")
        
        print(f"✅ Извлечено {len(text)} символов текста")
        
        # Этап 2: Автоматическое извлечение вариантов из текста
        print("🔍 Этап 2: Автоматическое извлечение вариантов через regex...")
        variants = self._extract_variants_from_text(text)
        
        if variants:
            print(f"✅ Найдено {len(variants)} вариантов через regex")
            metadata['extraction_method'] = 'regex'
            return metadata, variants
        
        # Этап 3: Извлечение из таблиц (если варианты не найдены)
        print("📊 Этап 3: Извлечение вариантов из таблиц...")
        tables = self.extract_tables_from_pdf(file_path)
        
        if tables:
            print(f"✅ Найдено {len(tables)} таблиц")
            metadata['tables_found'] = len(tables)
            metadata['extraction_method'] = 'tables'
            metadata['extracted_text'] = text  # Сохраняем текст для возможного ИИ-анализа
            # Варианты из таблиц будут извлечены в GeneticAnalyzer._extract_variants_from_tables
            return metadata, []  # Возвращаем пустой список, таблицы будут обработаны отдельно
        
        # Если автоматические методы не нашли варианты, возвращаем текст для ИИ-анализа
        print("⚠️ Автоматическое извлечение не дало результатов. Требуется ИИ-анализ.")
        metadata['extraction_method'] = 'ai_required'
        metadata['extracted_text'] = text
        return metadata, []
    
    def parse_genetic_data_from_text(self, text: str, use_ai: bool = True) -> Tuple[Dict[str, Any], List[VCFVariant]]:
        """Парсинг генетических данных из текста PDF с опциональным использованием ИИ"""
        metadata = {
            'source': 'PDF',
            'extraction_method': 'ai_enhanced' if use_ai else 'text_parsing',
            'file_type': 'genetic_report',
            'gene_panel': [],
            'technical_info': {
                'method': '',
                'laboratory': '',
                'accreditation': '',
                'reference_genome': '',
                'pipeline': '',
                'geneticist_signature': ''
            }
        }
        variants = []
        gene_panel = []
        technical_info = {}
        
        # Сначала пробуем ИИ-извлечение, если доступно
        if use_ai:
            try:
                ai_result = self._extract_variants_with_ai(text)
                ai_variants = ai_result.get('variants', [])
                gene_panel = ai_result.get('gene_panel', [])
                technical_info = ai_result.get('technical_info', {})
                
                if ai_variants:
                    print(f"✅ ИИ извлек {len(ai_variants)} вариантов")
                    variants.extend(ai_variants)
                if gene_panel:
                    print(f"✅ ИИ нашел спектр из {len(gene_panel)} генов")
                    metadata['gene_panel'] = gene_panel
                if technical_info:
                    metadata['technical_info'].update(technical_info)
                    print(f"✅ ИИ извлек техническую информацию")
            except Exception as e:
                print(f"⚠️ ИИ-извлечение не удалось: {e}. Используем регулярные выражения.")
        
        # Дополняем результатами регулярных выражений
        regex_result = self._extract_variants_with_regex(text)
        regex_variants = regex_result.get('variants', [])
        regex_gene_panel = regex_result.get('gene_panel', [])
        
        if regex_variants:
            print(f"✅ Регулярные выражения нашли {len(regex_variants)} вариантов")
            # Объединяем, избегая дубликатов
            existing_ids = {v.id for v in variants}
            for v in regex_variants:
                if v.id not in existing_ids:
                    variants.append(v)
                    existing_ids.add(v.id)
        
        # Объединяем спектры генов
        if regex_gene_panel:
            for gene in regex_gene_panel:
                if gene not in gene_panel:
                    gene_panel.append(gene)
            metadata['gene_panel'] = gene_panel
        
        metadata['total_variants_parsed'] = len(variants)
        metadata['gene_panel_size'] = len(gene_panel)
        metadata['extraction_notes'] = f"Извлечено {len(variants)} вариантов из текста PDF (ИИ: {len([v for v in variants if v.info.get('source', '').startswith('AI')])}, Regex: {len([v for v in variants if v.info.get('source') == 'PDF_text'])})"
        
        return metadata, variants
    
    def _extract_variants_with_ai(self, text: str) -> Dict[str, Any]:
        """Извлечение генетических вариантов с помощью ИИ"""
        variants = []
        gene_panel = []
        technical_info = {}
        
        try:
            from claude_assistant import OpenRouterAssistant
            assistant = OpenRouterAssistant()
        except ImportError:
            print("⚠️ Claude Assistant недоступен для ИИ-извлечения")
            return {'variants': variants, 'gene_panel': gene_panel, 'technical_info': technical_info}
        
        # Проверяем, что текст не пустой
        if not text or len(text.strip()) < 50:
            print("⚠️ Текст слишком короткий для анализа")
            return {'variants': variants, 'gene_panel': gene_panel, 'technical_info': technical_info}
        
        print(f"📄 Начинаю анализ текста: {len(text)} символов")
        
        # Для больших файлов разбиваем на части (уменьшаем размер чанка для лучшей обработки)
        max_chunk_size = 30000  # Уменьшенный размер чанка для более точного извлечения
        chunks = []
        
        if len(text) > max_chunk_size:
            # Умное разбиение: сначала по страницам, затем по абзацам
            # Ищем маркеры страниц
            page_markers = re.finditer(r'---\s*Страница\s+\d+/\d+\s*---|Page\s+\d+|страница\s+\d+', text, re.IGNORECASE)
            page_positions = [m.start() for m in page_markers]
            
            if len(page_positions) > 1:
                # Разбиваем по страницам
                for i in range(len(page_positions)):
                    start_pos = page_positions[i]
                    end_pos = page_positions[i + 1] if i + 1 < len(page_positions) else len(text)
                    page_text = text[start_pos:end_pos]
                    
                    if len(page_text) > max_chunk_size:
                        # Если страница большая, разбиваем на абзацы
                        paragraphs = page_text.split('\n\n')
                        current_chunk = ""
                        for para in paragraphs:
                            if len(current_chunk) + len(para) < max_chunk_size:
                                current_chunk += para + "\n\n"
                            else:
                                if current_chunk:
                                    chunks.append(current_chunk.strip())
                                current_chunk = para + "\n\n"
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                    else:
                        if page_text.strip():
                            chunks.append(page_text.strip())
            else:
                # Если нет маркеров страниц, разбиваем по абзацам
                paragraphs = text.split('\n\n')
                current_chunk = ""
                
                for para in paragraphs:
                    if len(current_chunk) + len(para) < max_chunk_size:
                        current_chunk += para + "\n\n"
                    else:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = para + "\n\n"
                
                if current_chunk:
                    chunks.append(current_chunk.strip())
            
            print(f"📄 Текст разбит на {len(chunks)} частей для ИИ-анализа (размер чанка: ~{max_chunk_size} символов)")
        else:
            chunks = [text]
        
        # Обрабатываем каждый чанк
        chunk_variants = []
        total_text_analyzed = 0
        for chunk_num, chunk in enumerate(chunks, 1):
            if len(chunks) > 1:
                print(f"🔍 Обработка части {chunk_num}/{len(chunks)} ({len(chunk)} символов)...")
            else:
                print(f"🔍 Обработка полного текста ({len(chunk)} символов)...")
            
            total_text_analyzed += len(chunk)
            
            prompt = f"""Ты — эксперт в области медицинской генетики и персонализированной медицины, специализируешься на консультировании врачей, генетиков и научных сотрудников. Твоя задача — давать профессиональные, научно обоснованные и актуальные ответы по вопросам генетики, интерпретации генетических тестов, наследственных заболеваний, молекулярной диагностики, генетического консультирования, новым методам секвенирования, биоинформатике, клиническим рекомендациям. Учитывай достижения в области генной терапии, редактирования генома (CRISPR), эпигенетики, интерпретации биомаркеров, а также актуальные научные исследования, рекомендации международных организаций (ACMG, ESHG, EASL) и данные о клинических протоколах. Ссылайся на ведущие платформы и онлайн-ресурсы (gnomAD, DECIPHER, GeneReviews, ClinVar, dbSNP), публикации в PubMed и последние конференции. Исключай галлюцинации, всегда указывай степень достоверности.

ВАЖНО: В предоставленном генетическом отчете содержится информация о проанализированных генах, полиморфизмах, генотипах и их клинической значимости. Это {'часть ' + str(chunk_num) + ' из ' + str(len(chunks)) + ' большого отчета' if len(chunks) > 1 else 'полный отчет'}.

ТВОЯ ЗАДАЧА:
1. Внимательно проанализировать ВСЕ упомянутые в отчете гены, полиморфизмы и генотипы
2. Выявить все генетические варианты и их клиническую значимость
3. Определить риски и предрасположенности на основе найденных генетических маркеров
4. Извлечь ВСЕ данные для последующего формирования клинических рекомендаций

КРИТИЧЕСКИ ВАЖНО: Проанализируй предоставленный генетический отчет ПОЛНОСТЬЮ и ДЕТАЛЬНО. В отчете содержится информация о множестве генов, полиморфизмов и генотипов. Ты должен:

1. ИЗВЛЕЧЬ И ПЕРЕЧИСЛИТЬ все найденные гены (например: ESR1, ESR2, CYP17A1, CYP19A1, COMT, MTHFR, F5, F2, TNFa, FSHR, LHCGR, GNRH1, AMH, AMHR2, PGR, AR, SRD5A2, SHBG, BRCA1, BRCA2, TP53, APC, MLH1, MSH2, MSH6, PMS2, CFTR, FMR1, HTT, DMD и т.д.)

2. ДЛЯ КАЖДОГО ГЕНА указать:
   - Найденные полиморфизмы (rs-номера) - НЕ ПРОПУСКАЙ НИ ОДИН rsID!
   - Генотип пациента (AA, AG, GG, 0/0, 0/1, 1/1, гомозигота, гетерозигота)
   - Клиническую значимость
   - Выявленные риски и предрасположенности
   - Позиции (хромосомные, cDNA, белковые)
   - Покрытие и качество секвенирования
   - Аннотации из ClinVar, gnomAD, dbSNP
   - Классификацию ACMG

3. ИЗВЛЕЧЬ ВСЕ SNP/ИНДЕЛИ с точными позициями:
   - ВСЕ rsID (rs1801133, rs699, rs7412 и т.д.) - если видишь rsID = извлекай!
   - ВСЕ хромосомные позиции (chr1:11856378, 1:11856378, chr1:11856378 G>A)
   - ВСЕ cDNA позиции (c.677C>T, c.665C>T)
   - ВСЕ белковые позиции (p.Ala222Val, p.Arg399Gln)
   - ВСЕ транскрипты (NM_000518.4:c.677C>T)

4. ИЗВЛЕЧЬ ТЕХНИЧЕСКУЮ ИНФОРМАЦИЮ:
   - Метод анализа (WES, WGS, targeted panel, NGS, Sanger)
   - Название лаборатории
   - Аккредитация (CAP, CLIA, ISO 15189)
   - Версия референсного генома (GRCh37, GRCh38, hg19, hg38)
   - Биоинформатический пайплайн (GATK, VarScan, FreeBayes и т.д.)
   - Подпись медицинского генетика/врача

5. ИЗВЛЕЧЬ ДАННЫЕ ИЗ ВСЕХ ТАБЛИЦ:
   - Таблицы с генотипами
   - Таблицы с вариантами
   - Таблицы с аннотациями
   - Любые структурированные данные

НЕ ПРОПУСКАЙ НИ ОДИН ГЕН из отчета! Проанализируй ВСЕ упомянутые генетические маркеры. Даже если данные кажутся неполными, извлекай то, что есть - позже данные из всех частей будут объединены.

Текст отчета{' (часть ' + str(chunk_num) + ' из ' + str(len(chunks)) + ')' if len(chunks) > 1 else ''}:
{chunk}

КРИТИЧЕСКИ ВАЖНО: Извлеки ВСЕ данные, включая:

1. ВСЕ SNP/ИНДЕЛИ с точными позициями:
   - rsID (rs1801133, rs699, rs7412 и т.д.)
   - Хромосомные позиции (chr1:11856378, 1:11856378, chr1:11856378 G>A)
   - cDNA позиции (c.677C>T, c.665C>T)
   - Белковые позиции (p.Ala222Val, p.Arg399Gln)
   - NM_ транскрипты (NM_000518.4:c.677C>T)

2. ГЕНОТИПЫ (обязательно для каждого варианта):
   - AA, AG, GG, CC, CT, TT (диплоидные)
   - 0/0, 0/1, 1/1 (VCF формат или цифровой формат)
   - гомозигота, гетерозигота, гемизигота
   - WT/WT, WT/MUT, MUT/MUT

3. ТЕХНИЧЕСКИЕ ДАННЫЕ:
   - Покрытие (coverage, depth, Xx, например: 50x, 100x)
   - Качество секвенирования (quality score, Q-score, Phred score)
   - VAF (variant allele frequency, частота аллеля варианта)
   - Read count (количество прочтений)

4. АННОТАЦИИ ИЗ БАЗ ДАННЫХ:
   - ClinVar (клиническая значимость из ClinVar)
   - gnomAD (частота в популяции, AF, allele frequency)
   - dbSNP (rsID, если не указан явно)
   - ExAC, 1000 Genomes (частоты)
   - SIFT, PolyPhen (предсказания патогенности)

5. КЛАССИФИКАЦИЯ ПО ACMG:
   - Pathogenic / Патогенный
   - Likely Pathogenic / Вероятно патогенный
   - Uncertain Significance (VUS) / Неопределенной значимости
   - Likely Benign / Вероятно доброкачественный
   - Benign / Доброкачественный

6. ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ ОБ ОТЧЕТЕ:
   - Метод анализа (WES, WGS, targeted panel, NGS, Sanger)
   - Название лаборатории
   - Аккредитация (CAP, CLIA, ISO 15189)
   - Версия референсного генома (GRCh37, GRCh38, hg19, hg38)
   - Биоинформатический пайплайн (GATK, VarScan, FreeBayes и т.д.)
   - Подпись медицинского генетика / врача

7. СПЕКТР ГЕНОВ (все гены из панели анализа)

Извлеки ВСЕ данные в следующем JSON формате:
{{
    "technical_info": {{
        "method": "метод анализа (WES/WGS/targeted panel/NGS)",
        "laboratory": "название лаборатории",
        "accreditation": "аккредитация (CAP/CLIA/ISO 15189)",
        "reference_genome": "версия генома (GRCh37/GRCh38/hg19/hg38)",
        "pipeline": "биоинформатический пайплайн",
        "geneticist_signature": "подпись медицинского генетика/врача"
    }},
    "gene_panel": ["список всех генов из спектра анализа"],
    "variants": [
        {{
            "variant_id": "rs1801133 или chr1:11856378 G>A или c.677C>T или p.Ala222Val",
            "rsid": "rsID если указан (rs1801133, rs699 и т.д.)",
            "gene": "название гена",
            "chromosome": "номер хромосомы (1, 2, X, Y, M)",
            "position": "позиция в геноме (точное число, например: 11856378)",
            "ref_allele": "референсный аллель (A, G, C, T)",
            "alt_allele": "альтернативный аллель (A, G, C, T)",
            "c_dna": "cDNA позиция (c.677C>T)",
            "protein": "белковая позиция (p.Ala222Val)",
            "transcript": "транскрипт (NM_000518.4)",
            "genotype": "генотип (AA, AG, GG, 0/0, 0/1, 1/1, WT/WT, WT/MUT, MUT/MUT)",
            "zygosity": "гомозигота/гетерозигота/гемизигота",
            "coverage": "покрытие (число, например: 50, 100, 200x)",
            "quality_score": "качество (Phred score, Q-score)",
            "vaf": "частота аллеля варианта (VAF, например: 0.5, 50%)",
            "read_count": "количество прочтений",
            "pathogenicity": "pathogenic/likely_pathogenic/uncertain_significance/likely_benign/benign",
            "acmg_classification": "классификация по ACMG",
            "clinvar": "данные из ClinVar (клиническая значимость, ID)",
            "gnomad_af": "частота в gnomAD (allele frequency)",
            "gnomad_data": "дополнительные данные gnomAD",
            "dbsnp": "rsID из dbSNP если не указан явно",
            "sift": "предсказание SIFT",
            "polyphen": "предсказание PolyPhen",
            "disease": "связанное заболевание",
            "clinical_significance": "клиническая значимость",
            "frequency": "частота в популяции",
            "context": "контекст из текста где найден вариант"
        }}
    ],
    "genotypes_table": [
        {{
            "gene": "название гена",
            "variant": "вариант (rsID или позиция)",
            "genotype": "генотип",
            "zygosity": "гомозигота/гетерозигота",
            "interpretation": "интерпретация"
        }}
    ]
}}

КРИТИЧЕСКИ ВАЖНО:
- ОБЯЗАТЕЛЬНО извлекай ВСЕ SNP/индели с точными позициями! Не пропускай ни одного rsID!
- ОБЯЗАТЕЛЬНО извлекай генотипы для каждого варианта!
- ОБЯЗАТЕЛЬНО извлекай покрытие и качество, если они указаны!
- ОБЯЗАТЕЛЬНО извлекай аннотации из ClinVar, gnomAD, dbSNP, если они указаны!
- ОБЯЗАТЕЛЬНО извлекай классификацию ACMG, если она указана!
- ОБЯЗАТЕЛЬНО извлекай техническую информацию (метод, лаборатория, версия генома, пайплайн, подпись)!
- Извлекай данные из ВСЕХ таблиц в отчете!
- Если позиция не указана явно, попробуй найти её по rsID или другим данным!
- Если генотип не указан явно, попробуй определить из контекста!
- НЕ ПРОПУСКАЙ варианты! Если видишь rsID или позицию = извлекай!

Ответь ТОЛЬКО валидным JSON без дополнительного текста!"""

            try:
                response = assistant.get_response(prompt)
                
                # Парсим JSON из ответа
                import json
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    
                    # Сохраняем техническую информацию (только из первого чанка)
                    if chunk_num == 1:
                        chunk_tech_info = data.get('technical_info', {})
                        if chunk_tech_info:
                            technical_info.update(chunk_tech_info)
                    
                    # Сохраняем спектр генов в metadata (будет использовано позже)
                    chunk_gene_panel = data.get('gene_panel', [])
                    if chunk_gene_panel:
                        print(f"📋 Найден спектр генов: {len(chunk_gene_panel)} генов")
                        gene_panel.extend([g for g in chunk_gene_panel if g and g not in gene_panel])
                    
                    # Обрабатываем варианты
                    for var_data in data.get('variants', []):
                        # Приоритет rsID для variant_id
                        rsid = var_data.get('rsid', '')
                        variant_id = rsid if rsid else var_data.get('variant_id', 'unknown')
                        if not variant_id or variant_id == 'unknown':
                            # Пробуем извлечь из variant_id
                            rsid_match = re.search(r'rs\d+', str(var_data.get('variant_id', '')))
                            if rsid_match:
                                variant_id = rsid_match.group()
                                rsid = variant_id
                        
                        gene = var_data.get('gene', 'Unknown')
                        chromosome = var_data.get('chromosome', 'Unknown')
                        position = int(var_data.get('position', 0)) if str(var_data.get('position', 0)).isdigit() else 0
                        ref = var_data.get('ref_allele', 'N')
                        alt = var_data.get('alt_allele', 'N')
                        genotype = var_data.get('genotype', '')
                        path_str = var_data.get('pathogenicity', 'uncertain_significance').lower()
                        
                        # Извлекаем дополнительные данные
                        c_dna = var_data.get('c_dna', '')
                        protein = var_data.get('protein', '')
                        transcript = var_data.get('transcript', '')
                        coverage = var_data.get('coverage', '')
                        quality_score = var_data.get('quality_score', '')
                        vaf = var_data.get('vaf', '')
                        read_count = var_data.get('read_count', '')
                        acmg_classification = var_data.get('acmg_classification', '')
                        clinvar = var_data.get('clinvar', '')
                        gnomad_af = var_data.get('gnomad_af', '')
                        gnomad_data = var_data.get('gnomad_data', '')
                        dbsnp = var_data.get('dbsnp', '')
                        sift = var_data.get('sift', '')
                        polyphen = var_data.get('polyphen', '')
                        
                        # Определяем зиготность из генотипа
                        zygosity = var_data.get('zygosity', '')
                        if not zygosity and genotype:
                            genotype_upper = genotype.upper()
                            if genotype_upper in ['AA', 'GG', 'CC', 'TT', '0/0', '1/1', 'WT/WT', 'MUT/MUT'] or 'гомозигот' in genotype.lower():
                                zygosity = 'гомозигота'
                            elif genotype_upper in ['AG', 'AC', 'AT', 'GC', 'GT', 'CT', '0/1', '1/0', 'WT/MUT', 'MUT/WT'] or 'гетерозигот' in genotype.lower():
                                zygosity = 'гетерозигота'
                        
                        # Определяем патогенность - расширенная проверка
                        pathogenicity = VariantPathogenicity.UNCERTAIN_SIGNIFICANCE
                        path_str_lower = path_str.lower()
                        context_lower = var_data.get('context', '').lower()
                        disease_lower = var_data.get('disease', '').lower()
                        clinical_sig = var_data.get('clinical_significance', '').lower()
                        acmg_lower = acmg_classification.lower() if acmg_classification else ''
                        
                        # Проверяем все источники патогенности
                        all_text = f"{path_str_lower} {context_lower} {disease_lower} {clinical_sig}"
                        
                        # Патогенные индикаторы
                        if any(ind in all_text for ind in ['pathogenic', 'патогенный', 'disease-causing', 'мутация', 'causative', 'deleterious']):
                            if 'likely' not in all_text and 'вероятно' not in all_text:
                                pathogenicity = VariantPathogenicity.PATHOGENIC
                            else:
                                pathogenicity = VariantPathogenicity.LIKELY_PATHOGENIC
                        # Если есть заболевание = патогенный
                        elif disease_lower and disease_lower != 'unknown' and disease_lower != '':
                            pathogenicity = VariantPathogenicity.PATHOGENIC
                        # Если есть клиническая значимость с риском
                        elif any(ind in clinical_sig for ind in ['риск', 'risk', 'высокий', 'high', 'повышенный']):
                            pathogenicity = VariantPathogenicity.PATHOGENIC
                        elif 'likely_pathogenic' in path_str_lower or 'likely pathogenic' in path_str_lower:
                            pathogenicity = VariantPathogenicity.LIKELY_PATHOGENIC
                        elif 'benign' in path_str_lower and 'likely' not in path_str_lower:
                            pathogenicity = VariantPathogenicity.BENIGN
                        elif 'likely_benign' in path_str_lower or 'likely benign' in path_str_lower:
                            pathogenicity = VariantPathogenicity.LIKELY_BENIGN
                        
                        # Определяем качество из quality_score
                        quality = 0.0
                        if quality_score:
                            try:
                                quality = self._safe_float(quality_score)
                            except:
                                pass
                        
                        variant = VCFVariant(
                            chromosome=str(chromosome),
                            position=position,
                            id=variant_id,
                            ref=ref,
                            alt=alt,
                            quality=quality,
                            filter="PASS",
                            info={
                                'gene': gene,
                                'rsid': rsid if rsid else dbsnp,
                                'c_dna': c_dna,
                                'protein': protein,
                                'transcript': transcript,
                                'genotype': genotype,
                                'zygosity': zygosity,
                                'pathogenicity': pathogenicity.value,
                                'acmg_classification': acmg_classification,
                                'source': 'AI',
                                'disease': var_data.get('disease', ''),
                                'clinical_significance': var_data.get('clinical_significance', ''),
                                'frequency': var_data.get('frequency', ''),
                                'allele_frequency': var_data.get('allele_frequency', '') or gnomad_af,
                                'coverage': coverage,
                                'quality_score': quality_score,
                                'vaf': vaf,
                                'read_count': read_count,
                                'clinvar': clinvar,
                                'gnomad_af': gnomad_af,
                                'gnomad_data': gnomad_data,
                                'sift': sift,
                                'polyphen': polyphen,
                                'context': var_data.get('context', '')[:500]
                            },
                            format="GT",
                            samples={'sample': {'GT': genotype}} if genotype else {}
                        )
                        chunk_variants.append(variant)
                    
                    # Обрабатываем таблицы с генотипами
                    for gt_data in data.get('genotypes_table', []):
                        gene = gt_data.get('gene', 'Unknown')
                        variant_id = gt_data.get('variant', '')
                        genotype = gt_data.get('genotype', '')
                        zygosity = gt_data.get('zygosity', '')
                        
                        if variant_id or gene != 'Unknown':
                            # Создаем вариант из таблицы генотипов
                            variant = VCFVariant(
                                chromosome="Unknown",
                                position=0,
                                id=variant_id or f"{gene}_genotype",
                                ref="N",
                                alt="N",
                                quality=0.0,
                                filter="PASS",
                                info={
                                    'gene': gene,
                                    'genotype': genotype,
                                    'zygosity': zygosity,
                                    'pathogenicity': 'uncertain_significance',
                                    'source': 'AI_genotypes_table',
                                    'interpretation': gt_data.get('interpretation', ''),
                                    'context': f"Из таблицы генотипов: {gene}"
                                },
                                format="GT",
                                samples={'sample': {'GT': genotype}} if genotype else {}
                            )
                            chunk_variants.append(variant)
                    
                    # Сохраняем спектр генов для использования в metadata
                    if gene_panel:
                        # Добавляем гены из спектра как варианты, если они не были найдены в вариантах
                        found_genes = {v.info.get('gene', '') for v in chunk_variants}
                        for gene in gene_panel:
                            if gene and gene not in found_genes:
                                variant = VCFVariant(
                                    chromosome="Unknown",
                                    position=0,
                                    id=f"{gene}_panel",
                                    ref="N",
                                    alt="N",
                                    quality=0.0,
                                    filter="PASS",
                                    info={
                                        'gene': gene,
                                        'source': 'AI_gene_panel',
                                        'pathogenicity': 'uncertain_significance',
                                        'context': f"Ген из спектра анализа"
                                    },
                                    format="GT",
                                    samples={}
                                )
                                chunk_variants.append(variant)
                
            except Exception as e:
                print(f"⚠️ Ошибка ИИ-извлечения для части {chunk_num}: {e}")
                continue
        
        # Умное объединение вариантов из всех чанков, избегая дубликатов
        # Используем несколько ключей для дедупликации
        seen_variants = {}  # Ключ: (rsid или id, gene, position) -> вариант
        all_gene_panel = set(gene_panel)  # Начинаем с уже собранных генов
        
        for variant in chunk_variants:
            # Создаем уникальный ключ для дедупликации
            rsid = variant.info.get('rsid', '') or variant.id if variant.id.startswith('rs') else ''
            gene = variant.info.get('gene', 'Unknown')
            position = variant.position if variant.position > 0 else 0
            c_dna = variant.info.get('c_dna', '')
            protein = variant.info.get('protein', '')
            
            # Приоритет ключей: rsID > (gene + position) > (gene + c_dna) > (gene + protein) > id
            if rsid:
                key = (rsid, gene, 'rsid')
            elif position > 0 and gene != 'Unknown':
                key = (gene, position, 'position')
            elif c_dna and gene != 'Unknown':
                key = (gene, c_dna, 'c_dna')
            elif protein and gene != 'Unknown':
                key = (gene, protein, 'protein')
            else:
                key = (variant.id, gene, 'id')
            
            # Если вариант уже есть, объединяем информацию (приоритет более полным данным)
            if key in seen_variants:
                existing = seen_variants[key]
                # Объединяем info поля, приоритет более полным данным
                for info_key in ['genotype', 'zygosity', 'coverage', 'quality_score', 'vaf', 
                                'clinvar', 'gnomad_af', 'acmg_classification', 'c_dna', 'protein', 
                                'transcript', 'rsid']:
                    existing_val = existing.info.get(info_key, '')
                    new_val = variant.info.get(info_key, '')
                    if not existing_val and new_val:
                        existing.info[info_key] = new_val
                    elif existing_val and new_val and len(str(new_val)) > len(str(existing_val)):
                        # Если новое значение более полное, заменяем
                        existing.info[info_key] = new_val
                
                # Обновляем качество, если новое лучше
                if variant.quality > existing.quality:
                    existing.quality = variant.quality
            else:
                seen_variants[key] = variant
                variants.append(variant)
            
            # Собираем гены из спектра
            if gene and gene != 'Unknown':
                all_gene_panel.add(gene)
        
        print(f"✅ Объединено {len(variants)} уникальных вариантов из {len(chunk_variants)} найденных")
        print(f"📊 Проанализировано {total_text_analyzed} символов текста из {len(chunks)} частей")
        
        return {
            'variants': variants,
            'gene_panel': list(all_gene_panel),
            'technical_info': technical_info
        }
    
    def _extract_variants_with_regex(self, text: str) -> Dict[str, Any]:
        """Извлечение генетических вариантов с помощью регулярных выражений"""
        variants = []
        gene_panel = set()
        
        # Паттерны для поиска генотипов
        genotype_patterns = [
            re.compile(r'генотип[:\s]+([A-Z]{2}|[AGCT]{2}|[0-9]/[0-9]|гомозигот|гетерозигот)', re.IGNORECASE),
            re.compile(r'genotype[:\s]+([A-Z]{2}|[AGCT]{2}|[0-9]/[0-9])', re.IGNORECASE),
            re.compile(r'\b([AGCT]{2}|[0-9]/[0-9])\b', re.IGNORECASE),  # AA, AG, GG, 0/0, 0/1, 1/1
        ]
        
        # Паттерны для поиска спектра генов
        gene_panel_patterns = [
            re.compile(r'спектр генов[:\s]+(.+?)(?:\n|$)', re.IGNORECASE),
            re.compile(r'gene panel[:\s]+(.+?)(?:\n|$)', re.IGNORECASE),
            re.compile(r'анализированы гены[:\s]+(.+?)(?:\n|$)', re.IGNORECASE),
            re.compile(r'analyzed genes[:\s]+(.+?)(?:\n|$)', re.IGNORECASE),
        ]
        
        # Улучшенные паттерны для поиска генетических вариантов
        variant_patterns = [
            # rsID формат (rs1801133, rs699, rs7412 и т.д.)
            re.compile(r'\brs\d+\b', re.IGNORECASE),
            # Хромосома:позиция формат (chr1:11856378, 1:11856378, chr1:11856378 G>A)
            re.compile(r'chr?(\d+|X|Y|M)[:\s]+(\d+)(?:\s+([ATCGN]+)[\s]*[>\/\-][\s]*([ATCGN]+))?', re.IGNORECASE),
            # c. формат (cDNA позиция) - c.677C>T, c.665C>T
            re.compile(r'c\.(\d+)([+-]?\d*)([ATCG]+)[>\/\-]([ATCG]+)', re.IGNORECASE),
            # p. формат (белковая позиция) - p.Ala222Val, p.Arg399Gln
            re.compile(r'p\.([A-Z][a-z]{2})(\d+)([A-Z][a-z]{2}|Ter|X|\*|fs|del|ins)', re.IGNORECASE),
            # NM_ формат (транскрипт) - NM_000518.4:c.677C>T
            re.compile(r'NM_\d+\.\d+[:\s]+c\.(\d+)([+-]?\d*)([ATCG]+)[>\/\-]([ATCG]+)', re.IGNORECASE),
            # Индели - ins, del, dup
            re.compile(r'([ATCG]+)\s*(ins|del|dup)\s*([ATCG]+)?', re.IGNORECASE),
        ]
        
        # Паттерны для поиска покрытия и качества
        coverage_patterns = [
            re.compile(r'coverage[:\s]+(\d+)[xX]?', re.IGNORECASE),
            re.compile(r'depth[:\s]+(\d+)[xX]?', re.IGNORECASE),
            re.compile(r'(\d+)[xX]\s*(?:coverage|depth)', re.IGNORECASE),
            re.compile(r'покрытие[:\s]+(\d+)', re.IGNORECASE),
        ]
        
        quality_patterns = [
            re.compile(r'quality[:\s]+(\d+(?:\.\d+)?)', re.IGNORECASE),
            re.compile(r'Q[-\s]?score[:\s]+(\d+(?:\.\d+)?)', re.IGNORECASE),
            re.compile(r'Phred[:\s]+(\d+(?:\.\d+)?)', re.IGNORECASE),
            re.compile(r'качество[:\s]+(\d+(?:\.\d+)?)', re.IGNORECASE),
        ]
        
        # Паттерны для поиска VAF (variant allele frequency)
        vaf_patterns = [
            re.compile(r'VAF[:\s]+([\d.]+(?:%|))', re.IGNORECASE),
            re.compile(r'variant\s+allele\s+frequency[:\s]+([\d.]+(?:%|))', re.IGNORECASE),
            re.compile(r'частота\s+аллеля[:\s]+([\d.]+(?:%|))', re.IGNORECASE),
        ]
        
        # Паттерны для поиска аннотаций
        clinvar_patterns = [
            re.compile(r'ClinVar[:\s]+([^,\n]+)', re.IGNORECASE),
            re.compile(r'ClinVar\s+ID[:\s]+(\d+)', re.IGNORECASE),
        ]
        
        gnomad_patterns = [
            re.compile(r'gnomAD[:\s]+AF[:\s]+([\d.e-]+)', re.IGNORECASE),
            re.compile(r'gnomAD[:\s]+([\d.e-]+)', re.IGNORECASE),
            re.compile(r'allele\s+frequency[:\s]+([\d.e-]+)', re.IGNORECASE),
        ]
        
        # Паттерны для поиска технической информации
        method_patterns = [
            re.compile(r'метод[:\s]+(WES|WGS|targeted\s+panel|NGS|Sanger|секвенирование)', re.IGNORECASE),
            re.compile(r'method[:\s]+(WES|WGS|targeted\s+panel|NGS|Sanger)', re.IGNORECASE),
            re.compile(r'(WES|WGS|targeted\s+panel|NGS|Sanger)', re.IGNORECASE),
        ]
        
        genome_version_patterns = [
            re.compile(r'(GRCh37|GRCh38|hg19|hg38)', re.IGNORECASE),
            re.compile(r'reference\s+genome[:\s]+(GRCh37|GRCh38|hg19|hg38)', re.IGNORECASE),
            re.compile(r'референсный\s+геном[:\s]+(GRCh37|GRCh38|hg19|hg38)', re.IGNORECASE),
        ]
        
        pipeline_patterns = [
            re.compile(r'pipeline[:\s]+([^,\n]+)', re.IGNORECASE),
            re.compile(r'пайплайн[:\s]+([^,\n]+)', re.IGNORECASE),
            re.compile(r'(GATK|VarScan|FreeBayes|Strelka|MuTect)', re.IGNORECASE),
        ]
        
        laboratory_patterns = [
            re.compile(r'лаборатория[:\s]+([^,\n]+)', re.IGNORECASE),
            re.compile(r'laboratory[:\s]+([^,\n]+)', re.IGNORECASE),
            re.compile(r'lab[:\s]+([^,\n]+)', re.IGNORECASE),
        ]
        
        accreditation_patterns = [
            re.compile(r'(CAP|CLIA|ISO\s+15189)', re.IGNORECASE),
            re.compile(r'аккредитация[:\s]+([^,\n]+)', re.IGNORECASE),
        ]
        
        # Улучшенный поиск генов (известные гены)
        known_genes = ['BRCA1', 'BRCA2', 'TP53', 'APC', 'MLH1', 'MSH2', 'MSH6', 'PMS2', 
                      'CFTR', 'FMR1', 'HTT', 'DMD', 'COL1A1', 'COL1A2', 'FBN1', 'MYH7',
                      'MYBPC3', 'KCNQ1', 'KCNH2', 'SCN5A', 'LMNA', 'PKP2', 'DSP']
        gene_pattern = re.compile(r'\b(' + '|'.join(known_genes) + r')\b', re.IGNORECASE)
        general_gene_pattern = re.compile(r'\b([A-Z]{2,10})\b', re.IGNORECASE)
        
        # Расширенный поиск патогенности - больше ключевых слов
        pathogenicity_keywords = {
            'pathogenic': [
                'pathogenic', 'патогенный', 'disease-causing', 'мутация', 'мутация патогенная',
                'pathogenic variant', 'патогенный вариант', 'disease causing', 'causative',
                'мутация патогенна', 'патогенная мутация', 'вызывает заболевание', 'причина заболевания',
                'deleterious', 'вредный', 'вредная мутация', 'клинически значимый', 'клинически значимая',
                'клинически значим', 'клиническое значение', 'высокий риск', 'повышенный риск',
                'наследственное заболевание', 'генетическое заболевание', 'мутация в гене',
                'мутантный', 'мутантная', 'мутантный аллель', 'патологический', 'патологическая',
                'патологический вариант', 'выявлена мутация', 'обнаружена мутация', 'найдена мутация'
            ],
            'likely_pathogenic': [
                'likely pathogenic', 'вероятно патогенный', 'likely disease-causing',
                'probably pathogenic', 'вероятно патогенна', 'вероятно патогенная',
                'предположительно патогенный', 'предположительно патогенная',
                'возможно патогенный', 'возможно патогенная', 'likely deleterious'
            ],
            'uncertain_significance': [
                'uncertain significance', 'неопределенной значимости', 'VUS', 'вариант неопределенной значимости',
                'uncertain', 'неопределенный', 'неопределенная', 'неясная значимость',
                'неясное значение', 'требует уточнения', 'требует дополнительного анализа'
            ],
            'likely_benign': [
                'likely benign', 'вероятно доброкачественный', 'likely polymorphism',
                'probably benign', 'вероятно доброкачественна', 'вероятно доброкачественная'
            ],
            'benign': [
                'benign', 'доброкачественный', 'polymorphism', 'полиморфизм',
                'доброкачественна', 'доброкачественная', 'нормальный вариант',
                'нормальная', 'нормальный', 'без клинического значения'
            ]
        }
        
        lines = text.split('\n')
        found_variants = set()
        
        # Поиск спектра генов
        for pattern in gene_panel_patterns:
            matches = pattern.finditer(text)
            for match in matches:
                genes_text = match.group(1)
                # Извлекаем гены из текста
                for gene_match in general_gene_pattern.finditer(genes_text):
                    gene = gene_match.group(1)
                    if gene and len(gene) >= 2:
                        gene_panel.add(gene.upper())
        
        for line_num, line in enumerate(lines, 1):
            line_upper = line.upper()
            
            # Поиск генотипов в строке
            genotype = ""
            zygosity = ""
            for gt_pattern in genotype_patterns:
                gt_match = gt_pattern.search(line)
                if gt_match:
                    genotype = gt_match.group(1)
                    if 'гомозигот' in line.lower():
                        zygosity = 'гомозигота'
                    elif 'гетерозигот' in line.lower():
                        zygosity = 'гетерозигота'
                    break
            
            # Поиск патологических вариантов по упоминанию гена + заболевания
            # Паттерн: ГЕН + заболевание/риск/мутация
            disease_keywords = ['заболевание', 'disease', 'рак', 'cancer', 'синдром', 'syndrome',
                              'риск', 'risk', 'мутация', 'mutation', 'патогенный', 'pathogenic',
                              'выявлена', 'обнаружена', 'найдена', 'высокий риск', 'повышенный риск']
            
            # Если в строке есть ген + заболевание = патогенный вариант
            gene_match = gene_pattern.search(line) or general_gene_pattern.search(line)
            if gene_match:
                gene = gene_match.group(1)
                if any(disease_kw in line_upper for disease_kw in disease_keywords):
                    # Это патогенный вариант
                    variant_id = f"{gene}_pathogenic_{line_num}"
                    if variant_id not in found_variants:
                        found_variants.add(variant_id)
                        variant = VCFVariant(
                            chromosome="Unknown",
                            position=0,
                            id=variant_id,
                            ref="N",
                            alt="N",
                            quality=0.0,
                            filter="PASS",
                            info={
                                'gene': gene,
                                'pathogenicity': 'pathogenic',
                                'source': 'PDF_text_disease_association',
                                'line_number': line_num,
                                'context': line[:500],
                                'disease_mentioned': True
                            },
                            format="GT",
                            samples={}
                        )
                        variants.append(variant)
                        gene_panel.add(gene.upper())
            
            # Поиск вариантов
            for pattern in variant_patterns:
                matches = pattern.finditer(line)
                for match in matches:
                    variant_id = match.group(0)
                    if variant_id not in found_variants:
                        found_variants.add(variant_id)
                        
                        # Определение патогенности - расширенный поиск
                        pathogenicity = VariantPathogenicity.UNCERTAIN_SIGNIFICANCE
                        
                        # Проверяем всю строку и контекст вокруг
                        context_line = line
                        if line_num > 1:
                            context_line += " " + lines[line_num-2] if line_num > 1 else ""
                        if line_num < len(lines):
                            context_line += " " + lines[line_num] if line_num < len(lines) else ""
                        context_upper = context_line.upper()
                        
                        # Приоритет: патогенный > вероятно патогенный > неопределенный > доброкачественный
                        for path_type, keywords in pathogenicity_keywords.items():
                            if any(kw in context_upper for kw in keywords):
                                pathogenicity = VariantPathogenicity[path_type.upper()]
                                break
                        
                        # Если есть упоминание заболевания рядом с вариантом = патогенный
                        if any(disease_kw in context_upper for disease_kw in disease_keywords):
                            if pathogenicity == VariantPathogenicity.UNCERTAIN_SIGNIFICANCE:
                                pathogenicity = VariantPathogenicity.PATHOGENIC
                        
                        # Поиск гена (сначала известные, потом общий паттерн)
                        gene = "Unknown"
                        gene_match = gene_pattern.search(line)
                        if gene_match:
                            gene = gene_match.group(1)
                        else:
                            general_match = general_gene_pattern.search(line)
                            if general_match:
                                gene = general_match.group(1)
                        
                        # Извлечение хромосомы и позиции если возможно
                        chromosome = "Unknown"
                        position = 0
                        ref = "N"
                        alt = "N"
                        
                        if len(match.groups()) >= 2:
                            try:
                                chromosome = match.group(1) if match.group(1) else "Unknown"
                                position = int(match.group(2)) if match.group(2) else 0
                                if len(match.groups()) >= 4:
                                    ref = match.group(3) if match.group(3) else "N"
                                    alt = match.group(4) if match.group(4) else "N"
                            except:
                                pass
                        
                        # Добавляем генотип если найден
                        if genotype:
                            if not zygosity:
                                if genotype.upper() in ['AA', 'GG', 'CC', 'TT', '0/0', '1/1']:
                                    zygosity = 'гомозигота'
                                elif genotype.upper() in ['AG', 'AC', 'AT', 'GC', 'GT', 'CT', '0/1', '1/0']:
                                    zygosity = 'гетерозигота'
                        
                        # Добавляем ген в спектр
                        if gene and gene != "Unknown":
                            gene_panel.add(gene.upper())
                        
                        # Создание варианта
                        variant = VCFVariant(
                            chromosome=chromosome,
                            position=position,
                            id=variant_id,
                            ref=ref,
                            alt=alt,
                            quality=0.0,
                            filter="PASS",
                            info={
                                'gene': gene,
                                'genotype': genotype,
                                'zygosity': zygosity,
                                'pathogenicity': pathogenicity.value,
                                'source': 'PDF_text',
                                'line_number': line_num,
                                'context': line[:300]  # Увеличено до 300 символов
                            },
                            format="GT",
                            samples={'sample': {'GT': genotype}} if genotype else {}
                        )
                        variants.append(variant)
        
        return {
            'variants': variants,
            'gene_panel': list(gene_panel)
        }

class GeneticAnalyzer:
    """Основной анализатор генетических данных"""
    
    def __init__(self):
        self.database = GeneticDatabase()
        self.parser = VCFParser()
        self.pdf_parser = PDFGeneticParser()
        self.analysis_cache = {}
    
    def _safe_float(self, value: Any, default: float = 0.0) -> float:
        """Безопасное преобразование в float"""
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            value = value.strip().lower().replace(',', '.')
            if value in ['не указана', 'не указан', 'не указано', 'н/д', 'n/a', 'na', '', '.']:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        return default
    
    def _check_extraction_complete(self, extracted_text: str) -> bool:
        """Проверка, извлечены ли все гены и SNP из текста"""
        try:
            # Пытаемся найти JSON в тексте (несколько вариантов формата)
            import re
            
            # Вариант 1: JSON с "variants" и "gene_panel"
            json_match = re.search(r'\{.*?"variants".*?"gene_panel".*?\}', extracted_text, re.DOTALL)
            if json_match:
                try:
                    json_str = json_match.group(0)
                    data = json.loads(json_str)
                    variants = data.get('variants', [])
                    gene_panel = data.get('gene_panel', [])
                    
                    # Если есть варианты и гены, считаем извлечение полным
                    if variants and len(variants) > 0 and gene_panel and len(gene_panel) > 0:
                        print(f"✅ Найдено {len(variants)} вариантов и {len(gene_panel)} генов. Извлечение полное.")
                        return True
                except:
                    pass
            
            # Вариант 2: JSON с "extracted_variants" (формат из _analyze_pdf_with_ai)
            json_match2 = re.search(r'\{.*?"extracted_variants".*?\}', extracted_text, re.DOTALL)
            if json_match2:
                try:
                    json_str = json_match2.group(0)
                    data = json.loads(json_str)
                    extracted_variants = data.get('extracted_variants', [])
                    
                    # Проверяем наличие генов в вариантах
                    genes_found = set()
                    variants_found = 0
                    for var in extracted_variants:
                        if var.get('gene') and var.get('gene') != 'Unknown':
                            genes_found.add(var.get('gene'))
                        if var.get('variant'):
                            variants_found += 1
                    
                    if variants_found > 0 and len(genes_found) > 0:
                        print(f"✅ Найдено {variants_found} вариантов в {len(genes_found)} генах. Извлечение полное.")
                        return True
                except:
                    pass
            
            # Вариант 3: Проверяем наличие ключевых слов и структурированных данных
            keywords = ['rs', 'chr', 'gene', 'variant', 'snp', 'indel', 'genotype', 'brca', 'cyp', 'tpmt']
            found_keywords = sum(1 for kw in keywords if kw.lower() in extracted_text.lower())
            
            # Подсчитываем количество упоминаний rsID (SNP)
            rsid_matches = len(re.findall(r'rs\d+', extracted_text, re.IGNORECASE))
            
            # Подсчитываем количество упоминаний генов (BRCA1, CYP2D6 и т.д.)
            gene_matches = len(re.findall(r'\b[A-Z]{2,}[A-Z0-9]*\b', extracted_text))
            
            # Если найдено много ключевых слов, rsID и генов, считаем полным
            if found_keywords >= 5 and rsid_matches >= 3 and gene_matches >= 3:
                print(f"✅ Найдено {rsid_matches} rsID и {gene_matches} упоминаний генов. Извлечение полное.")
                return True
                
        except Exception as e:
            # Если не удалось распарсить, продолжаем анализ
            pass
        
        return False
    
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
            raise
    
    def _extract_variants_from_tables(self, tables: List[Dict]) -> List[VCFVariant]:
        """Извлечение вариантов из таблиц PDF (Этап 3) - улучшенная версия для русских PDF"""
        variants = []
        
        for table_data in tables:
            table = table_data.get('data', [])
            if not table or len(table) < 2:  # Нужен заголовок и хотя бы одна строка данных
                continue
            
            # Поиск колонок по заголовкам (поддержка русского и английского)
            headers = [str(cell).strip() if cell else "" for cell in table[0]]
            headers_lower = [h.lower() for h in headers]
            col_indices = {}
            
            # Логируем заголовки для отладки
            print(f"🔍 Заголовки таблицы: {headers}")
            
            # Ищем нужные колонки (русские и английские названия)
            for i, (header, header_lower) in enumerate(zip(headers, headers_lower)):
                # Хромосома
                if 'chrom' in header_lower or 'chr' in header_lower or 'хромосом' in header_lower:
                    col_indices['chromosome'] = i
                # Позиция
                elif 'position' in header_lower or 'pos' in header_lower or 'позиц' in header_lower:
                    col_indices['position'] = i
                # Референсный аллель
                elif 'reference' in header_lower or 'ref' in header_lower or 'референс' in header_lower:
                    col_indices['ref'] = i
                # Альтернативный аллель
                elif 'alternate' in header_lower or 'alt' in header_lower or 'альтернат' in header_lower or 'вариант' in header_lower:
                    col_indices['alt'] = i
                # Ген
                elif 'gene' in header_lower or 'ген' in header_lower:
                    col_indices['gene'] = i
                # rsID / Полиморфизм
                elif 'rsid' in header_lower or ('rs' in header_lower and 'id' in header_lower) or 'полиморфизм' in header_lower:
                    col_indices['rsid'] = i
                # Генотип
                elif 'genotype' in header_lower or 'генотип' in header_lower or 'gt' == header_lower:
                    col_indices['genotype'] = i
                # Признак / Trait (может содержать дополнительную информацию)
                elif 'trait' in header_lower or 'признак' in header_lower:
                    col_indices['trait'] = i
                # Эффект
                elif 'effect' in header_lower or 'эффект' in header_lower:
                    col_indices['effect'] = i
            
            # Логируем найденные колонки
            print(f"📋 Найденные колонки: {list(col_indices.keys())}")
            
            # Если нашли ген - это основной формат для русских PDF (rsID желателен, но не обязателен)
            if 'gene' in col_indices:
                print(f"✅ Найдена колонка 'Ген', начинаем извлечение вариантов...")
                for row in table[1:]:  # Пропускаем заголовок
                    try:
                        if len(row) <= col_indices['gene']:
                            continue
                        
                        gene = str(row[col_indices['gene']]).strip() if col_indices['gene'] < len(row) and row[col_indices['gene']] else "Unknown"
                        
                        # Извлекаем rsID если есть колонка
                        variant_id = f"{gene}_variant_{len(variants)}"
                        if 'rsid' in col_indices and col_indices['rsid'] < len(row):
                            rsid_text = str(row[col_indices['rsid']]).strip() if row[col_indices['rsid']] else ""
                            # Извлекаем rsID из текста (может быть "rs123456" или "rs 123456" или просто "123456")
                            rsid_match = re.search(r'rs?\s*(\d+)', rsid_text, re.IGNORECASE)
                            if rsid_match:
                                variant_id = f"rs{rsid_match.group(1)}"
                        
                        # Извлекаем генотип если есть
                        genotype = ""
                        zygosity = ""
                        if 'genotype' in col_indices and col_indices['genotype'] < len(row):
                            genotype_text = str(row[col_indices['genotype']]).strip() if row[col_indices['genotype']] else ""
                            # Парсим генотип (G/G, T/T, C/C, G/A, C/T, A/A, 0/0, 0/1, 1/1)
                            gt_match = re.search(r'([ACGTN0-9]+)[/\|]([ACGTN0-9]+)', genotype_text, re.IGNORECASE)
                            if gt_match:
                                allele1 = gt_match.group(1).upper()
                                allele2 = gt_match.group(2).upper()
                                genotype = f"{allele1}/{allele2}"
                                # Определяем зиготность
                                if allele1 == allele2:
                                    zygosity = 'гомозигота'
                                else:
                                    zygosity = 'гетерозигота'
                        
                        # Извлекаем признак/эффект если есть
                        trait = ""
                        effect = ""
                        if 'trait' in col_indices and col_indices['trait'] < len(row):
                            trait = str(row[col_indices['trait']]).strip() if row[col_indices['trait']] else ""
                        if 'effect' in col_indices and col_indices['effect'] < len(row):
                            effect = str(row[col_indices['effect']]).strip() if row[col_indices['effect']] else ""
                        
                        # Если есть хромосома и позиция - используем их
                        chrom = "Unknown"
                        pos = 0
                        ref = "N"
                        alt = "N"
                        
                        if 'chromosome' in col_indices and 'position' in col_indices:
                            chrom = str(row[col_indices['chromosome']]).strip() if col_indices['chromosome'] < len(row) and row[col_indices['chromosome']] else "Unknown"
                            pos_str = str(row[col_indices['position']]).strip() if col_indices['position'] < len(row) and row[col_indices['position']] else "0"
                            pos = int(pos_str) if pos_str.isdigit() else 0
                            
                            if 'ref' in col_indices and col_indices['ref'] < len(row):
                                ref = str(row[col_indices['ref']]).strip() if row[col_indices['ref']] else "N"
                            if 'alt' in col_indices and col_indices['alt'] < len(row):
                                alt = str(row[col_indices['alt']]).strip() if row[col_indices['alt']] else "N"
                        
                        # Создаем вариант если есть ген (rsID желателен, но не обязателен)
                        if gene != "Unknown" and gene:
                            variant = VCFVariant(
                                chromosome=chrom.replace('chr', '') if chrom.startswith('chr') else chrom,
                                position=pos,
                                id=variant_id,
                                ref=ref.upper() if ref != "N" else "N",
                                alt=alt.upper() if alt != "N" else "N",
                                quality=0.0,
                                filter="PASS",
                                info={
                                    'gene': gene,
                                    'genotype': genotype,
                                    'zygosity': zygosity,
                                    'trait': trait,
                                    'effect': effect,
                                    'source': 'PDF_table',
                                    'extraction_method': 'table',
                                    'table_page': table_data.get('page', 0),
                                    'table_num': table_data.get('table_num', 0)
                                },
                                format="GT",
                                samples={'sample': {'GT': genotype}} if genotype else {}
                            )
                            variants.append(variant)
                    except Exception as e:
                        continue
            
            # Альтернативный вариант: если есть хромосома и позиция (стандартный VCF формат)
            if 'chromosome' in col_indices and 'position' in col_indices and 'gene' not in col_indices:
                print(f"✅ Найдены колонки 'Хромосома' и 'Позиция', используем стандартный VCF формат...")
                for row in table[1:]:  # Пропускаем заголовок
                    try:
                        chrom = str(row[col_indices['chromosome']]).strip() if col_indices['chromosome'] < len(row) else "Unknown"
                        pos_str = str(row[col_indices['position']]).strip() if col_indices['position'] < len(row) else "0"
                        pos = int(pos_str) if pos_str.isdigit() else 0
                        
                        ref = str(row[col_indices['ref']]).strip() if 'ref' in col_indices and col_indices['ref'] < len(row) else "N"
                        alt = str(row[col_indices['alt']]).strip() if 'alt' in col_indices and col_indices['alt'] < len(row) else "N"
                        
                        gene = str(row[col_indices['gene']]).strip() if 'gene' in col_indices and col_indices['gene'] < len(row) else "Unknown"
                        variant_id = str(row[col_indices['rsid']]).strip() if 'rsid' in col_indices and col_indices['rsid'] < len(row) else f"{chrom}:{pos}:{ref}:{alt}"
                        
                        if chrom != "Unknown" and pos > 0:
                            variant = VCFVariant(
                                chromosome=chrom.replace('chr', '') if chrom.startswith('chr') else chrom,
                                position=pos,
                                id=variant_id,
                                ref=ref.upper(),
                                alt=alt.upper(),
                                quality=0.0,
                                filter="PASS",
                                info={
                                    'gene': gene,
                                    'source': 'PDF_table',
                                    'extraction_method': 'table',
                                    'table_page': table_data.get('page', 0),
                                    'table_num': table_data.get('table_num', 0)
                                },
                                format="GT",
                                samples={}
                            )
                            variants.append(variant)
                    except Exception as e:
                        continue
        
        return variants
    
    def _analyze_pdf_with_ai(self, text: str, metadata: Dict, patient_info: Dict, clinical_context: str, analysis_id: str, file_path: str = None) -> GeneticAnalysisResult:
        """ИИ-анализ PDF текста с оптимизацией: извлекаем постранично и останавливаемся, когда найдены все SNP"""
        try:
            from claude_assistant import OpenRouterAssistant
            assistant = OpenRouterAssistant()
        except ImportError:
            raise ImportError("Claude Assistant недоступен для ИИ-анализа")
        
        # Используем весь переданный текст
        text_to_analyze = text
        print(f"📄 Передаю текст в ИИ-анализ: {len(text)} символов")
        
        # Если текст очень большой (>100000 символов), предупреждаем
        if len(text) > 100000:
            print(f"⚠️ Большой PDF файл ({len(text)} символов). Анализ может занять больше времени.")
        elif len(text) < 3000:
            print(f"⚠️ Мало текста извлечено ({len(text)} символов). Возможно, PDF содержит только изображения или текст не извлекается.")
        
        # Формирование промпта согласно документации
        system_prompt = assistant.system_prompt
        
        prompt = f"""{system_prompt}

Ты — ведущий врач-генетик-консультант и профессор клинической генетики с 25-летним опытом работы в университетской клинике (Board Certified в клинической генетике и фармакогенетике). Ты специализируешься на интерпретации генетических тестов, ACMG классификации патогенности, фармакогенетике и генетическом консультировании.

КРИТИЧЕСКИ ВАЖНО — СИСТЕМАТИЧЕСКИЙ АНАЛИЗ ГЕНЕТИЧЕСКИХ ДАННЫХ:

ТЕКСТ ИЗ ГЕНЕТИЧЕСКОГО ОТЧЕТА (PDF):

{text_to_analyze}

ИНФОРМАЦИЯ О ПАЦИЕНТЕ: {patient_info}
КЛИНИЧЕСКИЙ КОНТЕКСТ: {clinical_context}

ОБЯЗАТЕЛЬНО извлеки и проанализируй:

1. ВСЕ ГЕНЕТИЧЕСКИЕ ВАРИАНТЫ (в любом формате):
   - rsID (например, rs123456)
   - HGVS нотация (c.123A>G, p.Arg123Gln)
   - Хромосомная позиция (chr:pos:ref:alt)
   - Названия генов
   - НЕ ПРОПУСТИ НИ ОДИН ВАРИАНТ, даже если он в нестандартном формате

2. ПАТОГЕННОСТЬ (ACMG классификация):
   - Pathogenic (P) — патогенный
   - Likely Pathogenic (LP) — вероятно патогенный
   - Uncertain Significance (VUS) — неопределенная значимость
   - Likely Benign (LB) — вероятно доброкачественный
   - Benign (B) — доброкачественный
   - Укажи критерии ACMG для каждого варианта

3. КЛИНИЧЕСКОЕ ЗНАЧЕНИЕ:
   - Связанные заболевания (точные названия)
   - Тип наследования (аутосомно-доминантный, аутосомно-рецессивный, X-сцепленный, митохондриальный)
   - Пенетрантность
   - Экспрессивность
   - Возраст манифестации

4. ФАРМАКОГЕНЕТИЧЕСКИЕ ВАРИАНТЫ:
   - Гены метаболизма препаратов (CYP2D6, CYP2C19, CYP2C9, TPMT, DPYD и др.)
   - Фенотип метаболизма (быстрый/медленный/промежуточный метаболизер)
   - Препараты, требующие коррекции дозы
   - Конкретные рекомендации по дозировке

5. СРОЧНЫЕ НАХОДКИ (требующие немедленного внимания):
   - Патогенные варианты в онкогенах (BRCA1, BRCA2, TP53, MLH1, MSH2 и др.)
   - Варианты с высоким риском внезапной смерти
   - Противопоказания к препаратам
   - Варианты, требующие немедленного генетического консультирования

6. РЕКОМЕНДАЦИИ:
   - Дальнейшее обследование
   - Скрининг родственников
   - Мониторинг
   - Генетическое консультирование

Предоставь ответ СТРОГО в формате JSON:

{{
    "extracted_variants": [
        {{
            "gene": "точное название гена (например, BRCA1, CYP2D6, TP53)",
            "variant": "полное описание варианта (rs123456, c.123A>G, p.Arg123Gln, или chr:pos:ref:alt)",
            "pathogenicity": "pathogenic/likely_pathogenic/uncertain_significance/likely_benign/benign",
            "acmg_criteria": "критерии ACMG если указаны",
            "disease": "связанное заболевание или состояние (точное название)",
            "clinical_significance": "детальное клиническое значение и рекомендации",
            "inheritance": "тип наследования (аутосомно-доминантный/рецессивный, X-сцепленный и т.д.)",
            "penetrance": "пенетрантность если указана",
            "zygosity": "гомозигота/гетерозигота если указано",
            "population_frequency": "частота в популяции если указана"
        }}
    ],
    "summary": "краткое резюме анализа с основными находками в формате 'Клиническая директива'",
    "recommendations": ["список конкретных клинических рекомендаций с приоритетами"],
    "urgent_findings": ["срочные находки требующие немедленного внимания с указанием причин"],
    "pharmacogenetic_variants": [
        {{
            "gene": "ген",
            "variant": "вариант",
            "phenotype": "фенотип метаболизма",
            "drugs": ["список препаратов требующих коррекции"],
            "recommendation": "конкретная рекомендация по дозировке/применению с ссылками на гайдлайны"
        }}
    ],
    "genetic_counseling_needed": true/false,
    "family_screening_recommended": true/false
}}

КРИТИЧЕСКИ ВАЖНО:
- Извлеки ВСЕ генетические варианты, даже если они в нестандартном формате или упомянуты в тексте
- Укажи точную патогенность согласно ACMG критериям (не выдумывай, если не указано)
- Выдели срочные находки с конкретными причинами (патогенные варианты в онкогенах, противопоказания к препаратам)
- Предоставь конкретные клинические рекомендации с приоритетами
- Используй международные стандарты (ACMG, CPIC, PharmGKB, ClinVar)
- Если варианты не найдены, укажи это явно в summary с объяснением
- Формат ответа: «Клиническая директива» для summary
"""
        
        print("🤖 ИИ-анализ текста PDF...")
        ai_response = assistant.get_response(prompt)
        
        # Парсинг JSON ответа
        try:
            json_start = ai_response.find('{')
            json_end = ai_response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                ai_data = json.loads(ai_response[json_start:json_end])
            else:
                raise ValueError("JSON не найден в ответе")
        except Exception as e:
            print(f"⚠️ Ошибка парсинга JSON: {e}")
            # Создаем результат с текстовым анализом
            ai_data = {
                "extracted_variants": [],
                "summary": ai_response[:1000],
                "recommendations": ["Требуется ручная проверка ИИ-ответа"],
                "urgent_findings": [],
                "pharmacogenetic_variants": []
            }
        
        # Преобразование в структурированные объекты
        extracted_variants = ai_data.get('extracted_variants', [])
        pharmacogenetic_variants = ai_data.get('pharmacogenetic_variants', [])
        
        clinical_interpretations_list = []
        pharmacogenetic_interpretations_list = []
        
        for var_data in extracted_variants:
            # Преобразование патогенности
            path_str = var_data.get('pathogenicity', 'uncertain_significance').lower()
            if path_str == 'pathogenic':
                path = VariantPathogenicity.PATHOGENIC
            elif path_str == 'likely_pathogenic':
                path = VariantPathogenicity.LIKELY_PATHOGENIC
            elif path_str == 'benign':
                path = VariantPathogenicity.BENIGN
            elif path_str == 'likely_benign':
                path = VariantPathogenicity.LIKELY_BENIGN
            else:
                path = VariantPathogenicity.UNCERTAIN_SIGNIFICANCE
            
            clinical_interpretations_list.append(ClinicalVariant(
                gene=var_data.get('gene', 'Unknown'),
                variant_name=var_data.get('variant', ''),
                protein_change='',
                pathogenicity=path,
                disease=var_data.get('disease', ''),
                inheritance_pattern=var_data.get('inheritance', ''),
                penetrance=var_data.get('zygosity', ''),
                clinical_action=var_data.get('clinical_significance', ''),
                evidence_level='',
                population_frequency=self._safe_float(var_data.get('population_frequency', 0))
            ))
        
        for pg_data in pharmacogenetic_variants:
            pharmacogenetic_interpretations_list.append(PharmacogeneticVariant(
                gene=pg_data.get('gene', 'Unknown'),
                variant=pg_data.get('variant', ''),
                phenotype=pg_data.get('phenotype', ''),
                drugs=pg_data.get('drugs', []),
                recommendation=pg_data.get('recommendation', ''),
                evidence_level='',
                clinical_annotation=pg_data.get('recommendation', '')
            ))
        
        # Оценка рисков
        risk_assessment_obj = self._assess_genetic_risks(
            {'pathogenic': [], 'likely_pathogenic': [], 'pharmacogenetic': [], 'trait': []},
            clinical_interpretations_list,
            patient_info
        )
        
        return GeneticAnalysisResult(
            analysis_id=analysis_id,
            timestamp=datetime.datetime.now().isoformat(),
            metadata={**metadata, "analysis_method": "AI_text_analysis", "ai_extracted_data": ai_data},
            total_variants=len(extracted_variants) + len(pharmacogenetic_variants),
            confidence_score=0.75,  # Повышенная уверенность для ИИ-анализа
            pathogenic_variants=[],
            likely_pathogenic_variants=[],
            pharmacogenetic_variants=[],
            trait_variants=[],
            clinical_interpretations=clinical_interpretations_list,
            pharmacogenetic_interpretations=pharmacogenetic_interpretations_list,
            risk_assessment=risk_assessment_obj,
            recommendations=ai_data.get('recommendations', []),
            urgent_flags=ai_data.get('urgent_findings', []),
            icd10_codes=[]
        )
    
    def _analyze_pdf_as_images(self, file_path: str, patient_info: Dict[str, Any], clinical_context: str, analysis_id: str) -> GeneticAnalysisResult:
        """Анализ PDF как изображений через vision-модель (для сканированных документов)"""
        try:
            from claude_assistant import OpenRouterAssistant
            import numpy as np
            from PIL import Image
            
            assistant = OpenRouterAssistant()
            
            print("🖼️ Конвертация PDF страниц в изображения...")
            images = self.pdf_parser._convert_pdf_to_images(file_path, max_pages=10)
            
            if not images:
                raise ValueError("Не удалось конвертировать PDF в изображения. Установите pdf2image и poppler.")
            
            print(f"✅ Конвертировано {len(images)} страниц. Анализируем через vision-модель...")
            
            # Промпт для генетического анализа изображений
            genetic_prompt = """Ты — ведущий врач-генетик-консультант с 25-летним опытом. Проанализируй это изображение генетического отчета.

КРИТИЧЕСКИ ВАЖНО — извлеки ВСЕ генетические данные:

1. ВСЕ ГЕНЕТИЧЕСКИЕ ВАРИАНТЫ:
   - rsID (например, rs123456)
   - HGVS нотация (c.123A>G, p.Arg123Gln)
   - Хромосомная позиция (chr:pos:ref:alt)
   - Названия генов
   - Генотипы (гомозигота/гетерозигота)

2. ПАТОГЕННОСТЬ (ACMG):
   - Pathogenic (P) / Likely Pathogenic (LP) / VUS / Likely Benign (LB) / Benign (B)

3. ТЕХНИЧЕСКИЕ ДАННЫЕ:
   - Метод анализа (WES/WGS/targeted panel)
   - Покрытие (coverage)
   - Качество (quality score, VAF)
   - Версия референсного генома (GRCh37/GRCh38)

4. АННОТАЦИИ:
   - ClinVar
   - gnomAD (allele frequency)
   - dbSNP
   - SIFT, PolyPhen

5. ТЕХНИЧЕСКАЯ ИНФОРМАЦИЯ:
   - Лаборатория
   - Аккредитация (CAP/CLIA/ISO 15189)
   - Биоинформатический пайплайн
   - Дата анализа

Верни результат в JSON формате с полями: variants (массив), gene_panel (массив генов), technical_info (объект)."""
            
            # Анализируем каждую страницу и объединяем результаты
            all_extracted_text = []
            for page_num, image in enumerate(images, 1):
                print(f"🔍 Анализ страницы {page_num}/{len(images)} через vision-модель...")
                try:
                    # Конвертируем PIL Image в numpy array
                    image_array = np.array(image)
                    
                    # Отправляем в vision-модель
                    page_result = assistant.send_vision_request(
                        genetic_prompt,
                        image_array=image_array,
                        metadata=f"genetic_report_page_{page_num}",
                        use_cache=False
                    )
                    
                    all_extracted_text.append(f"\n--- Страница {page_num} (vision-анализ) ---\n{page_result}")
                    print(f"✅ Страница {page_num}: извлечено {len(page_result)} символов")
                    
                    # Проверяем, извлечены ли все гены и SNP
                    combined_so_far = "\n".join(all_extracted_text)
                    if self._check_extraction_complete(combined_so_far):
                        print(f"✅ Все гены и SNP извлечены на странице {page_num}. Останавливаем анализ.")
                        break
                    
                except Exception as e:
                    print(f"⚠️ Ошибка анализа страницы {page_num}: {e}")
                    continue
            
            if not all_extracted_text:
                raise ValueError("Не удалось извлечь данные ни с одной страницы через vision-анализ")
            
            # Объединяем результаты всех страниц
            combined_text = "\n".join(all_extracted_text)
            print(f"✅ Vision-анализ завершен. Извлечено {len(combined_text)} символов из {len(images)} страниц")
            
            # Теперь анализируем объединенный текст через текстовый ИИ-анализ
            metadata = {
                'source': 'PDF',
                'file_type': 'genetic_report',
                'extraction_method': 'AI_vision_analysis',
                'extracted_text_length': len(combined_text),
                'pages_analyzed': len(images),
                'vision_analysis': True
            }
            
            print("🤖 Запуск финального ИИ-анализа объединенных данных...")
            return self._analyze_pdf_with_ai(combined_text, metadata, patient_info, clinical_context, analysis_id, file_path)
            
        except Exception as e:
            print(f"❌ Ошибка vision-анализа PDF: {e}")
            raise
    
    def analyze_pdf_file(self, file_path: str,
                        patient_info: Optional[Dict[str, Any]] = None,
                        clinical_context: str = "") -> GeneticAnalysisResult:
        """Анализ PDF файла с генетическими данными - сразу используем ИИ-анализ"""
        
        analysis_id = f"genetic_analysis_pdf_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            print(f"📄 Анализ PDF файла: {file_path}")
            print("🤖 Для PDF файлов используется ИИ-анализ (наиболее надежный метод для нестандартизированных форматов)")
            
            # Извлекаем текст из PDF (первые 10 страниц для оптимизации)
            print("📄 Извлечение текста из PDF (первые 10 страниц для оптимизации)...")
            text = self.pdf_parser.extract_text_from_pdf(file_path, max_pages=10)
            
            # Проверяем качество извлечения текста
            text_length = len(text.strip()) if text else 0
            avg_chars_per_page = text_length / 10 if text_length > 0 else 0
            
            print(f"📊 Статистика извлечения: {text_length} символов, ~{avg_chars_per_page:.0f} символов/страницу")
            
            # Если текст извлечен плохо (< 100 символов/страницу), используем vision-анализ
            if avg_chars_per_page < 100 and text_length < 1000:
                print("⚠️ Текст извлечен плохо. PDF, вероятно, содержит изображения (сканированный документ).")
                print("🖼️ Переключаемся на vision-анализ: конвертируем страницы в изображения...")
                return self._analyze_pdf_as_images(file_path, patient_info or {}, clinical_context, analysis_id)
            
            if not text or text_length < 100:
                print("⚠️ Текст не извлечен. Пробуем vision-анализ...")
                return self._analyze_pdf_as_images(file_path, patient_info or {}, clinical_context, analysis_id)
            
            print(f"✅ Извлечено {text_length} символов текста из первых 10 страниц PDF")
            print(f"📄 Текст будет передан в ИИ-анализ для извлечения всех генетических данных")
            
            # Сразу используем ИИ-анализ для PDF
            metadata = {
                'source': 'PDF',
                'file_type': 'genetic_report',
                'extraction_method': 'AI_text_analysis',
                'extracted_text_length': text_length,
                'pages_extracted': 10,
                'full_text_analysis': False  # Используем только первые 10 страниц
            }
            
            print("🤖 Запуск ИИ-анализа текста PDF (первые 10 страниц)...")
            return self._analyze_pdf_with_ai(text, metadata, patient_info or {}, clinical_context, analysis_id, file_path)
            
        except Exception as e:
            print(f"❌ Ошибка анализа PDF: {e}")
            raise
            
            pharmacogenetic_interpretations = self._get_pharmacogenetic_interpretations(
                classified_variants['pharmacogenetic']
            )
            
            risk_assessment = self._assess_genetic_risks(
                classified_variants, clinical_interpretations, patient_info
            )
            
            recommendations = self._generate_recommendations(
                classified_variants, clinical_interpretations, pharmacogenetic_interpretations
            )
            
            urgent_flags = self._determine_urgent_flags(
                classified_variants, clinical_interpretations
            )
            
            icd10_codes = self._assign_icd10_codes(clinical_interpretations)
            
            confidence_score = self._calculate_confidence_score(
                classified_variants, len(variants)
            )
            
            metadata.update({
                'analysis_id': analysis_id,
                'patient_info': patient_info or {},
                'clinical_context': clinical_context,
                'file_path': file_path,
                'source': 'PDF'
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
            
            self.analysis_cache[analysis_id] = result
            print(f"✅ Анализ PDF завершен. ID: {analysis_id}")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка анализа PDF: {e}")
            
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
            
            # ПРИОРИТЕТ 1: Проверяем патогенность из info поля (извлеченную из PDF/текста)
            if 'pathogenicity' in variant.info:
                path_str = str(variant.info['pathogenicity']).lower()
                if path_str == 'pathogenic':
                    classified['pathogenic'].append(variant)
                    continue
                elif path_str == 'likely_pathogenic':
                    classified['likely_pathogenic'].append(variant)
                    continue
            
            # ПРИОРИТЕТ 2: Проверяем контекст на наличие патогенных ключевых слов
            context = variant.info.get('context', '').lower()
            if context:
                # Расширенные ключевые слова для патогенности
                pathogenic_indicators = [
                    'патогенный', 'pathogenic', 'мутация', 'disease-causing',
                    'вызывает заболевание', 'причина заболевания', 'клинически значим',
                    'высокий риск', 'повышенный риск', 'наследственное заболевание',
                    'выявлена мутация', 'обнаружена мутация', 'найдена мутация',
                    'патологический', 'патологическая', 'deleterious', 'causative'
                ]
                if any(indicator in context for indicator in pathogenic_indicators):
                    # Проверяем, не доброкачественный ли это
                    benign_indicators = ['доброкачественный', 'benign', 'полиморфизм', 'polymorphism', 'нормальный']
                    if not any(indicator in context for indicator in benign_indicators):
                        classified['pathogenic'].append(variant)
                        continue
            
            # ПРИОРИТЕТ 3: Поиск в базе патогенных вариантов
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
        
        # Специфические рекомендации для известных вариантов
        known_variants_recommendations = {
            'MTHFR': [
                "MTHFR C677T (гетерозигота): Прием метилированной фолиевой кислоты (метилфолат) 400-800 мкг/день",
                "Контроль уровня гомоцистеина в крови (целевой уровень <10 мкмоль/л)",
                "Дополнительный прием витамина B12 (метилкобаламин) 500-1000 мкг/день",
                "Ограничение потребления алкоголя",
                "При планировании беременности - консультация генетика и акушера-гинеколога"
            ],
            'COMT': [
                "COMT: Управление стрессом (медитация, йога, регулярный отдых)",
                "Коррекция доз препаратов, влияющих на катехоламины (антидепрессанты, леводопа)",
                "Избегание избыточного кофеина",
                "Регулярная умеренная физическая активность"
            ],
            'TNF': [
                "TNFa: Контроль воспалительных процессов",
                "При наличии аутоиммунных заболеваний - обсуждение с ревматологом коррекции терапии",
                "Противовоспалительная диета (омега-3, ограничение обработанных продуктов)",
                "Мониторинг маркеров воспаления (СРБ, СОЭ)"
            ],
            'TNFa': [
                "TNFa: Контроль воспалительных процессов",
                "При наличии аутоиммунных заболеваний - обсуждение с ревматологом коррекции терапии",
                "Противовоспалительная диета (омега-3, ограничение обработанных продуктов)",
                "Мониторинг маркеров воспаления (СРБ, СОЭ)"
            ]
        }
        
        # Проверяем найденные варианты на известные
        found_genes = set()
        for variant in classified_variants['pathogenic'] + classified_variants['likely_pathogenic']:
            gene = variant.info.get('gene', '').upper()
            if gene:
                found_genes.add(gene)
                if gene in known_variants_recommendations:
                    recommendations.extend(known_variants_recommendations[gene])
        
        # Рекомендации при патогенных вариантах
        if classified_variants['pathogenic']:
            recommendations.extend([
                "СРОЧНО: Консультация врача-генетика (в течение 1-2 недель)",
                "Медико-генетическое консультирование для семьи",
                "Разработка индивидуального плана скрининга и мониторинга"
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