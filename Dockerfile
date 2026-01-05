# Этап 1: Сборка Next.js фронтенда
FROM node:18-slim AS node-builder

WORKDIR /app

# Установка системных зависимостей для canvas и сборки (Node.js)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Копируем конфиги и устанавливаем зависимости
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# Копируем исходники и собираем проект
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Этап 2: Финальный образ с Python и Node.js
FROM python:3.10-slim

LABEL maintainer="Doctor Opus Team"
LABEL version="3.39.0"

WORKDIR /app

# Установка системных зависимостей для Node.js, DICOM и обработки изображений
RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Копируем зависимости Python и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем собранное приложение из первого этапа
COPY --from=node-builder /app/.next ./.next
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json
COPY --from=node-builder /app/next.config.js ./next.config.js

# Копируем остальные необходимые файлы (скрипты, либы)
COPY scripts/ ./scripts/
COPY lib/ ./lib/
# Копируем корневые файлы проекта
COPY *.ts *.js *.json ./

# Настройка переменных окружения
ENV NODE_ENV production
ENV PORT 3000
ENV PYTHONUNBUFFERED 1

# Создаем директории для данных и выставляем права (если нужно)
RUN mkdir -p uploads exports data/training_data

# Открываем порт
EXPOSE 3000

# Команда запуска
CMD ["npm", "start"]

