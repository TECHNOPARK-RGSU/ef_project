from django.db import models

class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_archived = models.BooleanField(default=False)

    class Meta:
        abstract = True

    def __str__(self):
        # По умолчанию пытаемся вернуть поле `name`,
        # а если его нет — стандартное строковое представление Django.
        return getattr(self, "name", super().__str__())