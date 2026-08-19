# Сборка и запуск бэкенда PARAFRAZ.
#
# Два этапа, а не один. На первом стоят devDependencies и лежит TypeScript — он
# нужен ровно один раз, чтобы собрать dist. Во второй образ переезжает только
# собранный код и рабочие зависимости: у TypeScript, ts-node-dev и типов в
# продакшене работы нет, а вес и площадь для уязвимостей они добавляют.
FROM node:24-alpine AS build
WORKDIR /app

# Сначала манифесты, потом код. Слой с npm ci кешируется по ним, и правка
# исходников не заставляет ставить зависимости заново.
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Не root. Образ node создаёт пользователя node заранее — берём его.
USER node

# Порт задаёт хостинг переменной PORT; здесь только подсказка для docker run.
EXPOSE 4000
CMD ["node", "dist/index.js"]
