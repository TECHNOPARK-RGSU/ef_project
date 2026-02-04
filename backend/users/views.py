from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users.models import EducationalOrganization, Role, User
from users.serializers import (
    EducationalOrganizationSerializer,
    RoleSerializer,
    UserSerializer,
)
from utils.permissions import RoleBasedPermission


class EducationalOrganizationViewSet(viewsets.ModelViewSet):
    """ViewSet для образовательных организаций."""

    queryset = EducationalOrganization.objects.filter(is_archived=False)
    serializer_class = EducationalOrganizationSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["city"]
    search_fields = ["name", "short_name", "city"]
    ordering_fields = ["name", "city", "created_at"]
    ordering = ["name"]


class RoleViewSet(viewsets.ModelViewSet):
    """ViewSet для ролей."""

    queryset = Role.objects.filter(is_archived=False)
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["code"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet для пользователей."""    
    queryset = User.objects.filter(is_archived=False)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["role", "educational_organization", "city"]
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

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
