import { DeviceAdapterMeta, DeviceEventMap, DeviceStatus, DeviceStudyEnvelope, IDeviceAdapter } from './types'

type Handler<E extends keyof DeviceEventMap> = (payload: DeviceEventMap[E]) => void

type ListenerBucket = {
  [K in keyof DeviceEventMap]: Set<Handler<K>>
}

interface MockStudyOptions {
  seriesCount?: number
  notes?: string
}

export class HotFolderDicomAdapter implements IDeviceAdapter {
  public readonly meta: DeviceAdapterMeta
  private status: DeviceStatus = 'idle'
  private listeners: ListenerBucket = {
    status: new Set(),
    error: new Set(),
    study: new Set(),
  }

  constructor(meta: DeviceAdapterMeta) {
    this.meta = meta
  }

  getStatus(): DeviceStatus {
    return this.status
  }

  async connect(): Promise<void> {
    this.updateStatus('connected')
  }

  async disconnect(): Promise<void> {
    this.updateStatus('idle')
  }

  async start(): Promise<void> {
    this.updateStatus('streaming')
  }

  async stop(): Promise<void> {
    this.updateStatus('connected')
  }

  subscribe<E extends keyof DeviceEventMap>(event: E, handler: Handler<E>): () => void {
    this.listeners[event].add(handler as never)
    return () => {
      this.listeners[event].delete(handler as never)
    }
  }

  async triggerMockStudy(options: MockStudyOptions = {}): Promise<DeviceStudyEnvelope> {
    const seriesCount = options.seriesCount ?? 1
    if (this.status === 'idle') {
      await this.connect()
    }
    if (this.status !== 'streaming') {
      await this.start()
    }

    const study: DeviceStudyEnvelope = {
      studyId: `mock-${this.meta.modality}-${Date.now()}`,
      deviceId: this.meta.id,
      modality: this.meta.modality,
      payloadType: 'dicom',
      createdAt: new Date().toISOString(),
      measurements: {
        seriesCount,
      },
      notes: options.notes || 'Mock-пакет DICOM получен через Hot Folder',
    }
    this.emit('study', study)
    return study
  }

  ingestStudy(study: DeviceStudyEnvelope): void {
    if (study.modality !== this.meta.modality) return
    if (this.status === 'idle') {
      this.updateStatus('connected')
    }
    if (this.status !== 'streaming') {
      this.updateStatus('streaming')
    }
    this.emit('study', study)
  }

  private updateStatus(next: DeviceStatus): void {
    this.status = next
    this.emit('status', next)
  }

  private emit<E extends keyof DeviceEventMap>(event: E, payload: DeviceEventMap[E]): void {
    this.listeners[event].forEach((handler) => {
      handler(payload as never)
    })
  }
}
