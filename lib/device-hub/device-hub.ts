import { DeviceAdapterMeta, DeviceAdapterDescriptor, IDeviceAdapter } from './types'

export class DeviceHub {
  private adapters = new Map<string, IDeviceAdapter>()

  register(adapter: IDeviceAdapter): void {
    this.adapters.set(adapter.meta.id, adapter)
  }

  registerMany(adapters: IDeviceAdapter[]): void {
    adapters.forEach((adapter) => this.register(adapter))
  }

  unregister(adapterId: string): void {
    this.adapters.delete(adapterId)
  }

  getAdapter(adapterId: string): IDeviceAdapter | undefined {
    return this.adapters.get(adapterId)
  }

  getMeta(): DeviceAdapterMeta[] {
    return Array.from(this.adapters.values()).map((adapter) => adapter.meta)
  }

  getByTab(routeTabId: string, catalog: DeviceAdapterDescriptor[]): IDeviceAdapter | undefined {
    const descriptor = catalog.find((item) => item.routeTabId === routeTabId)
    if (!descriptor) return undefined
    return this.getAdapter(descriptor.id)
  }
}
