from django.db import models
from utils.models import BaseModel
from users.models import User


class Conference(BaseModel):
    """Конференция (мероприятие)."""

    title = models.CharField(
        max_length=255,
        verbose_name="Название конференции",
    )
    description = models.TextField(
        verbose_name="Описание",
        blank=True,
    )
    start_date = models.DateField(
        verbose_name="Дата начала",
    )
    end_date = models.DateField(
        verbose_name="Дата окончания",
    )
    location = models.CharField(
        max_length=255,
        verbose_name="Место проведения",
        blank=True,
    )
    is_online = models.BooleanField(
        default=False,
        verbose_name="Онлайн-формат",
    )
    organizers = models.ManyToManyField(
        User,
        blank=True,
        related_name="organized_conferences",
        verbose_name="Организаторы",
    )

    class Meta:
        verbose_name = "Конференция"
        verbose_name_plural = "Конференции"
        ordering = ["-start_date"]
        


class AgeCategory(BaseModel):
    """Возрастная категория участников."""

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Название категории",
    )
    min_age = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Минимальный возраст",
    )
    max_age = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Максимальный возраст",
    )

    class Meta:
        verbose_name = "Возрастная категория"
        verbose_name_plural = "Возрастные категории"
        ordering = ["min_age", "max_age"]
    


class Section(BaseModel):
    """Секция конференции (научное направление)."""

    name = models.CharField(
        max_length=255,
        verbose_name="Название секции",
    )

    # Foreign Keys
    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name="sections",
        verbose_name="Конференция",
    )
    category = models.ForeignKey(
        AgeCategory,
        on_delete=models.PROTECT,
        related_name="sections",
        verbose_name="Возрастная категория",
    )

    class Meta:
        verbose_name = "Секция"
        verbose_name_plural = "Секции"



class ProjectStatus(BaseModel):
    """Статус проекта (согласован, не согласован, на доработку, новый и т.п.)."""

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Название статуса",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Код статуса",
    )

    class Meta:
        verbose_name = "Статус проекта"
        verbose_name_plural = "Статусы проекта"
        ordering = ["name"]


class ParticipationStage(BaseModel):
    """Этап участия (отборочный, заключительный, призёр, победитель, дисквалифицирован и т.п.)."""

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Название этапа",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Код этапа",
    )

    class Meta:
        verbose_name = "Этап участия"
        verbose_name_plural = "Этапы участия"
        ordering = ["name"]


class Place(BaseModel):
    """Место проведения."""

    name = models.CharField(
        max_length=225,
        verbose_name="Имя"
    )

    address = models.CharField(
        max_length=300,
        verbose_name="Адрес"
    )

    class Meta:
        verbose_name = "Место"
        verbose_name_plural = "Места"
        ordering = ["created_at"]


class PresentationType(BaseModel):
    """Тип представления проекта (устный, стендовый, онлайн и т.п.)."""

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Тип представления",
    )
    code = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Код типа",
    )

    #Foreign Keys

    place = models.ForeignKey(
        Place,
        on_delete=models.PROTECT,
        related_name="presentation_types",
        verbose_name="Место",
    )

    class Meta:
        verbose_name = "Тип представления"
        verbose_name_plural = "Типы представления"
        ordering = ["name"]


class Project(BaseModel):
    """Проект, который подаётся на конференцию."""

    title = models.CharField(
        max_length=255,
        verbose_name="Название проекта",
    )
    description = models.TextField(
        verbose_name="Описание проекта",
        blank=True,
    )

    files = models.FileField(
        upload_to="projects/files/",
        verbose_name="Файлы проекта",
        blank=True,
        null=True,
    )
    additional_info = models.TextField(
        verbose_name="Дополнительная информация",
        blank=True,
    )

    # Foreign Keys
    members = models.ManyToManyField(
        User,
        related_name="projects",
        verbose_name="Участники",
        blank=True,
    )
    leader = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="lead_projects",
        verbose_name="Руководитель проекта",
    )
    tutor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tutor_projects",
        verbose_name="Научный руководитель",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.PROTECT,
        related_name="projects",
        verbose_name="Секция",
    )
    status = models.ForeignKey(
        ProjectStatus,
        on_delete=models.PROTECT,
        related_name="projects",
        verbose_name="Статус проекта",
    )
    stage = models.ForeignKey(
        ParticipationStage,
        on_delete=models.PROTECT,
        related_name="projects",
        verbose_name="Этап участия",
    )
    presentation_type = models.ForeignKey(
        PresentationType,
        on_delete=models.PROTECT,
        related_name="projects",
        verbose_name="Тип представления",
    )

    class Meta:
        verbose_name = "Проект"
        verbose_name_plural = "Проекты"
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(
                fields=["title", "section", "leader"],
                name="unique_project_title_section_leader",
            )
        ]


class Comment(BaseModel):
    """Комментарий эксперта/организатора к проекту."""

    text = models.TextField(
        verbose_name="Текст комментария",
    )

    # Foreign Keys
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="comments",
        verbose_name="Проект",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="comments",
        verbose_name="Автор комментария",
    )

    class Meta:
        verbose_name = "Комментарий"
        verbose_name_plural = "Комментарии"
        ordering = ["created_at"]
