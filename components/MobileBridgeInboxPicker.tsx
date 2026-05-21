'use client';

import { useState } from 'react';
import {
  entryToFile,
  getInboxItemTag,
  getInboxTargetLabel,
  readAccumulatedInbox,
  type AccumulatedInboxEntry,
} from '@/lib/mobile-bridge-inbox';

interface MobileBridgeInboxPickerProps {
  onImport: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  preferredTarget?: string;
  buttonClassName?: string;
}

export default function MobileBridgeInboxPicker({
  onImport,
  accept: _accept,
  multiple = true,
  preferredTarget: _preferredTarget,
  buttonClassName,
}: MobileBridgeInboxPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AccumulatedInboxEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<AccumulatedInboxEntry | null>(null);
  const [status, setStatus] = useState('');

  const openPicker = () => {
    const inbox = readAccumulatedInbox();
    setItems(inbox);
    setSelectedIds([]);
    setStatus('');
    setOpen(true);
  };

  const toggleSelect = (id: string) => {
    if (!multiple) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const importSelected = () => {
    const selected = items.filter((item) => selectedIds.includes(item.id));
    if (selected.length === 0) {
      setStatus('Выберите хотя бы один файл.');
      return;
    }
    try {
      const files = selected.map((item) => entryToFile(item));
      onImport(files);
      setStatus(`Добавлено файлов: ${files.length}.`);
      setOpen(false);
    } catch {
      setStatus('Не удалось подготовить выбранные файлы.');
    }
  };

  return (
    <>
      <button
        onClick={openPicker}
        className={
          buttonClassName ||
          'px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-semibold'
        }
      >
        📥 Загрузить из накопителя
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Накопитель Bridge</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2">
              {items.length === 0 ? (
                <div className="rounded bg-white p-3 text-xs text-gray-500">
                  В накопителе пока нет файлов.
                </div>
              ) : (
                items.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2 rounded border p-2 text-xs ${
                        selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <input
                        type={multiple ? 'checkbox' : 'radio'}
                        name="bridge-inbox-pick"
                        checked={selected}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-1"
                      />
                      {item.dataUrl?.startsWith('data:image/') ? (
                        <img src={item.dataUrl} alt={item.title} className="h-12 w-12 rounded border border-gray-200 object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded border border-gray-200 bg-gray-100 text-[10px] font-semibold text-gray-600">
                          {getInboxItemTag(item)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            {getInboxTargetLabel(item.target)}
                          </span>
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            {getInboxItemTag(item)}
                          </span>
                        </div>
                        <div className="mt-1 truncate font-semibold text-gray-900">{item.title}</div>
                        <div className="text-gray-500">{new Date(item.createdAt).toLocaleString('ru-RU')}</div>
                      </div>
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Просмотр
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={importSelected}
                className="rounded bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
              >
                Загрузить выбранное
              </button>
              <span className="text-xs text-gray-600">{status}</span>
            </div>
          </div>
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Просмотр: {previewItem.title}</h4>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
            <div className="mt-3 max-h-[70vh] overflow-auto rounded border border-gray-200 bg-gray-50 p-2">
              {previewItem.dataUrl?.startsWith('data:image/') ? (
                <img src={previewItem.dataUrl} alt={previewItem.title} className="mx-auto max-h-[65vh] rounded border border-gray-200" />
              ) : previewItem.dataUrl?.startsWith('data:application/pdf') ? (
                <iframe title={previewItem.title} src={previewItem.dataUrl} className="h-[65vh] w-full rounded border border-gray-200 bg-white" />
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
    </>
  );
}
