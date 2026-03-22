# Payment Support Runbook (RU)

Краткий операционный чек-лист для стабильной работы PayAnyWay -> Opus.

## 1) Быстрая проверка статуса системы (ежедневно)

```bash
tail -n 100 /var/log/doctor-opus-payment-reconcile.log
tail -n 100 /var/log/doctor-opus-payment-health.log
```

Ожидаемо:
- нет постоянных ошибок 401/500;
- `pending_with_tx_24h` не накапливается;
- `pending_no_tx_24h` может появляться как брошенные оплаты, но не должен расти аномально.

## 2) Проверка автосверки вручную (когда нужно)

```bash
SECRET="$(grep -E '^PAYMENT_RECONCILE_SECRET=' /home/doctor-opus/.env | cut -d= -f2-)"
curl -fsS "https://doctor-opus.ru/api/payment/reconcile?secret=${SECRET}&limit=200"
```

Ожидаемо:
- JSON с `success: true`;
- при найденных кейсах увеличиваются `processed/confirmed`.

## 3) Проверка cron (разово и после админ-работ)

```bash
crontab -l | grep doctor-opus-payment
```

Должны быть:
- `doctor-opus-payment-reconcile` (каждые 10 минут),
- `doctor-opus-payment-health` (ежедневно).

## 4) Если пользователь сообщает "оплатил, баланс не пополнился"

1. Проверить, есть ли операция в кабинете PayAnyWay (номер операции).
2. Запустить reconcile вручную (пункт 2).
3. Проверить платежи и баланс:

```bash
cd /home/doctor-opus && docker exec -i -w /app doctor-opus-app-main95 node <<'NODE'
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
  await c.connect();
  const p = await c.query(`
    SELECT id,email,amount,units,status,transaction_id,created_at,updated_at
    FROM payments
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.table(p.rows);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
NODE
```

Если операция в PayAnyWay есть, а в Opus ещё `pending`, через reconcile должна перейти в `completed`.

## 5) Если reconcile не работает

Проверить последовательно:
1. секрет в `.env`:
```bash
grep '^PAYMENT_RECONCILE_SECRET=' /home/doctor-opus/.env
```
2. секрет в контейнере:
```bash
docker exec -i doctor-opus-app-main95 sh -lc "printenv | grep '^PAYMENT_RECONCILE_SECRET='"
```
3. middleware не блокирует endpoint (`/api/payment/reconcile` должен быть в public API whitelist).

## 6) Критерии "всё хорошо"

- Оплата в PayAnyWay фиксируется.
- Webhook приходит без ошибок подписи.
- Платеж в Opus становится `completed` (сразу или через reconcile).
- Баланс пользователя пополняется автоматически.
- В логах нет повторяющихся критичных ошибок.

---

Контрольная команда (одной строкой):

```bash
tail -n 50 /var/log/doctor-opus-payment-reconcile.log && tail -n 50 /var/log/doctor-opus-payment-health.log
```
