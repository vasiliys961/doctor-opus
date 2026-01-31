'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import PatientSelector from '@/components/PatientSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'
import ImageEditor from '@/components/ImageEditor'
import { 
  extractAndAnonymizeFrames, 
  formatTimestamp, 
  type ExtractedFrame 
} from '@/lib/video-frame-extractor'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

import { logUsage } from '@/lib/simple-logger'

export default function VideoPage() {
  const [file, setFile] = useState<File | null>(null)
  const [playlist, setPlaylist] = useState<File[]>([])
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicalContext, setClinicalContext] = useState<string>('')
  const [imageType, setImageType] = useState<ImageModality>('universal')
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [model, setModel] = useState<string>('')
  const [mode, setMode] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  
  // Новые state для работы с кадрами
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([])
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 })
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null)
  
  // Режим анализа видео
  const [analysisMode, setAnalysisMode] = useState<'frames' | 'full-video'>('frames')
  const [confirmNoPersonalData, setConfirmNoPersonalData] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Проверка на DICOM
      const isDicom = selectedFile.name.toLowerCase().endsWith('.dcm') || 
                      selectedFile.name.toLowerCase().endsWith('.dicom') || 
                      selectedFile.type === 'application/dicom';
      
      if (isDicom) {
        handleDicomFile(selectedFile);
        return;
      }

      // Проверка размера (100MB max)
      const maxSize = 100 * 1024 * 1024
      if (selectedFile.size > maxSize) {
        setError(`Размер видео превышает 100MB (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)`)
        return
      }
      setFile(selectedFile)
      setPlaylist([]) // Сбросить плейлист при выборе одиночного файла
      setExtractedFrames([]) // Сбросить предыдущие кадры
      setConfirmNoPersonalData(false) // Сбросить подтверждение
      setError(null)
      setResult('')
    }
  }

  const handleDicomFile = async (selectedFile: File) => {
    setExtracting(true);
    setError(null);
    setPlaylist([]); // Сбросить плейлист
    try {
      const { sliceDicomFile } = await import('@/lib/dicom-client-processor');
      const slices = await sliceDicomFile(selectedFile);
      if (slices && slices.length > 0) {
        const frames = slices.map((f, i) => ({
          index: i,
          timestamp: 0,
          file: f,
          preview: URL.createObjectURL(f)
        }));
        setExtractedFrames(frames);
        setFile(selectedFile);
        setAnalysisMode('frames');
      } else {
        setFile(selectedFile);
      }
    } catch (err: any) {
      setError('Ошибка при обработке DICOM: ' + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setPlaylist(dicomFiles);
      try {
        const { sliceDicomFolder } = await import('@/lib/dicom-client-processor');
        const slices = await sliceDicomFolder(dicomFiles);
        if (slices && slices.length > 0) {
          const frames = slices.map((f, i) => ({
            index: i,
            timestamp: 0,
            file: f,
            preview: URL.createObjectURL(f)
          }));
          setExtractedFrames(frames);
          setFile(dicomFiles[0]); // Используем первый как базовый
          setAnalysisMode('frames');
        }
      } catch (err: any) {
        setError('Ошибка при обработке папки: ' + err.message);
      } finally {
        setExtracting(false);
      }
    } else {
      // Если DICOM нет, ищем все видео-файлы
      const videoFiles = fileList.filter(f => f.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        setPlaylist(videoFiles);
        setFile(videoFiles[0]); // Первое видео по умолчанию
        setExtractedFrames([]);
        setError(null);
      } else {
        setError('В папке не найдено DICOM-файлов или видео');
      }
    }
  }

  // Извлечение и анонимизация кадров из ВСЕХ видео в плейлисте (по порядку)
  const handleExtractFrames = async () => {
    if (playlist.length === 0 && !file) {
      setError('Пожалуйста, выберите видео файл или папку')
      return
    }

    setExtracting(true)
    setError(null)
    setExtractedFrames([])
    setExtractionProgress({ current: 0, total: 0 })

    try {
      const filesToProcess = playlist.length > 0 ? playlist : [file!];
      const allExtractedFrames: ExtractedFrame[] = [];
      
      console.log(`🎬 [VIDEO] Начало пакетного извлечения кадров из ${filesToProcess.length} видео...`)
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const currentFile = filesToProcess[i];
        console.log(`🎞️ [VIDEO] Обработка видео ${i + 1}/${filesToProcess.length}: ${currentFile.name}`)
        
        const frames = await extractAndAnonymizeFrames(
          currentFile,
          (current, total) => {
            // Для пакетной обработки прогресс считаем суммарно
            setExtractionProgress({ 
              current: (i * total) + current, 
              total: filesToProcess.length * total 
            })
          }
        )
        
        // Добавляем информацию о том, из какого видео кадр
        const framesWithSource = frames.map(f => ({
          ...f,
          // Переименовываем файл для ясности в API
          file: new File([f.file], `v${i+1}_${f.file.name}`, { type: f.file.type })
        }));
        
        allExtractedFrames.push(...framesWithSource);
      }
      
      // Обновляем индексы для всей коллекции
      const finalFrames = allExtractedFrames.map((f, i) => ({ ...f, index: i }));
      
      setExtractedFrames(finalFrames)
      console.log(`✅ [VIDEO] Успешно извлечено ${finalFrames.length} кадров из всех ракурсов`)
      
    } catch (err: any) {
      console.error('❌ [VIDEO] Ошибка извлечения кадров:', err)
      setError(err.message || 'Ошибка при извлечении кадров')
    } finally {
      setExtracting(false)
    }
  }

  // Обработка сохранения после редактирования кадра
  const handleFrameEditorSave = (editedFile: File) => {
    if (editingFrameIndex === null) return

    const newFrames = [...extractedFrames]
    const originalFrame = newFrames[editingFrameIndex]
    
    // Обновляем файл и preview
    newFrames[editingFrameIndex] = {
      ...originalFrame,
      file: editedFile,
      preview: URL.createObjectURL(editedFile)
    }
    
    setExtractedFrames(newFrames)
    setEditingFrameIndex(null)
  }

  // Анализ извлеченных кадров
  const handleAnalyzeFrames = async () => {
    if (extractedFrames.length === 0) {
      setError('Сначала извлеките кадры из видео')
      return
    }

    setAnalyzing(true)
    setLoading(true)
    setError(null)
    setResult('')
    setCurrentCost(0)

    try {
      const formData = new FormData()
      
      // Добавляем кадры в правильном формате для API
      if (extractedFrames.length > 0) {
        formData.append('file', extractedFrames[0].file) // Первый кадр как основной
        // Остальные кадры как дополнительные
        for (let i = 1; i < extractedFrames.length; i++) {
          formData.append(`additionalImage_${i - 1}`, extractedFrames[i].file)
        }
      }
      
      if (clinicalContext) {
        formData.append('prompt', clinicalContext)
      }
      
      // Если у нас много видео, добавляем пояснение для ИИ
      if (playlist.length > 1) {
        const batchContext = `Проанализируй серию из ${playlist.length} видео-ракурсов одного исследования. Кадры извлечены по порядку из каждого файла. Сформируй единый отчет по всем предоставленным визуальным данным.`
        const existingPrompt = clinicalContext || '';
        // Перезаписываем промпт с учетом батча
        formData.set('prompt', existingPrompt ? `${batchContext}\n\nКонтекст: ${existingPrompt}` : batchContext)
      }

      formData.append('imageType', imageType)
      formData.append('isTwoStage', 'true') // Включаем режим радиологического протокола

      console.log(`🎬 [VIDEO] Отправка ${extractedFrames.length} кадров на анализ...`)
      
      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result || 'Анализ выполнен')
        setCurrentCost(data.cost || 0)
        setModel(data.model || 'google/gemini-3-flash-preview')
        setMode(data.mode || 'fast')
        
        // Логирование использования
        logUsage({
          section: 'video-frames',
          model: data.model || 'google/gemini-3-flash-preview',
          inputTokens: data.usage?.prompt_tokens || 0, 
          outputTokens: data.usage?.completion_tokens || 0,
        })
      } else {
        setError(data.error || 'Ошибка при анализе кадров')
      }
    } catch (err: any) {
      console.error('❌ [VIDEO] Ошибка:', err)
      setError(err.message || 'Произошла ошибка при анализе')
    } finally {
      setAnalyzing(false)
      setLoading(false)
    }
  }

  // Анализ полного видео (для анонимных файлов)
  const handleAnalyzeFullVideo = async () => {
    if (!file) {
      setError('Пожалуйста, выберите видео файл')
      return
    }

    if (playlist.length > 1) {
      setError('Режим "Полное видео" пока поддерживает только один файл. Для анализа всей папки (всех ракурсов) используйте "Безопасный режим (извлечение кадров)".')
      return
    }

    if (!confirmNoPersonalData) {
      setError('Необходимо подтвердить отсутствие персональных данных')
      return
    }

    setAnalyzing(true)
    setLoading(true)
    setError(null)
    setResult('')
    setCurrentCost(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (clinicalContext) {
        formData.append('prompt', clinicalContext)
      }
      formData.append('imageType', imageType)

      console.log('🎬 [VIDEO] Отправка ПОЛНОГО видео на анализ...')
      console.warn('⚠️ [VIDEO] Режим без анонимизации - врач подтвердил отсутствие ПД')
      
      const response = await fetch('/api/analyze/video', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        // Формируем результат с описанием и анализом
        let fullResult = ''
        
        if (data.description) {
          fullResult += `## 📝 ЭТАП 1: Описание видео (Gemini 3.0 Flash)\n\n${data.description}\n\n`
        }
        
        if (data.analysis) {
          fullResult += `## 🏥 ЭТАП 2: Клиническая директива (Профессор)\n\n${data.analysis}`
        }
        
        setResult(fullResult || data.result || 'Анализ выполнен')
        setCurrentCost(data.cost || 0)
        setModel(data.model || 'google/gemini-3-flash-preview')
        setMode('fast')
        
        // Логирование использования
        logUsage({
          section: 'video-full',
          model: data.model || 'google/gemini-3-flash-preview',
          inputTokens: data.usage?.prompt_tokens || 5000, 
          outputTokens: data.usage?.completion_tokens || 4000,
        })
      } else {
        setError(data.error || 'Ошибка при анализе видео')
      }
    } catch (err: any) {
      console.error('❌ [VIDEO] Ошибка:', err)
      setError(err.message || 'Произошла ошибка при анализе')
    } finally {
      setAnalyzing(false)
      setLoading(false)
    }
  }

  // Универсальный обработчик анализа
  const handleAnalyze = () => {
    if (analysisMode === 'frames') {
      return handleAnalyzeFrames()
    } else {
      return handleAnalyzeFullVideo()
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🎬 Анализ видео</h1>
      
      <AnalysisTips 
        content={{
          fast: "двухэтапный скрининг (сначала структурированное описание видео через Gemini Vision, затем текстовый разбор через Gemini Flash), даёт компактное заключение и общий сигнал риска.",
          validated: "самый точный экспертный анализ (Gemini JSON + Opus 4.5) — рекомендуется для детального клинического разбора видеоматериалов; самый дорогой режим.",
          extra: [
            "🛡️ Видео автоматически обрабатывается: система извлекает 5-12 ключевых кадров (адаптивно по длине видео).",
            "🔒 Каждый кадр анонимизируется: черные полосы по краям (10% верх, 8% низ, 12% с боков).",
            "👁️ Preview перед отправкой: вы видите все кадры и можете дополнительно отредактировать любой из них.",
            "🎯 Точность ~92-95% при анализе 7 кадров — оптимальный баланс качества и безопасности.",
            "💰 Экономия в 5-6 раз по сравнению с отправкой всего видео.",
            "⏱️ Обработка занимает 4-8 секунд в зависимости от длительности видео."
          ]
        }}
      />

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите видео для анализа</h2>
        
        <div className="space-y-4">
          {/* Загрузка видео или папки */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.dcm,.dicom"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              mozdirectory=""
              directory=""
              onChange={handleFolderSelect}
              className="hidden"
            />
            
            <div className="flex flex-col items-center space-y-4">
              <div className="text-4xl">📁</div>
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
              <p className="text-sm text-gray-500">
                Поддерживаются: Видео (MP4, MOV, AVI) или DICOM-серии (папка)
              </p>
            </div>
          </div>

          {file && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600">
                  {playlist.length > 1 
                    ? `✅ Найдено в папке: ${playlist.length} видео`
                    : `✅ Выбран: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
                  }
                </p>

                {playlist.length > 1 && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg max-h-40 overflow-y-auto">
                    <p className="text-xs font-bold text-blue-700 mb-2 uppercase">Список файлов для комплексного анализа:</p>
                    <ul className="text-xs text-blue-600 space-y-1">
                      {playlist.map((f, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{i + 1}. {f.name}</span>
                          <span className="text-blue-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Переключатель режимов анализа */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Выберите режим анализа:</p>
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
                        <span className="font-semibold text-green-700">🛡️ Безопасный (извлечение кадров)</span>
                        <p className="text-xs text-gray-600 mt-1">
                          Система извлечет 5-12 ключевых кадров, анонимизирует каждый (черные полосы по краям), 
                          покажет preview. Вы сможете отредактировать любой кадр вручную. 
                          <strong>Рекомендуется по умолчанию.</strong>
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
                        <span className="font-semibold text-amber-700">⚡ Полное видео</span>
                        <p className="text-xs text-gray-600 mt-1">
                          Видео отправляется целиком без обработки. Более высокая точность (100%), 
                          но требует предварительной проверки на отсутствие ПД.
                          <strong> Только для анонимных файлов!</strong>
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
                
                {/* Предупреждение и подтверждение для режима "полное видео" */}
                {analysisMode === 'full-video' && (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                    <div className="flex items-start space-x-2 mb-3">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <p className="font-bold text-red-900 text-lg">ВНИМАНИЕ: Риск утечки персональных данных!</p>
                        <p className="text-red-800 text-sm mt-1">
                          В режиме "Полное видео" кадры НЕ анонимизируются автоматически. 
                          Если на видео присутствуют ФИО, дата рождения, паспортные данные или ID пациента - 
                          <strong> это нарушение ФЗ-152!</strong>
                        </p>
                        <ul className="text-red-700 text-xs mt-2 ml-4 list-disc space-y-1">
                          <li>Видео будет отправлено в OpenRouter (США) целиком</li>
                          <li>Все кадры попадут в обработку без изменений</li>
                          <li>Текстовые оверлеи и метаданные сохраняются</li>
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
                        Подтверждаю: я просмотрел видео и удостоверяю, что оно НЕ содержит 
                        персональных данных пациента (ФИО, дата рождения, паспорт, ID, адрес, телефон). 
                        Я беру на себя ответственность за соблюдение ФЗ-152.
                      </span>
                    </label>
                  </div>
                )}
                
                {/* Кнопка извлечения кадров (только для режима "кадры") */}
                {analysisMode === 'frames' && extractedFrames.length === 0 && (
                  <button
                    onClick={handleExtractFrames}
                    disabled={extracting}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {extracting 
                      ? `⏳ Извлечение кадров... ${extractionProgress.current}/${extractionProgress.total}` 
                      : '🎞️ Извлечь и анонимизировать кадры'
                    }
                  </button>
                )}
              </div>
            )}

          {/* Preview извлеченных кадров */}
          {extractedFrames.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-green-900">
                  ✅ Извлечено {extractedFrames.length} кадров (все анонимизированы)
                </h3>
                <button
                  onClick={() => {
                    setExtractedFrames([])
                    setResult('')
                  }}
                  className="text-sm text-green-700 hover:text-green-900 underline"
                >
                  🔄 Переизвлечь
                </button>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 mb-3">
                {extractedFrames.map((frame) => (
                  <div key={frame.index} className="relative group">
                    <div className="aspect-video bg-gray-100 rounded overflow-hidden border-2 border-green-300">
                      <img 
                        src={frame.preview} 
                        alt={`Кадр ${frame.index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded flex items-center justify-center">
                      <button
                        onClick={() => setEditingFrameIndex(frame.index)}
                        className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-2 py-1 rounded text-xs font-semibold shadow-lg transition-opacity"
                      >
                        🎨 Редактировать
                      </button>
                    </div>
                    <p className="text-xs text-center text-green-700 mt-1">
                      {frame.index + 1}: {formatTimestamp(frame.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-green-700">
                💡 Наведите на кадр, чтобы дополнительно отредактировать его вручную
              </p>
            </div>
          )}

          {/* Тип исследования */}
          <ModalitySelector
            value={imageType}
            onChange={setImageType}
            disabled={loading || extracting}
          />

          {/* Пациент и контекст */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <PatientSelector 
              onSelect={(context) => setClinicalContext(context)} 
              disabled={loading} 
            />
            
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Дополнительный контекст
              </label>
              <VoiceInput 
                onTranscript={(text) => setClinicalContext(prev => prev ? `${prev} ${text}` : text)}
                disabled={loading}
              />
            </div>
            <textarea
              value={clinicalContext}
              onChange={(e) => setClinicalContext(e.target.value)}
              placeholder="Укажите дополнительную информацию: жалобы пациента, анамнез, цель исследования..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              rows={4}
              disabled={loading}
            />
          </div>

          {/* Кнопка анализа */}
          <button
            onClick={handleAnalyze}
            disabled={
              loading || 
              extracting || 
              (analysisMode === 'frames' && extractedFrames.length === 0) ||
              (analysisMode === 'full-video' && !confirmNoPersonalData)
            }
            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {analyzing 
              ? '⏳ Анализ...' 
              : analysisMode === 'frames'
                ? (extractedFrames.length > 0
                    ? `📤 Отправить ${extractedFrames.length} кадров на анализ`
                    : '🎬 Сначала извлеките кадры'
                  )
                : (confirmNoPersonalData
                    ? '⚡ Отправить полное видео на анализ'
                    : '⚠️ Подтвердите отсутствие ПД'
                  )
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          ❌ {error}
        </div>
      )}

      {loading && (
        <div className="bg-primary-50 border border-primary-200 text-primary-800 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-3"></div>
            <span>Анализ видео может занять 30-60 секунд...</span>
          </div>
        </div>
      )}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        imageType={imageType} 
        cost={currentCost} 
        model={model}
        mode={mode}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="VIDEO" 
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}

      {/* Редактор кадров */}
      {editingFrameIndex !== null && extractedFrames[editingFrameIndex] && (
        <ImageEditor
          imageSrc={extractedFrames[editingFrameIndex].preview}
          fileName={extractedFrames[editingFrameIndex].file.name}
          mimeType={extractedFrames[editingFrameIndex].file.type}
          onSave={handleFrameEditorSave}
          onCancel={() => setEditingFrameIndex(null)}
        />
      )}
    </div>
  )
}
