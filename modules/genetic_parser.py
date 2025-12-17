# -*- coding: utf-8 -*-
"""
Парсер VCF файлов
"""
import gzip
import re
import os
from typing import List, Dict, Any, Tuple, Optional
from .genetic_models import VCFVariant

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

