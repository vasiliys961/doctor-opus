'use client'

import { useState, useRef } from 'react'
import JSZip from 'jszip'
import { compressMedicalImage, anonymizeMedicalImage } from '@/lib/image-compression'
import ImageEditor from './ImageEditor'

interface DrawingPath {
  points: Array<{ x: number; y: number }>
  brushSize: number
}

interface ImageUploadProps {
  onUpload: (file: File, additionalFiles?: File[], originalFiles?: File[]) => void
  accept?: string
  maxSize?: number // in MB
}

export default function ImageUpload({ onUpload, accept = 'image/*,.dcm,.dicom', maxSize = 500 }: ImageUploadProps) {
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

      const videoFiles = files.filter(f => f.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        setIsCompressing(true);
        try {
          const { extractAndAnonymizeFrames } = await import('@/lib/video-frame-extractor');
          const frames = await extractAndAnonymizeFrames(videoFiles[0]);
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

      if (files.length > 1) {
        const imageFiles = files.filter(f => f.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name));
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
      } else if (files.length > 0) {
        return handleFile(files[0]);
      }
      return;
    }

    const file = input as File;
    if (!file || !file.name) return;

    if (file.size > maxSize * 1024 * 1024) {
      setError(`File is too large. Maximum size: ${maxSize}MB`)
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
                <span>🛡️ Quick Anonymize</span>
              </button>
              <button
                onClick={() => setIsEditorOpen(true)}
                disabled={isCompressing}
                className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium shadow-lg disabled:opacity-50"
                title="Open editor for precise manual redaction"
              >
                <span>🎨 Precision Redact</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            <strong>Quick:</strong> automatically hides edges and corners. 
            <strong>Precision:</strong> manually redact any areas containing personal data.
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
              <p className="text-primary-600 font-medium">Processing data...</p>
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
                    Choose file
                  </button>
                  <span className="text-gray-600"> or </span>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="text-primary-600 hover:text-primary-700 font-semibold underline"
                  >
                    entire folder
                  </button>
                </div>
                <div className="text-gray-500 text-sm italic">or drag and drop here</div>
              </div>
            </>
          )}
          <p className="text-sm text-gray-500">
            Supported: DICOM (series), JPG, PNG, PDF
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

