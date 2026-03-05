'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import PatientSelector from '@/components/PatientSelector'
import ImageEditor, { type DrawingPath } from '@/components/ImageEditor'
import BillingErrorNotice from '@/components/BillingErrorNotice'
import { logUsage } from '@/lib/simple-logger'
import { 
  extractAndAnonymizeFrames, 
  formatTimestamp, 
  calculateOptimalFrameCount,
  type ExtractedFrame 
} from '@/lib/video-frame-extractor'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

export default function VideoComparisonPage() {
  const [video1, setVideo1] = useState<File | null>(null)
  const [video2, setVideo2] = useState<File | null>(null)
  const [playlist1, setPlaylist1] = useState<File[]>([])
  const [playlist2, setPlaylist2] = useState<File[]>([])
  const [preview1, setPreview1] = useState<string | null>(null)
  const [preview2, setPreview2] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicalContext, setClinicalContext] = useState<string>('')
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [model, setModel] = useState<string>('')
  
  const fileInputRef1 = useRef<HTMLInputElement>(null)
  const folderInputRef1 = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null)
  const folderInputRef2 = useRef<HTMLInputElement>(null)
  
  // Состояния для кадров
  const [frames1, setFrames1] = useState<ExtractedFrame[]>([])
  const [frames2, setFrames2] = useState<ExtractedFrame[]>([])
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 })
  const [editingFrame, setEditingFrame] = useState<{ videoIndex: 1 | 2; frameIndex: number } | null>(null)
  
  // Режим анализа
  const [analysisMode, setAnalysisMode] = useState<'frames' | 'full-video'>('frames')
  const [confirmNoPersonalData, setConfirmNoPersonalData] = useState(false)

  const handleFileChange = (index: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        setError(`Video #${index} exceeds 50MB`)
        return
      }
      
      if (index === 1) {
        setVideo1(file)
        setPlaylist1([]) // Сброс плейлиста
        setPreview1(URL.createObjectURL(file))
        setFrames1([]) // Сбросить кадры
      } else {
        setVideo2(file)
        setPlaylist2([]) // Сброс плейлиста
        setPreview2(URL.createObjectURL(file))
        setFrames2([]) // Сбросить кадры
      }
      setError(null)
      setResult('')
    }
  }

  const handleDicomFile = (index: 1 | 2) => async (selectedFile: File) => {
    setExtracting(true);
    setError(null);
    if (index === 1) setPlaylist1([]);
    else setPlaylist2([]);
    
    try {
      const { sliceDicomFile } = await import('@/lib/dicom-client-processor');
      const slices = await sliceDicomFile(selectedFile);
      if (slices && slices.length > 0) {
        const frames = slices.map((f, i) => ({
          index: i,
          timestamp: 0,
          file: f,
          preview: URL.createObjectURL(f),
          isAnonymized: false
        }));
        if (index === 1) {
          setFrames1(frames);
          setVideo1(selectedFile);
          setPreview1(null); // У DICOM нет стандартного видео-превью
        } else {
          setFrames2(frames);
          setVideo2(selectedFile);
          setPreview2(null);
        }
        setAnalysisMode('frames');
      } else {
        if (index === 1) setVideo1(selectedFile);
        else setVideo2(selectedFile);
      }
    } catch (err: any) {
      setError(`Error processing DICOM #${index}: ` + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleFolderSelect = (index: 1 | 2) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const dicomFiles = fileList.filter(f => 
      f.name.toLowerCase().endsWith('.dcm') || 
      f.name.toLowerCase().endsWith('.dicom') || 
      f.type === 'application/dicom'
    );

    if (dicomFiles.length > 0) {
      setExtracting(true);
      setError(null);
      if (index === 1) setPlaylist1(dicomFiles);
      else setPlaylist2(dicomFiles);
      
      try {
        const { sliceDicomFolder } = await import('@/lib/dicom-client-processor');
        const slices = await sliceDicomFolder(dicomFiles);
        if (slices && slices.length > 0) {
          const frames = slices.map((f, i) => ({
            index: i,
            timestamp: 0,
            file: f,
            preview: URL.createObjectURL(f),
            isAnonymized: false
          }));
          if (index === 1) {
            setFrames1(frames);
            setVideo1(dicomFiles[0]);
            setPreview1(null);
          } else {
            setFrames2(frames);
            setVideo2(dicomFiles[0]);
            setPreview2(null);
          }
          setAnalysisMode('frames');
        }
      } catch (err: any) {
        setError(`Error processing folder #${index}: ` + err.message);
      } finally {
        setExtracting(false);
      }
    } else {
      // Если DICOM нет, ищем все видео
      const videoFiles = fileList.filter(f => f.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        if (index === 1) {
          setPlaylist1(videoFiles);
          setVideo1(videoFiles[0]);
          setPreview1(URL.createObjectURL(videoFiles[0]));
          setFrames1([]);
        } else {
          setPlaylist2(videoFiles);
          setVideo2(videoFiles[0]);
          setPreview2(URL.createObjectURL(videoFiles[0]));
          setFrames2([]);
        }
        setError(null);
      } else {
        setError(`No DICOM files or videos found in folder #${index}`);
      }
    }
  }

  // Извлечение кадров из обоих наборов (видео или папок)
  const handleExtractFrames = async () => {
    if (!video1 || !video2) {
      setError('Upload data to both slots for comparison')
      return
    }

    setExtracting(true)
    setError(null)
    setExtractionProgress({ current: 0, total: 0 })

    try {
      console.log('🎬 [VIDEO COMPARISON] Starting batch frame extraction...')
      
      const files1 = playlist1.length > 0 ? playlist1 : [video1];
      const files2 = playlist2.length > 0 ? playlist2 : [video2];
      
      const totalSteps = files1.length + files2.length;
      let currentStep = 0;

      // Функция для извлечения из массива файлов
      const extractFromList = async (files: File[], slotIndex: number) => {
        const results: ExtractedFrame[] = [];
        for (let i = 0; i < files.length; i++) {
          const frames = await extractAndAnonymizeFrames(files[i], (curr, tot) => {
            // Упрощенный прогресс
          });
          results.push(...frames.map(f => ({
            ...f,
            file: new File([f.file], `slot${slotIndex}_v${i+1}_${f.file.name}`, { type: f.file.type })
          })));
          currentStep++;
          setExtractionProgress({ current: currentStep, total: totalSteps });
        }
        return results;
      };

      const [allFrames1, allFrames2] = await Promise.all([
        extractFromList(files1, 1),
        extractFromList(files2, 2)
      ]);
      
      // Для корректного сравнения попарно нам нужно одинаковое кол-во кадров.
      // Но если это разные серии, мы просто покажем их все.
      setFrames1(allFrames1.map((f, i) => ({ ...f, index: i })));
      setFrames2(allFrames2.map((f, i) => ({ ...f, index: i })));
      
      console.log(`✅ [VIDEO COMPARISON] Extracted ${allFrames1.length} and ${allFrames2.length} frames`)
      
    } catch (err: any) {
      console.error('❌ [VIDEO COMPARISON] Extraction error:', err)
      setError(err.message || 'Error extracting frames')
    } finally {
      setExtracting(false)
    }
  }

  // Обработка сохранения после редактирования кадра
  const handleFrameEditorSave = (editedFile: File) => {
    if (!editingFrame) return

    const { videoIndex, frameIndex } = editingFrame
    
    if (videoIndex === 1) {
      const newFrames = [...frames1]
      newFrames[frameIndex] = {
        ...newFrames[frameIndex],
        file: editedFile,
        preview: URL.createObjectURL(editedFile)
      }
      setFrames1(newFrames)
    } else {
      const newFrames = [...frames2]
      newFrames[frameIndex] = {
        ...newFrames[frameIndex],
        file: editedFile,
        preview: URL.createObjectURL(editedFile)
      }
      setFrames2(newFrames)
    }
    
    setEditingFrame(null)
  }

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, base64] = dataUrl.split(',')
    const mimeMatch = header?.match(/data:(.*?);base64/)
    const mimeType = mimeMatch?.[1] || 'image/png'
    const byteString = atob(base64 || '')
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    return new Blob([ab], { type: mimeType })
  }

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const timeout = setTimeout(() => reject(new Error('Image load timeout')), 15000)
      img.onload = () => { clearTimeout(timeout); resolve(img) }
      img.onerror = () => { clearTimeout(timeout); reject(new Error('Image load error')) }
      img.src = src
    })
  }

  const applyMaskToSlotFrames = async (params: {
    videoIndex: 1 | 2;
    frameIndex: number;
    editedDataUrl: string;
    editedFile: File;
    drawingPaths: DrawingPath[];
  }) => {
    const { videoIndex, frameIndex, editedDataUrl, editedFile, drawingPaths } = params
    if (!drawingPaths || drawingPaths.length === 0) return

    // Reference size for path scaling (paths are recorded in editor canvas coordinates)
    const refImg = await loadImage(editedDataUrl)
    const refW = refImg.width || 1
    const refH = refImg.height || 1

    const sourceFrames = videoIndex === 1 ? frames1 : frames2
    const updatedBase = sourceFrames.map((f, i) => {
      if (i !== frameIndex) return f
      return {
        ...f,
        file: editedFile,
        preview: editedDataUrl,
        isAnonymized: true,
      }
    })

    const processed: ExtractedFrame[] = []
    for (let i = 0; i < updatedBase.length; i++) {
      const frame = updatedBase[i]
      if (i === frameIndex) {
        processed.push(frame)
        continue
      }

      try {
        const img = await loadImage(frame.preview)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          processed.push(frame)
          continue
        }

        ctx.drawImage(img, 0, 0)

        const scaleX = (img.width || 1) / refW
        const scaleY = (img.height || 1) / refH
        const scaleBrush = (scaleX + scaleY) / 2

        for (const path of drawingPaths) {
          if (!path.points || path.points.length === 0) continue
          ctx.beginPath()
          ctx.lineWidth = Math.max(1, path.brushSize * scaleBrush)
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = 'black'

          ctx.moveTo(path.points[0].x * scaleX, path.points[0].y * scaleY)
          for (let p = 1; p < path.points.length; p++) {
            ctx.lineTo(path.points[p].x * scaleX, path.points[p].y * scaleY)
          }
          ctx.stroke()
        }

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, frame.file.type || 'image/png', 0.9))
        if (!blob) {
          processed.push(frame)
          continue
        }

        const newFile = new File([blob], frame.file.name, { type: blob.type || frame.file.type || 'image/png' })
        processed.push({
          ...frame,
          file: newFile,
          preview: URL.createObjectURL(newFile),
          isAnonymized: true,
        })
      } catch (_e) {
        processed.push(frame)
      }
    }

    if (videoIndex === 1) setFrames1(processed)
    else setFrames2(processed)
  }

  // Анализ кадров
  const handleAnalyzeFrames = async () => {
    if (frames1.length === 0 || frames2.length === 0) {
      setError('Extract frames from both videos first')
      return
    }

    setAnalyzing(true)
    setLoading(true)
    setError(null)
    setResult('')
    setCurrentCost(0)

    try {
      const formData = new FormData()
      
      // Собираем все кадры (сначала видео 1, затем видео 2)
      const allFrames = [...frames1, ...frames2]
      
      // Добавляем в правильном формате для API
      if (allFrames.length > 0) {
        formData.append('file', allFrames[0].file) // Первый кадр как основной
        // Остальные кадры как дополнительные
        for (let i = 1; i < allFrames.length; i++) {
          formData.append(`additionalImage_${i - 1}`, allFrames[i].file)
        }
      }
      
      // Добавляем метаинформацию о сравнении
      let comparisonPrompt = clinicalContext 
        ? `Compare the dynamic changes between two videos. If the images are identical — clearly state this. The first ${frames1.length} frames are from the archive video, the next ${frames2.length} frames are from the current video. ${clinicalContext}`
        : `Compare the dynamic changes between two videos. If identical — clearly state this; if differences exist — describe them in detail. The first ${frames1.length} frames are from the archive video, the next ${frames2.length} frames are from the current video. Identify all significant differences.`
      
      if (playlist1.length > 1 || playlist2.length > 1) {
        const batchInfo = `\n\nNOTE: Comparison is being made between series of video angles. Archive set contains ${playlist1.length || 1} videos, current set contains ${playlist2.length || 1} videos. Analyze all angles for pathology detection.`
        comparisonPrompt += batchInfo;
      }

      formData.append('prompt', comparisonPrompt)
      formData.append('imageType', 'universal')
      formData.append('isTwoStage', 'true') // Включаем режим радиологического протокола
      formData.append('isComparative', 'true')

      console.log(`🎬 [VIDEO COMPARISON] Sending ${frames1.length + frames2.length} frames for analysis...`)
      
      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result || 'Analysis complete')
        setCurrentCost(data.cost || 0)
        setModel(data.model || 'google/gemini-3-flash-preview')
        
        logUsage({
          section: 'video-comparison-frames',
          model: data.model || 'google/gemini-3-flash-preview',
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        })
      } else {
        setError(data.error || 'Analysis error')
      }
    } catch (err: any) {
      setError(err.message || 'Server error')
    } finally {
      setAnalyzing(false)
      setLoading(false)
    }
  }

  const handleAnalyzeFullVideo = async () => {
    if (!video1 || !video2) {
      setError('Upload both videos for comparison')
      return
    }

    if (playlist1.length > 1 || playlist2.length > 1) {
      setError('Full video comparison supports only one file per slot. For folder comparison (multi-angle series) use "Safe mode (frame extraction)".')
      return
    }

    if (!confirmNoPersonalData) {
      setError('Please confirm absence of personal data in both videos')
      return
    }

    setAnalyzing(true)
    setLoading(true)
    setError(null)
    setResult('')
    setCurrentCost(0)

    try {
      const formData = new FormData()
      formData.append('video1', video1)
      formData.append('video2', video2)
      if (clinicalContext) formData.append('prompt', clinicalContext)

      console.log('🎬 [VIDEO COMPARISON] Sending FULL videos for analysis...')
      console.warn('⚠️ [VIDEO COMPARISON] Non-anonymized mode enabled - clinician confirmed absence of PHI')

      const response = await fetch('/api/analyze/video-comparison', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        let fullResult = ''
        if (data.description) fullResult += `## 📝 STAGE 1: Dynamic comparison\n\n${data.description}\n\n`
        if (data.analysis) fullResult += `## 🏥 STAGE 2: Clinical directive\n\n${data.analysis}`
        
        setResult(fullResult)
        setCurrentCost(data.cost || 0)
        setModel(data.model)
        
        logUsage({
          section: 'video-comparison-full',
          model: data.model,
          inputTokens: data.usage?.prompt_tokens || 8000,
          outputTokens: data.usage?.completion_tokens || 4000,
        })
      } else {
        setError(data.error || 'Analysis error')
      }
    } catch (err: any) {
      setError(err.message || 'Server error')
    } finally {
      setAnalyzing(false)
      setLoading(false)
    }
  }

  // Universal handler анализа
  const handleAnalyze = () => {
    if (analysisMode === 'frames') {
      return handleAnalyzeFrames()
    } else {
      return handleAnalyzeFullVideo()
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📊 Comparative Video Analysis</h1>
      
      <AnalysisTips 
        content={{
          fast: "Compares two videos by extracting synchronized frames. Each frame is anonymized automatically.",
          extra: [
            "📽️ Upload two video files (e.g., ultrasound before and after treatment).",
            "🎞️ The system will extract an equal number of frames from BOTH videos at synchronized positions.",
            "🛡️ Each frame is automatically anonymized (black bars on edges).",
            "👁️ You will see a side-by-side preview of all paired frames.",
            "🔍 AI will compare frames pair by pair and identify dynamic changes.",
            "⏱️ Maximum file size per video — 50MB."
          ]
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Видео 1 */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-dashed border-gray-300">
          <h2 className="text-xl font-semibold mb-4 text-gray-600 italic">Video 1 (Archive)</h2>
          {preview1 ? (
            <video src={preview1} controls className="w-full h-64 bg-black rounded-lg mb-4" />
          ) : (
            <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg mb-4">
              <span className="text-gray-400">No video</span>
            </div>
          )}
          
          <div className="space-y-4">
            <input
              ref={fileInputRef1}
              type="file"
              accept="video/*,.dcm,.dicom"
              onChange={handleFileChange(1)}
              className="hidden"
            />
            <input
              ref={folderInputRef1}
              type="file"
              webkitdirectory=""
              mozdirectory=""
              directory=""
              onChange={handleFolderSelect(1)}
              className="hidden"
            />
            
            <div className="flex flex-col items-center space-y-2 border-2 border-dashed border-gray-200 p-4 rounded-xl">
              <div className="text-2xl">📁</div>
              <div>
                <button
                  onClick={() => fileInputRef1.current?.click()}
                  className="text-primary-600 hover:text-primary-700 font-semibold underline text-sm"
                >
                  Choose file
                </button>
                <span className="text-gray-600 text-sm"> or </span>
                <button
                  onClick={() => folderInputRef1.current?.click()}
                  className="text-primary-600 hover:text-primary-700 font-semibold underline text-sm"
                >
                  folder
                </button>
              </div>
            </div>
          </div>

          {video1 && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-gray-600 text-center">
                {playlist1.length > 1 
                  ? `✅ Found in folder: ${playlist1.length} videos`
                  : `✅ ${video1.name} (${(video1.size / 1024 / 1024).toFixed(1)} MB)`
                }
              </p>
              {playlist1.length > 1 && (
                <div className="p-2 bg-gray-50 border border-gray-100 rounded text-[10px] text-gray-500 max-h-24 overflow-y-auto">
                  {playlist1.map((f, i) => <div key={i}>{i+1}. {f.name}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Видео 2 */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <h2 className="text-xl font-semibold mb-4 text-blue-600">Video 2 (Current)</h2>
          {preview2 ? (
            <video src={preview2} controls className="w-full h-64 bg-black rounded-lg mb-4" />
          ) : (
            <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg mb-4">
              <span className="text-gray-400">No video</span>
            </div>
          )}
          
          <div className="space-y-4">
            <input
              ref={fileInputRef2}
              type="file"
              accept="video/*,.dcm,.dicom"
              onChange={handleFileChange(2)}
              className="hidden"
            />
            <input
              ref={folderInputRef2}
              type="file"
              webkitdirectory=""
              mozdirectory=""
              directory=""
              onChange={handleFolderSelect(2)}
              className="hidden"
            />
            
            <div className="flex flex-col items-center space-y-2 border-2 border-dashed border-blue-100 p-4 rounded-xl">
              <div className="text-2xl">📁</div>
              <div>
                <button
                  onClick={() => fileInputRef2.current?.click()}
                  className="text-primary-600 hover:text-primary-700 font-semibold underline text-sm"
                >
                  Choose file
                </button>
                <span className="text-gray-600 text-sm"> or </span>
                <button
                  onClick={() => folderInputRef2.current?.click()}
                  className="text-primary-600 hover:text-primary-700 font-semibold underline text-sm"
                >
                  folder
                </button>
              </div>
            </div>
          </div>

          {video2 && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-gray-600 text-center">
                {playlist2.length > 1 
                  ? `✅ Found in folder: ${playlist2.length} videos`
                  : `✅ ${video2.name} (${(video2.size / 1024 / 1024).toFixed(1)} MB)`
                }
              </p>
              {playlist2.length > 1 && (
                <div className="p-2 bg-blue-50 border border-blue-100 rounded text-[10px] text-blue-500 max-h-24 overflow-y-auto">
                  {playlist2.map((f, i) => <div key={i}>{i+1}. {f.name}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Переключатель режимов и кнопки */}
      {video1 && video2 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          {/* Режим анализа */}
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm font-semibold text-gray-900 mb-2">Select analysis mode:</p>
            <div className="space-y-2">
              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  value="frames"
                  checked={analysisMode === 'frames'}
                  onChange={() => {
                    setAnalysisMode('frames')
                    setConfirmNoPersonalData(false)
                  }}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <span className="font-semibold text-green-700">🛡️ Safe (frame extraction)</span>
                  <p className="text-xs text-gray-600 mt-1">
                    The system will extract synchronized frames from both videos, anonymize each one, and display them in pairs.
                    <strong>Recommended by default.</strong>
                  </p>
                </div>
              </label>
              
              <label className="flex items-start cursor-pointer">
                <input
                  type="radio"
                  value="full-video"
                  checked={analysisMode === 'full-video'}
                  onChange={() => setAnalysisMode('full-video')}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <span className="font-semibold text-amber-700">⚡ Full video</span>
                  <p className="text-xs text-gray-600 mt-1">
                    Both videos are sent in full without processing. Maximum accuracy (100%),
                    but requires prior verification that no PHI is present.
                    <strong> For anonymized files only!</strong>
                  </p>
                </div>
              </label>
            </div>
          </div>
          
          {/* Предупреждение для режима "полное видео" */}
          {analysisMode === 'full-video' && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg mb-4">
              <div className="flex items-start space-x-2 mb-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-red-900 text-lg">WARNING: Both videos will be sent without anonymization!</p>
                  <p className="text-red-800 text-sm mt-1">
                    In "Full video" mode, frames are NOT anonymized.
                    If ANY PHI is present in either video —
                    <strong> this is a HIPAA/GDPR violation!</strong>
                  </p>
                  <ul className="text-red-700 text-xs mt-2 ml-4 list-disc space-y-1">
                    <li>Both videos will be sent to OpenRouter (USA) in full</li>
                    <li>All frames will be processed without modification</li>
                    <li>Higher cost (~$1.00 vs $0.15)</li>
                    <li>Processing time: 60–120 seconds</li>
                  </ul>
                </div>
              </div>
              
              <label className="flex items-start cursor-pointer p-3 bg-white rounded border-2 border-red-400 hover:bg-red-50 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmNoPersonalData}
                  onChange={(e) => setConfirmNoPersonalData(e.target.checked)}
                  className="mt-1 mr-3"
                  required
                />
                <span className="text-sm font-semibold text-red-900">
                  I confirm: I have reviewed BOTH videos and certify they do NOT contain
                  any patient personal data. I take full responsibility for HIPAA/GDPR compliance.
                </span>
              </label>
            </div>
          )}
          
          {/* Кнопка извлечения кадров (только для режима "кадры") */}
          {analysisMode === 'frames' && frames1.length === 0 && (
            <>
              <button
                onClick={handleExtractFrames}
                disabled={extracting}
                className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extracting 
                  ? `⏳ Extracting frames... ${extractionProgress.current}/${extractionProgress.total}` 
                  : '🎞️ Extract and anonymize frames from both videos'
                }
              </button>
              <p className="text-sm text-gray-600 mt-2 text-center">
                An equal number of frames will be extracted from each video at synchronized positions
              </p>
            </>
          )}
        </div>
      )}

      {/* Preview кадров */}
      {frames1.length > 0 && frames2.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-green-900">
              ✅ Extracted {frames1.length} frames from each video (synchronized)
            </h3>
            <button
              onClick={() => {
                setFrames1([])
                setFrames2([])
                setResult('')
              }}
              className="text-sm text-green-700 hover:text-green-900 underline"
            >
              🔄 Re-extract
            </button>
          </div>

          {/* Сравнение кадров попарно */}
          <div className="space-y-4">
            {frames1.map((frame1, index) => {
              const frame2 = frames2[index]
              return (
                <div key={index} className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <p className="text-sm font-semibold text-green-900 mb-2">
                    Frame {index + 1}: {formatTimestamp(frame1.timestamp)} ↔ {formatTimestamp(frame2.timestamp)}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Кадр из видео 1 */}
                    <div className="relative group">
                      <div className="aspect-video bg-gray-100 rounded overflow-hidden border-2 border-gray-400">
                        <img 
                          src={frame1.preview} 
                          alt={`Video 1 - Frame ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded flex items-center justify-center">
                        <button
                          onClick={() => setEditingFrame({ videoIndex: 1, frameIndex: index })}
                          className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-2 py-1 rounded text-xs font-semibold shadow-lg transition-opacity"
                        >
                          🎨 Edit
                        </button>
                      </div>
                      <p className="text-xs text-center text-gray-600 mt-1">Archive</p>
                    </div>

                    {/* Кадр из видео 2 */}
                    <div className="relative group">
                      <div className="aspect-video bg-gray-100 rounded overflow-hidden border-2 border-blue-400">
                        <img 
                          src={frame2.preview} 
                          alt={`Video 2 - Frame ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded flex items-center justify-center">
                        <button
                          onClick={() => setEditingFrame({ videoIndex: 2, frameIndex: index })}
                          className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-2 py-1 rounded text-xs font-semibold shadow-lg transition-opacity"
                        >
                          🎨 Edit
                        </button>
                      </div>
                      <p className="text-xs text-center text-blue-600 mt-1">Current</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-green-700 mt-4">
            💡 Hover over a frame to manually edit it
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3">📝 Clinical Information</h2>
        <PatientSelector onSelect={setClinicalContext} disabled={loading} />
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Additional details</span>
            <VoiceInput onTranscript={(t) => setClinicalContext(p => p ? `${p} ${t}` : t)} disabled={loading} />
          </div>
          <textarea
            value={clinicalContext}
            onChange={(e) => setClinicalContext(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary-500"
            rows={3}
            disabled={loading}
            placeholder="Describe what the AI should focus on during comparison..."
          />
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={
          loading || 
          extracting || 
          (analysisMode === 'frames' && (frames1.length === 0 || frames2.length === 0)) ||
          (analysisMode === 'full-video' && !confirmNoPersonalData)
        }
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-xl shadow-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
      >
        {analyzing 
          ? '⌛ Comparative analysis in progress...' 
          : analysisMode === 'frames'
            ? (frames1.length > 0 && frames2.length > 0
                ? `📤 Compare ${frames1.length + frames2.length} frames`
                : '🔍 Extract frames first'
              )
            : (confirmNoPersonalData
                ? '⚡ Compare full videos'
                : '⚠️ Confirm absence of PHI'
              )
        }
      </button>

      {error && (
        <div className="mt-6">
          <BillingErrorNotice error={error} />
        </div>
      )}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        cost={currentCost} 
        model={model} 
        mode="comparative-video" 
        images={[...frames1.map(f => f.preview), ...frames2.map(f => f.preview)]}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="VIDEO_COMP" 
          analysisResult={result} 
          inputCase={clinicalContext} 
        />
      )}

      {editingFrame && (
        <ImageEditor
          image={editingFrame.videoIndex === 1 
            ? frames1[editingFrame.frameIndex].preview 
            : frames2[editingFrame.frameIndex].preview
          }
          hasAdditionalFiles={editingFrame.videoIndex === 1 ? frames1.length > 1 : frames2.length > 1}
          onSave={async (editedDataUrl, drawingPaths) => {
            const { videoIndex, frameIndex } = editingFrame;
            
            // Сначала обновляем превью мгновенно
            if (videoIndex === 1) {
              setFrames1(prev => {
                const updated = [...prev];
                updated[frameIndex] = { ...updated[frameIndex], preview: editedDataUrl };
                return updated;
              });
            } else {
              setFrames2(prev => {
                const updated = [...prev];
                updated[frameIndex] = { ...updated[frameIndex], preview: editedDataUrl };
                return updated;
              });
            }

            // Затем конвертируем в файл (без fetch — стабильнее под CSP)
            try {
              const originalFile = videoIndex === 1 ? frames1[frameIndex].file : frames2[frameIndex].file;
              const blob = dataUrlToBlob(editedDataUrl);
              const editedFile = new File([blob], originalFile.name, { type: blob.type || originalFile.type || 'image/png' });
              
              if (videoIndex === 1) {
                setFrames1(prev => {
                  const updated = [...prev];
                  if (updated[frameIndex]) updated[frameIndex] = { ...updated[frameIndex], file: editedFile, isAnonymized: true };
                  return updated;
                });
              } else {
                setFrames2(prev => {
                  const updated = [...prev];
                  if (updated[frameIndex]) updated[frameIndex] = { ...updated[frameIndex], file: editedFile, isAnonymized: true };
                  return updated;
                });
              }

              // Если пользователь нажал "Применить ко всем" — ImageEditor передаст drawingPaths
              if (drawingPaths && drawingPaths.length > 0) {
                await applyMaskToSlotFrames({
                  videoIndex,
                  frameIndex,
                  editedDataUrl,
                  editedFile,
                  drawingPaths,
                })
              }
            } catch (err) {
              console.error('Error saving edited frame:', err);
            }
            
            setEditingFrame(null);
          }}
          onCancel={() => setEditingFrame(null)}
        />
      )}
    </div>
  )
}
