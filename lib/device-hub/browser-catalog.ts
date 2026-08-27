import { DeviceAdapterDescriptor } from './types'

export const BROWSER_DEVICE_CATALOG: DeviceAdapterDescriptor[] = [
  {
    id: 'browser-ecg-usb',
    routeTabId: 'ecg',
    title: 'ЭКГ USB (Chrome)',
    modality: 'ecg',
    connectorType: 'browser',
    capabilities: ['stream-waveform', 'upload-file'],
    description: 'Текущая реализация через Web Serial в браузере',
  },
  {
    id: 'browser-spirometry-usb',
    routeTabId: 'spirometry',
    title: 'Спирометр USB (Chrome)',
    modality: 'spirometry',
    connectorType: 'browser',
    capabilities: ['stream-waveform', 'upload-file'],
    description: 'Текущая реализация через Web Serial в браузере',
  },
  {
    id: 'browser-glucose-import',
    routeTabId: 'glucose',
    title: 'Глюкоза (CSV импорт)',
    modality: 'glucose',
    connectorType: 'browser',
    capabilities: ['import-csv', 'upload-file'],
    description: 'Импорт профиля из CSV без прямого аппаратного подключения',
  },
  {
    id: 'browser-camera-capture',
    routeTabId: 'camera',
    title: 'UVC/HDMI Capture (Chrome)',
    modality: 'camera',
    connectorType: 'browser',
    capabilities: ['capture-frame', 'upload-file'],
    description: 'Захват кадра с камеры или capture-карты',
  },
]
