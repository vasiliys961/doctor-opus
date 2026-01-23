'use client'

import { useState, useRef } from 'react'
import { compressMedicalImage, anonymizeMedicalImage } from '@/lib/image-compression'
import ImageEditor from './ImageEditor'

interface FileUploadProps {
  onUpload: (files: File[]) => void
  accept?: string
  maxSize?: number // в MB
  multiple?: boolean
}

export default function FileUpload({ 
  onUpload, 
  accept = 'image/*,application/pdf,.doc,.docx,.txt,.csv', 
  maxSize = 50,
  multiple = true 
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewFiles, setPreviewFiles] = useState<Array<{ file: File; preview?: string }>>([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setError(null)
    const validFiles: File[] = []
    
    setIsCompressing(true)

    try {
      for (const file of Array.from(files)) {
        // Проверка размера
        if (file.size > maxSize * 1024 * 1024) {
          setError(`Файл ${file.name} слишком большой. Максимальный размер: ${maxSize}MB`)
          continue
        }

        // Проверка на дубликаты
        const isDuplicate = previewFiles.some(p => 
          p.file.name === file.name && 
          p.file.size === file.size && 
          p.file.lastModified === file.lastModified
        )
        
        if (isDuplicate) {
          setError(`Файл ${file.name} уже добавлен`)
          continue
        }

        // Сжатие если это изображение
        let processedFile = file
        if (file.type.startsWith('image/')) {
          processedFile = await compressMedicalImage(file)
        }

        validFiles.push(processedFile)

        // Создание превью
        if (processedFile.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onloadend = () => {
            const preview = reader.result as string
            setPreviewFiles(prev => {
              const existing = prev.find(p => 
                p.file.name === processedFile.name && 
                p.file.size === processedFile.size
              )
              if (existing) {
                return prev.map(p => 
                  p.file.name === processedFile.name && p.file.size === processedFile.size
                    ? { ...p, preview }
                    : p
                )
              }
              return [...prev, { file: processedFile, preview }]
            })
          }
          reader.readAsDataURL(processedFile)
        } else {
          setPreviewFiles(prev => [...prev, { file: processedFile }])
        }
      }
    } catch (err) {
      console.error("Processing error:", err)
      setError("Ошибка при обработке файлов")
    } finally {
      setIsCompressing(false)
    }

    if (validFiles.length > 0) {
      onUpload(validFiles)
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
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const removeFile = (fileToRemove: File) => {
    setPreviewFiles(prev => prev.filter(p => p.file !== fileToRemove))
  }

  const anonymizeAllImages = async () => {
    setIsCompressing(true);
    try {
      const newPreviewFiles = await Promise.all(
        previewFiles.map(async (item) => {
          // Анонимизируем только изображения
          if (!item.file.type.startsWith('image/')) {
            return item;
          }

          const anonymized = await anonymizeMedicalImage(item.file);
          
          // Обновляем превью
          return new Promise<{ file: File; preview?: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({ file: anonymized, preview: reader.result as string });
            };
            reader.readAsDataURL(anonymized);
          });
        })
      );

      setPreviewFiles(newPreviewFiles);
      
      // Обновляем файлы в родительском компоненте
      const updatedFiles = newPreviewFiles.map(item => item.file);
      onUpload(updatedFiles);
    } catch (err) {
      console.error("Anonymization error:", err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleEditorSave = (editedFile: File) => {
    if (editingFileIndex === null) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newPreviewFiles = previewFiles.map((item, idx) =>
        idx === editingFileIndex
          ? { file: editedFile, preview: reader.result as string }
          : item
      );
      setPreviewFiles(newPreviewFiles);
      onUpload(newPreviewFiles.map(item => item.file));
      setEditingFileIndex(null);
    };
    reader.readAsDataURL(editedFile);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return '🖼️'
    if (file.type === 'application/pdf') return '📄'
    if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) return '📝'
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) return '📃'
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) return '📊'
    return '📁'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="w-full">
      {previewFiles.length > 0 && (
        <div className="mb-4 space-y-3">
          {previewFiles.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              {item.preview ? (
                <img
                  src={item.preview}
                  alt={item.file.name}
                  className="w-16 h-16 object-cover rounded"
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded text-2xl">
                  {getFileIcon(item.file)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.file.name}</div>
                <div className="text-xs text-gray-500">{formatFileSize(item.file.size)}</div>
              </div>
              <div className="flex gap-2">
                {item.file.type.startsWith('image/') && item.preview && (
                  <button
                    onClick={() => setEditingFileIndex(idx)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2"
                    title="Открыть редактор для точной анонимизации"
                  >
                    🎨 Редактировать
                  </button>
                )}
                <button
                  onClick={() => removeFile(item.file)}
                  className="text-red-500 hover:text-red-700 text-xl"
                  title="Удалить файл"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          
          {/* Кнопка анонимизации для всех изображений */}
          {previewFiles.some(item => item.file.type.startsWith('image/')) && (
            <div className="pt-2">
              <button
                onClick={anonymizeAllImages}
                disabled={isCompressing}
                className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Закрасить черным области с персональными данными на всех изображениях"
              >
                <span>🛡️ Анонимизировать все изображения</span>
              </button>
              <p className="text-xs text-gray-500 mt-2 italic text-center">
                Автоматически скроет зоны с ФИО и персональными данными на всех загруженных снимках. 
                Защита по ФЗ-152.
              </p>
            </div>
          )}
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Обычный input для выбора файлов */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          multiple={multiple}
        />
        
        {/* Input для камеры (только изображения) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="space-y-3">
          {isCompressing ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              <p className="text-primary-600 font-medium">Оптимизация файлов...</p>
            </div>
          ) : (
            <>
              <div className="text-4xl">📎</div>
              
              {/* Кнопки для загрузки */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold"
                >
                  📁 Выбрать файлы
                </button>
                
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold"
                >
                  📷 Сделать фото
                </button>
              </div>
              
              <span className="text-gray-600">или перетащите файлы сюда</span>
            </>
          )}
          
          <p className="text-sm text-gray-500">
            Поддерживаемые форматы: изображения (JPG, PNG), PDF, документы (DOC, DOCX), текстовые файлы (TXT, CSV)
            <br />
            Максимальный размер файла: {maxSize}MB
            {multiple && ' • Можно загрузить несколько файлов'}
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ {error}
        </div>
      )}

      {/* Редактор для ручной анонимизации */}
      {editingFileIndex !== null && previewFiles[editingFileIndex] && (
        <ImageEditor
          imageSrc={previewFiles[editingFileIndex].preview!}
          fileName={previewFiles[editingFileIndex].file.name}
          mimeType={previewFiles[editingFileIndex].file.type}
          onSave={handleEditorSave}
          onCancel={() => setEditingFileIndex(null)}
        />
      )}
    </div>
  )
}

