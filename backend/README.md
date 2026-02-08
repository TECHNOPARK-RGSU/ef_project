# Backend (Django)

После деплоя обязательно примените миграции на сервере:

```bash
python manage.py migrate
```

Иначе API будет возвращать 500 (например, `column conf_agecategory.conference_id does not exist`), так как в БД не будут созданы поля справочников, привязанных к конференции.
