import { BrowserBridgeAdapter } from './browser-adapter'
import { BROWSER_DEVICE_CATALOG } from './browser-catalog'
import { DeviceHub } from './device-hub'
import { HotFolderDicomAdapter } from './hot-folder-dicom-adapter'
import { RADIOLOGY_DEVICE_CATALOG } from './radiology-catalog'

export const createDeviceHub = (): DeviceHub => {
  const hub = new DeviceHub()
  const browserAdapters = BROWSER_DEVICE_CATALOG.map((descriptor) => new BrowserBridgeAdapter(descriptor))
  const radiologyAdapters = RADIOLOGY_DEVICE_CATALOG.map((descriptor) => new HotFolderDicomAdapter(descriptor))
  hub.registerMany([...browserAdapters, ...radiologyAdapters])
  return hub
}

export const createBrowserDeviceHub = createDeviceHub
