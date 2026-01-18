from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticatedOrReadOnly
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
from conf.serializers import (
    ConferenceSerializer,
    AgeCategorySerializer,
    SectionSerializer,
    ProjectStatusSerializer,
    ParticipationStageSerializer,
    PlaceSerializer,
    PresentationTypeSerializer,
    ProjectSerializer,
    CommentSerializer,
)


class PlaceViewSet(viewsets.ModelViewSet):
    """ViewSet для мест."""

    queryset = Place.objects.filter(is_archived=False)
    serializer_class = PlaceSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "address"]
    ordering_fields = ["name", "created_at"]
    ordering = ["created_at"]


class ConferenceViewSet(viewsets.ModelViewSet):
    """ViewSet для конференций."""

    queryset = Conference.objects.filter(is_archived=False)
    serializer_class = ConferenceSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "location"]
    ordering_fields = ["title", "start_date", "end_date", "created_at"]
    ordering = ["-start_date"]


class AgeCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet для возрастных категорий."""

    queryset = AgeCategory.objects.filter(is_archived=False)
    serializer_class = AgeCategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "min_age", "max_age", "created_at"]
    ordering = ["min_age", "max_age"]


class SectionViewSet(viewsets.ModelViewSet):
    """ViewSet для секций."""

    queryset = Section.objects.filter(is_archived=False)
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class ProjectStatusViewSet(viewsets.ModelViewSet):
    """ViewSet для статусов проекта."""

    queryset = ProjectStatus.objects.filter(is_archived=False)
    serializer_class = ProjectStatusSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class ParticipationStageViewSet(viewsets.ModelViewSet):
    """ViewSet для этапов участия."""

    queryset = ParticipationStage.objects.filter(is_archived=False)
    serializer_class = ParticipationStageSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class PresentationTypeViewSet(viewsets.ModelViewSet):
    """ViewSet для типов представления."""

    queryset = PresentationType.objects.filter(is_archived=False)
    serializer_class = PresentationTypeSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet для проектов."""

    queryset = Project.objects.filter(is_archived=False)
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "additional_info"]
    ordering_fields = ["title", "created_at"]
    ordering = ["title"]


class CommentViewSet(viewsets.ModelViewSet):
    """ViewSet для комментариев."""

    queryset = Comment.objects.filter(is_archived=False)
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["text"]
    ordering_fields = ["created_at"]
    ordering = ["created_at"]
