import numpy as np
import pandas as pd
from scipy import signal
from scipy.stats import kurtosis, skew
import matplotlib.pyplot as plt
from datetime import datetime
import json
import sys
import os

# Импорт констант для ЭКГ
try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))
    from constants import (
        ECG_DEFAULT_SAMPLING_RATE,
        BANDPASS_FILTER_LOW_FREQ,
        BANDPASS_FILTER_HIGH_FREQ,
        POWERLINE_INTERFERENCE_FREQ,
        R_PEAK_MIN_DISTANCE_RATIO,
        R_PEAK_WINDOW_SIZE_RATIO,
        R_PEAK_CORRECTION_WINDOW_RATIO,
        TRIANGULAR_INDEX_BIN_WIDTH_MS,
        TRIANGULAR_INDEX_BIN_WIDTH_SEC,
        HR_BRADYCARDIA_THRESHOLD,
        HR_TACHYCARDIA_THRESHOLD,
        HR_SEVERE_BRADYCARDIA,
        HR_SEVERE_TACHYCARDIA,
        RR_VARIATION_COEFFICIENT_THRESHOLD,
        RR_VARIATION_COEFFICIENT_SEVERE,
        HRV_NN50_THRESHOLD_SEC,
    )
except ImportError:
    # Fallback значения
    ECG_DEFAULT_SAMPLING_RATE = 500
    BANDPASS_FILTER_LOW_FREQ = 0.5
    BANDPASS_FILTER_HIGH_FREQ = 40
    POWERLINE_INTERFERENCE_FREQ = 50
    R_PEAK_MIN_DISTANCE_RATIO = 0.2
    R_PEAK_WINDOW_SIZE_RATIO = 0.15
    R_PEAK_CORRECTION_WINDOW_RATIO = 0.05
    TRIANGULAR_INDEX_BIN_WIDTH_MS = 7.8125
    TRIANGULAR_INDEX_BIN_WIDTH_SEC = 0.0078125
    HR_BRADYCARDIA_THRESHOLD = 60
    HR_TACHYCARDIA_THRESHOLD = 100
    HR_SEVERE_BRADYCARDIA = 45
    HR_SEVERE_TACHYCARDIA = 150
    RR_VARIATION_COEFFICIENT_THRESHOLD = 0.15
    RR_VARIATION_COEFFICIENT_SEVERE = 0.25
    HRV_NN50_THRESHOLD_SEC = 0.05

class AdvancedECGProcessor:
    """Расширенный класс для обработки и анализа ЭКГ данных"""
    
    def __init__(self, sampling_rate=ECG_DEFAULT_SAMPLING_RATE):
        self.sampling_rate = sampling_rate
        self.lead_names = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']
        
    def load_multi_lead_ecg(self, data, format_type='csv'):
        """Загрузка многоканальной ЭКГ"""
        if format_type == 'csv':
            if isinstance(data, pd.DataFrame):
                df = data
            else:
                df = pd.read_csv(data)
        elif format_type == 'json':
            if isinstance(data, dict):
                df = pd.DataFrame(data)
            else:
                with open(data, 'r') as f:
                    json_data = json.load(f)
                df = pd.DataFrame(json_data)
        
        # Автоматическое определение колонок времени и отведений
        time_col = None
        lead_cols = []
        
        for col in df.columns:
            col_lower = str(col).lower()
            if any(time_word in col_lower for time_word in ['time', 'времена', 'сек', 'sec']):
                time_col = col
            elif any(lead in col_lower for lead in ['lead', 'отвед', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'i', 'ii', 'iii']):
                lead_cols.append(col)
        
        if time_col is None and len(df.columns) > 1:
            time_col = df.columns[0]
        
        if not lead_cols:
            lead_cols = [col for col in df.columns if col != time_col]
        
        return df, time_col, lead_cols
    
    def preprocess_signal(self, signal_data, remove_baseline=True, filter_noise=True):
        """Предварительная обработка ЭКГ сигнала"""
        processed_signal = signal_data.copy()
        
        if remove_baseline:
            # Удаление дрейфа базовой линии
            processed_signal = self.remove_baseline_drift(processed_signal)
        
        if filter_noise:
            # Фильтрация шума
            processed_signal = self.apply_bandpass_filter(processed_signal)
            processed_signal = self.remove_powerline_interference(processed_signal)
        
        return processed_signal
    
    def remove_baseline_drift(self, signal_data, cutoff_freq=0.5):
        """Удаление дрейфа базовой линии"""
        # Высокочастотный фильтр для удаления низкочастотного дрейфа
        sos = signal.butter(4, cutoff_freq, btype='high', fs=self.sampling_rate, output='sos')
        filtered_signal = signal.sosfilt(sos, signal_data)
        return filtered_signal
    
    def apply_bandpass_filter(self, signal_data, low_freq=BANDPASS_FILTER_LOW_FREQ, high_freq=BANDPASS_FILTER_HIGH_FREQ):
        """Применение полосового фильтра"""
        sos = signal.butter(4, [low_freq, high_freq], btype='band', fs=self.sampling_rate, output='sos')
        filtered_signal = signal.sosfilt(sos, signal_data)
        return filtered_signal
    
    def remove_powerline_interference(self, signal_data, notch_freq=POWERLINE_INTERFERENCE_FREQ):
        """Удаление сетевой наводки"""
        # Режекторный фильтр для удаления 50/60 Гц
        quality_factor = 30
        sos = signal.iirnotch(notch_freq, quality_factor, fs=self.sampling_rate)
        filtered_signal = signal.sosfilt(sos, signal_data)
        return filtered_signal
    
    def detect_r_peaks(self, signal_data, min_distance=None):
        """Обнаружение R-пиков"""
        if min_distance is None:
            min_distance = int(R_PEAK_MIN_DISTANCE_RATIO * self.sampling_rate)  # Минимальное расстояние
        
        # Использование алгоритма Pan-Tompkins (упрощенная версия)
        # 1. Дифференцирование
        diff_signal = np.diff(signal_data)
        
        # 2. Возведение в квадрат
        squared_signal = diff_signal ** 2
        
        # 3. Скользящее окно интегрирования
        window_size = int(R_PEAK_WINDOW_SIZE_RATIO * self.sampling_rate)  # Окно интегрирования
        integrated_signal = np.convolve(squared_signal, np.ones(window_size), mode='same') / window_size
        
        # 4. Поиск пиков
        peaks, properties = signal.find_peaks(
            integrated_signal,
            height=np.mean(integrated_signal) + 2 * np.std(integrated_signal),
            distance=min_distance
        )
        
        # 5. Коррекция позиций пиков (поиск максимума в исходном сигнале)
        corrected_peaks = []
        for peak in peaks:
            # Поиск в окне коррекции вокруг найденного пика
            window_half = int(R_PEAK_CORRECTION_WINDOW_RATIO * self.sampling_rate)
            start_idx = max(0, peak - window_half)
            end_idx = min(len(signal_data), peak + window_half)
            
            local_max_idx = np.argmax(signal_data[start_idx:end_idx]) + start_idx
            corrected_peaks.append(local_max_idx)
        
        return np.array(corrected_peaks)
    
    def calculate_rr_intervals(self, r_peaks):
        """Расчет RR интервалов"""
        if len(r_peaks) < 2:
            return np.array([])
        
        rr_intervals = np.diff(r_peaks) / self.sampling_rate  # в секундах
        return rr_intervals
    
    def calculate_heart_rate_variability(self, rr_intervals):
        """Расчет показателей вариабельности сердечного ритма"""
        if len(rr_intervals) < 2:
            return {}
        
        # Временные показатели
        hrv_metrics = {}
        
        # SDNN - стандартное отклонение NN интервалов
        hrv_metrics['SDNN'] = np.std(rr_intervals) * 1000  # в мс
        
        # RMSSD - квадратный корень из среднего квадратов разностей соседних NN интервалов
        successive_diffs = np.diff(rr_intervals)
        hrv_metrics['RMSSD'] = np.sqrt(np.mean(successive_diffs ** 2)) * 1000  # в мс
        
        # pNN50 - процент NN интервалов, различающихся более чем на 50 мс
        nn50_count = np.sum(np.abs(successive_diffs) > HRV_NN50_THRESHOLD_SEC)
        hrv_metrics['pNN50'] = (nn50_count / len(successive_diffs)) * 100
        
        # Среднее RR и частота сердечных сокращений
        hrv_metrics['mean_RR'] = np.mean(rr_intervals) * 1000  # в мс
        hrv_metrics['mean_HR'] = 60 / np.mean(rr_intervals)  # уд/мин
        
        # Геометрические показатели
        hrv_metrics['TINN'] = self.calculate_triangular_index(rr_intervals)
        
        return hrv_metrics
    
    def calculate_triangular_index(self, rr_intervals):
        """Расчет треугольного индекса"""
        if len(rr_intervals) < 20:
            return 0
        
        # Создание гистограммы с шагом из константы
        bin_width = TRIANGULAR_INDEX_BIN_WIDTH_SEC
        hist, bins = np.histogram(rr_intervals, bins=int((np.max(rr_intervals) - np.min(rr_intervals)) / bin_width))
        
        # Треугольный индекс = общее количество интервалов / максимальная высота гистограммы
        if np.max(hist) > 0:
            return len(rr_intervals) / np.max(hist)
        else:
            return 0
    
    def detect_arrhythmias(self, rr_intervals, signal_data, r_peaks):
        """Обнаружение аритмий"""
        arrhythmias = []
        
        if len(rr_intervals) < 5:
            return arrhythmias
        
        # Средние значения для анализа
        mean_rr = np.mean(rr_intervals)
        std_rr = np.std(rr_intervals)
        mean_hr = 60 / mean_rr
        
        # 1. Брадикардия
        if mean_hr < HR_BRADYCARDIA_THRESHOLD:
            arrhythmias.append({
                'type': 'Брадикардия',
                'description': f'Средняя ЧСС: {mean_hr:.1f} уд/мин',
                'severity': 'Умеренная' if mean_hr > HR_SEVERE_BRADYCARDIA else 'Выраженная'
            })
        
        # 2. Тахикардия
        elif mean_hr > HR_TACHYCARDIA_THRESHOLD:
            arrhythmias.append({
                'type': 'Тахикардия',
                'description': f'Средняя ЧСС: {mean_hr:.1f} уд/мин',
                'severity': 'Умеренная' if mean_hr < HR_SEVERE_TACHYCARDIA else 'Выраженная'
            })
        
        # 3. Аритмия (нерегулярность)
        cv_rr = std_rr / mean_rr  # Коэффициент вариации
        if cv_rr > RR_VARIATION_COEFFICIENT_THRESHOLD:
            arrhythmias.append({
                'type': 'Нерегулярный ритм',
                'description': f'Коэффициент вариации RR: {cv_rr:.3f}',
                'severity': 'Умеренная' if cv_rr < RR_VARIATION_COEFFICIENT_SEVERE else 'Выраженная'
            })
        
        # 4. Экстрасистолы (упрощенное обнаружение)
        for i, rr in enumerate(rr_intervals):
            if rr < mean_rr - 2 * std_rr:  # Очень короткий RR интервал
                if i < len(rr_intervals) - 1:
                    next_rr = rr_intervals[i + 1]
                    if next_rr > mean_rr + std_rr:  # Компенсаторная пауза
                        arrhythmias.append({
                            'type': 'Возможная экстрасистола',
                            'description': f'Позиция: {i+1}, RR: {rr*1000:.1f} мс',
                            'severity': 'Легкая'
                        })
        
        return arrhythmias
    
    def analyze_morphology(self, signal_data, r_peaks):
        """Анализ морфологии ЭКГ комплексов"""
        if len(r_peaks) < 3:
            return {}
        
        morphology = {}
        
        # Извлечение средних комплексов
        beat_window = int(0.6 * self.sampling_rate)  # 600 мс окно
        beats = []
        
        for r_peak in r_peaks:
            start_idx = max(0, r_peak - beat_window // 2)
            end_idx = min(len(signal_data), r_peak + beat_window // 2)
            
            if end_idx - start_idx == beat_window:
                beat = signal_data[start_idx:end_idx]
                beats.append(beat)
        
        if beats:
            beats_array = np.array(beats)
            mean_beat = np.mean(beats_array, axis=0)
            
            # Анализ средних амплитуд
            r_amplitude = np.max(mean_beat)
            morphology['R_amplitude'] = r_amplitude
            
            # Поиск Q и S волн относительно R пика
            r_pos = len(mean_beat) // 2
            
            # Q волна (перед R)
            q_search_start = max(0, r_pos - int(0.04 * self.sampling_rate))
            q_region = mean_beat[q_search_start:r_pos]
            if len(q_region) > 0:
                q_amplitude = np.min(q_region)
                morphology['Q_amplitude'] = q_amplitude
            
            # S волна (после R)
            s_search_end = min(len(mean_beat), r_pos + int(0.08 * self.sampling_rate))
            s_region = mean_beat[r_pos:s_search_end]
            if len(s_region) > 0:
                s_amplitude = np.min(s_region)
                morphology['S_amplitude'] = s_amplitude
            
            # QRS длительность (упрощенная оценка)
            qrs_start = q_search_start
            qrs_end = s_search_end
            morphology['QRS_duration'] = (qrs_end - qrs_start) / self.sampling_rate * 1000  # в мс
            
            # Вариабельность морфологии
            morphology['beat_variability'] = np.std(beats_array, axis=0).mean()
        
        return morphology
    
    def calculate_qt_interval(self, signal_data, r_peaks):
        """Расчет QT интервала (упрощенный)"""
        if len(r_peaks) < 2:
            return {}
        
        qt_intervals = []
        
        for i, r_peak in enumerate(r_peaks[:-1]):
            # Поиск T волны после R пика
            search_start = r_peak + int(0.2 * self.sampling_rate)  # 200 мс после R
            search_end = min(len(signal_data), r_peaks[i + 1] - int(0.1 * self.sampling_rate))
            
            if search_end > search_start:
                t_region = signal_data[search_start:search_end]
                
                # Поиск конца T волны (возврат к изолинии)
                baseline = np.mean(signal_data[max(0, r_peak - int(0.1 * self.sampling_rate)):r_peak - int(0.05 * self.sampling_rate)])
                
                # Найти точку, где сигнал возвращается к baseline
                t_end_candidates = np.where(np.abs(t_region - baseline) < 0.1 * np.std(signal_data))[0]
                
                if len(t_end_candidates) > 0:
                    t_end = search_start + t_end_candidates[-1]
                    
                    # Q начало (упрощенное)
                    q_start = r_peak - int(0.04 * self.sampling_rate)
                    
                    qt_duration = (t_end - q_start) / self.sampling_rate * 1000  # в мс
                    
                    if 300 < qt_duration < 500:  # Реалистичные значения QT
                        qt_intervals.append(qt_duration)
        
        qt_analysis = {}
        if qt_intervals:
            qt_analysis['mean_QT'] = np.mean(qt_intervals)
            qt_analysis['std_QT'] = np.std(qt_intervals)
            
            # QTc расчет (формула Bazett)
            mean_rr = np.mean(np.diff(r_peaks) / self.sampling_rate)
            qt_analysis['QTc'] = qt_analysis['mean_QT'] / np.sqrt(mean_rr)
            
            # Оценка удлинения QT
            if qt_analysis['QTc'] > 440:  # мс
                qt_analysis['QT_assessment'] = 'Удлинен'
            elif qt_analysis['QTc'] < 350:
                qt_analysis['QT_assessment'] = 'Укорочен'
            else:
                qt_analysis['QT_assessment'] = 'Нормальный'
        
        return qt_analysis
    
    def generate_comprehensive_report(self, signal_data, time_data=None):
        """Генерация комплексного отчета по ЭКГ"""
        # Предобработка сигнала
        processed_signal = self.preprocess_signal(signal_data)
        
        # Обнаружение R-пиков
        r_peaks = self.detect_r_peaks(processed_signal)
        
        # Расчет RR интервалов
        rr_intervals = self.calculate_rr_intervals(r_peaks)
        
        # Анализ ВСР
        hrv_metrics = self.calculate_heart_rate_variability(rr_intervals)
        
        # Обнаружение аритмий
        arrhythmias = self.detect_arrhythmias(rr_intervals, processed_signal, r_peaks)
        
        # Анализ морфологии
        morphology = self.analyze_morphology(processed_signal, r_peaks)
        
        # Анализ QT интервала
        qt_analysis = self.calculate_qt_interval(processed_signal, r_peaks)
        
        # Формирование отчета
        report = {
            'timestamp': datetime.now().isoformat(),
            'signal_quality': {
                'total_duration': len(signal_data) / self.sampling_rate,
                'sampling_rate': self.sampling_rate,
                'r_peaks_detected': len(r_peaks),
                'signal_quality_score': self.assess_signal_quality(signal_data, r_peaks)
            },
            'rhythm_analysis': {
                'hrv_metrics': hrv_metrics,
                'arrhythmias': arrhythmias,
                'rhythm_regularity': self.assess_rhythm_regularity(rr_intervals)
            },
            'morphology_analysis': morphology,
            'qt_analysis': qt_analysis,
            'clinical_interpretation': self.generate_clinical_interpretation(hrv_metrics, arrhythmias, morphology, qt_analysis),
            'recommendations': self.generate_recommendations(hrv_metrics, arrhythmias, morphology, qt_analysis)
        }
        
        return report
    
    def assess_signal_quality(self, signal_data, r_peaks):
        """Оценка качества сигнала ЭКГ"""
        # Простая оценка качества на основе:
        # 1. Отношение сигнал/шум
        # 2. Количество обнаруженных R-пиков
        # 3. Регулярность обнаружения
        
        signal_power = np.var(signal_data)
        noise_estimate = np.var(np.diff(signal_data))  # Упрощенная оценка шума
        
        snr = signal_power / noise_estimate if noise_estimate > 0 else 0
        
        expected_peaks = len(signal_data) / self.sampling_rate * 1.2  # ~72 уд/мин
        peak_detection_ratio = len(r_peaks) / expected_peaks if expected_peaks > 0 else 0
        
        # Нормализация и объединение метрик
        quality_score = min(100, (np.log(snr) * 10 + peak_detection_ratio * 50 + 50))
        
        return max(0, quality_score)
    
    def assess_rhythm_regularity(self, rr_intervals):
        """Оценка регулярности ритма"""
        if len(rr_intervals) < 3:
            return "Недостаточно данных"
        
        cv = np.std(rr_intervals) / np.mean(rr_intervals)
        
        if cv < 0.05:
            return "Регулярный"
        elif cv < 0.15:
            return "Слегка нерегулярный"
        elif cv < 0.25:
            return "Умеренно нерегулярный"
        else:
            return "Выраженно нерегулярный"
    
    def generate_clinical_interpretation(self, hrv_metrics, arrhythmias, morphology, qt_analysis):
        """Генерация клинической интерпретации"""
        interpretation = []
        
        # Анализ ЧСС
        if 'mean_HR' in hrv_metrics:
            hr = hrv_metrics['mean_HR']
            if hr < 60:
                interpretation.append(f"Брадикардия (ЧСС: {hr:.0f} уд/мин)")
            elif hr > 100:
                interpretation.append(f"Тахикардия (ЧСС: {hr:.0f} уд/мин)")
            else:
                interpretation.append(f"Нормокардия (ЧСС: {hr:.0f} уд/мин)")
        
        # Анализ ВСР
        if 'SDNN' in hrv_metrics:
            sdnn = hrv_metrics['SDNN']
            if sdnn < 50:
                interpretation.append("Сниженная вариабельность сердечного ритма")
            elif sdnn > 150:
                interpretation.append("Повышенная вариабельность сердечного ритма")
        
        # Аритмии
        if arrhythmias:
            arrhythmia_types = [arr['type'] for arr in arrhythmias]
            interpretation.append(f"Обнаружены нарушения ритма: {', '.join(set(arrhythmia_types))}")
        
        # QT анализ
        if 'QT_assessment' in qt_analysis:
            if qt_analysis['QT_assessment'] != 'Нормальный':
                interpretation.append(f"QT интервал {qt_analysis['QT_assessment'].lower()}")
        
        if not interpretation:
            interpretation.append("Ритм синусовый, регулярный, без выраженных отклонений")
        
        return interpretation
    
    def generate_recommendations(self, hrv_metrics, arrhythmias, morphology, qt_analysis):
        """Генерация рекомендаций"""
        recommendations = []
        
        # Рекомендации по аритмиям
        severe_arrhythmias = [arr for arr in arrhythmias if arr.get('severity') == 'Выраженная']
        if severe_arrhythmias:
            recommendations.append("Рекомендуется консультация кардиолога в связи с выраженными нарушениями ритма")
        
        # Рекомендации по QT
        if 'QTc' in qt_analysis and qt_analysis['QTc'] > 500:
            recommendations.append("Удлинение QTc требует мониторинга и коррекции терапии")
        
        # Рекомендации по ВСР
        if 'SDNN' in hrv_metrics and hrv_metrics['SDNN'] < 50:
            recommendations.append("Сниженная ВСР может указывать на необходимость оценки вегетативной функции")
        
        if not recommendations:
            recommendations.append("Рекомендуется регулярное наблюдение согласно клиническим показаниям")
        
        return recommendations