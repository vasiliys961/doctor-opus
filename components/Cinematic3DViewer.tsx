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
  const [activePreset, setActivePreset] = useState<'default' | 'bone' | 'vessels' | 'mip'>('default')
  const [quality, setQuality] = useState<'normal' | 'high'>('normal')

  const volumePropertyRef = useRef<any>(null)
  const renderWindowRef = useRef<any>(null)
  const mapperRef = useRef<any>(null)
  const imageDataRef = useRef<any>(null)
  const scalarArrayRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.vtk) {
      setVtkReady(true);
    }
  }, []);

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
      const voxels = new Int16Array(numVoxels);
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
    
    mapper.setSampleDistance(quality === 'high' ? 0.3 : 0.6);
    mapper.setInputData(imageData);
    if (mapper.setUseJittering) mapper.setUseJittering(true);
    
    volume.setMapper(mapper);

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
      mapper.setSampleDistance(1.2);
    });
    interactor.onEndAnimation(() => {
      mapper.setSampleDistance(quality === 'high' ? 0.25 : 0.5);
      renderWindow.render();
    });

    renderWindow.render();

    renderWindowRef.current = renderWindow;
    volumePropertyRef.current = property;
    mapperRef.current = mapper;

    applyRenderSettings(renderMode, activePreset);
  }

  const applyRenderSettings = (mode: 'clinical' | 'cinematic', preset: string) => {
    if (!volumePropertyRef.current) return;
    
    const vtk = window.vtk;
    const property = volumePropertyRef.current;
    const mapper = mapperRef.current;
    const range = scalarArrayRef.current.getRange();
    const [min, max] = range;
    const delta = max - min;

    const ctfun = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
    const ofun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();
    const gfun = vtk.Common.DataModel.vtkPiecewiseFunction.newInstance();

    if (mode === 'cinematic') {
      property.setAmbient(0.6);
      property.setDiffuse(0.5);
      property.setSpecular(0.4);
      property.setSpecularPower(60);
      mapper.setSampleDistance(quality === 'high' ? 0.25 : 0.45);
    } else {
      property.setAmbient(0.35);
      property.setDiffuse(0.45);
      property.setSpecular(0.2);
      property.setSpecularPower(25);
      mapper.setSampleDistance(quality === 'high' ? 0.4 : 0.8);
    }

    switch (preset) {
      case 'bone':
        ctfun.addRGBPoint(min, 0, 0, 0);
        ctfun.addRGBPoint(min + 0.4 * delta, 0.4, 0.2, 0.2);
        ctfun.addRGBPoint(min + 0.7 * delta, 0.9, 0.8, 0.7);
        ctfun.addRGBPoint(max, 1, 1, 1);
        ofun.addPoint(min, 0);
        ofun.addPoint(min + 0.5 * delta, 0);
        ofun.addPoint(min + 0.8 * delta, 0.6);
        ofun.addPoint(max, 0.9);
        break;
      
      case 'vessels':
        // Сосуды красным, ткани прозрачным
        ctfun.addRGBPoint(min, 0, 0, 0);
        ctfun.addRGBPoint(min + 0.1 * delta, 0.2, 0.1, 0.1); // мягкие ткани
        ctfun.addRGBPoint(min + 0.3 * delta, 0.8, 0.1, 0.1); // сосуды/контраст
        ctfun.addRGBPoint(min + 0.6 * delta, 1.0, 0.9, 0.8); // кости
        ofun.addPoint(min, 0);
        ofun.addPoint(min + 0.15 * delta, 0.02);
        ofun.addPoint(min + 0.3 * delta, 0.4);
        ofun.addPoint(min + 0.7 * delta, 0.1); // кости делаем полупрозрачными чтобы видеть сосуды внутри
        ofun.addPoint(max, 0.5);
        break;

      case 'mip':
        property.setShade(false);
        ctfun.addRGBPoint(min, 0, 0, 0);
        ctfun.addRGBPoint(max, 1, 1, 1);
        ofun.addPoint(min, 0);
        ofun.addPoint(max, 1);
        break;

      default: // Soft Tissue / Cinematic Body
        if (mode === 'cinematic') {
          ctfun.addRGBPoint(min, 0.0, 0.0, 0.0);
          ctfun.addRGBPoint(min + 0.2 * delta, 0.25, 0.35, 0.45); // кожа холодная
          ctfun.addRGBPoint(min + 0.5 * delta, 0.85, 0.65, 0.55); // мышцы теплые
          ctfun.addRGBPoint(max, 1.0, 0.95, 0.9);
          ofun.addPoint(min, 0);
          ofun.addPoint(min + 0.15 * delta, 0.01);
          ofun.addPoint(min + 0.4 * delta, 0.15);
          ofun.addPoint(min + 0.75 * delta, 0.5);
          ofun.addPoint(max, 0.85);
        } else {
          ctfun.addRGBPoint(min, 0, 0, 0);
          ctfun.addRGBPoint(min + 0.2 * delta, 0.6, 0.4, 0.4);
          ctfun.addRGBPoint(min + 0.6 * delta, 0.95, 0.85, 0.8);
          ctfun.addRGBPoint(max, 1, 1, 1);
          ofun.addPoint(min, 0);
          ofun.addPoint(min + 0.2 * delta, 0.02);
          ofun.addPoint(min + 0.5 * delta, 0.1);
          ofun.addPoint(max, 0.7);
        }
        break;
    }

    // Gradient opacity для четких границ
    gfun.addPoint(0, 0.1);
    gfun.addPoint(50, 0.2);
    gfun.addPoint(150, 0.8);
    property.setRGBTransferFunction(0, ctfun);
    property.setScalarOpacity(0, ofun);
    property.setGradientOpacity(0, gfun);

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
                {(['default', 'bone', 'vessels', 'mip'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setActivePreset(p)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${activePreset === p ? 'bg-primary-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  >
                    {p === 'default' ? 'Tissue' : p}
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
