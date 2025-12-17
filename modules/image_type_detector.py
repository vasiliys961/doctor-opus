# -*- coding: utf-8 -*-
"""
Детектор типа медицинского изображения
Выделено из medical_ai_analyzer.py для лучшей организации кода
"""

import numpy as np
from typing import Tuple
from .medical_types import ImageType


class ImageTypeDetector:
    """Класс для определения типа медицинского изображения"""
    
    def detect(self, image_array: np.ndarray) -> Tuple[ImageType, float]:
        """Улучшенное автоматическое определение типа медицинского изображения"""
        height, width = image_array.shape[:2]
        aspect_ratio = width / height
        
        # Преобразуем в grayscale для анализа
        if len(image_array.shape) == 3:
            is_color = True
            gray_image = np.mean(image_array, axis=2).astype(np.uint8)
            # Проверяем насыщенность цвета
            rgb_std = np.std(image_array, axis=(0, 1))
            color_variance = np.std(rgb_std)
        else:
            is_color = False
            gray_image = image_array.astype(np.uint8)
            color_variance = 0
        
        # Базовые характеристики изображения
        mean_intensity = np.mean(gray_image)
        intensity_std = np.std(gray_image)
        
        # Анализ краев и текстуры
        gradient_x = np.gradient(gray_image.astype(float), axis=1)
        gradient_y = np.gradient(gray_image.astype(float), axis=0)
        edge_magnitude = np.sqrt(gradient_x**2 + gradient_y**2)
        edge_density = np.mean(edge_magnitude)
        
        # Анализ гистограммы
        hist, bins = np.histogram(gray_image, bins=256, range=(0, 256))
        hist_peaks = []
        for i in range(1, len(hist)-1):
            if hist[i] > hist[i-1] and hist[i] > hist[i+1] and hist[i] > np.max(hist) * 0.1:
                hist_peaks.append(i)
        
        # Выполняем анализы
        has_periodic, periodic_score = self._analyze_periodic_patterns(gray_image, width, height)
        has_bones, bone_score = self._analyze_bone_structures(gray_image, mean_intensity, intensity_std, hist_peaks, width, height, edge_density)
        has_brain, brain_score = self._analyze_brain_structures(gray_image, height, width)
        has_us_pattern, us_score = self._analyze_ultrasound_patterns(gray_image, mean_intensity, intensity_std, width, height)
        
        # Принятие решения с улучшенной логикой
        scores = {}
        
        # ЭКГ: длинный формат + периодические паттерны + монохром + низкая интенсивность
        if (aspect_ratio > 1.5 and not is_color and has_periodic and 
            mean_intensity < 200 and edge_density > 10):
            scores[ImageType.ECG] = 0.85 + periodic_score * 0.15
        elif aspect_ratio > 2.0 and not is_color and edge_density > 15:
            scores[ImageType.ECG] = 0.6
        
        # Рентген: костные структуры + высокий контраст + монохром
        if not is_color and has_bones:
            base_score = 0.8 + bone_score * 0.2
            if len(hist_peaks) >= 2 and intensity_std > 40:
                base_score += 0.15
            if aspect_ratio < 2.0:
                base_score += 0.1
            if max(width, height) > 1000:
                base_score += 0.1
            scores[ImageType.XRAY] = min(base_score, 0.98)
        elif not is_color and intensity_std > 50 and edge_density > 30:
            if max(width, height) > 800:
                scores[ImageType.XRAY] = 0.65
            else:
                scores[ImageType.XRAY] = 0.5
        
        # МРТ/КТ: мозговые структуры + монохром + средняя интенсивность
        if not is_color and has_brain and mean_intensity > 60 and mean_intensity < 200:
            scores[ImageType.MRI] = 0.75 + brain_score * 0.2
        elif not is_color and aspect_ratio < 1.5 and mean_intensity > 80:
            scores[ImageType.CT] = 0.6
        
        # УЗИ: специфические паттерны + монохром + низкая интенсивность
        if not is_color and has_us_pattern:
            scores[ImageType.ULTRASOUND] = 0.7 + us_score * 0.25
        elif not is_color and mean_intensity < 100 and edge_density < 40:
            scores[ImageType.ULTRASOUND] = 0.5
        
        # Дерматоскопия: ТОЛЬКО для цветных изображений
        if is_color and color_variance > 20 and edge_density > 40:
            if max(width, height) < 1500:
                scores[ImageType.DERMATOSCOPY] = 0.75
        
        # Гистология: цветное + очень высокая детализация
        if is_color and edge_density > 80 and color_variance > 30:
            scores[ImageType.HISTOLOGY] = 0.7
        
        # Офтальмология: круглые структуры + средний размер
        if aspect_ratio > 0.8 and aspect_ratio < 1.3:
            if max(width, height) < 1000:
                if is_color:
                    scores[ImageType.RETINAL] = 0.65
                elif not has_bones:
                    scores[ImageType.RETINAL] = 0.4
        
        # Маммография: специфический контраст + монохром + большой размер
        if (not is_color and intensity_std > 35 and mean_intensity > 70 and 
            max(width, height) > 800):
            scores[ImageType.MAMMOGRAPHY] = 0.65
        
        # Выбираем тип с наивысшим скором
        if scores:
            best_type = max(scores.keys(), key=lambda k: scores[k])
            best_score = scores[best_type]
            return best_type, best_score
        
        # Запасной вариант
        if not is_color:
            if aspect_ratio > 2.0:
                return ImageType.ECG, 0.3
            elif intensity_std > 40:
                return ImageType.XRAY, 0.5
            else:
                return ImageType.ULTRASOUND, 0.3
        else:
            return ImageType.DERMATOSCOPY, 0.3
    
    def _analyze_periodic_patterns(self, gray_image: np.ndarray, width: int, height: int) -> Tuple[bool, float]:
        """Анализ периодических паттернов (для ЭКГ)"""
        if width < 200:
            return False, 0
        
        center_row = gray_image[height//2, :]
        autocorr = np.correlate(center_row, center_row, mode='full')
        autocorr = autocorr[len(autocorr)//2:]
        
        if autocorr[0] > 0:
            autocorr = autocorr / autocorr[0]
        
        peaks = []
        min_distance = 20
        for i in range(min_distance, min(len(autocorr), 300)):
            if (i >= min_distance and 
                autocorr[i] > autocorr[i-1] and 
                autocorr[i] > autocorr[i+1] and
                autocorr[i] > 0.3):
                peaks.append(i)
        
        if len(peaks) >= 3:
            intervals = [peaks[i+1] - peaks[i] for i in range(len(peaks)-1)]
            if intervals:
                interval_std = np.std(intervals)
                interval_mean = np.mean(intervals)
                regularity = 1.0 - (interval_std / max(interval_mean, 1))
                return len(peaks) >= 3 and regularity > 0.7, regularity
        
        return False, 0
    
    def _analyze_bone_structures(self, gray_image: np.ndarray, mean_intensity: float, 
                                 intensity_std: float, hist_peaks: list, 
                                 width: int, height: int, edge_density: float) -> Tuple[bool, float]:
        """Анализ костных структур (для рентгена)"""
        high_density_threshold = mean_intensity + 1.5 * intensity_std
        bone_pixels = np.sum(gray_image > high_density_threshold)
        bone_ratio = bone_pixels / (width * height)
        contrast_ratio = intensity_std / max(mean_intensity, 1)
        
        sobel_h = np.abs(np.gradient(gray_image, axis=0))
        sobel_v = np.abs(np.gradient(gray_image, axis=1))
        strong_edges = np.sum((sobel_h > np.mean(sobel_h) + np.std(sobel_h)) | 
                             (sobel_v > np.mean(sobel_v) + np.std(sobel_v)))
        edge_ratio = strong_edges / (width * height)
        hist_diversity = len(hist_peaks)
        
        bone_score = (bone_ratio * 2 + contrast_ratio + edge_ratio + hist_diversity/10) / 4
        return bone_score > 0.15, bone_score
    
    def _analyze_brain_structures(self, gray_image: np.ndarray, height: int, width: int) -> Tuple[bool, float]:
        """Анализ мозговых структур (для МРТ/КТ)"""
        center_y, center_x = height//2, width//2
        center_size = min(height, width) // 4
        
        if center_size > 0:
            center_region = gray_image[max(0, center_y-center_size):min(height, center_y+center_size),
                                      max(0, center_x-center_size):min(width, center_x+center_size)]
            
            if center_region.size > 0:
                center_mean = np.mean(center_region)
                center_std = np.std(center_region)
                
                if center_region.shape[0] > 20 and center_region.shape[1] > 20:
                    h, w = center_region.shape
                    top_half = center_region[:h//2, :]
                    bottom_half = center_region[h//2:, :]
                    bottom_half_flipped = np.flipud(bottom_half)
                    
                    if top_half.shape == bottom_half_flipped.shape:
                        symmetry_score = 1.0 - np.mean(np.abs(top_half.astype(float) - bottom_half_flipped.astype(float))) / 255.0
                    else:
                        symmetry_score = 0
                    
                    brain_score = (symmetry_score + min(center_std/50, 1) + min(center_mean/128, 1)) / 3
                    return brain_score > 0.4, brain_score
        
        return False, 0
    
    def _analyze_ultrasound_patterns(self, gray_image: np.ndarray, mean_intensity: float,
                                     intensity_std: float, width: int, height: int) -> Tuple[bool, float]:
        """Анализ УЗИ паттернов"""
        dark_threshold = mean_intensity - 0.5 * intensity_std
        dark_pixels = np.sum(gray_image < dark_threshold)
        dark_ratio = dark_pixels / (width * height)
        
        edge_darkness = (np.mean(gray_image[:, :10]) + np.mean(gray_image[:, -10:]) + 
                       np.mean(gray_image[:10, :]) + np.mean(gray_image[-10:, :])) / 4
        edge_contrast = (mean_intensity - edge_darkness) / max(mean_intensity, 1)
        
        us_score = (dark_ratio + edge_contrast + min(intensity_std/40, 1)) / 3
        return us_score > 0.4 and mean_intensity < 120, us_score
