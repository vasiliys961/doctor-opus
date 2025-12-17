# -*- coding: utf-8 -*-
"""
Модуль анализа генетических данных для Enhanced Medical AI Analyzer
Поддерживает: VCF файлы, фармакогенетику, патогенные варианты, наследственные заболевания

⚠️ ВНИМАНИЕ: Этот файл теперь является оберткой для обратной совместимости.
Основной код разделен на модули:
- genetic_models.py - модели данных
- genetic_database.py - база данных вариантов
- genetic_parser.py - парсер VCF
- genetic_analyzer_core.py - основная логика анализа
- genetic_integration.py - интеграция с медицинским ИИ
"""

# Реэкспорт всех классов и функций для обратной совместимости
from .genetic_models import (
    GeneticDataType,
    VariantPathogenicity,
    VCFVariant,
    ClinicalVariant,
    PharmacogeneticVariant,
    GeneticRiskAssessment,
    GeneticAnalysisResult
)

from .genetic_database import GeneticDatabase
from .genetic_parser import VCFParser
from .genetic_analyzer_core import GeneticAnalyzer
from .genetic_integration import GeneticAnalyzerIntegration

# Утилиты
import os

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


# Экспорт основных классов и функций
__all__ = [
    'GeneticAnalyzer',
    'GeneticAnalyzerIntegration', 
    'VCFParser',
    'GeneticDatabase',
    'GeneticAnalysisResult',
    'GeneticDataType',
    'VariantPathogenicity',
    'VCFVariant',
    'ClinicalVariant',
    'PharmacogeneticVariant',
    'GeneticRiskAssessment',
    'create_test_vcf_file',
    'run_genetic_analysis_example'
]

if __name__ == "__main__":
    # Запуск примера при прямом выполнении модуля
    run_genetic_analysis_example()
