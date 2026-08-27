#!/usr/bin/env node
/**
 * Готовит локальные ресурсы для эмбеддингов:
 * 1) Копирует WASM onnxruntime в public/ort
 * 2) Скачивает модели Xenova в public/models
 *
 * Запускается в Docker build и локально через `npm run setup:models`.
 */

import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = process.cwd();
const PUBLIC_ORT = path.join(ROOT, 'public', 'ort');
const PKG_DIST = path.join(ROOT, 'node_modules', '@xenova', 'transformers', 'dist');
const HF_BASE = 'https://huggingface.co';

const WASM_FILES = [
  'ort-wasm-simd.wasm',
  'ort-wasm.wasm',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-threaded.wasm',
];

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

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyWasm() {
  await ensureDir(PUBLIC_ORT);
  for (const file of WASM_FILES) {
    const src = path.join(PKG_DIST, file);
    const dest = path.join(PUBLIC_ORT, file);
    await fs.copyFile(src, dest);
    console.log(`[wasm] ${file} -> public/ort/`);
  }
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  await ensureDir(path.dirname(dest));
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function withRetries(task, attempts = 3) {
  let lastError = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        const backoff = i * 2000;
        console.warn(`retry ${i}/${attempts} in ${backoff}ms: ${String(err?.message || err)}`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }
  throw lastError;
}

async function downloadModel(model) {
  const modelDir = path.join(ROOT, 'public', 'models', ...model.repo.split('/'));
  for (const file of model.files) {
    const url = `${HF_BASE}/${model.repo}/resolve/main/${file}`;
    const dest = path.join(modelDir, file);
    try {
      console.log(`[model] downloading ${model.repo}/${file} ...`);
      await withRetries(() => downloadFile(url, dest), 3);
      const { size } = await fs.stat(dest);
      console.log(`[model] done: ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`);
    } catch (err) {
      if (model.optional.has(file)) {
        console.warn(`[model] optional file skipped: ${file}`);
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log('Preparing local embedding assets...');
  await copyWasm();
  for (const model of MODELS) {
    await downloadModel(model);
  }
  console.log('Done. Local embedding assets are ready.');
}

main().catch((err) => {
  console.error('setup:models failed:', err);
  process.exit(1);
});
