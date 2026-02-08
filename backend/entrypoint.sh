#!/bin/sh
set -e
# Собираем статику при каждом старте (админка, наши стили) — без ручного шага при деплое
/app/.venv/bin/python manage.py collectstatic --noinput
exec "$@"
