'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    vtk: any
  }
}

interface Dicom3DViewerProps {
  files: File[]
  onClose: () => void
  presentation?: 'modal' | 'fullscreen'
}

export default function Dicom3DViewer({ files, onClose, presentation = 'modal' }: Dicom3DViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const axialRef = useRef<HTMLDivElement>(null)
  const coronalRef = useRef<HTMLDivElement>(null)
  const sagittalRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)
  
  const [loading, setLoading] = useState(true)
  const [decodeProgress, setDecodeProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [vtkReady, setVtkReady] = useState(false)
  const [activePreset, setActivePreset] = useState<'default' | 'bone' | 'brain' | 'mip' | 'glow' | 'xray_light' | 'vessels' | 'organ_lesion'>('default')
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false)
  const [isVolumeOnly, setIsVolumeOnly] = useState(false)

  // Хранилище для функций передачи (чтобы менять их на лету)
  const volumePropertyRef = useRef<any>(null)
  const renderWindowRef = useRef<any>(null)
  const mapperRef = useRef<any>(null)

  const getNormalizedRange = (scalarArray: any) => {
    if (!scalarArray) return { min: 0, max: 1, delta: 1 };
    const [min, max] = scalarArray.getRange();
    const delta = max - min || 1;
    return { min, max, delta };
  };

  const huWindowToScalarRange = (min: number, max: number, huLow: number, huHigh: number) => {
    const clampedLow = Math.max(min, Math.min(max, huLow));
    const clampedHigh = Math.max(min, Math.min(max, huHigh));
    return { low: clampedLow, high: clampedHigh };
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.vtk) {
      setVtkReady(true);
    }
  }, []);

  const getFullscreenElement = () => {
    if (typeof document === 'undefined') return null
    const anyDoc = document as any
    return document.fullscreenElement || anyDoc.webkitFullscreenElement || anyDoc.webkitCurrentFullScreenElement || null
  }

  const requestBrowserFullscreen = async (el: HTMLElement) => {
    const anyEl = el as any
    if (el.requestFullscreen) return el.requestFullscreen()
    // Safari (особенно macOS) нередко использует webkit-prefixed API
    if (anyEl.webkitRequestFullscreen) return anyEl.webkitRequestFullscreen()
    if (anyEl.webkitRequestFullScreen) return anyEl.webkitRequestFullScreen()
    throw new Error('Fullscreen API is not supported')
  }

  const exitBrowserFullscreen = async () => {
    const anyDoc = document as any
    if (document.exitFullscreen) return document.exitFullscreen()
    if (anyDoc.webkitExitFullscreen) return anyDoc.webkitExitFullscreen()
    if (anyDoc.webkitCancelFullScreen) return anyDoc.webkitCancelFullScreen()
    throw new Error('Fullscreen API is not supported')
  }

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onFsChange = () => setIsBrowserFullscreen(Boolean(getFullscreenElement()))
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange as EventListener)
    onFsChange()
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange as EventListener)
    }
  }, [])

  useEffect(() => {
    // При смене раскладки grid размеры контейнеров меняются без window.resize.
    // Триггерим существующий handleResize (он подписан на window.resize в initVtk).
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 0)
    return () => window.clearTimeout(t)
  }, [isVolumeOnly])

  useEffect(() => {
    // После первичной загрузки DOM/лейаут может "дотягиваться", из-за чего resetCamera
    // случается при не финальном размере контейнера. Пинаем resize ещё раз.
    if (loading || error) return
    const t1 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
    const t2 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 250)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [loading, error])

  const toggleBrowserFullscreen = async () => {
    try {
      if (typeof document === 'undefined') return
      if (!getFullscreenElement()) {
        // 1) Стараемся развернуть именно оверлей (лучше для UI)
        if (rootRef.current) {
          await requestBrowserFullscreen(rootRef.current)
          return
        }
        // 2) Фоллбек: весь документ
        await requestBrowserFullscreen(document.documentElement)
      } else {
        await exitBrowserFullscreen()
      }
    } catch (e) {
      console.warn('Fullscreen toggle failed:', e)
    }
  }

  const initVtk = async () => {
    if (!window.vtk || !axialRef.current || files.length === 0) return

    try {
      console.log(`🏗️ [MPR] Starting MPR build with ${files.length} files...`)
      
      const vtk = window.vtk
      const cornerstone = await import('cornerstone-core');
      const cornerstoneWADOImageLoader = await import('cornerstone-wado-image-loader');
      const { initCornerstone } = await import('@/lib/dicom-client-processor');
      
      initCornerstone();
      
      const pixelDataArrays: any[] = [];
      let width = 0;
      let height = 0;
      let spacing = [1, 1, 1];

      // Лимит срезов для стабильности MPR (увеличено для детальности)
      const limit = 500;
      let filesToProcess = files.length > limit ? files.slice(0, limit) : files;
      
      setDecodeProgress({ current: 0, total: filesToProcess.length });

      // 1. Предварительная загрузка метаданных для сортировки
      console.log('Sorting files by instance/position...');
      const fileDataList: { file: File, instance: number, position: number }[] = [];
      
      for (const file of filesToProcess) {
        const isDicom = file.name.toLowerCase().endsWith('.dcm') || 
                        file.name.toLowerCase().endsWith('.dicom') || 
                        file.type === 'application/dicom';
        
        if (isDicom) {
          const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
          const image = await cornerstone.loadImage(imageId);
          const instance = image.data.intString('x00200013') || 0; // Instance Number
          // Позиция по Z (из Image Position Patient)
          const posString = image.data.string('x00200032');
          let zPos = 0;
          if (posString) {
            const parts = posString.split('\\');
            zPos = parseFloat(parts[2]) || 0;
          }
          fileDataList.push({ file, instance, position: zPos });
        } else {
          fileDataList.push({ file, instance: 0, position: 0 });
        }
      }

      // Сортируем: сначала по позиции Z, если её нет - по номеру инстанса, если нет - по имени
      fileDataList.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        if (a.instance !== b.instance) return a.instance - b.instance;
        return a.file.name.localeCompare(b.file.name);
      });

      const sortedFiles = fileDataList.map(d => d.file);
      
      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        const isDicom = file.name.toLowerCase().endsWith('.dcm') || 
                        file.name.toLowerCase().endsWith('.dicom') || 
                        file.type === 'application/dicom';
        
        try {
          if (isDicom) {
            const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
            const image = await cornerstone.loadImage(imageId);
            if (i === 0) {
              width = image.width;
              height = image.height;
              try {
                const pixelSpacing = image.data.string('x00280030');
                if (pixelSpacing) {
                  const parts = pixelSpacing.split('\\');
                  spacing[0] = parseFloat(parts[0]) || 1;
                  spacing[1] = parseFloat(parts[1]) || 1;
                }
                const sliceThickness = image.data.floatString('x00180050');
                if (sliceThickness) spacing[2] = sliceThickness;
              } catch (e) {}
            }
            pixelDataArrays.push(image.getPixelData());
          } else {
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(bitmap, 0, 0);
              const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
              const grayscale = new Uint8Array(bitmap.width * bitmap.height);
              for (let j = 0; j < imgData.data.length; j += 4) {
                grayscale[j / 4] = Math.round(0.299 * imgData.data[j] + 0.587 * imgData.data[j+1] + 0.114 * imgData.data[j+2]);
              }
              if (i === 0) {
                width = bitmap.width;
                height = bitmap.height;
                spacing = [1, 1, 3];
              }
              pixelDataArrays.push(grayscale);
            }
          }
          setDecodeProgress(prev => ({ ...prev, current: i + 1 }));
        } catch (err) {
          console.warn(`[MPR] Skip slice ${i}`, err);
        }
      }

      // Корректный расчет Z-spacing на основе позиции срезов (убирает "вытянутость")
      if (fileDataList.length > 1 && fileDataList[0].position !== fileDataList[1].position) {
        const realZSpacing = Math.abs(fileDataList[1].position - fileDataList[0].position);
        if (realZSpacing > 0.1 && realZSpacing < 20) {
          console.log(`📏 [MPR] Calculated real Z-spacing: ${realZSpacing.toFixed(3)}mm`);
          spacing[2] = realZSpacing;
        }
      }

      if (pixelDataArrays.length < 2) {
        throw new Error('Недостаточно данных для построения 3D срезов. Загрузите серию снимков.');
      }

      // Создаем vtkImageData
      const imageData = vtk.Common.DataModel.vtkImageData.newInstance();
      imageData.setDimensions(width, height, pixelDataArrays.length);
      imageData.setSpacing(spacing[0], spacing[1], spacing[2]);

      const numVoxels = width * height * pixelDataArrays.length;
      let voxels;
      const firstArray = pixelDataArrays[0];
      if (firstArray instanceof Int16Array) voxels = new Int16Array(numVoxels);
      else if (firstArray instanceof Uint16Array) voxels = new Uint16Array(numVoxels);
      else voxels = new Float32Array(numVoxels);
      
      for (let i = 0; i < pixelDataArrays.length; i++) {
        voxels.set(pixelDataArrays[i], i * width * height);
      }

      const scalarArray = vtk.Common.Core.vtkDataArray.newInstance({
        name: 'Scalars',
        numberOfComponents: 1,
        values: voxels,
      });
      imageData.getPointData().setScalars(scalarArray);

      console.log(`📊 [MPR] Scalar Range: [${scalarArray.getRange()[0]}, ${scalarArray.getRange()[1]}]`);
      console.log(`📊 [MPR] Center: [${imageData.getCenter()}]`);

      // === Новый setupVolumeRendering ===
      const setupVolumeRendering = (container: HTMLElement) => {
        const renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
        const renderer = vtk.Rendering.Core.vtkRenderer.newInstance();
        renderWindow.addRenderer(renderer);
        renderer.setBackground(0.05, 0.05, 0.05);

        const openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
        renderWindow.addView(openGLRenderWindow);
        openGLRenderWindow.setContainer(container);

        const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
        interactor.setView(openGLRenderWindow);
        interactor.initialize();
        interactor.bindEvents(container);

        const volume = vtk.Rendering.Core.vtkVolume.newInstance();
        const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();

        // базовый шаг рейкастинга — баланс качество/скорость для M1
        mapper.setSampleDistance(0.9);
        mapper.setInputData(imageData);
        volume.setMapper(mapper);

        const property = vtk.Rendering.Core.vtkVolumeProperty.newInstance();
        property.setInterpolationTypeToLinear();
        property.setShade(true);

        // мягкий, «объёмный» свет по умолчанию
        property.setAmbient(0.4);
        property.setDiffuse(0.4);
        property.setSpecular(0.2);
        property.setSpecularPower(30);

        const ctfun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
        const ofun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();

        const range = scalarArray.getRange();
        const [min, max] = range;
        const delta = max - min;

        // Стартовый пресет: мягкие ткани прозрачные, плотное — видно
        ctfun.addRGBPoint(min, 0, 0, 0);
        ctfun.addRGBPoint(min + 0.2 * delta, 0.6, 0.4, 0.4);
        ctfun.addRGBPoint(min + 0.6 * delta, 0.95, 0.85, 0.8);
        ctfun.addRGBPoint(max, 1, 1, 1);

        ofun.addPoint(min, 0.0);
        ofun.addPoint(min + 0.1 * delta, 0.0);   // Жесткая отсечка воздуха (убирает "трубу")
        ofun.addPoint(min + 0.2 * delta, 0.02);  // Поверхностные ткани (кожа)
        ofun.addPoint(min + 0.4 * delta, 0.20);  // Внутренние органы - плотнее
        ofun.addPoint(min + 0.70 * delta, 0.75); // Кости/ребра - стали гораздо четче
        ofun.addPoint(max, 0.95);

        property.setRGBTransferFunction(0, ctfun);
        property.setScalarOpacity(0, ofun);
        volume.setProperty(property);
        renderer.addVolume(volume);
        renderer.resetCamera();
        
        // Освещение для высокой четкости и глубоких теней
        property.setShade(true);
        property.setAmbient(0.15);   // Меньше фонового света для контраста
        property.setDiffuse(0.8);    // Больше направленного света для объема
        property.setSpecular(0.4);   // Яркие блики на костях/плотных органах
        property.setSpecularPower(50);
        
        const style = vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance();
        interactor.setInteractorStyle(style);

        // Постоянное высокое качество (без адаптивного снижения)
        mapper.setSampleDistance(0.35); 
        renderWindow.render();

        volumePropertyRef.current = property;
        renderWindowRef.current = renderWindow;

        return { renderWindow, renderer, interactor, volume, property, ctfun, ofun };
      };

      // Настройка вьюпортов
      const setupViewport = (container: HTMLElement, axis: number) => {
        const renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
        const renderer = vtk.Rendering.Core.vtkRenderer.newInstance();
        renderWindow.addRenderer(renderer);

        const openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
        renderWindow.addView(openGLRenderWindow);
        openGLRenderWindow.setContainer(container);

        const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
        interactor.setView(openGLRenderWindow);
        interactor.initialize();
        interactor.bindEvents(container);

        const imageResliceMapper = vtk.Rendering.Core.vtkImageResliceMapper.newInstance();
        imageResliceMapper.setInputData(imageData);
        imageResliceMapper.setSlicePlane(vtk.Common.DataModel.vtkPlane.newInstance());
        
        const sliceActor = vtk.Rendering.Core.vtkImageSlice.newInstance();
        sliceActor.setMapper(imageResliceMapper);
        
        // Авто-настройка яркости/контраста (Window/Level)
        const range = scalarArray.getRange();
        sliceActor.getProperty().setColorWindow(range[1] - range[0]);
        sliceActor.getProperty().setColorLevel((range[1] + range[0]) / 2);
        sliceActor.getProperty().setInterpolationTypeToLinear();
        
        renderer.addActor(sliceActor);

        // Настройка осей
        const axes = [
          [0, 0, 1], // Axial
          [0, 1, 0], // Coronal
          [1, 0, 0], // Sagittal
        ];
        
        const normal = axes[axis];
        const plane = imageResliceMapper.getSlicePlane();
        plane.setNormal(normal);
        
        const center = imageData.getCenter();
        plane.setOrigin(center);

        const camera = renderer.getActiveCamera();
        camera.setParallelProjection(true);
        
        // Устанавливаем положение камеры в зависимости от оси
        if (axis === 0) { // Axial
          camera.setPosition(center[0], center[1], center[2] + 1000);
          camera.setViewUp(0, -1, 0);
        } else if (axis === 1) { // Coronal
          camera.setPosition(center[0], center[1] + 1000, center[2]);
          camera.setViewUp(0, 0, 1);
        } else if (axis === 2) { // Sagittal
          camera.setPosition(center[0] + 1000, center[1], center[2]);
          camera.setViewUp(0, 0, 1);
        }
        
        renderer.resetCamera();
        
        // Интерактивы
        const style = vtk.Interaction.Style.vtkInteractorStyleImage.newInstance();
        interactor.setInteractorStyle(style);

        renderWindow.render();
        return { renderWindow, renderer, imageResliceMapper, interactor, axis, plane };
      };

      const views = [
        setupViewport(axialRef.current!, 0),
        setupViewport(coronalRef.current!, 1),
        setupViewport(sagittalRef.current!, 2),
        setupVolumeRendering(volumeRef.current!),
      ];

      // === Новый applyPreset ===
      const applyPreset = (
        presetName: 'default' | 'bone' | 'brain' | 'mip' | 'glow' | 'xray_light' | 'vessels' | 'organ_lesion'
      ) => {
        if (!volumePropertyRef.current || !renderWindowRef.current) return;

        const property = volumePropertyRef.current;
        const range = scalarArray.getRange();
        const [min, max] = range;
        const delta = max - min;

        const vtk = (window as any).vtk;
        const ctfun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
        const ofun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();

        setActivePreset(presetName);

        // базовые значения освещения, дальше меняем по режиму
        property.setShade(true);
        property.setAmbient(0.4);
        property.setDiffuse(0.4);
        property.setSpecular(0.2);
        property.setSpecularPower(30);

        switch (presetName) {
          case 'bone':
            // кости: теперь максимально четкие и плотные
            ctfun.addRGBPoint(min, 0, 0, 0);
            ctfun.addRGBPoint(min + 0.5 * delta, 0.4, 0.2, 0.2);
            ctfun.addRGBPoint(min + 0.6 * delta, 0.9, 0.85, 0.8); // Начало костей раньше
            ctfun.addRGBPoint(max, 1, 1, 1);

            ofun.addPoint(min, 0.0);
            ofun.addPoint(min + 0.50 * delta, 0.0); 
            ofun.addPoint(min + 0.65 * delta, 0.8); // Резкий взлет плотности для ребер
            ofun.addPoint(max, 1.0);
            
            property.setAmbient(0.1);
            property.setDiffuse(0.9);
            property.setSpecular(0.6);
            property.setSpecularPower(60);
            break;

          case 'brain': {
            // "Просвет": увеличиваем контраст
            const low = min + 0.15 * delta;
            const mid = min + 0.6 * delta;
            const high = min + 0.85 * delta;

            ctfun.addRGBPoint(min, 0, 0, 0);
            ctfun.addRGBPoint(low, 0.2, 0.2, 0.4);
            ctfun.addRGBPoint(mid, 0.7, 0.7, 0.9);
            ctfun.addRGBPoint(high, 1.0, 0.4, 0.3);
            ctfun.addRGBPoint(max, 1.0, 0.9, 0.0);

            ofun.addPoint(min, 0.0);
            ofun.addPoint(low, 0.0);
            ofun.addPoint(mid, 0.02);
            ofun.addPoint(high, 0.4);
            ofun.addPoint(max, 0.8);

            property.setAmbient(0.2);
            property.setDiffuse(0.7);
            property.setSpecular(0.3);
            break;
          }

          case 'glow': {
            const [min, max] = range;
            const delta = max - min;
            const low = min + 0.2 * delta;
            const mid = min + 0.6 * delta;
            const high = min + 0.85 * delta;

            ctfun.addRGBPoint(min, 0, 0, 0);
            ctfun.addRGBPoint(low, 0.0, 0.15, 0.4);
            ctfun.addRGBPoint(mid, 0.0, 0.8, 1.0);
            ctfun.addRGBPoint(high, 0.6, 1.0, 0.8);
            ctfun.addRGBPoint(max, 1.0, 1.0, 1.0);

            ofun.addPoint(min, 0.0);
            ofun.addPoint(low, 0.0);
            ofun.addPoint(mid, 0.005);  // тело практически невидимо
            ofun.addPoint(high, 0.3);   // очаги начинают "гореть"
            ofun.addPoint(max, 0.9);

            property.setAmbient(0.9);   // возвращаем экстремальное свечение
            property.setDiffuse(0.2);
            property.setSpecular(0.4);
            property.setSpecularPower(50);
            break;
          }

          case 'mip':
            property.setShade(false);
            ctfun.addRGBPoint(min, 0, 0, 0);
            ctfun.addRGBPoint(max, 1, 1, 1);
            ofun.addPoint(min, 0.0);
            ofun.addPoint(max, 1.0);
            break;

          default:
            // настройки кости из МРТ/КТ (перенесены в раздел ткани)
            const softEnd = min + 0.55 * delta;
            const boneLow = min + 0.75 * delta;

            ctfun.addRGBPoint(min, 0, 0, 0);
            ctfun.addRGBPoint(softEnd, 0.3, 0.2, 0.2);
            ctfun.addRGBPoint(boneLow, 0.95, 0.85, 0.8);
            ctfun.addRGBPoint(max, 1.0, 1.0, 1.0);

            ofun.addPoint(min, 0.0);
            ofun.addPoint(softEnd, 0.0);
            ofun.addPoint(boneLow, 0.7);
            ofun.addPoint(max, 1.0);

            property.setAmbient(0.4);
            property.setDiffuse(0.7);
            property.setSpecular(0.5);
            property.setSpecularPower(80);
            break;
        }

        property.setRGBTransferFunction(0, ctfun);
        property.setScalarOpacity(0, ofun);
        renderWindowRef.current.render();
      };

      (window as any).applyDicomPreset = applyPreset;

      // Функция для программного зума
      const adjustZoom = (viewIdx: number, factor: number) => {
        const view = views[viewIdx];
        const camera = view.renderer.getActiveCamera();
        if (camera.getParallelProjection()) {
          const scale = camera.getParallelScale();
          camera.setParallelScale(scale * factor);
        } else {
          camera.zoom(factor);
        }
        view.renderWindow.render();
      };

      const resetView = (viewIdx: number) => {
        const view = views[viewIdx];
        view.renderer.resetCamera();
        view.renderWindow.render();
      };

      // Прокидываем функции в window для доступа из кнопок (упрощенно для прототипа)
      (window as any).mprZoom = adjustZoom;
      (window as any).mprReset = resetView;

      // Управление срезами через колесико мыши
      const wheelHandlers: ((e: WheelEvent) => void)[] = [];
      
      const handleWheel = (e: WheelEvent, viewIdx: number) => {
        e.preventDefault();
        const view: any = views[viewIdx];
        if (!view || viewIdx >= 3) return; // Только для MPR срезов (Axial, Coronal, Sagittal)
        
        const plane = view.plane;
        const origin = plane.getOrigin();
        const normal = plane.getNormal();
        
        const delta = e.deltaY > 0 ? -1 : 1;
        
        // Определяем индекс шага (axis 0=Axial/Z, 1=Coronal/Y, 2=Sagittal/X)
        // В vtkImageData: [X, Y, Z] -> spacing[0, 1, 2]
        // Axial (axis 0) нормаль [0,0,1] -> шаг по Z (spacing[2])
        // Coronal (axis 1) нормаль [0,1,0] -> шаг по Y (spacing[1])
        // Sagittal (axis 2) нормаль [1,0,0] -> шаг по X (spacing[0])
        const stepSize = spacing[viewIdx === 0 ? 2 : viewIdx === 1 ? 1 : 0] || 1;
        const step = stepSize * delta;
        
        const newOrigin = [
          origin[0] + normal[0] * step,
          origin[1] + normal[1] * step,
          origin[2] + normal[2] * step,
        ];
        
        // Проверка границ
        const bounds = imageData.getBounds();
        if (newOrigin[0] < bounds[0] - 2 || newOrigin[0] > bounds[1] + 2) return;
        if (newOrigin[1] < bounds[2] - 2 || newOrigin[1] > bounds[3] + 2) return;
        if (newOrigin[2] < bounds[4] - 2 || newOrigin[2] > bounds[5] + 2) return;

        plane.setOrigin(newOrigin);
        view.renderWindow.render();
      };

      [axialRef, coronalRef, sagittalRef].forEach((ref, idx) => {
        const handler = (e: WheelEvent) => handleWheel(e, idx);
        wheelHandlers.push(handler);
        ref.current?.addEventListener('wheel', handler, { passive: false });
        
        // Поддержка жестов тачпада (двухпальцевый скролл)
        let lastTouchY = 0;
        ref.current?.addEventListener('touchstart', (e) => {
          if (e.touches.length === 2) {
            lastTouchY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
          }
        }, { passive: true });

        ref.current?.addEventListener('touchmove', (e) => {
          if (e.touches.length === 2) {
            e.preventDefault();
            const currentY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
            const deltaY = lastTouchY - currentY;
            if (Math.abs(deltaY) > 5) {
              const fakeWheelEvent = {
                preventDefault: () => {},
                deltaY: deltaY,
              } as WheelEvent;
              handleWheel(fakeWheelEvent, idx);
              lastTouchY = currentY;
            }
          }
        }, { passive: false });
      });

      // Синхронизация ресайза
      const handleResize = () => {
        views.forEach(v => {
          const view = v.renderWindow.getViews?.()?.[0];
          if (!view) return;

          // В редких случаях (fast refresh/перемонтирование DOM) container может быть null.
          const container = view.getContainer?.();
          if (!container) return;

          const dims = container.getBoundingClientRect?.();
          if (!dims) return;

          if (dims.width > 0 && dims.height > 0) {
            view.setSize(Math.floor(dims.width), Math.floor(dims.height));
            v.renderer.resetCamera();
            v.renderWindow.render();
          }
        });
      };
      window.addEventListener('resize', handleResize);
      
      // Форсируем начальный рендеринг через паузу, чтобы контейнеры успели обрести размер
      setTimeout(() => {
        handleResize();
        console.log('✅ [MPR] Views initialized and rendered');
      }, 300);

      setLoading(false);
      return () => {
        window.removeEventListener('resize', handleResize);
        [axialRef, coronalRef, sagittalRef].forEach((ref, idx) => {
          if (ref.current && wheelHandlers[idx]) {
            ref.current.removeEventListener('wheel', wheelHandlers[idx]);
          }
        });
        // Очистка vtk объектов для освобождения памяти
        views.forEach(v => {
          if (v.interactor) v.interactor.delete();
          if (v.renderWindow) v.renderWindow.delete();
        });
      };
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (vtkReady) initVtk()
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [vtkReady])

  return (
    <>
      <Script 
        src="/libs/vtk/vtk.js" 
        onLoad={() => setVtkReady(true)}
      />
      
      <div
        ref={rootRef}
        className={`fixed inset-0 z-50 flex bg-black bg-opacity-95 backdrop-blur-md ${
          presentation === 'fullscreen'
            ? 'p-0 items-stretch justify-stretch w-screen h-screen'
            : 'p-2 items-center justify-center'
        }`}
      >
        <div
          className={`relative w-full h-full min-h-0 bg-gray-900 overflow-hidden shadow-2xl flex flex-col border border-gray-700 ${
            presentation === 'fullscreen' ? 'max-w-none rounded-none border-0' : 'max-w-7xl rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                <span className="mr-2">🏥</span> Профессиональный MPR Вьюер
              </h3>
              <p className="text-xs text-gray-400">
                Мультипланарная реконструкция: Axial, Coronal, Sagittal
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleBrowserFullscreen}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white"
                title={isBrowserFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим браузера'}
              >
                <span className="text-lg">{isBrowserFullscreen ? '🗗' : '🗖'}</span>
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white" title="Закрыть">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* MPR Content */}
          <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-px bg-gray-800 relative">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
                <p className="text-white font-medium">Сборка 3D модели: {decodeProgress.current} из {decodeProgress.total}</p>
              </div>
            )}
            
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 z-20 bg-gray-900">
                <div className="text-red-500 text-center max-w-md">
                  <p className="text-xl font-bold mb-4">Ошибка 3D</p>
                  <p className="text-sm">{error}</p>
                  <button onClick={onClose} className="mt-6 px-6 py-2 bg-red-900 text-white rounded-lg">Закрыть</button>
                </div>
              </div>
            ) : (
              <>
                {/* Viewports */}
                <div className={`relative flex flex-col h-full bg-black border border-gray-700 group ${isVolumeOnly ? 'hidden' : ''}`}>
                  <div className="absolute top-2 left-2 z-10 text-[10px] text-yellow-500 font-bold uppercase">Axial (Z)</div>
                  <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => (window as any).mprZoom?.(0, 0.8)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">+</button>
                    <button onClick={() => (window as any).mprZoom?.(0, 1.2)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">−</button>
                  </div>
                  <div ref={axialRef} className="flex-1 touch-none" />
                </div>

                <div className={`relative flex flex-col h-full bg-black border border-gray-700 group ${isVolumeOnly ? 'hidden' : ''}`}>
                  <div className="absolute top-2 left-2 z-10 text-[10px] text-blue-500 font-bold uppercase">Coronal (Y)</div>
                  <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => (window as any).mprZoom?.(1, 0.8)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">+</button>
                    <button onClick={() => (window as any).mprZoom?.(1, 1.2)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">−</button>
                  </div>
                  <div ref={coronalRef} className="flex-1 touch-none" />
                </div>

                <div className={`relative flex flex-col h-full bg-black border border-gray-700 group ${isVolumeOnly ? 'hidden' : ''}`}>
                  <div className="absolute top-2 left-2 z-10 text-[10px] text-green-500 font-bold uppercase">Sagittal (X)</div>
                  <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => (window as any).mprZoom?.(2, 0.8)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">+</button>
                    <button onClick={() => (window as any).mprZoom?.(2, 1.2)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">−</button>
                  </div>
                  <div ref={sagittalRef} className="flex-1 touch-none" />
                </div>

                <div
                  className={`relative flex flex-col h-full bg-black border border-gray-700 group ${
                    isVolumeOnly ? 'col-span-2 row-span-2' : ''
                  }`}
                >
                  <div className="absolute top-2 left-2 z-10 text-[10px] text-purple-500 font-bold uppercase">3D Volume Reconstruction</div>

                  <button
                    onClick={() => setIsVolumeOnly(v => !v)}
                    className="absolute top-2 right-2 z-30 w-12 h-12 flex items-center justify-center text-2xl bg-black/80 hover:bg-black rounded-lg border border-gray-500 text-white shadow-lg transition-colors"
                    title={isVolumeOnly ? 'Вернуть 4 окна' : 'Только 3D'}
                    type="button"
                  >
                    ⤢
                  </button>
                  
                  {/* Presets Controls inside 3D View */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1.5 bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700">
                    <button 
                      onClick={() => (window as any).applyDicomPreset?.('default')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${activePreset === 'default' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      Ткани
                    </button>
                    <button 
                      onClick={() => (window as any).applyDicomPreset?.('bone')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${activePreset === 'bone' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      Кости
                    </button>
                    <button 
                      onClick={() => (window as any).applyDicomPreset?.('brain')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${activePreset === 'brain' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      Мозг
                    </button>
                    <button 
                      onClick={() => (window as any).applyDicomPreset?.('glow')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${activePreset === 'glow' ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      Свечение ✨
                    </button>
                    <button 
                      onClick={() => (window as any).applyDicomPreset?.('mip')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${activePreset === 'mip' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      MIP
                    </button>
                  </div>

                  <div ref={volumeRef} className="flex-1 touch-none" />
                </div>
              </>
            )}
          </div>

          <div className="p-3 bg-gray-950 border-t border-gray-800 text-[10px] text-gray-500 flex justify-between items-center">
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5"></span> Скролл/2 пальца: Слои</span>
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span> ЛКМ/1 палец: Яркость</span>
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span> ПКМ/Пинч: Зум</span>
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5"></span> Shift+ЛКМ: Смещение</span>
            </div>
            <div className="hidden sm:block text-primary-600 font-bold uppercase tracking-widest opacity-50">
              Medical MPR Engine v1.1
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
