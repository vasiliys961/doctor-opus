/**
 * Утилиты для предварительной проверки медицинских изображений в браузере.
 * Помогает сэкономить токены, предупреждая врача о низком качестве снимка до отправки.
 */

export interface ImageValidationResult {
  isValid: boolean;
  score: number;
  warnings: string[];
}

export async function validateMedicalImage(file: File): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ isValid: true, score: 100, warnings: [] });
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let brightness = 0;
        let contrast = 0;
        const pixelCount = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Стандартная формула яркости
          brightness += (0.299 * r + 0.587 * g + 0.114 * b);
        }

        const avgBrightness = brightness / pixelCount;
        const warnings: string[] = [];
        let score = 100;

        // 1. Проверка на слишком темный снимок (актуально для рентгена/УЗИ)
        if (avgBrightness < 30) {
          warnings.push('⚠️ Снимок слишком темный. Это может снизить точность анализа.');
          score -= 30;
        }

        // 2. Проверка на слишком светлый снимок (пересвет)
        if (avgBrightness > 220) {
          warnings.push('⚠️ Снимок пересвечен. Детали могут быть потеряны.');
          score -= 30;
        }

        // 3. Базовая проверка разрешения
        if (img.width < 512 || img.height < 512) {
          warnings.push('⚠️ Низкое разрешение снимка. Рекомендуется минимум 1024px.');
          score -= 20;
        }

        resolve({
          isValid: score > 40,
          score,
          warnings
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}



