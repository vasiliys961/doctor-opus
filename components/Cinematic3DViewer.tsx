'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { prepareVolumeData } from '@/lib/dicom-3d-processor'

interface Cinematic3DViewerProps {
  files: File[]
  onClose: () => void
}

export default function Cinematic3DViewer({ files, onClose }: Cinematic3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)
  
  const [loading, setLoading] = useState(true)
  const [decodeProgress, setDecodeProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [vtkReady, setVtkReady] = useState(false)
  const [renderMode, setRenderMode] = useState<'clinical' | 'cinematic'>('clinical')
  const [activePreset, setActivePreset] = useState<'default' | 'bone' | 'vessels' | 'mip' | 'xray_light' | 'brain' | 'glow' | 'organ_lesion'>('default')
  const [quality, setQuality] = useState<'normal' | 'high'>('normal')

  const volumePropertyRef = useRef<any>(null)
  const renderWindowRef = useRef<any>(null)
  const mapperRef = useRef<any>(null)
  const imageDataRef = useRef<any>(null)
  const scalarArrayRef = useRef<any>(null)

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

  const qualityRef = useRef(quality);
  const renderModeRef = useRef(renderMode);

  useEffect(() => {
    qualityRef.current = quality;
    renderModeRef.current = renderMode;
    if (typeof window !== 'undefined') {
      (window as any).currentCinematicQuality = quality;
      (window as any).currentCinematicMode = renderMode;
    }
  }, [quality, renderMode]);

  const initVtk = async () => {
    if (!window.vtk || !volumeRef.current || files.length === 0) return

    try {
      setLoading(true)
      const vtk = window.vtk
      const cornerstone = await import('cornerstone-core');
      const cornerstoneWADOImageLoader = await import('cornerstone-wado-image-loader');
      const { initCornerstone } = await import('@/lib/dicom-client-processor');
      
      initCornerstone();
      
      const pixelDataArrays: any[] = [];
      let width = 0;
      let height = 0;
      let spacing = [1, 1, 1];

      // Лимит файлов для продвинутого вьюера (до 500 для M1)
      const limit = 500;
      let filesToProcess = files.length > limit ? files.slice(0, limit) : files;
      setDecodeProgress({ current: 0, total: filesToProcess.length });

      // Сортировка (упрощенная для примера, можно взять полную из Dicom3DViewer)
      const fileDataList: any[] = [];
      for (const file of filesToProcess) {
        const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
        const image = await cornerstone.loadImage(imageId);
        const posString = image.data.string('x00200032');
        let zPos = 0;
        if (posString) zPos = parseFloat(posString.split('\\')[2]) || 0;
        fileDataList.push({ file, position: zPos, image });
      }
      fileDataList.sort((a, b) => a.position - b.position);

      width = fileDataList[0].image.width;
      height = fileDataList[0].image.height;
      
      try {
        const pixelSpacing = fileDataList[0].image.data.string('x00280030');
        if (pixelSpacing) {
          const parts = pixelSpacing.split('\\');
          spacing[0] = parseFloat(parts[0]) || 1;
          spacing[1] = parseFloat(parts[1]) || 1;
        }
        const sliceThickness = fileDataList[0].image.data.floatString('x00180050');
        if (sliceThickness) spacing[2] = sliceThickness;
      } catch (e) {}

      for (let i = 0; i < fileDataList.length; i++) {
        pixelDataArrays.push(fileDataList[i].image.getPixelData());
        setDecodeProgress(prev => ({ ...prev, current: i + 1 }));
      }

      let imageData = vtk.Common.DataModel.vtkImageData.newInstance();
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
      
      // Обработка данных (даунсэмплинг если нужно)
      imageData = await prepareVolumeData(vtk, imageData, renderMode === 'cinematic');
      
      imageDataRef.current = imageData;
      scalarArrayRef.current = scalarArray;

      const range = scalarArray.getRange();
      console.log('[CINEMATIC] scalar range =', range[0], range[1]);

      setupRenderer(imageData);
      setLoading(false);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const setupRenderer = (imageData: any) => {
    const vtk = window.vtk;
    const container = volumeRef.current;
    if (!container) return;

    const renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
    const renderer = vtk.Rendering.Core.vtkRenderer.newInstance();
    renderWindow.addRenderer(renderer);
    renderer.setBackground(0.01, 0.01, 0.01);

    const openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
    renderWindow.addView(openGLRenderWindow);
    openGLRenderWindow.setContainer(container);

    const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
    interactor.setView(openGLRenderWindow);
    interactor.initialize();
    interactor.bindEvents(container);

    const volume = vtk.Rendering.Core.vtkVolume.newInstance();
    const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
    
    // Увеличиваем лимит сэмплов до 10000 для сверхчеткости и больших данных
    if (mapper.setMaximumSamples) mapper.setMaximumSamples(10000);
    
    mapper.setSampleDistance(quality === 'high' ? 0.15 : 0.35);
    mapper.setInputData(imageData);
    if (mapper.setUseJittering) mapper.setUseJittering(true);
    
    volume.setMapper(mapper);

    // --- Улучшенная световая схема (Cinematic Lighting) ---
    renderer.removeAllLights();
    
    // 1. Основной свет (Key Light) - теплый, сверху-справа
    const keyLight = vtk.Rendering.Core.vtkLight.newInstance();
    keyLight.setIntensity(0.85);
    keyLight.setColor(1.0, 0.95, 0.9);
    keyLight.setPosition(1, 1, 1);
    renderer.addLight(keyLight);

    // 2. Заполняющий свет (Fill Light) - холодный, слева
    const fillLight = vtk.Rendering.Core.vtkLight.newInstance();
    fillLight.setIntensity(0.4);
    fillLight.setColor(0.8, 0.9, 1.0);
    fillLight.setPosition(-1, 0, 0.5);
    renderer.addLight(fillLight);

    // 3. Контурный свет (Rim Light) - подчеркивает края сзади
    const rimLight = vtk.Rendering.Core.vtkLight.newInstance();
    rimLight.setIntensity(0.6);
    rimLight.setColor(1.0, 1.0, 1.0);
    rimLight.setPosition(0, -1, -1);
    renderer.addLight(rimLight);

    const property = vtk.Rendering.Core.vtkVolumeProperty.newInstance();
    property.setInterpolationTypeToLinear();
    property.setShade(true);
    
    volume.setProperty(property);
    renderer.addVolume(volume);
    renderer.resetCamera();

    const style = vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance();
    interactor.setInteractorStyle(style);

    // Adaptive quality during interaction
    interactor.onStartAnimation(() => {
      mapper.setSampleDistance(0.8);
    });
    interactor.onEndAnimation(() => {
      const currentQuality = (window as any).currentCinematicQuality || 'normal';
      const currentMode = (window as any).currentCinematicMode || 'clinical';
      
      let baseDistance = 0.5;
      if (currentMode === 'cinematic') {
        baseDistance = currentQuality === 'high' ? 0.15 : 0.35;
      } else {
        baseDistance = currentQuality === 'high' ? 0.4 : 0.6;
      }
      
      mapper.setSampleDistance(baseDistance);
      renderWindow.render();
    });

    renderWindow.render();

    renderWindowRef.current = renderWindow;
    volumePropertyRef.current = property;
    mapperRef.current = mapper;

    applyRenderSettings(renderMode, activePreset);
  }

  const applyRenderSettings = (mode: 'clinical' | 'cinematic', preset: string) => {
    if (!volumePropertyRef.current || !scalarArrayRef.current) return;
    
    const vtk = window.vtk;
    const property = volumePropertyRef.current;
    const mapper = mapperRef.current;
    const { min, max, delta } = getNormalizedRange(scalarArrayRef.current);
    console.log('[CINEMATIC] scalar range =', min, max);

    const ctfun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
    const ofun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();

    if (mode === 'cinematic') {
      property.setAmbient(0.4); // Снижаем общий фон для глубоких теней
      property.setDiffuse(0.7); // Больше направленного света
      property.setSpecular(0.5); 
      property.setSpecularPower(80); // Жесткие блики для "влажного" вида
      property.setShade(true);
      mapper.setSampleDistance(quality === 'high' ? 0.15 : 0.35);
      if (mapper.setUseJittering) mapper.setUseJittering(true);
    } else {
      property.setAmbient(0.35);
      property.setDiffuse(0.45);
      property.setSpecular(0.2);
      property.setSpecularPower(25);
      property.setShade(true);
      mapper.setSampleDistance(quality === 'high' ? 0.4 : 0.6);
    }

    switch (preset) {
      case 'bone':
        if (mode === 'cinematic') {
          const softEnd = min + 0.55 * delta;
          const boneLow = min + 0.75 * delta;
          ctfun.addRGBPoint(min, 0, 0, 0);
          ctfun.addRGBPoint(softEnd, 0.3, 0.2, 0.2);
          ctfun.addRGBPoint(boneLow, 0.95, 0.85, 0.8); // Более белая кость
          ctfun.addRGBPoint(max, 1.0, 1.0, 1.0);
          ofun.addPoint(min, 0.0);
          ofun.addPoint(softEnd, 0.0);
          ofun.addPoint(boneLow, 0.7); // Плотнее
          ofun.addPoint(max, 1.0);
        } else {
          ctfun.addRGBPoint(min, 0, 0, 0);
          ctfun.addRGBPoint(min + 0.4 * delta, 0.4, 0.2, 0.2);
          ctfun.addRGBPoint(min + 0.7 * delta, 0.9, 0.8, 0.7);
          ctfun.addRGBPoint(max, 1, 1, 1);
          ofun.addPoint(min, 0);
          ofun.addPoint(min + 0.5 * delta, 0);
          ofun.addPoint(min + 0.7 * delta, 0.5);
          ofun.addPoint(max, 0.95);
        }
        break;
      
      case 'vessels':
        if (mode === 'cinematic') {
          const softEnd = huWindowToScalarRange(min, max, 50, 150).high;
          const vesselLow = huWindowToScalarRange(min, max, 150, 250).low;
          const vesselHi = huWindowToScalarRange(min, max, 250, 500).high;

          ctfun.addRGBPoint(min, 0, 0, 0);
          ctfun.addRGBPoint(softEnd, 0.15, 0.20, 0.35);
          ctfun.addRGBPoint(vesselLow, 0.9, 0.0, 0.0); // Ярко-красный
          ctfun.addRGBPoint(vesselHi, 1.0, 0.4, 0.4);
          ctfun.addRGBPoint(max, 1.0, 1.0, 1.0);

          ofun.addPoint(min, 0.0);
          ofun.addPoint(softEnd, 0.0); // Ткани полностью прозрачны
          ofun.addPoint(vesselLow, 0.5);
          ofun.addPoint(vesselHi, 0.85);
          ofun.addPoint(max, 0.95);

          property.setAmbient(0.3);
          property.setDiffuse(0.8);
          property.setSpecular(0.7);
          property.setSpecularPower(120); // Глянцевые сосуды
        } else {
          const vLow = huWindowToScalarRange(min, max, 100, 200).low;
          const vHi = huWindowToScalarRange(min, max, 200, 600).high;
          ctfun.addRGBPoint(min, 0, 0, 0);
          ctfun.addRGBPoint(vLow, 0.8, 0.1, 0.1); 
          ctfun.addRGBPoint(vHi, 1.0, 0.9, 0.8); 
          ofun.addPoint(min, 0);
          ofun.addPoint(vLow - 50, 0);
          ofun.addPoint(vLow, 0.4);
          ofun.addPoint(vHi, 0.1); 
          ofun.addPoint(max, 0.5);
        }
        break;

      case 'brain': {
        const brainLow = huWindowToScalarRange(min, max, 10, 30).low;
        const brainHi = huWindowToScalarRange(min, max, 30, 80).high;
        const boneLow = huWindowToScalarRange(min, max, 300, 500).low;

        ctfun.addRGBPoint(min, 0, 0, 0);
        ctfun.addRGBPoint(brainLow, 0.2, 0.3, 0.6); // Синеватый мозг
        ctfun.addRGBPoint(brainHi, 0.9, 0.9, 1.0);  // Белое вещество
        ctfun.addRGBPoint(boneLow, 0.8, 0.7, 0.6);  // Кость черепа
        ctfun.addRGBPoint(max, 1.0, 1.0, 1.0);

        ofun.addPoint(min, 0.0);
        ofun.addPoint(brainLow - 10, 0.0);
        ofun.addPoint(brainLow, 0.15);
        ofun.addPoint(brainHi, 0.4);
        ofun.addPoint(boneLow, 0.05); // Кость почти прозрачна, чтобы видеть мозг
        ofun.addPoint(max, 0.7);

        property.setAmbient(0.4);
        property.setDiffuse(0.6);
        property.setSpecular(0.3);
        break;
      }

      case 'glow': {
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
        ofun.addPoint(mid, 0.005);
        ofun.addPoint(high, 0.3);
        ofun.addPoint(max, 0.9);
        property.setAmbient(0.9);
        property.setDiffuse(0.2);
        property.setSpecular(0.4);
        property.setSpecularPower(50);
        break;
      }

      case 'xray_light': {
        const cut = huWindowToScalarRange(min, max, -600, -400).high;
        const bone = huWindowToScalarRange(min, max, 200, 400).low;

        ctfun.addRGBPoint(min, 0, 0, 0);
        ctfun.addRGBPoint(max, 1, 1, 1);

        ofun.addPoint(min, 0.0);
        ofun.addPoint(cut, 0.0); // Удаляем трубу
        ofun.addPoint(bone, 0.05);
        ofun.addPoint(max, 0.15);

        property.setShade(false);
        break;
      }

      case 'organ_lesion': {
        // окно органа и очагов в HU
        const airCut   = huWindowToScalarRange(min, max, -800, -500).high;
        const shellEnd = huWindowToScalarRange(min, max, -150,  -50).high; // кожа/жир
        const organEnd = huWindowToScalarRange(min, max, -50,   200).high; // орган
        const lesionLo = huWindowToScalarRange(min, max, 200,   400).low;  // плотные очаги
        const lesionHi = huWindowToScalarRange(min, max, 400,   1200).high;

        // Цвета: оболочка холодная, орган тёплый, очаги красно-жёлтые
        ctfun.addRGBPoint(min,      0.0, 0.0, 0.0);
        ctfun.addRGBPoint(airCut,   0.05, 0.05, 0.08);
        ctfun.addRGBPoint(shellEnd, 0.4,  0.5,  0.8);   // синеватая оболочка
        ctfun.addRGBPoint(organEnd, 0.85, 0.75, 0.70);  // орган бежевый
        ctfun.addRGBPoint(lesionLo, 1.0,  0.4,  0.3);   // очаги красные
        ctfun.addRGBPoint(lesionHi, 1.0,  0.9,  0.0);   // самые плотные — жёлтые/белые
        ctfun.addRGBPoint(max,      1.0,  1.0,  1.0);

        // Прозрачность: оболочка почти 0, орган тонкий, очаги яркие
        ofun.addPoint(min,       0.0);
        ofun.addPoint(airCut,    0.0);    // воздух/стол
        ofun.addPoint(shellEnd,  0.003);  // кожа
        ofun.addPoint(organEnd,  0.07);   // орган
        ofun.addPoint(lesionLo,  0.45);   // очаги
        ofun.addPoint(lesionHi,  0.9);
        ofun.addPoint(max,       0.9);

        if (mode === 'cinematic') {
          property.setShade(true);
          property.setAmbient(0.3);
          property.setDiffuse(0.8);
          property.setSpecular(0.6);
          property.setSpecularPower(100);
        }
        break;
      }

      case 'mip':
        property.setShade(false);
        ctfun.addRGBPoint(min, 0, 0, 0);
        ctfun.addRGBPoint(max, 1, 1, 1);
        ofun.addPoint(min, 0);
        ofun.addPoint(max, 1);
        break;

      default: {
        // Используем жесткие HU-пороги, так как скалярный диапазон начинается с -2000
        const airCut   = huWindowToScalarRange(min, max, -800, -500).high;
        const fatEnd   = huWindowToScalarRange(min, max, -150, -50).high;
        const softEnd  = huWindowToScalarRange(min, max, -50, 200).high;
        const boneLow  = huWindowToScalarRange(min, max, 300, 800).low;

        if (mode === 'cinematic') {
          ctfun.addRGBPoint(min,      0.0, 0.0, 0.0);
          ctfun.addRGBPoint(airCut,   0.05, 0.05, 0.08);
          ctfun.addRGBPoint(fatEnd,   0.75, 0.60, 0.50); 
          ctfun.addRGBPoint(softEnd,  0.90, 0.40, 0.35); 
          ctfun.addRGBPoint(boneLow,  0.95, 0.85, 0.80); 
          ctfun.addRGBPoint(max,      1.0, 1.0, 1.0);    

          ofun.addPoint(min,      0.0);
          ofun.addPoint(airCut,   0.0); // Гарантированный 0 для воздуха/труб
          ofun.addPoint(fatEnd,   0.005); 
          ofun.addPoint(softEnd,  0.15); 
          ofun.addPoint(boneLow,  0.50);
          ofun.addPoint(max,      0.90);
        } else {
          ctfun.addRGBPoint(min,      0.0, 0.0, 0.0);
          ctfun.addRGBPoint(airCut,   0.05, 0.05, 0.08);
          ctfun.addRGBPoint(fatEnd,   0.80, 0.70, 0.55);
          ctfun.addRGBPoint(softEnd,  0.92, 0.72, 0.65);
          ctfun.addRGBPoint(boneLow,  0.98, 0.90, 0.85);
          ctfun.addRGBPoint(max,      1.0, 1.0, 1.0);

          ofun.addPoint(min,      0.0);
          ofun.addPoint(airCut,   0.0);
          ofun.addPoint(fatEnd,   0.01);
          ofun.addPoint(softEnd,  0.10);
          ofun.addPoint(boneLow,  0.35);
          ofun.addPoint(max,      0.85);
        }
        break;
      }
    }

    if (property.setGradientOpacity) {
      const gfun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();
      if (mode === 'cinematic') {
        // Симуляция Ambient Occlusion через градиентную прозрачность
        // Гасим плоские области, подсвечиваем только резкие переходы (границы)
        gfun.addPoint(0, 0.05); 
        gfun.addPoint(15, 0.1);
        gfun.addPoint(100, 0.8);
        gfun.addPoint(250, 1.0);
      } else {
        gfun.addPoint(0, 0.1);
        gfun.addPoint(50, 0.2);
        gfun.addPoint(150, 0.8);
      }
      property.setGradientOpacity(0, gfun);
    }

    property.setRGBTransferFunction(0, ctfun);
    property.setScalarOpacity(0, ofun);

    renderWindowRef.current.render();
  }

  useEffect(() => {
    if (vtkReady) initVtk()
    return () => {
      if (renderWindowRef.current) renderWindowRef.current.delete();
    }
  }, [vtkReady])

  useEffect(() => {
    if (renderWindowRef.current) {
      applyRenderSettings(renderMode, activePreset);
    }
  }, [renderMode, activePreset, quality]);

  return (
    <>
      <Script src="/libs/vtk/vtk.js" onLoad={() => setVtkReady(true)} />
      
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
        <div className="relative w-full h-full flex flex-col overflow-hidden">
          
          {/* Header & Controls */}
          <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
                <span className="bg-primary-600 px-2 py-0.5 rounded text-sm">3D PRO</span>
                ADVANCED VISUALIZATION
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setRenderMode('clinical')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${renderMode === 'clinical' ? 'bg-white text-black border-white' : 'bg-black/50 text-white border-white/20 hover:bg-black/80'}`}
                >
                  CLINICAL
                </button>
                <button 
                  onClick={() => setRenderMode('cinematic')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${renderMode === 'cinematic' ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-black/50 text-white border-white/20 hover:bg-black/80'}`}
                >
                  CINEMATIC ✨
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 flex gap-1">
                {(['default', 'bone', 'vessels', 'brain', 'glow', 'mip', 'xray_light', 'organ_lesion'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setActivePreset(p)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${activePreset === p ? 'bg-primary-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  >
                    {p === 'default' ? 'Tissue' : p === 'xray_light' ? 'X-Ray' : p === 'brain' ? 'Prosve' : p === 'glow' ? 'Glow' : p === 'organ_lesion' ? 'Organ' : p}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/10 text-[9px] font-bold text-white/50">
                  <button onClick={() => setQuality('normal')} className={`px-2 py-0.5 rounded ${quality === 'normal' ? 'bg-white/10 text-white' : ''}`}>LQ</button>
                  <button onClick={() => setQuality('high')} className={`px-2 py-0.5 rounded ${quality === 'high' ? 'bg-white/10 text-white' : ''}`}>HQ</button>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Main Viewport */}
          <div ref={volumeRef} className="flex-1 bg-black cursor-move" />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/90">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-white font-black tracking-widest uppercase text-sm">
                Rendering Volume: {decodeProgress.current} / {decodeProgress.total}
              </p>
              <p className="text-primary-500/50 text-[10px] mt-2 animate-pulse">OPTIMIZING FOR APPLE M1 CHIP...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/95 p-12">
              <div className="max-w-md text-center">
                <div className="text-6xl mb-6">⚠️</div>
                <h3 className="text-2xl font-bold text-white mb-4">3D Engine Error</h3>
                <p className="text-gray-400 mb-8">{error}</p>
                <button onClick={onClose} className="px-8 py-3 bg-red-600 text-white rounded-full font-bold">CLOSE VIEW</button>
              </div>
            </div>
          )}
          
          {/* Footer Info */}
          <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
            <div className="flex flex-col gap-1 text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">
              <p>M1 Hardware Accelerated</p>
              <p>Volumetric Ray-Casting Engine</p>
              <p>{renderMode} mode active</p>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
