# Как вывести бэкенд в сеть

Зачем: сейчас он на вашем компьютере, а база — в своём регионе Supabase. Каждый
запрос идёт через домашний интернет дважды, и это самая большая часть задержки,
которая осталась. Бэкенд в том же регионе, что база, убирает её целиком.

Проверить, где база:

```powershell
Select-String -Path .env -Pattern SUPABASE_URL
```

В адресе вида `https://gtothbqjddrfnhkpjtym.supabase.co` региона не видно — он в
панели Supabase: Settings → General → Region. Хостинг нужно выбирать в том же
или ближайшем.

## Railway

Проще всего, потому что читает `railway.json` и `Dockerfile` из репозитория и
больше ничего не спрашивает.

1. [railway.com](https://railway.com) → войти через GitHub.
2. **New Project → Deploy from GitHub repo** → выбрать `IHEEED/agora`.
3. **Root Directory** поставить `backend`. Без этого Railway ищет Dockerfile в
   корне и не находит.
4. **Variables** — добавить три:
   - `SUPABASE_URL` — из `backend/.env`
   - `SUPABASE_SERVICE_KEY` — оттуда же
   - `CORS_ORIGINS` — адрес фронтенда, например `https://agora-vert-nine.vercel.app`
5. **Settings → Region** — тот же, что у Supabase.
6. **Settings → Networking → Generate Domain** — получите адрес вида
   `agora-backend-production.up.railway.app`.

Порт задавать не нужно: Railway передаёт его переменной `PORT`, и код её уже
читает.

## Переключить фронтенд

В `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=https://ваш-адрес.up.railway.app
```

В Vercel то же самое: Settings → Environment Variables → `NEXT_PUBLIC_API_URL`.

И в `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://ваш-адрес.up.railway.app
```

После этого телефону больше не нужен ваш компьютер — приложение работает из
любой сети.

## Проверить

```powershell
curl https://ваш-адрес.up.railway.app/health
```

Должно ответить `{"ok":true,"uptime":...}`. Дальше замерьте ленту:

```powershell
curl -o NUL -s -w "%{time_total}\n" https://ваш-адрес.up.railway.app/posts?sort=hot
```

С компьютера сейчас 0.68 с. С хостинга в регионе базы ожидаемо 0.1–0.2 с.

## Сколько стоит

Railway: 5 $/месяц за Hobby, в него входит потребление примерно на эту сумму —
одному небольшому сервису этого хватает. Fly.io при желании дешевле, но там
нужен свой `fly.toml` и больше настройки руками.

## Локальная разработка не меняется

`npm run dev` работает как раньше. Dockerfile и `railway.json` нужны только
хостингу.
