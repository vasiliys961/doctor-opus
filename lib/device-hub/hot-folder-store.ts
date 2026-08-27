export type HotFolderModality = 'xray' | 'ct' | 'mri'

export interface HotFolderIngestStudy {
  modality: HotFolderModality
  payloadType: 'dicom' | 'image'
  title: string
  notes?: string
  dataUrls: string[]
  fileNames: string[]
  seriesCount?: number
}

export interface HotFolderQueueEvent {
  id: number
  createdAt: string
  study: HotFolderIngestStudy
}

const MAX_EVENTS = 200

const globalStore = globalThis as typeof globalThis & {
  __hot_folder_queue__?: {
    nextId: number
    events: HotFolderQueueEvent[]
  }
}

if (!globalStore.__hot_folder_queue__) {
  globalStore.__hot_folder_queue__ = {
    nextId: 1,
    events: [],
  }
}

const queue = globalStore.__hot_folder_queue__

export function pushHotFolderEvent(study: HotFolderIngestStudy): HotFolderQueueEvent {
  const event: HotFolderQueueEvent = {
    id: queue.nextId++,
    createdAt: new Date().toISOString(),
    study,
  }
  queue.events.push(event)
  if (queue.events.length > MAX_EVENTS) {
    queue.events = queue.events.slice(queue.events.length - MAX_EVENTS)
  }
  return event
}

export function getHotFolderEventsSince(since: number): HotFolderQueueEvent[] {
  return queue.events.filter((event) => event.id > since)
}

export function clearHotFolderEvents(): void {
  queue.events = []
}
