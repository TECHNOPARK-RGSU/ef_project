from django.contrib.auth.models import AbstractUser, UserManager
from django.core.exceptions import ValidationError
from django.db import models
from utils.models import BaseModel


class EmailUserManager(UserManager):
    """Менеджер пользователя с авторизацией по email (без username)."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email обязателен для создания пользователя.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Суперпользователь должен иметь is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Суперпользователь должен иметь is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


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

    def __str__(self):
        if self.short_name and self.short_name.strip():
            return f"{self.short_name} ({self.city})"
        return f"{self.name} ({self.city})"


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

    def __str__(self):
        return f"{self.name} ({self.code})"


class User(AbstractUser, BaseModel):
    """Пользователь системы (участник, руководитель, эксперт, организатор)."""

    username = None
    email = models.EmailField(
        unique=True,
        verbose_name="E-mail",
    )
    middle_name = models.CharField(
        max_length=255,
        verbose_name="Отчество",
        blank=True,
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

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = EmailUserManager()

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        ordering = ["last_name", "first_name"]


class TutorStudentAccess(BaseModel):
    """Разрешение: наставник допускает участника к выбору себя как руководителя."""

    tutor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="allowed_student_links",
        verbose_name="Наставник",
    )
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="available_tutor_links",
        verbose_name="Участник",
    )

    class Meta:
        verbose_name = "Доступ наставника к участнику"
        verbose_name_plural = "Доступы наставников к участникам"
        constraints = [
            models.UniqueConstraint(
                fields=["tutor", "student"],
                name="unique_tutor_student_access",
            )
        ]

    def clean(self):
        tutor_role = (getattr(self.tutor.role, "code", "") or "").lower()
        student_role = (getattr(self.student.role, "code", "") or "").lower()
        if tutor_role != "tutor":
            raise ValidationError({"tutor": "Выбранный пользователь не является наставником."})
        if student_role not in {"student", "student2", "student3"}:
            raise ValidationError({"student": "Можно выбирать только пользователей с ролью ученика."})

    def __str__(self):
        tutor_email = getattr(self.tutor, "email", "") or f"user#{self.tutor_id}"
        student_email = getattr(self.student, "email", "") or f"user#{self.student_id}"
        return f"{tutor_email} -> {student_email}"


class StudentPeerLink(BaseModel):
    """Симметричная связь между двумя учениками для совместных проектов."""

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="peer_links",
        verbose_name="Ученик",
    )
    peer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="peer_of_links",
        verbose_name="Связанный ученик",
    )

    class Meta:
        verbose_name = "Связь между учениками"
        verbose_name_plural = "Связи между учениками"
        constraints = [
            models.UniqueConstraint(
                fields=["student", "peer"],
                name="unique_student_peer_link",
            )
        ]

    def clean(self):
        student_role = (getattr(self.student.role, "code", "") or "").lower()
        peer_role = (getattr(self.peer.role, "code", "") or "").lower()
        if student_role not in {"student", "student2", "student3"}:
            raise ValidationError({"student": "Связь можно создавать только для учеников."})
        if peer_role not in {"student", "student2", "student3"}:
            raise ValidationError({"peer": "Связь можно создавать только с учеником."})
        if self.student_id == self.peer_id:
            raise ValidationError({"peer": "Нельзя связать ученика с самим собой."})

    def __str__(self):
        student_email = getattr(self.student, "email", "") or f"user#{self.student_id}"
        peer_email = getattr(self.peer, "email", "") or f"user#{self.peer_id}"
        return f"{student_email} <-> {peer_email}"
