#!/bin/sh
set -e
# Применяем миграции при старте контейнера, чтобы схема БД не отставала от кода.
/app/.venv/bin/python manage.py migrate --noinput
# Собираем статику при каждом старте (админка, наши стили) — без ручного шага при деплое
/app/.venv/bin/python manage.py collectstatic --noinput
exec "$@"
