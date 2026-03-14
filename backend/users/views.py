from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from conf.models import Project
from users.models import EducationalOrganization, Role, StudentPeerLink, TutorStudentAccess, User
from utils.roles import is_student_role, normalize_role_code
from users.serializers import (
    EducationalOrganizationSerializer,
    RegistrationSerializer,
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
        "my_allowed_students": ["tutor"],
        "my_peer_students": ["student"],
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
                | Q(
                    role__code__iexact="student",
                    available_tutor_links__tutor=user,
                    available_tutor_links__is_archived=False,
                )
                | Q(
                    role__code__iexact="student2",
                    available_tutor_links__tutor=user,
                    available_tutor_links__is_archived=False,
                )
                | Q(
                    role__code__iexact="student3",
                    available_tutor_links__tutor=user,
                    available_tutor_links__is_archived=False,
                )
            ).distinct()
        if role_code == "expert":
            return queryset.filter(id=user.id)
        if is_student_role(role_code):
            return queryset.filter(
                Q(id=user.id)
                | Q(
                    role__code__iexact="tutor",
                    allowed_student_links__student=user,
                    allowed_student_links__is_archived=False,
                )
                | Q(
                    role__code__iexact="student",
                    peer_of_links__student=user,
                    peer_of_links__is_archived=False,
                )
                | Q(
                    role__code__iexact="student2",
                    peer_of_links__student=user,
                    peer_of_links__is_archived=False,
                )
                | Q(
                    role__code__iexact="student3",
                    peer_of_links__student=user,
                    peer_of_links__is_archived=False,
                )
            ).distinct()
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

    @action(detail=False, methods=["get", "put"], url_path="my-allowed-students")
    def my_allowed_students(self, request):
        user = request.user
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if not getattr(user, "is_superuser", False) and role_code != "tutor":
            raise PermissionDenied("Доступно только наставникам.")

        if request.method == "GET":
            return Response(self._serialize_allowed_students(user))

        resolved = self._resolve_students_from_payload(request.data)
        if "detail" in resolved:
            return Response(resolved, status=400)

        requested_ids = set(resolved["student_ids"])
        with transaction.atomic():
            self._sync_tutor_students(user, requested_ids)

        return Response(self._serialize_allowed_students(user))

    @action(detail=False, methods=["get", "put"], url_path="my-peer-students")
    def my_peer_students(self, request):
        user = request.user
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if not getattr(user, "is_superuser", False) and not is_student_role(role_code):
            raise PermissionDenied("Доступно только ученикам.")

        if request.method == "GET":
            return Response(self._serialize_peer_students(user))

        resolved = self._resolve_students_from_payload(request.data, exclude_user_id=user.id)
        if "detail" in resolved:
            return Response(resolved, status=400)

        requested_ids = set(resolved["student_ids"])
        with transaction.atomic():
            self._sync_student_peers(user, requested_ids)

        return Response(self._serialize_peer_students(user))

    def _serialize_allowed_students(self, tutor: User) -> dict:
        links = TutorStudentAccess.objects.filter(
            tutor=tutor,
            is_archived=False,
            student__is_archived=False,
        ).select_related("student__role", "student__educational_organization")
        students = [link.student for link in links]
        return {
            "student_ids": [student.id for student in students],
            "student_emails": [student.email for student in students if student.email],
            "students": UserSerializer(
                students,
                many=True,
                context=self.get_serializer_context(),
            ).data,
        }

    def _serialize_peer_students(self, student: User) -> dict:
        links = StudentPeerLink.objects.filter(
            student=student,
            is_archived=False,
            peer__is_archived=False,
        ).select_related("peer__role", "peer__educational_organization")
        peers = [link.peer for link in links]
        return {
            "student_ids": [peer.id for peer in peers],
            "student_emails": [peer.email for peer in peers if peer.email],
            "students": UserSerializer(
                peers,
                many=True,
                context=self.get_serializer_context(),
            ).data,
        }

    def _resolve_students_from_payload(self, data, exclude_user_id: int | None = None) -> dict:
        raw_emails = data.get("emails")
        if raw_emails is not None:
            if not isinstance(raw_emails, list):
                return {"detail": "emails must be a list."}
            normalized_emails = sorted({str(email).strip().lower() for email in raw_emails if str(email).strip()})
            students = list(
                User.objects.filter(
                    email__in=normalized_emails,
                    is_archived=False,
                ).filter(
                    Q(role__code__iexact="student")
                    | Q(role__code__iexact="student2")
                    | Q(role__code__iexact="student3")
                )
            )
            if exclude_user_id is not None:
                students = [student for student in students if student.id != exclude_user_id]
            found_emails = {student.email.lower() for student in students if student.email}
            missing = [email for email in normalized_emails if email not in found_emails]
            if missing:
                return {"detail": f"Не найдены ученики с email: {', '.join(missing)}."}
            return {"student_ids": [student.id for student in students]}

        raw_ids = data.get("student_ids", [])
        if not isinstance(raw_ids, list):
            return {"detail": "student_ids must be a list."}

        try:
            student_ids = sorted({int(student_id) for student_id in raw_ids})
        except (TypeError, ValueError):
            return {"detail": "student_ids must contain integer ids."}

        students = list(
            User.objects.filter(
                id__in=student_ids,
                is_archived=False,
            ).filter(
                Q(role__code__iexact="student")
                | Q(role__code__iexact="student2")
                | Q(role__code__iexact="student3")
            )
        )
        if exclude_user_id is not None:
            students = [student for student in students if student.id != exclude_user_id]
        if len(students) != len({student.id for student in students}) or len(students) != len(
            [student_id for student_id in student_ids if student_id != exclude_user_id]
        ):
            return {"detail": "В списке есть пользователи, которые не являются учениками."}
        return {"student_ids": [student.id for student in students]}

    def _sync_tutor_students(self, tutor: User, requested_ids: set[int]):
        current_active_ids = set(
            TutorStudentAccess.objects.filter(
                tutor=tutor,
                is_archived=False,
            ).values_list("student_id", flat=True)
        )
        to_archive = current_active_ids - requested_ids
        if to_archive:
            TutorStudentAccess.objects.filter(
                tutor=tutor,
                student_id__in=to_archive,
                is_archived=False,
            ).update(is_archived=True)
            Project.objects.filter(leader_id__in=to_archive, tutor=tutor).update(tutor=None)

        to_activate = requested_ids - current_active_ids
        if to_activate:
            TutorStudentAccess.objects.filter(
                student_id__in=to_activate,
                is_archived=False,
            ).exclude(tutor=tutor).update(is_archived=True)

        for student_id in requested_ids:
            link, created = TutorStudentAccess.objects.get_or_create(
                tutor=tutor,
                student_id=student_id,
                defaults={"is_archived": False},
            )
            if not created and link.is_archived:
                link.is_archived = False
                link.save(update_fields=["is_archived"])
            Project.objects.filter(leader_id=student_id, is_archived=False).update(tutor=tutor)

    def _sync_student_peers(self, student: User, requested_ids: set[int]):
        current_active_ids = set(
            StudentPeerLink.objects.filter(
                student=student,
                is_archived=False,
            ).values_list("peer_id", flat=True)
        )
        to_archive = current_active_ids - requested_ids
        if to_archive:
            StudentPeerLink.objects.filter(
                student=student,
                peer_id__in=to_archive,
                is_archived=False,
            ).update(is_archived=True)
            StudentPeerLink.objects.filter(
                student_id__in=to_archive,
                peer=student,
                is_archived=False,
            ).update(is_archived=True)

        for peer_id in requested_ids:
            for left_id, right_id in ((student.id, peer_id), (peer_id, student.id)):
                link, created = StudentPeerLink.objects.get_or_create(
                    student_id=left_id,
                    peer_id=right_id,
                    defaults={"is_archived": False},
                )
                if not created and link.is_archived:
                    link.is_archived = False
                    link.save(update_fields=["is_archived"])
