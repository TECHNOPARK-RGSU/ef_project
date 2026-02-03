# MinIO (Dokploy)

Этот файл — заготовка под будущую интеграцию MinIO. Пока подключение не сделано, ниже — минимальный набор переменных окружения, которые пригодятся для Dokploy.

## Переменные окружения

```
MINIO_ACCESS_KEY=change-me
MINIO_SECRET_KEY=change-me
MINIO_BUCKET=change-me
MINIO_REGION=us-east-1
MINIO_ENDPOINT=https://s3.example.com
MINIO_PUBLIC_URL=https://s3.example.com

AWS_ACCESS_KEY_ID=change-me
AWS_SECRET_ACCESS_KEY=change-me
S3_ENDPOINT_URL=https://s3.example.com
S3_BUCKET=change-me
```

## Заметки

- MINIO_* — параметры удалённого MinIO.
- AWS_* и S3_* нужны для совместимых SDK, используем те же ключи.
