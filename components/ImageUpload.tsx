'use client'

import { useEffect, useState, useRef } from 'react'
import JSZip from 'jszip'
import { compressMedicalImage, anonymizeMedicalImage } from '@/lib/image-compression'
import ImageEditor from './ImageEditor'
import MobileBridgeInboxPicker from './MobileBridgeInboxPicker'
import { getClientLocale } from '@/lib/i18n/client'
import { uploadComponentMessages } from '@/lib/i18n/ui-client-messages'
import type { Locale } from '@/lib/i18n/config'

interface DrawingPath {
  points: Array<{ x: number; y: number }>
  brushSize: number
}

interface ImageUploadProps {
  onUpload: (file: File, additionalFiles?: File[], originalFiles?: File[]) => void
  accept?: string
  maxSize?: number // in MB
  anonymizationMode?: 'strict' | 'soft'
  bridgePullTarget?: string
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

export default function ImageUpload({
  onUpload,
  accept = 'image/*,.dcm,.dicom',
  maxSize = 500,
  anonymizationMode = 'strict',
  bridgePullTarget = '',
}: ImageUploadProps) {
  const [locale, setLocale] = useState<Locale>('en')
  const t = uploadComponentMessages[locale]
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]) // Дополнительные файлы для пакетной анонимизации
  const additionalFilesRef = useRef<File[]>([]) // Ref для немедленного доступа
  const bridgeDraftConsumedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const acceptedRules = accept
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  const acceptsDicom = acceptedRules.some(
    (rule) => rule === '.dcm' || rule === '.dicom' || rule === 'application/dicom'
  )

  const isLikelyDicomFile = async (file: File): Promise<boolean> => {
    const fileName = (file.name || '').toLowerCase()
    const fileType = (file.type || '').toLowerCase()
    if (fileName.endsWith('.dcm') || fileName.endsWith('.dicom')) return true
    if (fileType === 'application/dicom') return true

    try {
      const header = new Uint8Array(await file.slice(0, 512).arrayBuffer())
      if (header.length >= 132) {
        const signature = String.fromCharCode(...Array.from(header.slice(128, 132)))
        if (signature === 'DICM') return true
      }
      if (header.length >= 2) {
        const littleEndianGroup = header[0] | (header[1] << 8)
        const bigEndianGroup = (header[0] << 8) | header[1]
        if (
          littleEndianGroup === 0x0002 ||
          littleEndianGroup === 0x0008 ||
          bigEndianGroup === 0x0002 ||
          bigEndianGroup === 0x0008
        ) return true
      }
    } catch (e) {
      console.warn('Cannot inspect DICOM signature:', e)
    }
    return false
  }

  const isFileAccepted = async (file: File, dicomLike?: boolean): Promise<boolean> => {
    if (acceptedRules.length === 0) return true
    const fileName = (file.name || '').toLowerCase()
    const fileType = (file.type || '').toLowerCase()
    const matchedByRule = acceptedRules.some((rule) => {
      if (rule === '*/*') return true
      if (rule.startsWith('.')) return fileName.endsWith(rule)
      if (rule.endsWith('/*')) return fileType.startsWith(rule.slice(0, -1))
      return fileType === rule
    })
    if (matchedByRule) return true
    if (!acceptsDicom) return false
    if (typeof dicomLike === 'boolean') return dicomLike
    return await isLikelyDicomFile(file)
  }

  const showUnsupportedFormatError = () => {
    const readableFormats = acceptedRules.join(', ') || 'image/*'
    setError(`Unsupported format for this section. Allowed: ${readableFormats}`)
  }

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
          await handleFile(file)
        }
      } catch {
        // ignore corrupted bridge payload
      } finally {
        localStorage.removeItem(storageKey)
      }
    })()
  }, [bridgePullTarget])

  const handleAnonymize = async () => {
    if (!currentFile) return;
    setIsCompressing(true);
    try {
      const anonymized = await anonymizeMedicalImage(currentFile, anonymizationMode);
      setCurrentFile(anonymized);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(anonymized);
      onUpload(anonymized);
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

  // Apply drawing paths to all additional files
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
          reader.onerror = () => reject(new Error('File read error'));
          reader.readAsDataURL(file);
        });

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Load timeout')), 10000);
          img.onload = () => { clearTimeout(timeout); resolve(); };
          img.onerror = () => { clearTimeout(timeout); reject(new Error('Load error')); };
          img.src = fileDataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

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
            (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
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
    
    if (input instanceof FileList || Array.isArray(input)) {
      const files = Array.from(input);
      const inspected = await Promise.all(
        files.map(async (file) => {
          const dicomLike = acceptsDicom ? await isLikelyDicomFile(file) : false
          const accepted = await isFileAccepted(file, dicomLike)
          return { file, accepted, dicomLike }
        })
      )
      const allowedFiles = inspected.filter((entry) => entry.accepted).map((entry) => entry.file)
      if (allowedFiles.length === 0) {
        showUnsupportedFormatError()
        return
      }
      const dicomFiles = inspected.filter((entry) => entry.dicomLike && entry.accepted).map((entry) => entry.file)

      if (dicomFiles.length > 0) {
        setIsCompressing(true);
        try {
          const { sliceDicomFolder } = await import('@/lib/dicom-client-processor');
          const slices = await sliceDicomFolder(dicomFiles);
          if (slices && slices.length > 0) {
            const additionalSlices = slices.slice(1);
            setAdditionalFiles(additionalSlices);
            additionalFilesRef.current = additionalSlices;
            onUpload(slices[0], slices, dicomFiles);
            setCurrentFile(slices[0]);
            
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

      const videoFiles = allowedFiles.filter(f => f.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        setIsCompressing(true);
        try {
          const { extractAndAnonymizeFrames } = await import('@/lib/video-frame-extractor');
          const frames = await extractAndAnonymizeFrames(videoFiles[0], undefined, anonymizationMode);
          const frameFiles = frames.map(f => f.file);
          if (frameFiles.length > 0) {
            const additionalFrames = frameFiles.slice(1);
            setAdditionalFiles(additionalFrames);
            additionalFilesRef.current = additionalFrames;
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

      if (allowedFiles.length > 1) {
        const imageFiles = allowedFiles.filter(f => f.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name));
        if (imageFiles.length > 0) {
          const additionalImages = imageFiles.slice(1);
          setAdditionalFiles(additionalImages);
          additionalFilesRef.current = additionalImages;
          setCurrentFile(imageFiles[0]);
          const reader = new FileReader();
          reader.onloadend = () => setPreview(reader.result as string);
          reader.readAsDataURL(imageFiles[0]);
          onUpload(imageFiles[0], [], imageFiles);
          return;
        }
      } else if (allowedFiles.length > 0) {
        return handleFile(allowedFiles[0]);
      }
      return;
    }

    const file = input as File;
    if (!file || !file.name) return;
    const dicomLike = acceptsDicom ? await isLikelyDicomFile(file) : false
    if (!(await isFileAccepted(file, dicomLike))) {
      showUnsupportedFormatError()
      return
    }

    if (file.size > maxSize * 1024 * 1024) {
      setError(`File is too large. Maximum size: ${maxSize}MB`)
      return
    }

    const fileName = file.name.toLowerCase();
    const isZip = fileName.endsWith('.zip');
    const isDicom = dicomLike || fileName.endsWith('.dcm') || fileName.endsWith('.dicom') || file.type === 'application/dicom';
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
        setError("Error extracting archive");
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
          // Set preview from first slice
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
        const frames = await extractAndAnonymizeFrames(file, undefined, anonymizationMode);
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
    <div className="w-full" data-tour="upload-zone">
      {preview && (
        <div className="mb-4 text-center">
          <div className="relative inline-block">
            <img 
              src={preview} 
              alt="Uploaded file preview" 
              className="max-w-full h-auto rounded-lg border-2 border-gray-300 max-h-96 mx-auto"
            />
            <div className="mt-2 flex gap-2 w-full">
              <button
                onClick={handleAnonymize}
                disabled={isCompressing}
                className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-lg disabled:opacity-50"
                title="Auto-redact standard areas (edges and corners)"
              >
                <span>🛡️ {t.quickAnonymize}</span>
              </button>
              <button
                onClick={() => setIsEditorOpen(true)}
                disabled={isCompressing}
                className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium shadow-lg disabled:opacity-50"
                title="Open editor for precise manual redaction"
              >
                <span>🎨 {t.precisionRedact}</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            <strong>Quick:</strong> {t.quickHint} 
            <strong>Precision:</strong> {t.precisionHint}
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
              <p className="text-primary-600 font-medium">{t.processingData}</p>
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
                    {t.chooseFile}
                  </button>
                  <span className="text-gray-600"> or </span>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="text-primary-600 hover:text-primary-700 font-semibold underline"
                  >
                    {t.chooseFolder}
                  </button>
                </div>
                <div>
                  <MobileBridgeInboxPicker
                    onImport={(filesFromInbox) => {
                      void handleFile(filesFromInbox)
                    }}
                    accept={accept}
                    multiple
                    preferredTarget={bridgePullTarget}
                    buttonClassName="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors font-semibold text-sm"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={openBridgeForSection}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors font-semibold text-sm"
                  >
                    {locale === 'ru' ? '📲 Камера телефона (этот раздел)' : '📲 Phone camera (this section)'}
                  </button>
                </div>
                <div className="text-gray-500 text-sm italic">{t.dragDrop}</div>
              </div>
            </>
          )}
          <p className="text-sm text-gray-500">
            {t.supported}
            <br />
            Max file size: {maxSize}MB
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
              console.error('Error processing files:', err);
              alert(`Save error: ${err instanceof Error ? err.message : 'unknown error'}`);
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

