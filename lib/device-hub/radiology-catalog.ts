import { DeviceAdapterDescriptor } from './types'

export const RADIOLOGY_DEVICE_CATALOG: DeviceAdapterDescriptor[] = [
  {
    id: 'hotfolder-xray-dicom',
    routeTabId: 'radiology',
    title: 'Рентген (Hot Folder DICOM)',
    modality: 'xray',
    connectorType: 'filewatch',
    capabilities: ['receive-dicom', 'upload-file'],
    description: 'Автоподхват DICOM-исследований из папки экспорта',
  },
  {
    id: 'hotfolder-ct-dicom',
    routeTabId: 'radiology',
    title: 'КТ (Hot Folder DICOM)',
    modality: 'ct',
    connectorType: 'filewatch',
    capabilities: ['receive-dicom', 'upload-file'],
    description: 'Автоподхват DICOM-исследований из папки экспорта',
  },
  {
    id: 'hotfolder-mri-dicom',
    routeTabId: 'radiology',
    title: 'МРТ (Hot Folder DICOM)',
    modality: 'mri',
    connectorType: 'filewatch',
    capabilities: ['receive-dicom', 'upload-file'],
    description: 'Автоподхват DICOM-исследований из папки экспорта',
  },
]
