// Точечный ре-тест только спорного (аорта) кейса — для сравнения Fable 5 vs Opus.
import { Pool } from 'pg';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });

function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function extractCookie(setCookieHeaders, name) {
  for (const header of setCookieHeaders || []) {
    const match = header.match(new RegExp(`${name}=([^;]+)`));
    if (match) return `${name}=${match[1]}`;
  }
  return null;
}

async function registerAndLogin(emailPrefix) {
  const email = `${emailPrefix}-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: emailPrefix }),
  });
  if (!registerRes.ok) {
    throw new Error(`Регистрация не удалась: ${registerRes.status} ${await registerRes.text()}`);
  }

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfSetCookie = getSetCookies(csrfRes);
  const csrfToken = (await csrfRes.json()).csrfToken;
  const csrfCookie = extractCookie(csrfSetCookie, 'next-auth.csrf-token') || extractCookie(csrfSetCookie, '__Host-next-auth.csrf-token');

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookie || '' },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: `${BASE_URL}/chat`, json: 'true' }),
    redirect: 'manual',
  });

  const loginSetCookie = getSetCookies(loginRes);
  const sessionCookie = extractCookie(loginSetCookie, 'next-auth.session-token') || extractCookie(loginSetCookie, '__Secure-next-auth.session-token');
  if (!sessionCookie) throw new Error(`Не удалось получить сессионную куку. Статус логина: ${loginRes.status}`);

  await pool.query(
    `INSERT INTO user_balances (email, balance) VALUES ($1, 300) ON CONFLICT (email) DO UPDATE SET balance = 300`,
    [email]
  );

  return { email, cookie: `${sessionCookie}; ${csrfCookie || ''}` };
}

async function runConsilium(label, cookie, message) {
  console.log(`\n========== ${label} (${BASE_URL}) ==========`);
  const formData = new FormData();
  formData.append('message', message);

  const res = await fetch(`${BASE_URL}/api/consilium`, { method: 'POST', headers: { Cookie: cookie }, body: formData });
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, await res.text());
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      if (!chunk.startsWith('data: ')) continue;
      const event = JSON.parse(chunk.slice(6));
      if (event.type === 'amsc-decision') console.log(`  [amsc-decision] escalated=${event.escalated} disagreement=${event.disagreementScore}`);
      if (event.type === 'round') console.log(`  [round] ${event.round} ${event.status}`);
      if (event.type === 'error') console.error(`  [error] ${event.message}`);
      if (event.type === 'final') finalResult = event.result;
    }
  }

  if (finalResult) {
    console.log('  ---- ИТОГ ----');
    console.log('  Диагноз:', finalResult.finalDiagnosis.diagnosis, `(p=${finalResult.finalDiagnosis.probability})`);
    console.log('  Обоснование:', finalResult.finalDiagnosis.reasoning);
    console.log('  Требует ручной проверки:', finalResult.requiresHumanReview, finalResult.reviewReason || '');
    console.log('  Раундов дебатов:', finalResult.auditTrail.roundOutputs.length);
    console.log('  Модели ролей:', finalResult.auditTrail.roundOutputs.flat().map(o => `${o.role}:${o.model}`).filter((v, i, a) => a.indexOf(v) === i).join(', '));
    console.log('  Токены:', finalResult.totalTokensUsed, '| Стоимость: $', finalResult.totalCostUsd.toFixed(4), `(~${(finalResult.totalCostUsd * 100).toFixed(2)} у.е.)`);
  }
}

async function main() {
  const complexCase = 'Мужчина 52 года, курит, внезапная резкая боль в грудной клетке с иррадиацией в спину 40 минут назад, АД 160/95 на одной руке и 120/80 на другой, потливость, легкая одышка. ЭКГ без явных признаков ОКС. В анамнезе гипертония, не принимает регулярно препараты.';

  const user = await registerAndLogin('consilium-compare');
  await runConsilium('СПОРНЫЙ КЕЙС (сравнение моделей)', user.cookie, complexCase);

  await pool.end();
}

main().catch((err) => {
  console.error('Ошибка теста:', err);
  process.exit(1);
});
