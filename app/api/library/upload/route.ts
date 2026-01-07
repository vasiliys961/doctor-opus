import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execPromise = promisify(exec);

export const maxDuration = 300; // 5 минут для больших файлов

/**
 * API для извлечения текста из PDF (локальная обработка на сервере)
 */
export async function POST(request: NextRequest) {
  const tempPdfPath = path.join(os.tmpdir(), `pdf_in_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`);
  const tempJsonPath = path.join(os.tmpdir(), `pdf_out_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Файл не получен' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Только PDF файлы поддерживаются' }, { status: 400 });
    }

    // 1. Сохраняем во временный PDF файл
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPdfPath, buffer);

    try {
      // 2. Пути к скрипту и Python
      const scriptPath = path.join(process.cwd(), 'scripts', 'extract_pdf_text.py');
      
      let pythonCmd = 'python3';
      const venvPath = process.platform === 'win32'
        ? path.join(process.cwd(), 'venv', 'Scripts', 'python.exe')
        : path.join(process.cwd(), 'venv', 'bin', 'python3');
      
      try {
        await fs.access(venvPath);
        pythonCmd = venvPath;
      } catch {
        if (process.platform === 'win32') pythonCmd = 'python';
      }
      
      // 3. Вызываем Python-скрипт. Результат пойдет в tempJsonPath
      // Мы НЕ используем stdout для передачи данных, чтобы избежать RangeError
      await execPromise(`"${pythonCmd}" "${scriptPath}" "${tempPdfPath}" "${tempJsonPath}"`);
      
      // 4. Читаем результат из JSON файла
      const jsonContent = await fs.readFile(tempJsonPath, 'utf-8');
      const result = JSON.parse(jsonContent);

      if (!result.success) {
        throw new Error(result.error || 'Ошибка при извлечении текста');
      }

      return NextResponse.json({
        success: true,
        data: {
          name: file.name,
          size: file.size,
          chunks: result.chunks,
          uploaded_at: new Date().toISOString()
        }
      });

    } catch (execError: any) {
      console.error('Python execution error:', execError);
      return NextResponse.json({ 
        success: false, 
        error: execError.message || 'Ошибка при обработке PDF на сервере' 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Ошибка сервера' 
    }, { status: 500 });
  } finally {
    // 5. Всегда удаляем временные файлы
    await Promise.all([
      fs.unlink(tempPdfPath).catch(() => {}),
      fs.unlink(tempJsonPath).catch(() => {})
    ]);
  }
}
