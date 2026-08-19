# Сборка и запуск бэкенда PARAFRAZ.
#
# Контекст сборки — корень репозитория, а не папка backend. Так пришлось сделать
# потому, что в Railway настройка «корневая папка» лежит не там, где я её описал,
# и называется в разных версиях по-разному: надёжнее не зависеть от неё вовсе.
# Отсюда пути вида backend/package.json — они считаются от корня.
#
# Два этапа, а не один. На первом стоят devDependencies и лежит TypeScript — он
# нужен ровно один раз, чтобы собрать dist. Во второй образ переезжает только
# собранный код и рабочие зависимости: у TypeScript и типов в продакшене работы
# нет, а вес и площадь для уязвимостей они добавляют.
FROM node:24-alpine AS build
WORKDIR /app

# Сначала манифесты, потом код. Слой с npm ci кешируется по ним, и правка
# исходников не заставляет ставить зависимости заново.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Не root. Образ node создаёт пользователя node заранее — берём его.
USER node

# Порт задаёт хостинг переменной PORT; здесь только подсказка для docker run.
EXPOSE 4000
CMD ["node", "dist/index.js"]
