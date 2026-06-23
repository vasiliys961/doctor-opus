#!/usr/bin/env node
/**
 * Готовит локальные ресурсы для семантического поиска (RAG) — вариант "всё локально".
 *
 * 1) Копирует WASM-движок onnxruntime из npm-пакета @xenova/transformers в public/ort
 * 2) Скачивает файлы текстовой эмбеддинг-модели (multilingual-e5-small) в public/models
 *
 * После запуска приложение работает полностью офлайн: содержимое книг и веса моделей
 * не покидают сервер/браузер. Запускать при первом деплое и после обновления модели:
 *   node scripts/setup-local-models.mjs
 */

import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = process.cwd();
const PUBLIC_ORT = path.join(ROOT, 'public', 'ort');
const PKG_DIST = path.join(ROOT, 'node_modules', '@xenova', 'transformers', 'dist');

const WASM_FILES = [
  'ort-wasm-simd.wasm',
  'ort-wasm.wasm',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-threaded.wasm',
];

// Текстовая эмбеддинг-модель (RU/EN, 384 измерения).
const TEXT_MODEL = {
  repo: 'Xenova/multilingual-e5-small',
  files: [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'onnx/model_quantized.onnx',
  ],
  optional: new Set(['special_tokens_map.json']),
};

// Мультимодальная модель CLIP для поиска по изображениям (image/text, 512 измерений).
const CLIP_MODEL = {
  repo: 'Xenova/clip-vit-base-patch32',
  files: [
    'config.json',
    'preprocessor_config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'vocab.json',
    'merges.txt',
    'special_tokens_map.json',
    'onnx/text_model_quantized.onnx',
    'onnx/vision_model_quantized.onnx',
  ],
  optional: new Set(['special_tokens_map.json']),
};

const MODELS = [TEXT_MODEL, CLIP_MODEL];

const HF_BASE = 'https://huggingface.co';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyWasm() {
  await ensureDir(PUBLIC_ORT);
  for (const file of WASM_FILES) {
    const src = path.join(PKG_DIST, file);
    const dest = path.join(PUBLIC_ORT, file);
    try {
      await fs.copyFile(src, dest);
      console.log(`[wasm] ${file} -> public/ort/`);
    } catch (err) {
      console.warn(`[wasm] пропуск ${file}: ${err.message}`);
    }
  }
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} для ${url}`);
  }
  await ensureDir(path.dirname(dest));
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function downloadModel(model) {
  const modelDir = path.join(ROOT, 'public', 'models', ...model.repo.split('/'));
  for (const file of model.files) {
    const url = `${HF_BASE}/${model.repo}/resolve/main/${file}`;
    const dest = path.join(modelDir, file);
    try {
      console.log(`[model] загрузка ${model.repo}/${file} ...`);
      await downloadFile(url, dest);
      const { size } = await fs.stat(dest);
      console.log(`[model] готово: ${file} (${(size / 1024 / 1024).toFixed(1)} МБ)`);
    } catch (err) {
      if (model.optional.has(file)) {
        console.warn(`[model] опциональный файл недоступен, пропуск: ${file}`);
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log('Настройка локальных моделей (вариант "всё локально")...');
  await copyWasm();
  for (const model of MODELS) {
    await downloadModel(model);
  }
  console.log('Готово. Семантический и визуальный поиск работают офлайн.');
}

main().catch((err) => {
  console.error('Ошибка настройки локальных моделей:', err);
  process.exit(1);
});
