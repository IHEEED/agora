#!/bin/bash
set -uo pipefail
# PARAFRAZ on iPhone, macOS side. Same job as phone.cmd does on Windows:
# build for production, then serve to the local network. See PHONE.md.
#
# Production, not "next dev", on purpose. The dev server ships unminified
# code, source maps, the hot-reload client, and React in development mode -
# which renders every component twice under StrictMode. On a desktop that is
# a rounding error. On a phone it is the difference between smooth and
# unusable.

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Find this machine on the local network. The address has to be one the phone
# can reach, so ask the hardware ports first: on a Mac with a VPN up, the
# default route points at a utun tunnel whose address the phone cannot reach,
# and ipconfig returns nothing for it anyway.
LAN=""
while read -r DEV; do
  [ -z "$DEV" ] && continue
  LAN="$(ipconfig getifaddr "$DEV" 2>/dev/null)"
  [ -n "$LAN" ] && break
done <<< "$(networksetup -listallhardwareports 2>/dev/null | awk '/^Device: /{print $2}')"

# Fallback: no hardware ports listed (or none of them carries an address).
# Take the default route only if it lands on a real, addressable interface.
if [ -z "$LAN" ]; then
  IFACE="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  [ -n "$IFACE" ] && LAN="$(ipconfig getifaddr "$IFACE" 2>/dev/null)"
fi

if [ -z "$LAN" ]; then
  echo
  echo "  Не нашёл адрес в локальной сети. Wi-Fi включён?"
  echo
  read -r -p "  Enter — закрыть." _
  exit 1
fi

# The address is baked into the frontend AT BUILD TIME, so it must be written
# before the build runs, not after. Rewriting it every time also keeps it in
# step when the router hands out a different address than it did last time.
ENV_FILE="$ROOT/frontend/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "  Нет frontend/.env.local — ключи не перенесены. См. SETUP.md."
  read -r -p "  Enter — закрыть." _
  exit 1
fi
if grep -q '^NEXT_PUBLIC_API_URL=' "$ENV_FILE"; then
  sed -i '' "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://$LAN:4000|" "$ENV_FILE"
else
  printf '\nNEXT_PUBLIC_API_URL=http://%s:4000\n' "$LAN" >> "$ENV_FILE"
fi

echo
echo "  Собираю. Около минуты — именно это делает версию быстрой на телефоне."
echo

if ! npm --prefix "$ROOT/backend" run build; then
  echo
  echo "  Бэкенд не собрался. Ничего не запущено."
  read -r -p "  Enter — закрыть." _
  exit 1
fi

if ! npm --prefix "$ROOT/frontend" run build; then
  echo
  echo "  Фронтенд не собрался. Ничего не запущено."
  read -r -p "  Enter — закрыть." _
  exit 1
fi

# Both servers live in this one window, unlike the Windows script's two. Ctrl+C
# has to take down both, and node ignores a SIGTERM sent to the npm wrapper
# alone, so kill the whole process group.
BACK_PID=""
FRONT_PID=""
cleanup() {
  trap - INT TERM EXIT
  [ -n "$BACK_PID" ] && kill "$BACK_PID" 2>/dev/null
  [ -n "$FRONT_PID" ] && kill "$FRONT_PID" 2>/dev/null
  wait 2>/dev/null
  echo
  echo "  Остановлено."
}
trap cleanup INT TERM EXIT

npm --prefix "$ROOT/backend" run start &
BACK_PID=$!
npm --prefix "$ROOT/frontend" run start:phone &
FRONT_PID=$!

echo
echo "  Работает. На iPhone, в том же Wi-Fi, открыть:"
echo
echo "      http://$LAN:3000"
echo
echo "  Дальше «Поделиться» → «На экран «Домой»», и запускать со значка."
echo "  Не по желанию: в Safari адресная строка прячется и возвращается при"
echo "  прокрутке, меняя высоту окна под пальцем. С экрана «Домой» её нет."
echo
echo "  Ничего не грузится? macOS спрашивает про входящие соединения при"
echo "  первом запуске — ответить «Разрешить». Если промахнулись:"
echo "  Системные настройки → Сеть → Брандмауэр → Параметры, найти node."
echo
echo "  Поправили код? Запустить заново — рабочая сборка это снимок,"
echo "  сама правки не подхватывает."
echo
echo "  Ctrl+C — остановить оба сервера."
echo

wait
