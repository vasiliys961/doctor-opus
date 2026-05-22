'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

type BridgeTarget =
  | 'auto_route'
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

interface BridgeEvent {
  id: number;
  createdAt: string;
  target: BridgeTarget;
  title: string;
  mimeType: string;
  dataUrl?: string;
  text?: string;
}

const BRIDGE_LIBRARY_KEY = 'mobile_bridge_library_draft';
const BRIDGE_CHAT_KEY = 'mobile_bridge_chat_draft';
const BRIDGE_CONTEXT_KEY = 'mobile_bridge_clinical_context_draft';
const BRIDGE_PATIENT_KEY = 'mobile_bridge_patient_draft';
const BRIDGE_IMAGE_ANALYSIS_KEY = 'mobile_bridge_image_analysis_draft';
const BRIDGE_ECG_ANALYSIS_KEY = 'mobile_bridge_ecg_analysis_draft';
const BRIDGE_XRAY_ANALYSIS_KEY = 'mobile_bridge_xray_analysis_draft';
const BRIDGE_CT_ANALYSIS_KEY = 'mobile_bridge_ct_analysis_draft';
const BRIDGE_MRI_ANALYSIS_KEY = 'mobile_bridge_mri_analysis_draft';
const BRIDGE_ULTRASOUND_ANALYSIS_KEY = 'mobile_bridge_ultrasound_analysis_draft';
const BRIDGE_LAB_ANALYSIS_KEY = 'mobile_bridge_lab_analysis_draft';
const BRIDGE_VIDEO_ANALYSIS_KEY = 'mobile_bridge_video_analysis_draft';
const BRIDGE_DOCUMENT_SCAN_KEY = 'mobile_bridge_document_scan_draft';
const PROTOCOL_DRAFT_KEY = 'protocol_draft';
const BRIDGE_SESSION_STORAGE_KEY = 'mobile_bridge_desktop_session_v1';
const BRIDGE_BASE_URL_STORAGE_KEY = 'mobile_bridge_base_url_v1';
const BRIDGE_ACCUMULATED_INBOX_KEY = 'mobile_bridge_accumulated_inbox_v2';
const BRIDGE_ACCUMULATED_INBOX_LEGACY_KEY = 'mobile_bridge_accumulated_inbox_v1';
const BRIDGE_EVENT_CURSOR_KEY = 'mobile_bridge_event_cursor_v1';

const INBOX_KEYS: Array<{ storageKey: string; target: BridgeTarget }> = [
  { storageKey: BRIDGE_CHAT_KEY, target: 'chat' },
  { storageKey: PROTOCOL_DRAFT_KEY, target: 'protocol' },
  { storageKey: BRIDGE_LIBRARY_KEY, target: 'library' },
  { storageKey: BRIDGE_CONTEXT_KEY, target: 'clinical_context' },
  { storageKey: BRIDGE_IMAGE_ANALYSIS_KEY, target: 'image_analysis' },
  { storageKey: BRIDGE_ECG_ANALYSIS_KEY, target: 'ecg_analysis' },
  { storageKey: BRIDGE_XRAY_ANALYSIS_KEY, target: 'xray_analysis' },
  { storageKey: BRIDGE_CT_ANALYSIS_KEY, target: 'ct_analysis' },
  { storageKey: BRIDGE_MRI_ANALYSIS_KEY, target: 'mri_analysis' },
  { storageKey: BRIDGE_ULTRASOUND_ANALYSIS_KEY, target: 'ultrasound_analysis' },
  { storageKey: BRIDGE_LAB_ANALYSIS_KEY, target: 'lab_analysis' },
  { storageKey: BRIDGE_VIDEO_ANALYSIS_KEY, target: 'video_analysis' },
  { storageKey: BRIDGE_DOCUMENT_SCAN_KEY, target: 'document_scan' },
];

const INBOX_TARGET_LABELS: Record<BridgeTarget, string> = {
  auto_route: 'Автоопределение',
  chat: 'Чат',
  protocol: 'Протокол',
  library: 'Библиотека',
  clinical_context: 'Клинический контекст',
  patient_db: 'Накопитель',
  image_analysis: 'Анализ изображений',
  ecg_analysis: 'ЭКГ',
  xray_analysis: 'Рентген',
  ct_analysis: 'КТ',
  mri_analysis: 'МРТ',
  ultrasound_analysis: 'УЗИ',
  lab_analysis: 'Лаборатория',
  video_analysis: 'Видео',
  document_scan: 'Сканирование',
};

interface AccumulatedInboxEntry {
  id: string;
  target: BridgeTarget;
  title: string;
  text?: string;
  mimeType?: string;
  dataUrl?: string;
  createdAt: string;
}

function normalizeBridgeTarget(value: string): BridgeTarget | null {
  const raw = value.trim();
  if (
    raw === 'auto_route' ||
    raw === 'chat' ||
    raw === 'protocol' ||
    raw === 'library' ||
    raw === 'clinical_context' ||
    raw === 'patient_db' ||
    raw === 'image_analysis' ||
    raw === 'ecg_analysis' ||
    raw === 'xray_analysis' ||
    raw === 'ct_analysis' ||
    raw === 'mri_analysis' ||
    raw === 'ultrasound_analysis' ||
    raw === 'lab_analysis' ||
    raw === 'video_analysis' ||
    raw === 'document_scan'
  ) {
    return raw;
  }
  return null;
}

function getInboxItemTag(item: AccumulatedInboxEntry): string {
  const mime = (item.mimeType || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  if (item.target === 'ecg_analysis' || /экг|ecg/.test(title)) return 'ЭКГ';
  if (item.target === 'xray_analysis' || /рентген|xray|x-ray/.test(title)) return 'Рентген';
  if (item.target === 'ct_analysis' || /\bкт\b|\bct\b/.test(title)) return 'КТ';
  if (item.target === 'mri_analysis' || /мрт|mri/.test(title)) return 'МРТ';
  if (item.target === 'ultrasound_analysis' || /узи|ultrasound/.test(title)) return 'УЗИ';
  if (item.target === 'lab_analysis' || /лаборатор|анализ/.test(title)) return 'Лаб';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.startsWith('video/')) return 'Видео';
  if (mime.startsWith('image/')) return 'Фото';
  return 'Файл';
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function alignBaseUrlPortWithCurrentOrigin(value: string): string {
  const normalized = normalizeBaseUrl(value);
  if (typeof window === 'undefined') return normalized;
  try {
    const baseUrl = new URL(normalized);
    const current = new URL(window.location.origin);
    const currentPort = current.port || (current.protocol === 'https:' ? '443' : '80');
    const basePort = baseUrl.port || (baseUrl.protocol === 'https:' ? '443' : '80');
    const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(baseUrl.hostname);

    // Частый кейс: LAN-IP сохранен со старым портом (3001), а текущий dev-сервер уже на 3000.
    if (isIpv4 && basePort !== currentPort && currentPort) {
      baseUrl.port = currentPort;
      return normalizeBaseUrl(baseUrl.toString());
    }
    return normalized;
  } catch {
    return normalized;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

function routeEventToLocalStorage(event: BridgeEvent): void {
  const cleanText = event.text?.trim() || '';
  switch (event.target) {
    case 'chat': {
      localStorage.setItem(
        BRIDGE_CHAT_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'protocol': {
      localStorage.setItem(
        PROTOCOL_DRAFT_KEY,
        JSON.stringify({
          kind: 'mobile_bridge',
          rawText: cleanText || `[${event.title}]`,
          timestamp: event.createdAt,
        }),
      );
      break;
    }
    case 'library': {
      localStorage.setItem(
        BRIDGE_LIBRARY_KEY,
        JSON.stringify({
          title: event.title,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          text: cleanText,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'clinical_context': {
      localStorage.setItem(
        BRIDGE_CONTEXT_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText || `[Документ: ${event.title}]`,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'patient_db': {
      // Legacy patient draft storage disabled: it quickly overflows localStorage with base64 payloads.
      // Accumulated inbox is the single source of truth for Bridge files.
      break;
    }
    case 'image_analysis': {
      localStorage.setItem(
        BRIDGE_IMAGE_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'ecg_analysis': {
      localStorage.setItem(
        BRIDGE_ECG_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'xray_analysis': {
      localStorage.setItem(
        BRIDGE_XRAY_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'ct_analysis': {
      localStorage.setItem(
        BRIDGE_CT_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'mri_analysis': {
      localStorage.setItem(
        BRIDGE_MRI_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'ultrasound_analysis': {
      localStorage.setItem(
        BRIDGE_ULTRASOUND_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'lab_analysis': {
      localStorage.setItem(
        BRIDGE_LAB_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'video_analysis': {
      localStorage.setItem(
        BRIDGE_VIDEO_ANALYSIS_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    case 'document_scan': {
      localStorage.setItem(
        BRIDGE_DOCUMENT_SCAN_KEY,
        JSON.stringify({
          title: event.title,
          text: cleanText,
          dataUrl: event.dataUrl,
          mimeType: event.mimeType,
          createdAt: event.createdAt,
        }),
      );
      break;
    }
    default:
      break;
  }
}

function appendToAccumulatedInbox(event: BridgeEvent): void {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(BRIDGE_ACCUMULATED_INBOX_KEY);
  let items: AccumulatedInboxEntry[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AccumulatedInboxEntry[];
      if (Array.isArray(parsed)) {
        items = parsed;
      }
    } catch {
      items = [];
    }
  }

  const signature = `${event.createdAt}|${event.target}|${event.title}|${event.mimeType || ''}|${
    event.dataUrl || event.text || ''
  }`;
  const alreadyExists = items.some((item) => {
    const itemSignature = `${item.createdAt}|${item.target}|${item.title}|${item.mimeType || ''}|${
      item.dataUrl || item.text || ''
    }`;
    return itemSignature === signature;
  });
  if (alreadyExists) return;

  const next: AccumulatedInboxEntry[] = [
    {
      id: `${event.id}-${event.createdAt}-${event.target}`,
      target: event.target,
      title: event.title,
      text: event.text,
      mimeType: event.mimeType,
      dataUrl: event.dataUrl,
      createdAt: event.createdAt,
    },
    ...items,
  ].slice(0, 200);

  try {
    localStorage.setItem(BRIDGE_ACCUMULATED_INBOX_KEY, JSON.stringify(next));
  } catch {
    // Fallback for quota errors: keep fewer recent entries but preserve preview data
    try {
      localStorage.setItem(BRIDGE_ACCUMULATED_INBOX_KEY, JSON.stringify(next.slice(0, 30)));
    } catch {
      // Last resort: keep only metadata so list remains visible
      const tiny = next.slice(0, 30).map((item) => ({
        id: item.id,
        target: item.target,
        title: item.title,
        mimeType: item.mimeType,
        createdAt: item.createdAt,
      }));
      localStorage.setItem(BRIDGE_ACCUMULATED_INBOX_KEY, JSON.stringify(tiny));
    }
  }
}

export default function MobileBridgeDesktopPage() {
  const publicBridgeUrl = process.env.NEXT_PUBLIC_BRIDGE_PUBLIC_URL?.trim() || '';
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [events, setEvents] = useState<BridgeEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [bridgeBaseUrl, setBridgeBaseUrl] = useState('');
  const [inboxVersion, setInboxVersion] = useState(0);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [copyLinkStatus, setCopyLinkStatus] = useState('');
  const [inboxActionStatus, setInboxActionStatus] = useState('');
  const [forceFreshSession, setForceFreshSession] = useState(false);
  const [pullTargetByContext, setPullTargetByContext] = useState<BridgeTarget | null>(null);
  const [accumulatedInbox, setAccumulatedInbox] = useState<AccumulatedInboxEntry[]>([]);
  const [previewItem, setPreviewItem] = useState<AccumulatedInboxEntry | null>(null);
  const lastEventIdRef = useRef(0);
  const sessionRefreshInFlightRef = useRef(false);
  const inboxSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentOrigin = normalizeBaseUrl(window.location.origin);
    const currentIsLocal = isLocalDevOrigin(window.location.origin);

    if (publicBridgeUrl) {
      const normalized = normalizeBaseUrl(publicBridgeUrl);
      setBridgeBaseUrl(normalized);
      localStorage.setItem(BRIDGE_BASE_URL_STORAGE_KEY, normalized);
      return;
    }

    // В production/staging всегда используем текущий origin страницы.
    // Это исключает случайный LAN/localhost URL из старого кэша.
    if (!currentIsLocal) {
      setBridgeBaseUrl(currentOrigin);
      localStorage.setItem(BRIDGE_BASE_URL_STORAGE_KEY, currentOrigin);
      return;
    }

    const cachedBaseUrl = localStorage.getItem(BRIDGE_BASE_URL_STORAGE_KEY)?.trim() || '';
    if (cachedBaseUrl) {
      const aligned = alignBaseUrlPortWithCurrentOrigin(cachedBaseUrl);
      setBridgeBaseUrl(aligned);
      localStorage.setItem(BRIDGE_BASE_URL_STORAGE_KEY, aligned);
      return;
    }
    setBridgeBaseUrl(currentOrigin);
  }, [publicBridgeUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (publicBridgeUrl) return;
    const normalized = normalizeBaseUrl(bridgeBaseUrl);
    if (!normalized) return;
    localStorage.setItem(BRIDGE_BASE_URL_STORAGE_KEY, normalized);
  }, [bridgeBaseUrl, publicBridgeUrl]);

  const sendUrl = useMemo(() => {
    if (!token) return '';
    const base = bridgeBaseUrl.trim();
    if (!base) return '';
    const root = base.replace(/\/$/, '');
    return `${root}/mobile-bridge/send?token=${encodeURIComponent(token)}`;
  }, [token, bridgeBaseUrl]);

  const isLikelyLocalhost = useMemo(() => {
    const base = bridgeBaseUrl.toLowerCase();
    return base.includes('localhost') || base.includes('127.0.0.1');
  }, [bridgeBaseUrl]);
  const canEditBaseUrl = !publicBridgeUrl && isLikelyLocalhost;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persistedRaw = localStorage.getItem(BRIDGE_ACCUMULATED_INBOX_KEY);
    if (!persistedRaw) {
      setAccumulatedInbox([]);
      return;
    }
    try {
      const persisted = JSON.parse(persistedRaw) as AccumulatedInboxEntry[];
      if (!Array.isArray(persisted)) {
        setAccumulatedInbox([]);
        return;
      }
      setAccumulatedInbox(
        persisted
          .filter((item) => {
            return Boolean(item && item.id && item.title && item.createdAt);
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    } catch {
      setAccumulatedInbox([]);
    }
  }, [inboxVersion]);

  useEffect(() => {
    if (!sendUrl) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(sendUrl, { width: 320, margin: 1 })
      .then((value) => {
        if (!cancelled) {
          setQrDataUrl(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sendUrl]);

  useEffect(() => {
    let stopped = false;

    const createSession = async () => {
      const response = await fetch('/api/mobile-bridge/session', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось создать сессию');
      }
      return {
        token: String(data.token),
        expiresAt: String(data.expiresAt),
      };
    };

    const readCachedSession = (): { token: string; expiresAt: string } | null => {
      if (typeof window === 'undefined') return null;
      if (forceFreshSession) return null;
      const raw = localStorage.getItem(BRIDGE_SESSION_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { token?: string; expiresAt?: string };
        const cachedToken = parsed.token?.trim() || '';
        const cachedExpiresAt = parsed.expiresAt?.trim() || '';
        const expiresTs = Date.parse(cachedExpiresAt);
        if (!cachedToken || !cachedExpiresAt || Number.isNaN(expiresTs)) return null;
        if (expiresTs <= Date.now() + 30_000) return null;
        return { token: cachedToken, expiresAt: cachedExpiresAt };
      } catch {
        return null;
      }
    };

    const init = async () => {
      try {
        const cached = readCachedSession();
        if (cached) {
          if (stopped) return;
          setToken(cached.token);
          setExpiresAt(cached.expiresAt);
          if (typeof window !== 'undefined') {
            const cursorRaw = localStorage.getItem(BRIDGE_EVENT_CURSOR_KEY);
            if (cursorRaw) {
              try {
                const cursor = JSON.parse(cursorRaw) as { token?: string; lastEventId?: number };
                if (cursor.token === cached.token && Number.isFinite(Number(cursor.lastEventId))) {
                  lastEventIdRef.current = Math.max(0, Number(cursor.lastEventId));
                }
              } catch {
                lastEventIdRef.current = 0;
              }
            }
          }
          setSessionRestored(true);
          setStatus('ready');
          return;
        }
        const fresh = await createSession();
        if (stopped) return;
        lastEventIdRef.current = 0;
        setToken(fresh.token);
        setExpiresAt(fresh.expiresAt);
        setSessionRestored(false);
        setStatus('ready');
      } catch (err) {
        if (stopped) return;
        setError(err instanceof Error ? err.message : 'Ошибка инициализации');
        setStatus('error');
      }
    };
    init();
    return () => {
      stopped = true;
    };
  }, [forceFreshSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!token || !expiresAt) return;
    localStorage.setItem(BRIDGE_SESSION_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
  }, [token, expiresAt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!token) return;
    localStorage.setItem(
      BRIDGE_EVENT_CURSOR_KEY,
      JSON.stringify({ token, lastEventId: Math.max(0, lastEventIdRef.current) }),
    );
  }, [token, inboxVersion]);

  useEffect(() => {
    if (!token) return;
    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/mobile-bridge/events?token=${encodeURIComponent(token)}&since=${lastEventIdRef.current}`,
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          if (data?.error === 'session not found or expired') {
            if (!sessionRefreshInFlightRef.current) {
              sessionRefreshInFlightRef.current = true;
              try {
                const renewResponse = await fetch('/api/mobile-bridge/session', { method: 'POST' });
                const renewData = await renewResponse.json();
                if (renewResponse.ok && renewData.success) {
                  lastEventIdRef.current = 0;
                  setToken(String(renewData.token));
                  setExpiresAt(String(renewData.expiresAt));
                  setSessionRestored(false);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(
                      BRIDGE_EVENT_CURSOR_KEY,
                      JSON.stringify({ token: String(renewData.token), lastEventId: 0 }),
                    );
                  }
                  setError('');
                } else {
                  setError('Сессия bridge истекла. Обновите QR и откройте заново.');
                }
              } catch {
                setError('Сессия bridge истекла. Обновите QR и откройте заново.');
              } finally {
                sessionRefreshInFlightRef.current = false;
              }
            }
            return;
          }
          throw new Error(data.error || 'Ошибка опроса');
        }
        const incoming: BridgeEvent[] = Array.isArray(data.events) ? data.events : [];
        const filteredIncoming = incoming;
        if (filteredIncoming.length > 0) {
          let maxIncomingId = lastEventIdRef.current;
          for (const event of filteredIncoming) {
            try {
              routeEventToLocalStorage(event);
            } catch {
              // ignore per-event localStorage write failures
            }
            try {
              appendToAccumulatedInbox(event);
            } catch {
              // ignore per-event localStorage write failures
            }
            maxIncomingId = Math.max(maxIncomingId, event.id);
          }
          lastEventIdRef.current = maxIncomingId;
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              BRIDGE_EVENT_CURSOR_KEY,
              JSON.stringify({ token, lastEventId: lastEventIdRef.current }),
            );
          }
          setEvents((prev) => [...filteredIncoming.reverse(), ...prev].slice(0, 30));
          setInboxVersion((prev) => prev + 1);
        }
      } catch (err) {
        if (!stopped) {
          setError(err instanceof Error ? err.message : 'Ошибка синхронизации');
        }
      }
    };

    const interval = window.setInterval(poll, 2000);
    void poll();
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pullTarget = normalizeBridgeTarget(params.get('pullTarget') || '');
    setPullTargetByContext(pullTarget);
    setForceFreshSession(params.get('fresh') === '1');
  }, []);

  const hardResetInbox = async () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(BRIDGE_ACCUMULATED_INBOX_KEY);
    localStorage.removeItem(BRIDGE_ACCUMULATED_INBOX_LEGACY_KEY);
    INBOX_KEYS.forEach((cfg) => localStorage.removeItem(cfg.storageKey));
    localStorage.removeItem(BRIDGE_PATIENT_KEY);
    localStorage.removeItem(BRIDGE_EVENT_CURSOR_KEY);
    lastEventIdRef.current = 0;
    setAccumulatedInbox([]);
    setEvents([]);
    setInboxVersion((prev) => prev + 1);
    if (token) {
      try {
        await fetch('/api/mobile-bridge/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch {
        // ignore server clear errors; local clear already applied
      }
    }
    if (token) {
      localStorage.setItem(BRIDGE_EVENT_CURSOR_KEY, JSON.stringify({ token, lastEventId: 0 }));
    }
    setInboxActionStatus('Накопитель очищен. Связка смартфона сохранена.');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('fresh') !== '1') return;
    localStorage.removeItem(BRIDGE_SESSION_STORAGE_KEY);
    localStorage.removeItem(BRIDGE_EVENT_CURSOR_KEY);
    localStorage.removeItem(BRIDGE_ACCUMULATED_INBOX_KEY);
    localStorage.removeItem(BRIDGE_ACCUMULATED_INBOX_LEGACY_KEY);
    INBOX_KEYS.forEach((cfg) => localStorage.removeItem(cfg.storageKey));
    localStorage.removeItem(BRIDGE_PATIENT_KEY);
    lastEventIdRef.current = 0;
    setInboxVersion((prev) => prev + 1);
    setEvents([]);
    setInboxActionStatus('Открыт чистый режим отправки: старые входящие скрыты.');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('focusInbox') !== '1') return;
    const timer = window.setTimeout(() => {
      inboxSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto max-w-5xl py-6">
      <h1 className="text-2xl font-bold text-primary-900">📲 Подключить смартфон</h1>
      <p className="mt-2 text-sm text-gray-700">
        Откройте эту страницу на ПК врача, отсканируйте QR смартфоном и отправляйте фото/сканы в накопитель.
      </p>
      <section className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
        <p className="text-xs font-semibold text-indigo-900">Что дает подключение смартфона</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-indigo-900">
          <li>Быстрый захват фото и сканов без пересылки в мессенджерах.</li>
          <li>Все файлы попадают в единый накопитель и не теряются между разделами.</li>
          <li>Из любого раздела можно открыть накопитель, просмотреть файл и загрузить в работу.</li>
        </ul>
      </section>
      <section ref={inboxSectionRef} className="mt-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-800">📥 Накопительный бокс входящих Bridge</p>
          <button
            onClick={() => {
              void hardResetInbox();
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            Очистить
          </button>
        </div>
        {accumulatedInbox.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">Пока пусто. Новые отправки со смартфона появятся здесь автоматически.</p>
        ) : (
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {accumulatedInbox.slice(0, 20).map((item, idx) => (
              <div key={item.id} className="rounded border border-gray-200 bg-gray-50 p-2 text-[11px]">
                <div className="flex items-start gap-2">
                  {item.dataUrl?.startsWith('data:image/') ? (
                    <img
                      src={item.dataUrl}
                      alt={item.title}
                      className="h-12 w-12 rounded border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded border border-gray-200 bg-white text-[10px] font-semibold text-gray-500">
                      {getInboxItemTag(item)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                      <span>#{idx + 1}</span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800">{getInboxItemTag(item)}</span>
                      <span className="truncate">{INBOX_TARGET_LABELS[item.target]} • {item.title}</span>
                    </div>
                    <div className="text-gray-500">{new Date(item.createdAt).toLocaleString('ru-RU')}</div>
                  </div>
                </div>
                {item.dataUrl && (
                  <button
                    onClick={() => setPreviewItem(item)}
                    className="mt-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Просмотр
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {inboxActionStatus && <p className="mt-2 text-[11px] text-emerald-700">{inboxActionStatus}</p>}
      </section>

      {status === 'error' && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {status === 'ready' && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Шаг 1. Сканируйте QR со смартфона</h2>
            {sessionRestored && (
              <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                Телефон уже подключен к активной bridge-сессии. Можно сразу открыть камеру по текущей ссылке.
              </div>
            )}
            {canEditBaseUrl ? (
              <label className="mt-3 block text-xs font-semibold text-gray-700">
                Адрес ПК для телефона
                <input
                  value={bridgeBaseUrl}
                  onChange={(e) => setBridgeBaseUrl(e.target.value)}
                  placeholder="http://192.168.1.45:3000"
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-800"
                />
              </label>
            ) : (
              <div className="mt-3 rounded bg-emerald-50 p-2 text-xs text-emerald-900">
                Адрес для QR определён автоматически: <span className="font-semibold">{bridgeBaseUrl}</span>
              </div>
            )}
            {publicBridgeUrl && (
              <p className="mt-2 rounded bg-emerald-50 p-2 text-xs text-emerald-900">
                Используется публичный адрес из `NEXT_PUBLIC_BRIDGE_PUBLIC_URL`.
              </p>
            )}
            <label className="mt-2 block text-xs font-semibold text-gray-700">
              Режим отправки
              <div className="mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs text-emerald-900">
                Упрощенный режим: фото со смартфона отправляется только в накопитель Bridge.
              </div>
            </label>
            {pullTargetByContext && (
              <p className="mt-2 rounded bg-indigo-50 p-2 text-xs text-indigo-900">
                Режим загрузки в раздел: {INBOX_TARGET_LABELS[pullTargetByContext]}.
              </p>
            )}
            {isLikelyLocalhost && (
              <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">
                Сейчас указан `localhost`: со смартфона это не откроется. Укажи LAN-адрес ПК, например `http://192.168.x.x:3000`.
              </p>
            )}
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR для Mobile Bridge" className="mt-3 h-64 w-64 rounded-md border border-gray-200" />
            ) : (
              <div className="mt-3 text-sm text-gray-500">Генерация QR... Если не появился, используйте ссылку ниже.</div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (!sendUrl) return;
                  void navigator.clipboard
                    .writeText(sendUrl)
                    .then(() => setCopyLinkStatus('Ссылка камеры скопирована.'))
                    .catch(() => setCopyLinkStatus('Не удалось скопировать ссылку.'));
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Копировать ссылку камеры
              </button>
              {copyLinkStatus && <span className="text-xs text-gray-500">{copyLinkStatus}</span>}
            </div>
            <p className="mt-3 break-all rounded bg-gray-50 p-2 text-xs text-gray-600">{sendUrl}</p>
            <p className="mt-2 text-xs text-gray-500">Сессия активна до: {new Date(expiresAt).toLocaleString('ru-RU')}</p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Шаг 2. Что происходит после отправки</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
              <li>Все отправки со смартфона попадают только в накопитель Bridge.</li>
              <li>Файлы не теряются и остаются в журнале с превью и временем поступления.</li>
              <li>В нужном разделе нажмите «Загрузить из накопителя» и выберите файлы как в проводнике.</li>
              <li>В чате выбранные файлы добавляются во вложения к текущему сообщению.</li>
              <li>После первого сканирования QR токен скрывается из адреса телефона, дальше используйте чистую страницу камеры.</li>
            </ul>
          </section>
        </div>
      )}

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Последние поступления</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Пока нет событий.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {events.map((event) => (
              <div key={`${event.id}-${event.createdAt}`} className="rounded border border-gray-200 bg-gray-50 p-2 text-xs">
                <div className="font-semibold text-gray-900">
                  #{event.id} • {event.target} • {event.title}
                </div>
                <div className="text-gray-600">{new Date(event.createdAt).toLocaleString('ru-RU')}</div>
                {event.text && <div className="mt-1 line-clamp-3 text-gray-700">{event.text}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {previewItem && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Просмотр: {previewItem.title}</h4>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
            <div className="mt-3 max-h-[75vh] overflow-auto rounded border border-gray-200 bg-gray-50 p-2">
              {previewItem.dataUrl?.startsWith('data:image/') ? (
                <img src={previewItem.dataUrl} alt={previewItem.title} className="mx-auto max-h-[70vh] rounded border border-gray-200" />
              ) : previewItem.dataUrl?.startsWith('data:video/') ? (
                <video
                  controls
                  playsInline
                  className="mx-auto max-h-[70vh] w-full rounded border border-gray-200 bg-black"
                  src={previewItem.dataUrl}
                />
              ) : previewItem.dataUrl?.startsWith('data:application/pdf') ? (
                <iframe title={previewItem.title} src={previewItem.dataUrl} className="h-[70vh] w-full rounded border border-gray-200 bg-white" />
              ) : (
                <div className="rounded bg-white p-3 text-xs text-gray-700">
                  <p>Предпросмотр недоступен для этого формата.</p>
                  <p className="mt-1 text-gray-500">Тип: {previewItem.mimeType || 'не указан'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
