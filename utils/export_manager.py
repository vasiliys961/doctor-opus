"""
Экспорт результатов анализа в различные форматы
"""
import json
import csv
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import pandas as pd

EXPORT_DIR = Path("exports")
EXPORT_DIR.mkdir(exist_ok=True)

def export_analysis_to_json(analysis_data: Dict[str, Any], filename: str = None) -> str:
    """Экспорт анализа в JSON"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"analysis_{timestamp}.json"
    
    filepath = EXPORT_DIR / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(analysis_data, f, ensure_ascii=False, indent=2)
    
    return str(filepath)

def export_analysis_to_csv(analysis_data: List[Dict], filename: str = None) -> str:
    """Экспорт анализа в CSV"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"analysis_{timestamp}.csv"
    
    filepath = EXPORT_DIR / filename
    
    df = pd.DataFrame(analysis_data)
    df.to_csv(filepath, index=False, encoding='utf-8')
    
    return str(filepath)

def export_lab_results_to_excel(lab_data: Dict, filename: str = None) -> str:
    """Экспорт лабораторных результатов в Excel"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"lab_results_{timestamp}.xlsx"
    
    filepath = EXPORT_DIR / filename
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        # Основные результаты
        if 'parameters' in lab_data:
            df_params = pd.DataFrame(lab_data['parameters'])
            df_params.to_excel(writer, sheet_name='Параметры', index=False)
        
        # Критические значения
        if 'critical_values' in lab_data and lab_data['critical_values']:
            df_critical = pd.DataFrame({'Критические значения': lab_data['critical_values']})
            df_critical.to_excel(writer, sheet_name='Критические', index=False)
        
        # Предупреждения
        if 'warnings' in lab_data and lab_data['warnings']:
            df_warnings = pd.DataFrame({'Предупреждения': lab_data['warnings']})
            df_warnings.to_excel(writer, sheet_name='Предупреждения', index=False)
    
    return str(filepath)
