import { randomUUID } from 'crypto';

type MobileBridgeTarget =
  | 'chat'
  | 'protocol'
  | 'library'
  | 'clinical_context'
  | 'patient_db'
  | 'image_analysis'
  | 'ecg_analysis'
  | 'xray_analysis'
  | 'ct_analysis'
  | 'mri_analysis'
  | 'ultrasound_analysis'
  | 'lab_analysis'
  | 'video_analysis'
  | 'document_scan';

export interface MobileBridgeEvent {
  id: number;
  createdAt: string;
  target: MobileBridgeTarget;
  title: string;
  mimeType: string;
  dataUrl?: string;
  text?: string;
}

interface MobileBridgeSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  events: MobileBridgeEvent[];
  nextEventId: number;
}

interface MobileBridgeStore {
  sessions: Map<string, MobileBridgeSession>;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __mobileBridgeStore: MobileBridgeStore | undefined;
}

function getStore(): MobileBridgeStore {
  if (!globalThis.__mobileBridgeStore) {
    globalThis.__mobileBridgeStore = { sessions: new Map() };
  }
  return globalThis.__mobileBridgeStore;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  const store = getStore();
  for (const [token, session] of store.sessions.entries()) {
    if (session.expiresAt <= now) {
      store.sessions.delete(token);
    }
  }
}

export function createMobileBridgeSession(): { token: string; expiresAt: string } {
  cleanupExpiredSessions();
  const token = randomUUID();
  const now = Date.now();
  const session: MobileBridgeSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    events: [],
    nextEventId: 1,
  };
  getStore().sessions.set(token, session);
  return { token, expiresAt: new Date(session.expiresAt).toISOString() };
}

export function getMobileBridgeSession(token: string): MobileBridgeSession | null {
  cleanupExpiredSessions();
  const session = getStore().sessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    getStore().sessions.delete(token);
    return null;
  }
  // Sliding TTL: пока есть активность сессии, держим bridge "в ожидании".
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

export function pushMobileBridgeEvent(
  token: string,
  payload: Omit<MobileBridgeEvent, 'id' | 'createdAt'>,
): MobileBridgeEvent | null {
  const session = getMobileBridgeSession(token);
  if (!session) {
    return null;
  }
  const event: MobileBridgeEvent = {
    id: session.nextEventId++,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  session.events.push(event);
  return event;
}

export function getMobileBridgeEvents(token: string, sinceId: number): MobileBridgeEvent[] | null {
  const session = getMobileBridgeSession(token);
  if (!session) {
    return null;
  }
  return session.events.filter((event) => event.id > sinceId);
}
