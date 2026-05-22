import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

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

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const STORE_FILE = path.join(process.cwd(), '.next', 'cache', 'mobile-bridge-store.json');

interface PersistedStore {
  sessions: Record<string, MobileBridgeSession>;
}

function readStore(): PersistedStore {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedStore;
    if (!parsed || typeof parsed !== 'object' || !parsed.sessions || typeof parsed.sessions !== 'object') {
      return { sessions: {} };
    }
    return parsed;
  } catch {
    return { sessions: {} };
  }
}

function writeStore(store: PersistedStore): void {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store));
}

function cleanupExpiredSessions(store: PersistedStore): void {
  const now = Date.now();
  for (const token of Object.keys(store.sessions)) {
    if (store.sessions[token].expiresAt <= now) {
      delete store.sessions[token];
    }
  }
}

export function createMobileBridgeSession(): { token: string; expiresAt: string } {
  const store = readStore();
  cleanupExpiredSessions(store);
  const token = randomUUID();
  const now = Date.now();
  const session: MobileBridgeSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    events: [],
    nextEventId: 1,
  };
  store.sessions[token] = session;
  writeStore(store);
  return { token, expiresAt: new Date(session.expiresAt).toISOString() };
}

export function getMobileBridgeSession(token: string): MobileBridgeSession | null {
  const store = readStore();
  cleanupExpiredSessions(store);
  const session = store.sessions[token];
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    delete store.sessions[token];
    writeStore(store);
    return null;
  }
  // Sliding TTL: пока есть активность сессии, держим bridge "в ожидании".
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  store.sessions[token] = session;
  writeStore(store);
  return session;
}

function getOrCreateMobileBridgeSession(store: PersistedStore, token: string): MobileBridgeSession {
  const existing = store.sessions[token];
  if (existing && existing.expiresAt > Date.now()) {
    existing.expiresAt = Date.now() + SESSION_TTL_MS;
    store.sessions[token] = existing;
    return existing;
  }
  const now = Date.now();
  const session: MobileBridgeSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    events: [],
    nextEventId: 1,
  };
  store.sessions[token] = session;
  return session;
}

export function pushMobileBridgeEvent(
  token: string,
  payload: Omit<MobileBridgeEvent, 'id' | 'createdAt'>,
): MobileBridgeEvent {
  const store = readStore();
  cleanupExpiredSessions(store);
  const session = getOrCreateMobileBridgeSession(store, token);
  const createdAt = new Date().toISOString();
  const event: MobileBridgeEvent = {
    id: session.nextEventId++,
    createdAt,
    ...payload,
  };
  session.events.push(event);
  store.sessions[token] = session;
  writeStore(store);
  return event;
}

export function getMobileBridgeEvents(token: string, sinceId: number): MobileBridgeEvent[] {
  const store = readStore();
  cleanupExpiredSessions(store);
  const session = getOrCreateMobileBridgeSession(store, token);
  store.sessions[token] = session;
  writeStore(store);
  return session.events.filter((event) => event.id > sinceId);
}

export function clearMobileBridgeEvents(token: string): void {
  const store = readStore();
  cleanupExpiredSessions(store);
  const session = getOrCreateMobileBridgeSession(store, token);
  session.events = [];
  session.nextEventId = 1;
  store.sessions[token] = session;
  writeStore(store);
}
