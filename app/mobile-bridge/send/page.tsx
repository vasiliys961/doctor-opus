'use client';

import { useState } from 'react';
import { useEffect } from 'react';

const MOBILE_PAIRING_STORAGE_KEY = 'mobile_bridge_phone_pairing_v1';
const DEFAULT_PAIRED_TARGET = 'patient_db';

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

export default function MobileBridgeSendPage() {
  const [token, setToken] = useState('');
  const [title, setTitle] = useState('mobile-scan');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const captureInputId = 'mobile-bridge-capture-input';

  const canSubmit = token.length > 0 && !loading && Boolean(file);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tokenFromQuery = params.get('token')?.trim() || '';

    if (tokenFromQuery) {
      setToken(tokenFromQuery);
      localStorage.setItem(
        MOBILE_PAIRING_STORAGE_KEY,
        JSON.stringify({
          token: tokenFromQuery,
        }),
      );
      return;
    }

    const raw = localStorage.getItem(MOBILE_PAIRING_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      const cachedToken = parsed.token?.trim() || '';
      if (!cachedToken) return;
      setToken(cachedToken);
    } catch {
      // ignore broken local state
    }
  }, []);

  const submit = async (overrideFile?: File | null) => {
    const fileToSend = overrideFile ?? file;
    const ready = token.length > 0 && !loading && Boolean(fileToSend);
    if (!ready) return;
    setLoading(true);
    setStatus('');
    try {
      if (!fileToSend.type.startsWith('image/')) {
        throw new Error('Поддерживается только съемка фото с камеры.');
      }
      const dataUrl = await fileToDataUrl(fileToSend);
      const response = await fetch('/api/mobile-bridge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          target: DEFAULT_PAIRED_TARGET,
          title: title.trim() || `mobile-${new Date().toISOString()}`,
          dataUrl,
          mimeType: fileToSend?.type || 'text/plain',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Не удалось отправить');
      }
      setStatus('✅ Отправлено в накопитель на десктопе.');
      setFile(null);
    } catch (err) {
      setStatus(`❌ ${err instanceof Error ? err.message : 'Ошибка отправки'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="text-xl font-bold text-primary-900">📤 Отправка в накопитель</h1>
      <p className="mt-2 text-sm text-gray-700">
        Сделайте фото или выберите файл. Отправка идет только в накопитель Bridge на десктопе.
      </p>

      {!token && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Нет токена сессии. Откройте страницу через QR с десктопа.
        </div>
      )}
      {token && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
          <span>Телефон сопряжен с bridge-сессией.</span>
          <button
            onClick={() => {
              localStorage.removeItem(MOBILE_PAIRING_STORAGE_KEY);
              setToken('');
              setStatus('Сопряжение сброшено. Откройте QR заново.');
            }}
            className="rounded border border-emerald-300 bg-white px-2 py-1 font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Сбросить сопряжение
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          Режим: <b>только в накопитель Bridge</b>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-gray-700">Название (опционально)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Например: Выписка 21.05"
          />
        </label>

        <div className="space-y-2">
          <input
            id={captureInputId}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const picked = e.target.files?.[0] || null;
              setFile(picked);
              if (picked) {
                void submit(picked);
              }
            }}
            className="hidden"
          />
          <label
            htmlFor={captureInputId}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-primary-600 px-4 py-4 text-center text-base font-semibold text-white hover:bg-primary-700"
          >
            {loading ? 'Отправка...' : 'Сделать фото / выбрать файл'}
          </label>
          {!file && <p className="text-center text-xs text-gray-500">После съемки фото отправится автоматически.</p>}
        </div>

        {status && <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{status}</div>}
      </div>
    </div>
  );
}
