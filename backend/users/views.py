from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from users.models import EducationalOrganization, Role, User
from users.serializers import (
    EducationalOrganizationSerializer,
    RoleSerializer,
    UserSerializer,
)


class EducationalOrganizationViewSet(viewsets.ModelViewSet):
    """ViewSet для образовательных организаций."""

    queryset = EducationalOrganization.objects.filter(is_archived=False)
    serializer_class = EducationalOrganizationSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "short_name", "city"]
    ordering_fields = ["name", "city", "created_at"]
    ordering = ["name"]


class RoleViewSet(viewsets.ModelViewSet):
    """ViewSet для ролей."""

    queryset = Role.objects.filter(is_archived=False)
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet для пользователей."""

    queryset = User.objects.filter(is_archived=False)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "last_name",
        "first_name",
        "middle_name",
        "email",
        "phone",
        "city",
    ]
    ordering_fields = ["last_name", "first_name", "email", "created_at"]
    ordering = ["last_name", "first_name"]
