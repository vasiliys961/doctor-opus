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
}

export default function Dicom3DViewer({ files, onClose }: Dicom3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const axialRef = useRef<HTMLDivElement>(null)
  const coronalRef = useRef<HTMLDivElement>(null)
  const sagittalRef = useRef<HTMLDivElement>(null)
  
  const [loading, setLoading] = useState(true)
  const [decodeProgress, setDecodeProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [vtkReady, setVtkReady] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.vtk) {
      setVtkReady(true);
    }
  }, []);

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

      // Лимит срезов для стабильности MPR
      const limit = 300;
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
      ];

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
        const view = views[viewIdx];
        if (!view) return;
        
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
          if (!v.renderWindow.getViews()[0]) return;
          const dims = v.renderWindow.getViews()[0].getContainer().getBoundingClientRect();
          if (dims.width > 0 && dims.height > 0) {
            v.renderWindow.getViews()[0].setSize(Math.floor(dims.width), Math.floor(dims.height));
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
      
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95 backdrop-blur-md p-2">
        <div className="relative w-full h-full max-w-7xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-gray-700">
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
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* MPR Content */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-1 bg-gray-800 relative">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
                <p className="text-white font-medium">Сборка MPR срезов: {decodeProgress.current} из {decodeProgress.total}</p>
              </div>
            )}
            
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 z-20 bg-gray-900">
                <div className="text-red-500 text-center max-w-md">
                  <p className="text-xl font-bold mb-4">Ошибка MPR</p>
                  <p className="text-sm">{error}</p>
                  <button onClick={onClose} className="mt-6 px-6 py-2 bg-red-900 text-white rounded-lg">Закрыть</button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative flex flex-col h-full bg-black border border-gray-700 group">
                  <div className="absolute top-2 left-2 z-10 text-[10px] text-yellow-500 font-bold uppercase">Axial</div>
                  <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => (window as any).mprZoom?.(0, 0.8)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">+</button>
                    <button onClick={() => (window as any).mprZoom?.(0, 1.2)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">−</button>
                    <button onClick={() => (window as any).mprReset?.(0)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">⟲</button>
                  </div>
                  <div ref={axialRef} className="flex-1 touch-none" />
                </div>
                <div className="relative flex flex-col h-full bg-black border border-gray-700 group">
                  <div className="absolute top-2 left-2 z-10 text-[10px] text-blue-500 font-bold uppercase">Coronal</div>
                  <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => (window as any).mprZoom?.(1, 0.8)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">+</button>
                    <button onClick={() => (window as any).mprZoom?.(1, 1.2)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">−</button>
                    <button onClick={() => (window as any).mprReset?.(1)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">⟲</button>
                  </div>
                  <div ref={coronalRef} className="flex-1 touch-none" />
                </div>
                <div className="relative flex flex-col h-full bg-black border border-gray-700 group">
                  <div className="absolute top-2 left-2 z-10 text-[10px] text-green-500 font-bold uppercase">Sagittal</div>
                  <div className="absolute top-2 right-2 z-20 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => (window as any).mprZoom?.(2, 0.8)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">+</button>
                    <button onClick={() => (window as any).mprZoom?.(2, 1.2)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">−</button>
                    <button onClick={() => (window as any).mprReset?.(2)} className="w-8 h-8 bg-gray-800 text-white rounded border border-gray-600 hover:bg-primary-600">⟲</button>
                  </div>
                  <div ref={sagittalRef} className="flex-1 touch-none" />
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
