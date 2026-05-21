'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type InboxTarget =
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

interface InboxEntry {
  id: string;
  storageKey: string;
  target: InboxTarget;
  title: string;
  text?: string;
  dataUrl?: string;
  mimeType?: string;
  createdAt?: string;
}

const KEY_CONFIG: Array<{ storageKey: string; target: InboxTarget }> = [
  { storageKey: 'mobile_bridge_chat_draft', target: 'chat' },
  { storageKey: 'protocol_draft', target: 'protocol' },
  { storageKey: 'mobile_bridge_library_draft', target: 'library' },
  { storageKey: 'mobile_bridge_clinical_context_draft', target: 'clinical_context' },
  { storageKey: 'mobile_bridge_image_analysis_draft', target: 'image_analysis' },
  { storageKey: 'mobile_bridge_ecg_analysis_draft', target: 'ecg_analysis' },
  { storageKey: 'mobile_bridge_xray_analysis_draft', target: 'xray_analysis' },
  { storageKey: 'mobile_bridge_ct_analysis_draft', target: 'ct_analysis' },
  { storageKey: 'mobile_bridge_mri_analysis_draft', target: 'mri_analysis' },
  { storageKey: 'mobile_bridge_ultrasound_analysis_draft', target: 'ultrasound_analysis' },
  { storageKey: 'mobile_bridge_lab_analysis_draft', target: 'lab_analysis' },
  { storageKey: 'mobile_bridge_video_analysis_draft', target: 'video_analysis' },
  { storageKey: 'mobile_bridge_document_scan_draft', target: 'document_scan' },
];

const PATIENT_DB_KEY = 'mobile_bridge_patient_draft';

const TARGET_LABELS: Record<InboxTarget, string> = {
  chat: 'Чат',
  protocol: 'Протокол',
  library: 'Библиотека',
  clinical_context: 'Клинический контекст',
  patient_db: 'Локальная БД пациента',
  image_analysis: 'Анализ изображений',
  ecg_analysis: 'ЭКГ',
  xray_analysis: 'Рентген',
  ct_analysis: 'КТ',
  mri_analysis: 'МРТ',
  ultrasound_analysis: 'УЗИ',
  lab_analysis: 'Лаборатория',
  video_analysis: 'Видео',
  document_scan: 'Сканирование документов',
};

const TARGET_ROUTES: Record<InboxTarget, string> = {
  chat: '/chat',
  protocol: '/protocol',
  library: '/library',
  clinical_context: '/advanced',
  patient_db: '/patients',
  image_analysis: '/image-analysis',
  ecg_analysis: '/ecg',
  xray_analysis: '/xray',
  ct_analysis: '/ct',
  mri_analysis: '/mri',
  ultrasound_analysis: '/ultrasound',
  lab_analysis: '/lab',
  video_analysis: '/video',
  document_scan: '/document',
};

function parseSingleEntry(storageKey: string, target: InboxTarget): InboxEntry[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      text?: string;
      dataUrl?: string;
      mimeType?: string;
      createdAt?: string;
      timestamp?: string;
      rawText?: string;
    };
    const createdAt = parsed.createdAt || parsed.timestamp || new Date().toISOString();
    const text = parsed.text || parsed.rawText;
    const title = parsed.title || `${TARGET_LABELS[target]} draft`;
    return [
      {
        id: `${storageKey}-0`,
        storageKey,
        target,
        title,
        text,
        dataUrl: parsed.dataUrl,
        mimeType: parsed.mimeType,
        createdAt,
      },
    ];
  } catch {
    return [];
  }
}

function parsePatientDbEntries(): InboxEntry[] {
  const raw = localStorage.getItem(PATIENT_DB_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{
      title?: string;
      text?: string;
      dataUrl?: string;
      mimeType?: string;
      createdAt?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry, idx) => ({
      id: `${PATIENT_DB_KEY}-${idx}`,
      storageKey: PATIENT_DB_KEY,
      target: 'patient_db',
      title: entry.title || 'Patient draft',
      text: entry.text,
      dataUrl: entry.dataUrl,
      mimeType: entry.mimeType,
      createdAt: entry.createdAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export default function MobileBridgeInboxPage() {
  const router = useRouter();
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const entries = useMemo(() => {
    void version;
    const all = KEY_CONFIG.flatMap((cfg) => parseSingleEntry(cfg.storageKey, cfg.target));
    all.push(...parsePatientDbEntries());
    return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [version]);

  const removeEntry = useCallback((entry: InboxEntry) => {
    if (entry.storageKey === PATIENT_DB_KEY) {
      const raw = localStorage.getItem(PATIENT_DB_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown[];
        if (!Array.isArray(parsed)) return;
        const index = Number(entry.id.split('-').pop() || '-1');
        if (index < 0) return;
        parsed.splice(index, 1);
        localStorage.setItem(PATIENT_DB_KEY, JSON.stringify(parsed));
      } catch {
        return;
      }
    } else {
      localStorage.removeItem(entry.storageKey);
    }
    refresh();
  }, [refresh]);

  const openTarget = useCallback((entry: InboxEntry) => {
    router.push(TARGET_ROUTES[entry.target]);
  }, [router]);

  const clearAll = useCallback(() => {
    KEY_CONFIG.forEach((cfg) => localStorage.removeItem(cfg.storageKey));
    localStorage.removeItem(PATIENT_DB_KEY);
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">📥 Входящие Bridge</h1>
          <p className="mt-1 text-sm text-gray-600">
            Единый список того, что пришло со смартфонов в текущий браузер.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            Обновить
          </button>
          <button
            onClick={clearAll}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Очистить все
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Входящих нет. Отправьте фото/скан через `Mobile Bridge`.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {TARGET_LABELS[entry.target]} • {entry.title}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString('ru-RU') : 'время не указано'}
                  </div>
                  {entry.text && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{entry.text}</p>}
                  {!entry.text && entry.dataUrl && (
                    <p className="mt-2 text-sm text-gray-700">Есть вложение ({entry.mimeType || 'unknown mime'}).</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openTarget(entry)}
                    className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    Открыть раздел
                  </button>
                  <button
                    onClick={() => removeEntry(entry)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
