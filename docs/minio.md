# MinIO (Dokploy)

Этот файл — заготовка под будущую интеграцию MinIO. Пока подключение не сделано, ниже — минимальный набор переменных окружения, которые пригодятся для Dokploy.

## Переменные окружения

```
MINIO_ROOT_USER=change-me
MINIO_ROOT_PASSWORD=change-me
MINIO_BUCKET=ef-project
MINIO_REGION=ru-central
MINIO_ENDPOINT=http://minio:9000
MINIO_PUBLIC_URL=https://minio.example.com

AWS_ACCESS_KEY_ID=change-me
AWS_SECRET_ACCESS_KEY=change-me
S3_ENDPOINT_URL=http://minio:9000
S3_BUCKET=ef-project
```

## Заметки

- MINIO_ROOT_* — учётные данные администратора MinIO.
- AWS_* и S3_* понадобятся, когда будем подключать хранилище к backend.
- Значения примерные, под Dokploy заменим на реальные.
