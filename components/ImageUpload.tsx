'use client'

import { useState, useRef } from 'react'
import { compressMedicalImage, anonymizeMedicalImage } from '@/lib/image-compression'
import ImageEditor from './ImageEditor'

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
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleAnonymize = async () => {
    if (!currentFile) return;
    setIsCompressing(true);
    try {
      const anonymized = await anonymizeMedicalImage(currentFile);
      setCurrentFile(anonymized);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(anonymized);
      onUpload(anonymized); // Обновляем файл в родительском компоненте
    } catch (err) {
      console.error("Anonymization error:", err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleEditorSave = (editedFile: File) => {
    setCurrentFile(editedFile);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(editedFile);
    onUpload(editedFile);
    setIsEditorOpen(false);
  };

  const handleFile = async (input: File | FileList | File[]) => {
    setError(null)
    
    // 1. Обработка группы файлов (FileList или массив) - например, при загрузке папки
    if (input instanceof FileList || Array.isArray(input)) {
      const files = Array.from(input);
      const dicomFiles = files.filter(f => 
        f.name.toLowerCase().endsWith('.dcm') || 
        f.name.toLowerCase().endsWith('.dicom') || 
        f.type === 'application/dicom'
      );

      if (dicomFiles.length > 0) {
        setIsCompressing(true);
        try {
          const { sliceDicomFolder } = await import('@/lib/dicom-client-processor');
          // Берем первый DICOM как основной файл для метаданных, а остальные как срезы
          const slices = await sliceDicomFolder(dicomFiles);
          if (slices && slices.length > 0) {
            onUpload(dicomFiles[0], slices);
            setCurrentFile(dicomFiles[0]);
            setPreview(null);
          } else {
            onUpload(dicomFiles[0]);
          }
        } catch (err) {
          console.error("DICOM Folder Slicing error:", err);
          onUpload(dicomFiles[0]);
        } finally {
          setIsCompressing(false);
        }
        return;
      } else if (files.length > 0) {
        // Если это не DICOM, просто берем первый файл
        return handleFile(files[0]);
      }
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
        setCurrentFile(fileToUpload);
        const reader = new FileReader()
        reader.onloadend = () => setPreview(reader.result as string)
        reader.readAsDataURL(fileToUpload)
        onUpload(fileToUpload)
      } catch (err) {
        console.error("Compression error:", err);
        setCurrentFile(file);
        onUpload(file);
      } finally {
        setIsCompressing(false);
      }
    } else if (isDicom) {
      setCurrentFile(file);
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
        <div className="mb-4 text-center">
          <div className="relative inline-block">
            <img 
              src={preview} 
              alt="Превью загруженного файла" 
              className="max-w-full h-auto rounded-lg border-2 border-gray-300 max-h-96 mx-auto"
            />
            <div className="mt-2 flex gap-2 w-full">
              <button
                onClick={handleAnonymize}
                disabled={isCompressing}
                className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-lg disabled:opacity-50"
                title="Автоматически закрасить стандартные зоны (края и углы)"
              >
                <span>🛡️ Быстрая анонимизация</span>
              </button>
              <button
                onClick={() => setIsEditorOpen(true)}
                disabled={isCompressing}
                className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium shadow-lg disabled:opacity-50"
                title="Открыть редактор для точного закрашивания вручную"
              >
                <span>🎨 Точная анонимизация</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            <strong>Быстрая:</strong> автоматически скрывает края и углы. 
            <strong>Точная:</strong> позволяет вручную закрасить любые области с персональными данными.
          </p>
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

      {/* Редактор для ручной анонимизации */}
      {isEditorOpen && preview && currentFile && (
        <ImageEditor
          imageSrc={preview}
          fileName={currentFile.name}
          mimeType={currentFile.type}
          onSave={handleEditorSave}
          onCancel={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  )
}

