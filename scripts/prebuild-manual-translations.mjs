import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const SOURCE_MANUAL_PATH = path.join(ROOT_DIR, 'USER_MANUAL_FOR_DOCTORS.md');
const OUTPUT_DIR = path.join(ROOT_DIR, 'content', 'manual');
const OPENROUTER_FALLBACK_URL = 'https://openrouter.ai/api/v1/chat/completions';

const LOCALES = ['en', 'es', 'fr', 'ar', 'hi', 'pt-BR', 'id', 'ms', 'tr', 'zh-CN'];

const LOCALE_TO_LANGUAGE = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic',
  hi: 'Hindi',
  'pt-BR': 'Brazilian Portuguese',
  id: 'Indonesian',
  ms: 'Malay',
  tr: 'Turkish',
  'zh-CN': 'Simplified Chinese',
};

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function loadLocalEnv() {
  const merged = {
    ...readEnvFile(path.join(ROOT_DIR, '.env')),
    ...readEnvFile(path.join(ROOT_DIR, '.env.local')),
    ...readEnvFile(path.join(ROOT_DIR, '.env.production')),
  };

  for (const [key, value] of Object.entries(merged)) {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value;
    }
  }
}

function resolveApiUrl() {
  const baseUrl = process.env.LLM_BASE_URL?.trim() || process.env.OPENROUTER_BASE_URL?.trim();
  if (!baseUrl) return OPENROUTER_FALLBACK_URL;
  return baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function resolveTranslatorModel() {
  return (
    process.env.MODEL_TRANSLATOR?.trim() ||
    process.env.MODEL_GEMINI_FLASH?.trim() ||
    'google/gemini-3.8-flash'
  );
}

async function translateMarkdown(markdown, targetLanguage) {
  const apiKey = process.env.LLM_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');
  }

  const response = await fetch(resolveApiUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolveTranslatorModel(),
      temperature: 0,
      max_tokens: 16000,
      messages: [
        {
          role: 'system',
          content: `You are a professional medical technical translator.
Translate the user-provided Markdown from English to ${targetLanguage}.
Strict requirements:
- Preserve Markdown structure exactly (headings, bullets, numbering, tables, links, emphasis, emojis, separators).
- Keep medical meaning precise and legally safe.
- Do not add, remove, summarize, or reinterpret content.
- Keep abbreviations and units accurate.
- Return only translated Markdown.`,
        },
        {
          role: 'user',
          content: markdown,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Translator request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const translated = data?.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error('Translator returned empty content');
  return translated;
}

async function main() {
  loadLocalEnv();

  if (!fs.existsSync(SOURCE_MANUAL_PATH)) {
    throw new Error(`Source manual not found: ${SOURCE_MANUAL_PATH}`);
  }

  const sourceMarkdown = fs.readFileSync(SOURCE_MANUAL_PATH, 'utf8');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const failedLocales = [];

  for (const locale of LOCALES) {
    const outputPath = path.join(OUTPUT_DIR, `${locale}.md`);
    if (locale === 'en') {
      fs.writeFileSync(outputPath, sourceMarkdown, 'utf8');
      console.log(`Saved ${locale} manual`);
      continue;
    }

    const language = LOCALE_TO_LANGUAGE[locale];
    try {
      console.log(`Translating manual -> ${locale} (${language})`);
      const translated = await translateMarkdown(sourceMarkdown, language);
      fs.writeFileSync(outputPath, translated, 'utf8');
      console.log(`Saved ${locale} manual`);
    } catch (error) {
      failedLocales.push(locale);
      console.error(
        `Failed locale ${locale}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (failedLocales.length > 0) {
    console.warn(
      `Manual prebuild finished with warnings. Failed locales: ${failedLocales.join(', ')}`
    );
    console.warn('Runtime fallback translation remains available for failed locales.');
    return;
  }

  console.log('Manual prebuild finished');
}

main().catch((error) => {
  console.error('Manual prebuild failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

