import { DeviceAdapterMeta, DeviceEventMap, DeviceStatus, IDeviceAdapter } from './types'

type Handler<E extends keyof DeviceEventMap> = (payload: DeviceEventMap[E]) => void

type ListenerBucket = {
  [K in keyof DeviceEventMap]: Set<Handler<K>>
}

export class BrowserBridgeAdapter implements IDeviceAdapter {
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

  subscribe<E extends keyof DeviceEventMap>(
    event: E,
    handler: Handler<E>
  ): () => void {
    this.listeners[event].add(handler as never)
    return () => {
      this.listeners[event].delete(handler as never)
    }
  }

  private updateStatus(next: DeviceStatus): void {
    this.status = next
    this.emit('status', next)
  }

  private emit<E extends keyof DeviceEventMap>(
    event: E,
    payload: DeviceEventMap[E]
  ): void {
    this.listeners[event].forEach((handler) => {
      handler(payload as never)
    })
  }
}
