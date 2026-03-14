from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from users.models import EducationalOrganization, Role, StudentTeam, User
from utils.roles import is_student_role, normalize_role_code
from users.serializers import (
    EducationalOrganizationSerializer,
    RegistrationSerializer,
    RoleSerializer,
    StudentTeamSerializer,
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

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.exclude(code__iexact="student2").exclude(code__iexact="student3")


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

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "organizer":
            return queryset
        if role_code == "tutor":
            return queryset.filter(
                Q(id=user.id)
                | Q(role__code__iexact="student")
                | Q(role__code__iexact="student2")
                | Q(role__code__iexact="student3")
            )
        if role_code == "expert" or is_student_role(role_code):
            return queryset.filter(id=user.id)
        return queryset.none()

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def register(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=201)


class StudentTeamViewSet(viewsets.ModelViewSet):
    """ViewSet для команд учеников наставника."""

    queryset = StudentTeam.objects.filter(is_archived=False).prefetch_related(
        "members__role",
        "members__educational_organization",
    ).select_related("tutor__role", "tutor__educational_organization")
    serializer_class = StudentTeamSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["tutor", "organizer"],
        "update": ["tutor", "organizer"],
        "partial_update": ["tutor", "organizer"],
        "destroy": ["tutor", "organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["tutor", "members"]
    search_fields = ["name", "members__email", "members__last_name", "members__first_name"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset

        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "organizer":
            return queryset
        if role_code == "tutor":
            return queryset.filter(tutor=user)
        if is_student_role(role_code):
            return queryset.filter(members=user)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "tutor":
            serializer.save(tutor=user)
            return
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        current_team = self.get_object()
        if role_code == "tutor" and current_team.tutor_id != user.id:
            raise PermissionDenied("Наставник может управлять только своими командами.")
        if role_code == "tutor":
            serializer.save(tutor=user)
            return
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        team = self.get_object()
        user = request.user
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "tutor" and team.tutor_id != user.id:
            raise PermissionDenied("Наставник может управлять только своими командами.")
        team.is_archived = True
        team.save(update_fields=["is_archived"])
        return Response({"status": "archived"})
