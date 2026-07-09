# 🔄 Как включить систему подписки (актуально для Next.js-версии)

**Статус:** инструкция обновлена под текущую архитектуру (`Next.js + PostgreSQL + server billing`).

---

## ✅ Что уже готово

- Баланс и транзакции хранятся в PostgreSQL.
- Списание выполняется на сервере (`checkAndDeductBalance` / `checkAndDeductGuestBalance`).
- Есть админские и VIP-режимы через переменные окружения.
- Есть гостевой триал и ограничения на создание оплат.

---

## 🚀 Быстрое включение

### 1) Заполните `.env`

Минимальный набор:

```env
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://doctor-opus.ru
POSTGRES_URL=postgres://...
MIGRATION_SECRET=...
ENCRYPTION_SALT=...

ADMIN_EMAILS=admin@doctor-opus.ru
VIP_EMAILS=admin@doctor-opus.ru
NEXT_PUBLIC_VIP_EMAILS=admin@doctor-opus.ru
```

Для включения оплаты (пример):

```env
PAYMENT_PROVIDER=yagoda
YAGODA_API_TOKEN=...
MIN_TOPUP_RUB=250
CREDIT_PRICE_RUB=2.5
```

### 2) Примените миграции и перезапустите сервис

```bash
npm run migrate
docker compose up -d --build medical-assistant
```

### 3) Проверка

- Войдите под админским email.
- Проверьте страницу подписки и историю транзакций.
- Сделайте тестовое списание (например, транскрибация/чат) и убедитесь, что баланс изменился.

---

## 📋 Полезные переключатели

- `GUEST_TRIAL_BALANCE` — стартовый баланс гостя.
- `REGISTERED_BONUS` / `INITIAL_BALANCE` — стартовые начисления.
- `SUBSCRIPTION_CLOSE_FOR_NEW_USERS` — закрыть оплату для новых аккаунтов.
- `SUBSCRIPTION_PAYMENTS_HARD_CLOSED` — полностью закрыть оплату.
- `PAYMENT_ACCESS_ALLOWLIST` — whitelist email для доступа к оплате.

---

## ⚠️ Важно

- Эта инструкция относится к текущей Next.js-версии.
- Упоминания `Streamlit`, `config.py`, `st.session_state` относятся к старой ветке и не применяются в текущем проде.

