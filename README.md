# ef_project

Учебная платформа для управления очными и заочными конференциями.

## Быстрый старт (Docker)

```bash
docker compose build
docker compose up
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- MinIO: http://localhost:9000 (console: http://localhost:9001)

### Демоданные

```bash
docker compose exec backend /app/.venv/bin/python manage.py seed_demo
```

### Токен доступа

После `seed_demo` в выводе будет токен организатора. В интерфейсе нажмите “Войти” и вставьте токен.  
Для ручного получения:

```bash
curl -X POST http://localhost:8000/api/auth/token/ \\
  -H "Content-Type: application/json" \\
  -d '{"username":"organizer@example.com","password":"password123"}'
```

### Результаты

```bash
curl -X POST http://localhost:8000/api/conf/conferences/1/calculate_results/
curl -X POST http://localhost:8000/api/conf/conferences/1/publish_results/
curl -X GET  http://localhost:8000/api/conf/conferences/1/export_results/
curl -X GET  http://localhost:8000/api/conf/conferences/1/export_results_excel/
curl -X GET  http://localhost:8000/api/conf/conferences/1/print_protocol/
curl -X POST http://localhost:8000/api/conf/conferences/1/assign_projects/ \\
  -H "Content-Type: application/json" \\
  -d '{"stage":"online","per_expert":3}'
```

## Переменные окружения

См. `.env.example` для backend.
