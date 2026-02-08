from rest_framework import serializers
from conf.models import (
    Conference,
    AgeCategory,
    Section,
    ProjectStatus,
    ParticipationStage,
    ConferenceStatusFlowItem,
    ConferenceStageAvailability,
    ConferenceExpert,
    Place,
    PresentationType,
    Project,
    Comment,
    EvaluationCriterion,
    ProjectScore,
    ProjectResult,
    ExpertAssignment,
    ExpertAssignmentItem,
)
from users.serializers import UserSerializer
from users.models import User


class PlaceSerializer(serializers.ModelSerializer):
    """Сериализатор для места."""

    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Place
        fields = [
            "id",
            "conference_id",
            "name",
            "address",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConferenceSerializer(serializers.ModelSerializer):
    """Сериализатор для конференции."""

    organizers = UserSerializer(many=True, read_only=True)
    organizer_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="organizers",
        write_only=True,
        many=True,
        required=False,
    )

    class Meta:
        model = Conference
        fields = [
            "id",
            "title",
            "description",
            "start_date",
            "end_date",
            "location",
            "format",
            "is_online",
            "winners_count",
            "prizes_count",
            "results_published",
            "organizers",
            "organizer_ids",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        end_date = attrs.get(
            "end_date",
            getattr(self.instance, "end_date", None),
        )
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "Дата окончания не может быть раньше даты начала."}
            )
        return attrs


class AgeCategorySerializer(serializers.ModelSerializer):
    """Сериализатор для возрастной категории."""

    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = AgeCategory
        fields = [
            "id",
            "conference_id",
            "name",
            "min_age",
            "max_age",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        min_age = attrs.get(
            "min_age",
            getattr(self.instance, "min_age", None),
        )
        max_age = attrs.get(
            "max_age",
            getattr(self.instance, "max_age", None),
        )
        if min_age is not None and max_age is not None and min_age > max_age:
            raise serializers.ValidationError(
                {"max_age": "Максимальный возраст не может быть меньше минимального."}
            )
        return attrs


class SectionSerializer(serializers.ModelSerializer):
    """Сериализатор для секции."""

    conference = ConferenceSerializer(read_only=True)
    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
    )
    category = AgeCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=AgeCategory.objects.all(),
        source="category",
        write_only=True,
    )

    class Meta:
        model = Section
        fields = [
            "id",
            "name",
            "conference",
            "conference_id",
            "category",
            "category_id",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectStatusSerializer(serializers.ModelSerializer):
    """Сериализатор для статуса проекта."""

    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ProjectStatus
        fields = [
            "id",
            "conference_id",
            "name",
            "code",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ParticipationStageSerializer(serializers.ModelSerializer):
    """Сериализатор для этапа участия."""

    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ParticipationStage
        fields = [
            "id",
            "conference_id",
            "name",
            "code",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConferenceStatusFlowItemSerializer(serializers.ModelSerializer):
    """Сериализатор для воронки статусов конференции."""

    conference = ConferenceSerializer(read_only=True)
    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
    )
    status = ProjectStatusSerializer(read_only=True)
    status_id = serializers.PrimaryKeyRelatedField(
        queryset=ProjectStatus.objects.all(),
        source="status",
        write_only=True,
    )

    class Meta:
        model = ConferenceStatusFlowItem
        fields = [
            "id",
            "conference",
            "conference_id",
            "status",
            "status_id",
            "order",
            "is_enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConferenceStageAvailabilitySerializer(serializers.ModelSerializer):
    """Сериализатор для доступных этапов конференции."""

    conference = ConferenceSerializer(read_only=True)
    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
    )
    stage = ParticipationStageSerializer(read_only=True)
    stage_id = serializers.PrimaryKeyRelatedField(
        queryset=ParticipationStage.objects.all(),
        source="stage",
        write_only=True,
    )

    class Meta:
        model = ConferenceStageAvailability
        fields = [
            "id",
            "conference",
            "conference_id",
            "stage",
            "stage_id",
            "is_enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PresentationTypeSerializer(serializers.ModelSerializer):
    """Сериализатор для типа представления."""

    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
        required=False,
        allow_null=True,
    )
    place = PlaceSerializer(read_only=True)
    place_id = serializers.PrimaryKeyRelatedField(
        queryset=Place.objects.all(),
        source="place",
        write_only=True,
    )

    class Meta:
        model = PresentationType
        fields = [
            "id",
            "conference_id",
            "name",
            "code",
            "place",
            "place_id",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectSerializer(serializers.ModelSerializer):
    """Сериализатор для проекта."""

    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="members",
        write_only=True,
        many=True,
        required=False,
    )
    leader = UserSerializer(read_only=True)
    leader_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="leader",
        write_only=True,
    )
    tutor = UserSerializer(read_only=True, allow_null=True)
    tutor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="tutor",
        write_only=True,
        required=False,
        allow_null=True,
    )
    section = SectionSerializer(read_only=True)
    section_id = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        source="section",
        write_only=True,
    )
    status = ProjectStatusSerializer(read_only=True)
    status_id = serializers.PrimaryKeyRelatedField(
        queryset=ProjectStatus.objects.all(),
        source="status",
        write_only=True,
    )
    stage = ParticipationStageSerializer(read_only=True)
    stage_id = serializers.PrimaryKeyRelatedField(
        queryset=ParticipationStage.objects.all(),
        source="stage",
        write_only=True,
    )
    presentation_type = PresentationTypeSerializer(read_only=True)
    presentation_type_id = serializers.PrimaryKeyRelatedField(
        queryset=PresentationType.objects.all(),
        source="presentation_type",
        write_only=True,
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "description",
            "files",
            "additional_info",
            "members",
            "member_ids",
            "leader",
            "leader_id",
            "tutor",
            "tutor_id",
            "section",
            "section_id",
            "status",
            "status_id",
            "stage",
            "stage_id",
            "presentation_type",
            "presentation_type_id",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CommentSerializer(serializers.ModelSerializer):
    """Сериализатор для комментария."""

    project = ProjectSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="project",
        write_only=True,
    )
    author = UserSerializer(read_only=True, allow_null=True)
    author_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="author",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Comment
        fields = [
            "id",
            "text",
            "project",
            "project_id",
            "author",
            "author_id",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EvaluationCriterionSerializer(serializers.ModelSerializer):
    """Сериализатор для критерия оценки."""

    conference = ConferenceSerializer(read_only=True)
    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
    )

    class Meta:
        model = EvaluationCriterion
        fields = [
            "id",
            "conference",
            "conference_id",
            "name",
            "description",
            "max_score",
            "stage",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProjectScoreSerializer(serializers.ModelSerializer):
    """Сериализатор для оценок проектов."""

    project = ProjectSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="project",
        write_only=True,
    )
    criterion = EvaluationCriterionSerializer(read_only=True)
    criterion_id = serializers.PrimaryKeyRelatedField(
        queryset=EvaluationCriterion.objects.all(),
        source="criterion",
        write_only=True,
    )
    evaluator = UserSerializer(read_only=True, allow_null=True)
    evaluator_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="evaluator",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ProjectScore
        fields = [
            "id",
            "project",
            "project_id",
            "criterion",
            "criterion_id",
            "evaluator",
            "evaluator_id",
            "score",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        criterion = attrs.get("criterion", getattr(self.instance, "criterion", None))
        project = attrs.get("project", getattr(self.instance, "project", None))
        score = attrs.get("score")
        errors = {}
        if score is not None:
            if score < 0:
                errors["score"] = "Баллы не могут быть отрицательными."
            if criterion and score > criterion.max_score:
                errors["score"] = "Баллы не могут превышать максимум по критерию."

        if project and criterion:
            project_conference = (
                project.section.conference_id if project.section_id else None
            )
            if project_conference is None or project_conference != criterion.conference_id:
                errors["criterion_id"] = "Критерий не относится к конференции проекта."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class ProjectResultSerializer(serializers.ModelSerializer):
    """Сериализатор для результатов проектов."""

    conference = ConferenceSerializer(read_only=True)
    section = SectionSerializer(read_only=True)
    project = ProjectSerializer(read_only=True)

    class Meta:
        model = ProjectResult
        fields = [
            "id",
            "conference",
            "section",
            "project",
            "online_score",
            "offline_score",
            "total_score",
            "rank",
            "is_winner",
            "is_prize",
            "published_at",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ConferenceExpertSerializer(serializers.ModelSerializer):
    """Сериализатор для экспертов конференции."""

    conference = ConferenceSerializer(read_only=True)
    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
    )
    expert = UserSerializer(read_only=True)
    expert_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="expert",
        write_only=True,
    )
    sections = SectionSerializer(read_only=True, many=True)
    section_ids = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        source="sections",
        write_only=True,
        many=True,
        required=False,
    )

    class Meta:
        model = ConferenceExpert
        fields = [
            "id",
            "conference",
            "conference_id",
            "expert",
            "expert_id",
            "sections",
            "section_ids",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_expert(self, value):
        role_code = (getattr(value.role, "code", "") or "").lower()
        if role_code != "expert":
            raise serializers.ValidationError("Пользователь не является экспертом.")
        return value


class ExpertAssignmentItemSerializer(serializers.ModelSerializer):
    """Сериализатор для проекта в назначении эксперта."""

    project = ProjectSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="project",
        write_only=True,
    )
    place = serializers.SerializerMethodField()

    class Meta:
        model = ExpertAssignmentItem
        fields = [
            "id",
            "assignment",
            "project",
            "project_id",
            "place",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_place(self, obj):
        assignment = getattr(obj, "assignment", None)
        if assignment and assignment.stage != "offline":
            return None
        presentation = getattr(obj.project, "presentation_type", None)
        place = getattr(presentation, "place", None) if presentation else None
        if not place:
            return None
        return {"id": place.id, "name": place.name, "address": place.address}


class ExpertAssignmentSerializer(serializers.ModelSerializer):
    """Сериализатор для назначения эксперту."""

    conference = ConferenceSerializer(read_only=True)
    conference_id = serializers.PrimaryKeyRelatedField(
        queryset=Conference.objects.all(),
        source="conference",
        write_only=True,
    )
    expert = UserSerializer(read_only=True)
    expert_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="expert",
        write_only=True,
    )
    items = ExpertAssignmentItemSerializer(many=True, read_only=True)

    class Meta:
        model = ExpertAssignment
        fields = [
            "id",
            "conference",
            "conference_id",
            "expert",
            "expert_id",
            "stage",
            "max_projects",
            "items",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
