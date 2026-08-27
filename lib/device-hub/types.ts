export type DeviceConnectorType = 'browser' | 'dicom' | 'filewatch' | 'server'

export type DeviceCapability =
  | 'stream-waveform'
  | 'capture-frame'
  | 'upload-file'
  | 'receive-dicom'
  | 'import-csv'

export type DeviceStatus = 'idle' | 'connected' | 'streaming' | 'error'

export interface DeviceStudyEnvelope {
  studyId: string
  deviceId: string
  modality: string
  payloadType: 'waveform' | 'image' | 'dicom' | 'csv' | 'text'
  createdAt: string
  files?: File[]
  measurements?: Record<string, number | string>
  notes?: string
}

export interface DeviceEventMap {
  status: DeviceStatus
  error: string
  study: DeviceStudyEnvelope
}

export interface DeviceAdapterMeta {
  id: string
  title: string
  modality: string
  connectorType: DeviceConnectorType
  capabilities: DeviceCapability[]
  description?: string
}

export interface DeviceAdapterDescriptor extends DeviceAdapterMeta {
  routeTabId: string
}

export interface IDeviceAdapter {
  readonly meta: DeviceAdapterMeta
  getStatus(): DeviceStatus
  connect(): Promise<void>
  disconnect(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  subscribe<E extends keyof DeviceEventMap>(
    event: E,
    handler: (payload: DeviceEventMap[E]) => void
  ): () => void
}
