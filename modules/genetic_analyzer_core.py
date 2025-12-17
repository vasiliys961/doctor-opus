# -*- coding: utf-8 -*-
"""
Основной анализатор генетических данных
"""
import json
import datetime
import io
import re
import os
from typing import List, Dict, Any, Tuple, Optional

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

from .genetic_models import (
    VCFVariant, ClinicalVariant, PharmacogeneticVariant,
    GeneticRiskAssessment, GeneticAnalysisResult, VariantPathogenicity
)
from .genetic_database import GeneticDatabase
from .genetic_parser import VCFParser

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
