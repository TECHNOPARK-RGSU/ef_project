from rest_framework import serializers
from conf.models import (
    Conference,
    AgeCategory,
    Section,
    ProjectStatus,
    ParticipationStage,
    Place,
    PresentationType,
    Project,
    Comment,
)
from users.serializers import UserSerializer
from users.models import User


class PlaceSerializer(serializers.ModelSerializer):
    """Сериализатор для места."""

    class Meta:
        model = Place
        fields = [
            "id",
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
            "is_online",
            "organizers",
            "organizer_ids",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AgeCategorySerializer(serializers.ModelSerializer):
    """Сериализатор для возрастной категории."""

    class Meta:
        model = AgeCategory
        fields = [
            "id",
            "name",
            "min_age",
            "max_age",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


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

    class Meta:
        model = ProjectStatus
        fields = [
            "id",
            "name",
            "code",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ParticipationStageSerializer(serializers.ModelSerializer):
    """Сериализатор для этапа участия."""

    class Meta:
        model = ParticipationStage
        fields = [
            "id",
            "name",
            "code",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PresentationTypeSerializer(serializers.ModelSerializer):
    """Сериализатор для типа представления."""

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

