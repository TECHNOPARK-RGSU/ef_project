from django.db import models
from utils.models import BaseModel


class EducationalOrganization(BaseModel):
    """Образовательная организация, к которой относится пользователь/участник."""

    name = models.CharField(
        max_length=255,
        verbose_name="Полное наименование",
    )
    short_name = models.CharField(
        max_length=255,
        verbose_name="Краткое наименование",
        blank=True,
    )
    city = models.CharField(
        max_length=255,
        verbose_name="Город",
    )
    address = models.CharField(
        max_length=255,
        verbose_name="Адрес",
        blank=True,
    )
    website = models.URLField(
        verbose_name="Сайт",
        blank=True,
    )

    class Meta:
        verbose_name = "Образовательная организация"
        verbose_name_plural = "Образовательные организации"
        constraints = [
            models.UniqueConstraint(
                fields=["name", "city"],
                name="unique_educational_org_name_city",
            )
        ]


class Role(BaseModel):
    """Роль пользователя в системе/конференции (участник, эксперт, организатор и т.д.)."""

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Название роли",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Код роли (для логики системы)",
    )

    class Meta:
        verbose_name = "Роль"
        verbose_name_plural = "Роли"
        ordering = ["name"]


class User(BaseModel):
    """Пользователь системы (участник, руководитель, эксперт, организатор)."""

    last_name = models.CharField(max_length=255, verbose_name="Фамилия")
    first_name = models.CharField(max_length=255, verbose_name="Имя")
    middle_name = models.CharField(
        max_length=255,
        verbose_name="Отчество",
        blank=True,
    )
    email = models.EmailField(
        unique=True,
        verbose_name="E-mail",
    )
    password = models.CharField(
        max_length=255,
        verbose_name="Пароль (хэш)",
    )
    phone = models.CharField(
        max_length=50,
        verbose_name="Телефон",
        blank=True,
    )
    city = models.CharField(
        max_length=255,
        verbose_name="Город",
        blank=True,
    )
    date_of_birth = models.DateField(
        null=True,
        blank=True,
        verbose_name="Дата рождения",
    )

    # Foreign Keys
    educational_organization = models.ForeignKey(
        EducationalOrganization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        verbose_name="Образовательная организация",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        verbose_name="Роль",
    )

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        ordering = ["last_name", "first_name"]
