from django.core.exceptions import ValidationError
from django.db import models
from utils.models import BaseModel
from users.models import User


class Conference(BaseModel):
    """Конференция (мероприятие)."""

    FORMAT_CHOICES = (
        ("online", "Онлайн"),
        ("offline", "Очно"),
        ("hybrid", "Смешанный"),
    )

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
    format = models.CharField(
        max_length=20,
        choices=FORMAT_CHOICES,
        default="offline",
        verbose_name="Формат",
    )
    is_online = models.BooleanField(
        default=False,
        verbose_name="Онлайн-формат (устаревшее)",
    )
    organizers = models.ManyToManyField(
        User,
        blank=True,
        related_name="organized_conferences",
        verbose_name="Организаторы",
    )
    winners_count = models.PositiveIntegerField(
        default=1,
        verbose_name="Количество победителей в секции",
    )
    prizes_count = models.PositiveIntegerField(
        default=2,
        verbose_name="Количество призёров в секции",
    )
    results_published = models.BooleanField(
        default=False,
        verbose_name="Результаты опубликованы",
    )

    class Meta:
        verbose_name = "Конференция"
        verbose_name_plural = "Конференции"
        ordering = ["-start_date"]

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError(
                {"end_date": "Дата окончания не может быть раньше даты начала."}
            )


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

    def clean(self):
        if self.min_age is not None and self.max_age is not None:
            if self.min_age > self.max_age:
                raise ValidationError(
                    {"max_age": "Максимальный возраст не может быть меньше минимального."}
                )


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


class ConferenceStatusFlowItem(BaseModel):
    """Настройка воронки статусов для конференции."""

    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name="status_flow_items",
        verbose_name="Конференция",
    )
    status = models.ForeignKey(
        ProjectStatus,
        on_delete=models.CASCADE,
        related_name="conference_status_items",
        verbose_name="Статус",
    )
    order = models.PositiveIntegerField(
        default=0,
        verbose_name="Порядок",
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Активен",
    )

    class Meta:
        verbose_name = "Воронка статусов конференции"
        verbose_name_plural = "Воронки статусов конференций"
        ordering = ["order", "id"]
        unique_together = ("conference", "status")


class ConferenceStageAvailability(BaseModel):
    """Доступные этапы участия для конференции."""

    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name="stage_items",
        verbose_name="Конференция",
    )
    stage = models.ForeignKey(
        ParticipationStage,
        on_delete=models.CASCADE,
        related_name="conference_stage_items",
        verbose_name="Этап",
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Активен",
    )

    class Meta:
        verbose_name = "Этап участия конференции"
        verbose_name_plural = "Этапы участия конференций"
        ordering = ["stage__name", "id"]
        unique_together = ("conference", "stage")


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


class EvaluationCriterion(BaseModel):
    """Критерий оценки проекта для конференции."""

    STAGE_CHOICES = (
        ("online", "Заочный этап"),
        ("offline", "Очный этап"),
    )

    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name="criteria",
        verbose_name="Конференция",
    )
    name = models.CharField(
        max_length=255,
        verbose_name="Название критерия",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Описание",
    )
    max_score = models.PositiveIntegerField(
        default=10,
        verbose_name="Максимальный балл",
    )
    stage = models.CharField(
        max_length=20,
        choices=STAGE_CHOICES,
        verbose_name="Этап оценки",
    )

    class Meta:
        verbose_name = "Критерий оценки"
        verbose_name_plural = "Критерии оценки"
        constraints = [
            models.UniqueConstraint(
                fields=["conference", "name", "stage"],
                name="unique_criterion_per_conference",
            )
        ]


class ProjectScore(BaseModel):
    """Оценка проекта по критерию."""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="scores",
        verbose_name="Проект",
    )
    criterion = models.ForeignKey(
        EvaluationCriterion,
        on_delete=models.CASCADE,
        related_name="scores",
        verbose_name="Критерий",
    )
    evaluator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="evaluations",
        verbose_name="Оценщик",
    )
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name="Баллы",
    )

    class Meta:
        verbose_name = "Оценка проекта"
        verbose_name_plural = "Оценки проектов"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "criterion", "evaluator"],
                name="unique_project_criterion_evaluator",
            )
        ]

    def clean(self):
        errors = {}
        if self.score is not None:
            if self.score < 0:
                errors["score"] = "Баллы не могут быть отрицательными."
            if self.criterion_id is not None and self.score > self.criterion.max_score:
                errors["score"] = "Баллы не могут превышать максимум по критерию."

        if self.project_id and self.criterion_id:
            project_conference = (
                self.project.section.conference_id if self.project.section_id else None
            )
            if project_conference is None or project_conference != self.criterion.conference_id:
                errors["criterion"] = "Критерий не относится к конференции проекта."

        if errors:
            raise ValidationError(errors)


class ProjectResult(BaseModel):
    """Итоговый результат проекта по конференции."""

    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name="results",
        verbose_name="Конференция",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="results",
        verbose_name="Секция",
    )
    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name="result",
        verbose_name="Проект",
    )
    online_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        verbose_name="Баллы заочного этапа",
    )
    offline_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        verbose_name="Баллы очного этапа",
    )
    total_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        verbose_name="Итоговый балл",
    )
    rank = models.PositiveIntegerField(
        default=0,
        verbose_name="Место",
    )
    is_winner = models.BooleanField(
        default=False,
        verbose_name="Победитель",
    )
    is_prize = models.BooleanField(
        default=False,
        verbose_name="Призёр",
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Дата публикации",
    )

    class Meta:
        verbose_name = "Результат проекта"
        verbose_name_plural = "Результаты проектов"


class ConferenceExpert(BaseModel):
    """Эксперт, приглашенный в конференцию, с ограничением по секциям."""

    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name="conference_experts",
        verbose_name="Конференция",
    )
    expert = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conference_expert_roles",
        verbose_name="Эксперт",
    )
    sections = models.ManyToManyField(
        Section,
        blank=True,
        related_name="conference_experts",
        verbose_name="Секции эксперта",
    )

    class Meta:
        verbose_name = "Эксперт конференции"
        verbose_name_plural = "Эксперты конференций"
        unique_together = ("conference", "expert")


class ExpertAssignment(BaseModel):
    """Назначение проектов эксперту для проверки."""

    STAGE_CHOICES = (
        ("online", "Заочный этап"),
        ("offline", "Очный этап"),
    )

    conference = models.ForeignKey(
        Conference,
        on_delete=models.CASCADE,
        related_name="expert_assignments",
        verbose_name="Конференция",
    )
    expert = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="expert_assignments",
        verbose_name="Эксперт",
    )
    stage = models.CharField(
        max_length=10,
        choices=STAGE_CHOICES,
        default="online",
        verbose_name="Этап проверки",
    )
    max_projects = models.PositiveIntegerField(
        default=0,
        verbose_name="Лимит проектов",
    )

    class Meta:
        verbose_name = "Назначение эксперту"
        verbose_name_plural = "Назначения экспертам"
        constraints = [
            models.UniqueConstraint(
                fields=["conference", "expert", "stage"],
                name="unique_conference_expert_stage",
            )
        ]


class ExpertAssignmentItem(BaseModel):
    """Конкретный проект в назначении эксперта."""

    assignment = models.ForeignKey(
        ExpertAssignment,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Назначение",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="expert_assignments",
        verbose_name="Проект",
    )

    class Meta:
        verbose_name = "Проект эксперта"
        verbose_name_plural = "Проекты экспертов"
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "project"],
                name="unique_assignment_project",
            )
        ]
