'use client'

import { useState, useRef } from 'react'
import { compressMedicalImage } from '@/lib/image-compression'

interface ImageUploadProps {
  onUpload: (file: File, additionalFiles?: File[]) => void
  accept?: string
  maxSize?: number // в MB
}

export default function ImageUpload({ onUpload, accept = 'image/*,.dcm,.dicom', maxSize = 500 }: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (input: File | FileList | File[]) => {
    setError(null)
    
    // 1. Обработка группы файлов (папка или множественный выбор)
    if (input instanceof FileList || Array.isArray(input)) {
      const files = Array.from(input).filter(f => f !== undefined);
      if (files.length === 0) return;

      // Ищем DICOM файлы
      const dicomFiles = files.filter(f => 
        f.name?.toLowerCase().endsWith('.dcm') || 
        f.name?.toLowerCase().endsWith('.dicom') ||
        f.type === 'application/dicom'
      );

      if (dicomFiles.length > 0) {
        setIsCompressing(true);
        try {
          dicomFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
          
          const { sliceDicomFolder } = await import('@/lib/dicom-client-processor');
          const selectedFiles = await sliceDicomFolder(dicomFiles);

          if (selectedFiles && selectedFiles.length > 0) {
            console.log(`✅ [FolderUpload] Конвертировано ${selectedFiles.length} срезов`);
            const mainFile = selectedFiles[Math.floor(selectedFiles.length / 2)];
            onUpload(mainFile, selectedFiles);
            setIsCompressing(false);
            return;
          }
        } catch (err: any) {
          console.error("Folder processing error:", err);
          setError(`Ошибка при обработке папки: ${err.message}`);
        } finally {
          setIsCompressing(false);
        }
        return;
      }

      // Если DICOM не нашли, берем первое попавшееся изображение
      const firstImage = files.find(f => f.type?.startsWith('image/'));
      if (firstImage) {
        handleFile(firstImage);
        return;
      }
      
      setError("В папке не найдено подходящих файлов (DICOM или изображения)");
      return;
    }

    // 2. Обработка одиночного файла
    const file = input as File;
    if (!file || !file.name) return;

    if (file.size > maxSize * 1024 * 1024) {
      setError(`Файл слишком большой. Максимальный размер: ${maxSize}MB`)
      return
    }

    const fileName = file.name.toLowerCase();
    const isDicom = fileName.endsWith('.dcm') || fileName.endsWith('.dicom') || file.type === 'application/dicom';
    const isImage = file.type.startsWith('image/');

    if (isImage) {
      setIsCompressing(true);
      try {
        const fileToUpload = await compressMedicalImage(file);
        const reader = new FileReader()
        reader.onloadend = () => setPreview(reader.result as string)
        reader.readAsDataURL(fileToUpload)
        onUpload(fileToUpload)
      } catch (err) {
        console.error("Compression error:", err);
        onUpload(file);
      } finally {
        setIsCompressing(false);
      }
    } else if (isDicom) {
      setPreview(null) 
      if (file.size > 30 * 1024 * 1024) {
        setIsCompressing(true);
        try {
          const { sliceDicomFile } = await import('@/lib/dicom-client-processor');
          const slices = await sliceDicomFile(file);
          if (slices && slices.length > 0) {
            onUpload(file, slices);
          } else {
            onUpload(file);
          }
        } catch (err) {
          console.error("DICOM Slicing error:", err);
          onUpload(file);
        } finally {
          setIsCompressing(false);
        }
      } else {
        onUpload(file);
      }
    } else {
      setPreview(null);
      onUpload(file);
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        handleFile(e.dataTransfer.files)
      } else {
        handleFile(e.dataTransfer.files[0])
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  return (
    <div className="w-full">
      {preview && (
        <div className="mb-4">
          <img 
            src={preview} 
            alt="Превью загруженного файла" 
            className="max-w-full h-auto rounded-lg border-2 border-gray-300 max-h-96 mx-auto"
          />
        </div>
      )}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          mozdirectory=""
          directory=""
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files);
            }
          }}
          className="hidden"
        />
        <div className="space-y-4">
          {isCompressing ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              <p className="text-primary-600 font-medium">Обработка данных...</p>
            </div>
          ) : (
            <>
              <div className="text-4xl">📁</div>
              <div className="flex flex-col space-y-2">
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary-600 hover:text-primary-700 font-semibold underline"
                  >
                    Выберите файл
                  </button>
                  <span className="text-gray-600"> или </span>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="text-primary-600 hover:text-primary-700 font-semibold underline"
                  >
                    папку целиком
                  </button>
                </div>
                <div className="text-gray-500 text-sm italic">или просто перетащите сюда</div>
              </div>
            </>
          )}
          <p className="text-sm text-gray-500">
            Поддерживаются: DICOM (серии), JPG, PNG, PDF
            <br />
            Макс. размер файла: {maxSize}MB
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  )
}

