# 🔄 Database Migration Guide - Doctor Opus v3.40.0

## Обзор

Этот гайд описывает процесс миграции базы данных для новой системы серверного биллинга.

---

## 📋 Предварительные требования

1. **PostgreSQL база данных** (Neon или другая)
2. **POSTGRES_URL** настроен в `.env`
3. **Доступ к админ-панели** или Vercel CLI

---

## 🔐 Настройка переменных окружения

### Локально (`.env.local`)

Добавьте следующую переменную:

```env
# Секрет для миграции базы данных (используется один раз)
MIGRATION_SECRET=doctor-opus-migration-2026-YOUR-RANDOM-STRING
```

### Production (Vercel)

1. Откройте Vercel Dashboard → Settings → Environment Variables
2. Добавьте:
   - **Имя:** `MIGRATION_SECRET`
   - **Значение:** `doctor-opus-migration-2026-YOUR-RANDOM-STRING`
   - **Environment:** Production (или All)

**⚠️ ВАЖНО:** Используйте сложный случайный секрет в production!

---

## 🚀 Выполнение миграции

### Способ 1: Через API (рекомендуется)

#### Шаг 1: Проверка статуса

Проверьте, нужна ли миграция:

```bash
curl https://doctor-opus.ru/api/admin/migrate
```

Ответ:
```json
{
  "status": "pending",
  "existing_tables": [],
  "missing_tables": ["user_balances", "credit_transactions"],
  "message": "Missing tables: user_balances, credit_transactions"
}
```

#### Шаг 2: Выполнение миграции

```bash
curl -X POST https://doctor-opus.ru/api/admin/migrate \
  -H "Content-Type: application/json" \
  -d '{"secret": "doctor-opus-migration-2026-YOUR-RANDOM-STRING"}'
```

Успешный ответ:
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "execution_time_ms": 1234,
  "tables": ["credit_transactions", "user_balances"],
  "stats": {
    "user_balances": 2,
    "credit_transactions": 0
  },
  "test_users": [
    "support@doctor-opus.ru",
    "test@doctor-opus.ru"
  ]
}
```

---

### Способ 2: Через Vercel CLI

```bash
# 1. Установите Vercel CLI
npm i -g vercel

# 2. Логин
vercel login

# 3. Запустите миграцию
vercel env pull .env.local
curl -X POST http://localhost:3000/api/admin/migrate \
  -H "Content-Type: application/json" \
  -d '{"secret": "ваш-секрет-из-env"}'
```

---

### Способ 3: Через Postman / Insomnia

1. Создайте новый POST запрос
2. URL: `https://doctor-opus.ru/api/admin/migrate`
3. Body (JSON):
   ```json
   {
     "secret": "doctor-opus-migration-2026-YOUR-RANDOM-STRING"
   }
   ```
4. Отправьте запрос

---

## 📊 Созданные таблицы

### `user_balances`

```sql
CREATE TABLE user_balances (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  balance DECIMAL(10,2) DEFAULT 50.00 CHECK (balance >= -5.00),
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  is_test_account BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_balances_email ON user_balances(email);
```

**Описание полей:**
- `balance`: Текущий баланс (разрешен овердрафт до -5)
- `total_spent`: Всего потрачено за всё время
- `is_test_account`: Флаг тестового аккаунта (для VIP пользователей)

---

### `credit_transactions`

```sql
CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  operation TEXT NOT NULL,
  metadata JSONB,
  balance_after DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_email_date 
ON credit_transactions(email, created_at DESC);
```

**Описание полей:**
- `amount`: Сумма списания (всегда положительная)
- `operation`: Описание операции (например, "Анализ ЭКГ")
- `metadata`: Дополнительная информация (модель, токены)
- `balance_after`: Баланс после операции

---

## 🧪 Тестирование после миграции

### 1. Проверка созданных таблиц

```bash
curl https://doctor-opus.ru/api/admin/migrate
```

Должно вернуть:
```json
{
  "status": "migrated",
  "existing_tables": ["credit_transactions", "user_balances"],
  "missing_tables": []
}
```

### 2. Проверка баланса тестового пользователя

Войдите как `test@doctor-opus.ru` и проверьте:

```bash
curl https://doctor-opus.ru/api/billing/balance \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

Ответ:
```json
{
  "success": true,
  "balance": 100.00,
  "totalSpent": 0
}
```

### 3. Тест списания кредитов

```bash
curl -X POST https://doctor-opus.ru/api/billing/deduct \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5.5,
    "operation": "Тест анализа ЭКГ",
    "metadata": {
      "model": "anthropic/claude-opus-4.6",
      "tokens": {"input": 1000, "output": 500}
    }
  }'
```

Ожидаемый ответ:
```json
{
  "success": true,
  "deducted": 5.5,
  "balanceBefore": 100,
  "balanceAfter": 94.5,
  "operation": "Тест анализа ЭКГ"
}
```

---

## ⚠️ Возможные ошибки

### Ошибка 401: Unauthorized

**Причина:** Неверный `MIGRATION_SECRET`

**Решение:**
1. Проверьте `.env.local` или Vercel Environment Variables
2. Убедитесь, что секрет совпадает с тем, что вы отправляете в запросе

---

### Ошибка 500: Migration failed

**Причина:** Проблема с подключением к PostgreSQL

**Решение:**
1. Проверьте `POSTGRES_URL` в `.env`
2. Убедитесь, что база данных доступна
3. Проверьте логи сервера: `vercel logs`

---

### Таблицы уже существуют

**Причина:** Миграция уже выполнялась ранее

**Решение:**
- Это нормально! Endpoint использует `CREATE TABLE IF NOT EXISTS`
- Повторный запуск безопасен и не повредит данные
- Проверьте статус: `GET /api/admin/migrate`

---

## 🔒 Безопасность

### После миграции

1. **Удалите `MIGRATION_SECRET`** из переменных окружения (опционально)
2. **Отзовите доступ** к `/api/admin/migrate` через Nginx/Cloudflare (если используется)
3. **Проверьте логи** на наличие подозрительных попыток доступа

### Рекомендации

- Используйте сложный секрет (минимум 32 символа)
- Не коммитьте `.env.local` в git
- Не передавайте секрет в открытом виде (используйте HTTPS)

---

## 📚 Дополнительные ресурсы

- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Neon Database Docs](https://neon.tech/docs)
- [Security Audit Report](./history/VERSION_3.40.0_SECURITY.md)

---

## ❓ FAQ

**Q: Можно ли запустить миграцию несколько раз?**  
A: Да, endpoint использует `IF NOT EXISTS` и безопасен для повторного запуска.

**Q: Что делать, если миграция прервалась?**  
A: Просто запустите её снова. Транзакции PostgreSQL гарантируют целостность.

**Q: Где хранятся старые данные из localStorage?**  
A: localStorage больше не используется. Все данные теперь в PostgreSQL.

**Q: Нужно ли мигрировать старые балансы пользователей?**  
A: Нет, все пользователи получают стартовый баланс 50 единиц при первом входе.

---

**Версия:** 3.40.0  
**Последнее обновление:** 22 января 2026  
**Автор:** Селиванов Василий Федорович
