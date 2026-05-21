export type BridgeTarget =
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

export interface AccumulatedInboxEntry {
  id: string;
  target: BridgeTarget;
  title: string;
  text?: string;
  mimeType?: string;
  dataUrl?: string;
  createdAt: string;
}

export const BRIDGE_ACCUMULATED_INBOX_KEY = 'mobile_bridge_accumulated_inbox_v1';
const BRIDGE_PATIENT_KEY = 'mobile_bridge_patient_draft';

const TARGET_LABELS: Record<BridgeTarget, string> = {
  auto_route: 'Авто',
  chat: 'Чат',
  protocol: 'Протокол',
  library: 'Библиотека',
  clinical_context: 'Контекст',
  patient_db: 'Накопитель',
  image_analysis: 'Изображение',
  ecg_analysis: 'ЭКГ',
  xray_analysis: 'Рентген',
  ct_analysis: 'КТ',
  mri_analysis: 'МРТ',
  ultrasound_analysis: 'УЗИ',
  lab_analysis: 'Лаб',
  video_analysis: 'Видео',
  document_scan: 'Документ',
};

function isValidTarget(value: string): value is BridgeTarget {
  return value in TARGET_LABELS;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'mobile-bridge-file';
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.startsWith('video/')) return mimeType.split('/')[1] || 'mp4';
  if (mimeType.startsWith('text/')) return 'txt';
  return 'bin';
}

export function getInboxItemTag(entry: AccumulatedInboxEntry): string {
  const mime = (entry.mimeType || '').toLowerCase();
  const title = (entry.title || '').toLowerCase();
  if (entry.target === 'ecg_analysis' || /экг|ecg/.test(title)) return 'ЭКГ';
  if (entry.target === 'xray_analysis' || /рентген|xray|x-ray/.test(title)) return 'Рентген';
  if (entry.target === 'ct_analysis' || /\bкт\b|\bct\b/.test(title)) return 'КТ';
  if (entry.target === 'mri_analysis' || /мрт|mri/.test(title)) return 'МРТ';
  if (entry.target === 'ultrasound_analysis' || /узи|ultrasound/.test(title)) return 'УЗИ';
  if (entry.target === 'lab_analysis' || /лаборатор|анализ/.test(title)) return 'Лаб';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.startsWith('video/')) return 'Видео';
  if (mime.startsWith('image/')) return 'Фото';
  return 'Файл';
}

export function getInboxTargetLabel(target: BridgeTarget): string {
  return TARGET_LABELS[target];
}

export function readAccumulatedInbox(): AccumulatedInboxEntry[] {
  if (typeof window === 'undefined') return [];
  const normalized: AccumulatedInboxEntry[] = [];

  const raw = localStorage.getItem(BRIDGE_ACCUMULATED_INBOX_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AccumulatedInboxEntry[];
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          if (!entry || typeof entry !== 'object') return;
          if (!entry.id || !entry.title || !entry.createdAt) return;
          if (typeof entry.target !== 'string' || !isValidTarget(entry.target)) return;
          normalized.push(entry);
        });
      }
    } catch {
      // ignore broken accumulated storage
    }
  }

  // Fallback for legacy/alternate payload: patient inbox draft list
  const rawPatient = localStorage.getItem(BRIDGE_PATIENT_KEY);
  if (rawPatient) {
    try {
      const parsed = JSON.parse(rawPatient) as Array<{
        title?: string;
        text?: string;
        mimeType?: string;
        dataUrl?: string;
        createdAt?: string;
      }>;
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          normalized.push({
            id: `legacy-patient-${idx}-${item.createdAt || 'now'}`,
            target: 'patient_db',
            title: item.title || `mobile-bridge-${idx + 1}`,
            text: item.text,
            mimeType: item.mimeType,
            dataUrl: item.dataUrl,
            createdAt: item.createdAt || new Date().toISOString(),
          });
        });
      }
    } catch {
      // ignore broken fallback payload
    }
  }

  const seen = new Set<string>();
  return normalized
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function entryToFile(entry: AccumulatedInboxEntry): File {
  const mimeType = (entry.mimeType || '').trim();
  const baseName = sanitizeFileName(entry.title);

  if (entry.dataUrl?.startsWith('data:')) {
    const match = entry.dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      const dataMime = match[1] || mimeType || 'application/octet-stream';
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const ext = extensionFromMime(dataMime);
      return new File([bytes], `${baseName}.${ext}`, { type: dataMime });
    }
  }

  const text = entry.text?.trim() || '';
  const finalMime = mimeType || 'text/plain';
  const ext = extensionFromMime(finalMime);
  return new File([text], `${baseName}.${ext}`, { type: finalMime });
}
