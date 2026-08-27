'use client'

import { useState, useRef, useEffect } from 'react'
import { compressMedicalImage, anonymizeMedicalImage } from '@/lib/image-compression'
import ImageEditor from './ImageEditor'
import MobileBridgeInboxPicker from './MobileBridgeInboxPicker'
import { getClientLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'

const FILE_UPLOAD_TEXT = {
  en: {
    fileTooLarge: (name: string, maxSize: number) => `File ${name} is too large. Maximum size: ${maxSize}MB`,
    duplicateFile: (name: string) => `File ${name} is already added`,
    processingError: 'Error while processing files',
    editTitle: 'Open editor for precise anonymization',
    editButton: 'Edit',
    deleteTitle: 'Remove file',
    anonymizeTitle: 'Black out areas with personal data on all images',
    anonymizeButton: 'Anonymize all images',
    anonymizeHint: 'Automatically hides zones with personal data on all uploaded images.',
    optimizing: 'Optimizing files...',
    chooseFiles: 'Choose files',
    chooseFolder: 'Choose folder',
    takePhoto: 'Take photo',
    dragHint: 'or drag a folder with images here',
    supported: 'Supported: DICOM series (.dcm), images (JPG, PNG), PDF, documents',
    maxFileSize: 'Maximum file size:',
    multipleAllowed: '• You can upload multiple files',
    saveError: 'Error saving file in FileUpload:',
  },
  ru: {
    fileTooLarge: (name: string, maxSize: number) => `Файл ${name} слишком большой. Максимальный размер: ${maxSize}MB`,
    duplicateFile: (name: string) => `Файл ${name} уже добавлен`,
    processingError: 'Ошибка при обработке файлов',
    editTitle: 'Открыть редактор для точной анонимизации',
    editButton: 'Редактировать',
    deleteTitle: 'Удалить файл',
    anonymizeTitle: 'Закрасить черным области с персональными данными на всех изображениях',
    anonymizeButton: 'Анонимизировать все изображения',
    anonymizeHint: 'Автоматически скроет зоны с ФИО и персональными данными на всех загруженных снимках.',
    optimizing: 'Оптимизация файлов...',
    chooseFiles: 'Выбрать файлы',
    chooseFolder: 'Выбрать папку',
    takePhoto: 'Сделать фото',
    dragHint: 'или перетащите папку со снимками сюда',
    supported: 'Поддерживаются: DICOM серии (.dcm), изображения (JPG, PNG), PDF, документы',
    maxFileSize: 'Максимальный размер файла:',
    multipleAllowed: '• Можно загрузить несколько файлов',
    saveError: 'Ошибка сохранения файла в FileUpload:',
  },
} as const;

interface FileUploadProps {
  onUpload: (files: File[]) => void
  accept?: string
  maxSize?: number // в MB
  multiple?: boolean
  bridgePullTarget?: string
  anonymizationMode?: 'strict' | 'soft'
}

const BRIDGE_DRAFT_KEYS: Record<string, string> = {
  chat: 'mobile_bridge_chat_draft',
  protocol: 'protocol_draft',
  library: 'mobile_bridge_library_draft',
  clinical_context: 'mobile_bridge_clinical_context_draft',
  image_analysis: 'mobile_bridge_image_analysis_draft',
  ecg_analysis: 'mobile_bridge_ecg_analysis_draft',
  xray_analysis: 'mobile_bridge_xray_analysis_draft',
  ct_analysis: 'mobile_bridge_ct_analysis_draft',
  mri_analysis: 'mobile_bridge_mri_analysis_draft',
  ultrasound_analysis: 'mobile_bridge_ultrasound_analysis_draft',
  lab_analysis: 'mobile_bridge_lab_analysis_draft',
  video_analysis: 'mobile_bridge_video_analysis_draft',
  document_scan: 'mobile_bridge_document_scan_draft',
}

export default function FileUpload({ 
  onUpload, 
  accept = 'image/*,application/pdf,.doc,.docx,.txt,.csv', 
  maxSize = 50,
  multiple = true,
  bridgePullTarget = '',
  anonymizationMode = 'strict',
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewFiles, setPreviewFiles] = useState<Array<{ file: File; preview?: string }>>([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null)
  const [locale, setLocale] = useState<Locale>('en')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const bridgeDraftConsumedRef = useRef(false)

  useEffect(() => {
    setLocale(getClientLocale())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!bridgePullTarget) return
    if (bridgeDraftConsumedRef.current) return
    bridgeDraftConsumedRef.current = true

    const storageKey = BRIDGE_DRAFT_KEYS[bridgePullTarget]
    if (!storageKey || storageKey === 'protocol_draft') return
    const raw = localStorage.getItem(storageKey)
    if (!raw) return

    const inferExt = (mime: string): string => {
      const lower = mime.toLowerCase()
      if (lower.includes('jpeg')) return 'jpg'
      if (lower.includes('png')) return 'png'
      if (lower.includes('webp')) return 'webp'
      if (lower.includes('pdf')) return 'pdf'
      if (lower.startsWith('video/')) return lower.split('/')[1] || 'mp4'
      if (lower.startsWith('text/')) return 'txt'
      return 'bin'
    }

    const makeSafeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'mobile-bridge'

    void (async () => {
      try {
        const payload = JSON.parse(raw) as {
          title?: string
          dataUrl?: string
          mimeType?: string
          text?: string
        }

        let file: File | null = null
        const title = makeSafeName(payload.title || 'mobile-bridge')
        const mime = (payload.mimeType || '').trim()

        if (payload.dataUrl?.startsWith('data:')) {
          const match = payload.dataUrl.match(/^data:(.+?);base64,(.+)$/)
          if (match) {
            const dataMime = match[1] || mime || 'application/octet-stream'
            const binary = atob(match[2])
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
            file = new File([bytes], `${title}.${inferExt(dataMime)}`, { type: dataMime })
          }
        } else if ((payload.text || '').trim()) {
          const finalMime = mime || 'text/plain'
          file = new File([payload.text.trim()], `${title}.${inferExt(finalMime)}`, { type: finalMime })
        }

        if (file) {
          await handleFiles([file])
        }
      } catch {
        // ignore corrupted bridge payload
      } finally {
        localStorage.removeItem(storageKey)
      }
    })()
  }, [bridgePullTarget])

  const t = locale === 'ru' ? FILE_UPLOAD_TEXT.ru : FILE_UPLOAD_TEXT.en

  const handleFiles = async (filesInput: FileList | File[] | null) => {
    if (!filesInput) return
    const files = Array.isArray(filesInput) ? filesInput : Array.from(filesInput)
    if (files.length === 0) return

    setError(null)
    const validFiles: File[] = []
    
    setIsCompressing(true)

    try {
      for (const file of files) {
        // Проверка размера
        if (file.size > maxSize * 1024 * 1024) {
          setError(t.fileTooLarge(file.name, maxSize))
          continue
        }

        // Проверка на дубликаты
        const isDuplicate = previewFiles.some(p => 
          p.file.name === file.name && 
          p.file.size === file.size && 
          p.file.lastModified === file.lastModified
        )
        
        if (isDuplicate) {
          setError(t.duplicateFile(file.name))
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
      setError(t.processingError)
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

          const anonymized = await anonymizeMedicalImage(item.file, anonymizationMode);
          
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
    
    // Мгновенно закрываем редактор
    setEditingFileIndex(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewFiles(prev => {
        const newPreviewFiles = [...prev];
        if (newPreviewFiles[editingFileIndex]) {
          newPreviewFiles[editingFileIndex] = { file: editedFile, preview: result };
        }
        return newPreviewFiles;
      });
      
      // Обновляем родительский компонент после обновления локального стейта
      setPreviewFiles(prev => {
        onUpload(prev.map(item => item.file));
        return prev;
      });
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

  const openBridgeForSection = () => {
    const params = new URLSearchParams()
    if (bridgePullTarget) {
      params.set('pullTarget', bridgePullTarget)
    }
    params.set('focusInbox', '1')
    const suffix = params.toString()
    window.open(`/mobile-bridge${suffix ? `?${suffix}` : ''}`, '_blank')
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
                    title={t.editTitle}
                  >
                    🎨 {t.editButton}
                  </button>
                )}
                <button
                  onClick={() => removeFile(item.file)}
                  className="text-red-500 hover:text-red-700 text-xl"
                  title={t.deleteTitle}
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
                title={t.anonymizeTitle}
              >
                <span>🛡️ {t.anonymizeButton}</span>
              </button>
              <p className="text-xs text-gray-500 mt-2 italic text-center">
                {t.anonymizeHint}
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

        {/* Input для папок */}
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          mozdirectory=""
          directory=""
          onChange={handleChange}
          className="hidden"
          multiple={multiple}
        />
        
        <div className="space-y-3">
          {isCompressing ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              <p className="text-primary-600 font-medium">{t.optimizing}</p>
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
                  📁 {t.chooseFiles}
                </button>

                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                >
                  📂 {t.chooseFolder}
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold"
                >
                  📷 {t.takePhoto}
                </button>
                <MobileBridgeInboxPicker
                  onImport={(filesFromInbox) => {
                    void handleFiles(filesFromInbox)
                  }}
                  accept={accept}
                  multiple={multiple}
                  preferredTarget={bridgePullTarget}
                  buttonClassName="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-semibold"
                />
                <button
                  type="button"
                  onClick={openBridgeForSection}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold"
                >
                  {locale === 'ru' ? '📲 Камера телефона (этот раздел)' : '📲 Phone camera (this section)'}
                </button>
              </div>
              
              <span className="text-gray-600">{t.dragHint}</span>
            </>
          )}
          
          <p className="text-sm text-gray-500">
            {t.supported}
            <br />
            {t.maxFileSize} {maxSize}MB
            {multiple && ` ${t.multipleAllowed}`}
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ {error}
        </div>
      )}

      {editingFileIndex !== null && previewFiles[editingFileIndex] && (
        <ImageEditor
          image={previewFiles[editingFileIndex].preview!}
          onSave={(editedDataUrl) => {
            const targetIndex = editingFileIndex;
            const originalFile = previewFiles[targetIndex].file;
            
            // Мгновенно закрываем редактор
            setEditingFileIndex(null);

            // Обновляем превью сразу
            setPreviewFiles(prev => {
              const updated = [...prev];
              if (updated[targetIndex]) {
                updated[targetIndex] = { ...updated[targetIndex], preview: editedDataUrl };
              }
              return updated;
            });

            // Конвертируем в файл асинхронно
            fetch(editedDataUrl)
              .then(res => res.blob())
              .then(blob => {
                const editedFile = new File([blob], originalFile.name, { type: 'image/jpeg' });
                setPreviewFiles(prev => {
                  const updated = [...prev];
                  if (updated[targetIndex]) {
                    updated[targetIndex] = { ...updated[targetIndex], file: editedFile };
                  }
                  // Оповещаем родителя после обновления файла
                  onUpload(updated.map(item => item.file));
                  return updated;
                });
              })
              .catch(err => console.error(t.saveError, err));
          }}
          onCancel={() => setEditingFileIndex(null)}
        />
      )}
    </div>
  )
}

