'use client'

import { useState, useRef } from 'react'
import JSZip from 'jszip'
import { compressMedicalImage, anonymizeMedicalImage } from '@/lib/image-compression'
import ImageEditor from './ImageEditor'
import MobileBridgeInboxPicker from './MobileBridgeInboxPicker'

interface DrawingPath {
  points: Array<{ x: number; y: number }>
  brushSize: number
}

interface ImageUploadProps {
  onUpload: (file: File, additionalFiles?: File[], originalFiles?: File[]) => void
  accept?: string
  maxSize?: number // в MB
  bridgePullTarget?: string
}

export default function ImageUpload({
  onUpload,
  accept = 'image/*,.dcm,.dicom',
  maxSize = 500,
  bridgePullTarget = '',
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]) // Дополнительные файлы для пакетной анонимизации
  const additionalFilesRef = useRef<File[]>([]) // Ref для немедленного доступа
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

  const handleEditorSave = async (editedFile: File) => {
    setCurrentFile(editedFile);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(editedFile);
    onUpload(editedFile, additionalFiles.length > 0 ? additionalFiles : undefined);
    setIsEditorOpen(false);
  };

  // Применяем пути рисования ко всем дополнительным файлам
  const applyDrawingPathsToAllFiles = async (
    originalImage: string,
    drawingPaths: DrawingPath[],
    files: File[]
  ): Promise<File[]> => {
    const processedFiles: File[] = [];

    for (const file of files) {
      try {
        // Читаем файл как Data URL
        const fileDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Ошибка чтения файла'));
          reader.readAsDataURL(file);
        });

        // Загружаем изображение
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Таймаут загрузки')), 10000);
          img.onload = () => { clearTimeout(timeout); resolve(); };
          img.onerror = () => { clearTimeout(timeout); reject(new Error('Ошибка загрузки')); };
          img.src = fileDataUrl;
        });

        // Рисуем на canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Не удалось получить контекст canvas');

        ctx.drawImage(img, 0, 0);

        // Применяем все пути рисования
        for (const path of drawingPaths) {
          ctx.lineWidth = path.brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'black';
          if (path.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
              ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
          }
        }

        // Сохраняем результат
        const resultBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Не удалось создать blob')),
            'image/jpeg', 0.85
          );
        });
        
        processedFiles.push(new File([resultBlob], file.name, { type: 'image/jpeg' }));
      } catch (err) {
        console.error(`Ошибка обработки ${file.name}:`, err);
        processedFiles.push(file);
      }
    }

    return processedFiles;
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
          const slices = await sliceDicomFolder(dicomFiles);
          if (slices && slices.length > 0) {
            const additionalSlices = slices.slice(1);
            setAdditionalFiles(additionalSlices); // Сохраняем остальные срезы для пакетной анонимизации
            additionalFilesRef.current = additionalSlices; // Синхронный доступ
            // Передаём первый JPEG-срез как основной файл (для превью и анонимизации)
            onUpload(slices[0], slices, dicomFiles);
            setCurrentFile(slices[0]); // Устанавливаем конвертированный JPEG, не сырой DICOM
            
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(slices[0]);
          } else {
            onUpload(dicomFiles[0], [], dicomFiles);
          }
        } catch (err) {
          console.error("DICOM Folder Slicing error:", err);
          onUpload(dicomFiles[0]);
        } finally {
          setIsCompressing(false);
        }
        return;
      }

      // Проверка на видео-файлы
      const videoFiles = files.filter(f => f.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        setIsCompressing(true);
        try {
          const { extractAndAnonymizeFrames } = await import('@/lib/video-frame-extractor');
          const frames = await extractAndAnonymizeFrames(videoFiles[0]);
          const frameFiles = frames.map(f => f.file);
          if (frameFiles.length > 0) {
            const additionalFrames = frameFiles.slice(1);
            setAdditionalFiles(additionalFrames); // Сохраняем остальные кадры
            additionalFilesRef.current = additionalFrames; // Синхронный доступ
            onUpload(frameFiles[0], [], frameFiles);
            setCurrentFile(videoFiles[0]);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(frameFiles[0]);
          }
        } catch (err) {
          console.error("Video processing in MRI error:", err);
        } finally {
          setIsCompressing(false);
        }
        return;
      }

      if (files.length > 1) {
        // Если это несколько изображений
        const imageFiles = files.filter(f => f.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name));
        if (imageFiles.length > 0) {
          const additionalImages = imageFiles.slice(1);
          setAdditionalFiles(additionalImages); // Сохраняем остальные изображения
          additionalFilesRef.current = additionalImages; // Синхронный доступ
          setCurrentFile(imageFiles[0]);
          const reader = new FileReader();
          reader.onloadend = () => setPreview(reader.result as string);
          reader.readAsDataURL(imageFiles[0]);
          onUpload(imageFiles[0], [], imageFiles);
          return;
        }
      } else if (files.length > 0) {
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
    const isZip = fileName.endsWith('.zip');
    const isDicom = fileName.endsWith('.dcm') || fileName.endsWith('.dicom') || file.type === 'application/dicom';
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (isZip) {
      setIsCompressing(true);
      try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const extractedFiles: File[] = [];
        
        const promises = Object.keys(contents.files).map(async (path) => {
          const zipFile = contents.files[path];
          if (!zipFile.dir) {
            const blob = await zipFile.async('blob');
            const name = path.split('/').pop() || 'file';
            extractedFiles.push(new File([blob], name));
          }
        });
        
        await Promise.all(promises);
        if (extractedFiles.length > 0) {
          return handleFile(extractedFiles);
        }
      } catch (err) {
        console.error("ZIP processing error:", err);
        setError("Ошибка при распаковке архива");
      } finally {
        setIsCompressing(false);
      }
      return;
    }

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
      setIsCompressing(true);
      try {
        const { sliceDicomFile } = await import('@/lib/dicom-client-processor');
        const slices = await sliceDicomFile(file);
        if (slices && slices.length > 0) {
          onUpload(file, slices, [file]);
          // Устанавливаем превью из первого среза
          const reader = new FileReader();
          reader.onloadend = () => setPreview(reader.result as string);
          reader.readAsDataURL(slices[0]);
        } else {
          onUpload(file, [], [file]);
          setPreview(null);
        }
      } catch (err) {
        console.error("DICOM Slicing error:", err);
        onUpload(file, [], [file]);
        setPreview(null);
      } finally {
        setIsCompressing(false);
      }
    } else if (isVideo) {
      setIsCompressing(true);
      try {
        const { extractAndAnonymizeFrames } = await import('@/lib/video-frame-extractor');
        const frames = await extractAndAnonymizeFrames(file);
        const frameFiles = frames.map(f => f.file);
        if (frameFiles.length > 0) {
          const additionalFrames = frameFiles.slice(1);
          setAdditionalFiles(additionalFrames);
          additionalFilesRef.current = additionalFrames;
          setCurrentFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setPreview(reader.result as string);
          reader.readAsDataURL(frameFiles[0]);
          onUpload(frameFiles[0], [], [file, ...frameFiles]);
        }
      } catch (err) {
        console.error("❌ Video processing error:", err);
        onUpload(file, [], [file]);
      } finally {
        setIsCompressing(false);
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
                <div>
                  <span className="inline-block">
                    <MobileBridgeInboxPicker
                      onImport={(filesFromInbox) => {
                        void handleFile(filesFromInbox);
                      }}
                      accept={accept}
                      multiple={true}
                      preferredTarget={bridgePullTarget}
                      buttonClassName="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                    />
                  </span>
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

      {isEditorOpen && preview && currentFile && (
        <ImageEditor
          image={preview}
          hasAdditionalFiles={additionalFilesRef.current.length > 0}
          onSave={async (editedDataUrl, drawingPaths) => {
            const filesCount = additionalFilesRef.current.length;
            setIsCompressing(true);
            try {
              // Конвертация data URL в File без fetch (обход CSP)
              const byteString = atob(editedDataUrl.split(',')[1]);
              const mimeString = editedDataUrl.split(',')[0].split(':')[1].split(';')[0];
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const blob = new Blob([ab], { type: mimeString });
              const editedFile = new File([blob], currentFile.name, { type: 'image/jpeg' });
              
              setCurrentFile(editedFile);
              setPreview(editedDataUrl);
              
              // Если есть пути рисования и дополнительные файлы, применяем маску ко всем
              if (drawingPaths && filesCount > 0) {
                const processedFiles = await applyDrawingPathsToAllFiles(
                  editedDataUrl,
                  drawingPaths,
                  additionalFilesRef.current
                );
                const allProcessedFiles = [editedFile, ...processedFiles];
                onUpload(editedFile, [], allProcessedFiles);
              } else {
                onUpload(editedFile, [], filesCount > 0 ? [editedFile, ...additionalFilesRef.current] : undefined);
              }
            } catch (err) {
              console.error('Ошибка при обработке файлов:', err);
              alert(`Ошибка при сохранении: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`);
            } finally {
              setIsCompressing(false);
              setIsEditorOpen(false);
            }
          }}
          onCancel={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  )
}

