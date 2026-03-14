import os
import tempfile
import zipfile

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse, HttpResponse
from django.shortcuts import render
from openpyxl import Workbook
from utils.roles import is_student_role, normalize_role_code
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
from conf.serializers import (
    ConferenceSerializer,
    AgeCategorySerializer,
    SectionSerializer,
    ProjectStatusSerializer,
    ParticipationStageSerializer,
    ConferenceStatusFlowItemSerializer,
    ConferenceStageAvailabilitySerializer,
    ConferenceExpertSerializer,
    PlaceSerializer,
    PresentationTypeSerializer,
    ProjectSerializer,
    CommentSerializer,
    EvaluationCriterionSerializer,
    ProjectScoreSerializer,
    ProjectResultSerializer,
    ExpertAssignmentSerializer,
    ExpertAssignmentItemSerializer,
)
from users.models import User
from conf.services.results import calculate_results_for_conference
from utils.permissions import RoleBasedPermission
from users.models import User


class PlaceViewSet(viewsets.ModelViewSet):
    """ViewSet для мест (привязаны к конференции)."""

    queryset = Place.objects.filter(is_archived=False)
    serializer_class = PlaceSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["name", "address"]
    search_fields = ["name", "address"]
    ordering_fields = ["name", "created_at"]
    ordering = ["created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        cid = self.request.query_params.get("conference")
        if cid:
            qs = qs.filter(Q(conference_id=cid) | Q(conference__isnull=True))
        return qs


class ConferenceViewSet(viewsets.ModelViewSet):
    """ViewSet для конференций."""

    queryset = Conference.objects.filter(is_archived=False)
    serializer_class = ConferenceSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
        "calculate_results": ["organizer"],
        "assign_projects": ["organizer"],
        "publish_results": ["organizer"],
        "export_results": ["organizer"],
        "export_results_excel": ["organizer"],
        "print_protocol": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["start_date", "end_date", "format"]
    search_fields = ["title", "description", "location"]
    ordering_fields = ["title", "start_date", "end_date", "created_at"]
    ordering = ["-start_date"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code in ("organizer", "expert", "tutor", "student"):
            return queryset
        return queryset.none()

    @action(detail=True, methods=["post"])
    def calculate_results(self, request, pk=None):
        conference = self.get_object()
        projects_count = calculate_results_for_conference(conference)
        return Response({"status": "ok", "projects": projects_count})

    @action(detail=True, methods=["post"])
    def assign_projects(self, request, pk=None):
        conference = self.get_object()
        stage = request.data.get("stage", "online")
        if stage not in ("online", "offline"):
            return Response({"detail": "stage must be online or offline"}, status=400)
        per_expert = int(request.data.get("per_expert", 0) or 0)
        if per_expert <= 0:
            return Response({"detail": "per_expert must be > 0"}, status=400)

        conference_experts = ConferenceExpert.objects.filter(
            conference=conference, expert__is_archived=False
        ).select_related("expert")
        if not conference_experts.exists():
            return Response({"detail": "No experts found for conference."}, status=400)

        projects = Project.objects.filter(section__conference=conference, is_archived=False).order_by("id")
        assigned_ids = set(
            ExpertAssignmentItem.objects.filter(
                assignment__conference=conference,
                assignment__stage=stage,
            ).values_list("project_id", flat=True)
        )
        available_projects = [project for project in projects if project.id not in assigned_ids]

        created_items = 0
        with transaction.atomic():
            expert_slots = []
            for conf_expert in conference_experts:
                assignment, _ = ExpertAssignment.objects.get_or_create(
                    conference=conference,
                    expert=conf_expert.expert,
                    stage=stage,
                    defaults={"max_projects": per_expert},
                )
                if assignment.max_projects != per_expert:
                    assignment.max_projects = per_expert
                    assignment.save(update_fields=["max_projects"])
                section_ids = list(conf_expert.sections.values_list("id", flat=True))
                expert_slots.append(
                    {
                        "assignment": assignment,
                        "sections": set(section_ids) if section_ids else None,
                        "count": 0,
                    }
                )

            items = []
            for project in available_projects:
                eligible = [
                    slot
                    for slot in expert_slots
                    if slot["count"] < per_expert
                    and (slot["sections"] is None or project.section_id in slot["sections"])
                ]
                if not eligible:
                    continue
                chosen = min(
                    eligible,
                    key=lambda slot: (slot["count"], slot["assignment"].id),
                )
                items.append(
                    ExpertAssignmentItem(
                        assignment=chosen["assignment"],
                        project=project,
                    )
                )
                chosen["count"] += 1

            ExpertAssignmentItem.objects.bulk_create(items, ignore_conflicts=True)
            created_items += len(items)

        return Response(
            {
                "status": "ok",
                "assigned": created_items,
                "experts": conference_experts.count(),
                "remaining": max(len(available_projects) - created_items, 0),
            }
        )

    @action(detail=True, methods=["post"])
    def publish_results(self, request, pk=None):
        conference = self.get_object()
        ProjectResult.objects.filter(conference=conference).update(
            published_at=timezone.now()
        )
        conference.results_published = True
        conference.save(update_fields=["results_published"])
        return Response({"status": "ok"})

    @action(detail=True, methods=["get"])
    def export_results(self, request, pk=None):
        conference = self.get_object()
        results = ProjectResult.objects.filter(conference=conference).select_related(
            "project", "section"
        )
        response = HttpResponse(content_type="text/csv")
        filename = f"conference_{conference.id}_results.csv"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.write("section,project,online_score,offline_score,total_score,rank,result\n")
        for result in results:
            result_label = "Победитель" if result.is_winner else "Призёр" if result.is_prize else "Участник"
            response.write(
                f"{result.section.name},"
                f"{result.project.title},"
                f"{result.online_score},"
                f"{result.offline_score},"
                f"{result.total_score},"
                f"{result.rank},"
                f'"{result_label}"\n'
            )
        return response

    @action(detail=True, methods=["get"])
    def export_results_excel(self, request, pk=None):
        conference = self.get_object()
        results = ProjectResult.objects.filter(conference=conference).select_related(
            "project", "section"
        )
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Results"
        sheet.append(
            [
                "section",
                "project",
                "online_score",
                "offline_score",
                "total_score",
                "rank",
                "result",
            ]
        )
        for result in results:
            result_label = "Победитель" if result.is_winner else "Призёр" if result.is_prize else "Участник"
            sheet.append(
                [
                    result.section.name,
                    result.project.title,
                    float(result.online_score),
                    float(result.offline_score),
                    float(result.total_score),
                    result.rank,
                    result_label,
                ]
            )

        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        filename = f"conference_{conference.id}_results.xlsx"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        workbook.save(response)
        return response

    @action(detail=True, methods=["get"])
    def print_protocol(self, request, pk=None):
        conference = self.get_object()
        results = (
            ProjectResult.objects.filter(conference=conference)
            .select_related("project", "section")
            .order_by("section__name", "rank")
        )
        return render(
            request,
            "conf/print_protocol.html",
            {
                "conference": conference,
                "results": results,
                "generated_at": timezone.now(),
            },
        )


class AgeCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet для возрастных категорий (привязаны к конференции)."""

    queryset = AgeCategory.objects.filter(is_archived=False)
    serializer_class = AgeCategorySerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["min_age", "max_age"]
    search_fields = ["name"]
    ordering_fields = ["name", "min_age", "max_age", "created_at"]
    ordering = ["min_age", "max_age"]

    def get_queryset(self):
        qs = super().get_queryset()
        cid = self.request.query_params.get("conference")
        if cid:
            qs = qs.filter(Q(conference_id=cid) | Q(conference__isnull=True))
        return qs


class SectionViewSet(viewsets.ModelViewSet):
    """ViewSet для секций."""

    queryset = Section.objects.filter(is_archived=False)
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["conference", "category"]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]


class ProjectStatusViewSet(viewsets.ModelViewSet):
    """ViewSet для статусов проекта (привязаны к конференции)."""

    queryset = ProjectStatus.objects.filter(is_archived=False)
    serializer_class = ProjectStatusSerializer
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
        qs = super().get_queryset()
        cid = self.request.query_params.get("conference")
        if cid:
            qs = qs.filter(Q(conference_id=cid) | Q(conference__isnull=True))
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.conference_id:
            order = ConferenceStatusFlowItem.objects.filter(conference_id=instance.conference_id).count()
            ConferenceStatusFlowItem.objects.get_or_create(
                conference_id=instance.conference_id,
                status=instance,
                defaults={"order": order, "is_enabled": True},
            )


class ParticipationStageViewSet(viewsets.ModelViewSet):
    """ViewSet для этапов участия (привязаны к конференции)."""

    queryset = ParticipationStage.objects.filter(is_archived=False)
    serializer_class = ParticipationStageSerializer
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
        qs = super().get_queryset()
        cid = self.request.query_params.get("conference")
        if cid:
            qs = qs.filter(Q(conference_id=cid) | Q(conference__isnull=True))
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.conference_id:
            ConferenceStageAvailability.objects.get_or_create(
                conference_id=instance.conference_id,
                stage=instance,
                defaults={"is_enabled": True},
            )


class ConferenceStatusFlowItemViewSet(viewsets.ModelViewSet):
    """ViewSet для воронки статусов конференции."""

    queryset = ConferenceStatusFlowItem.objects.all()
    serializer_class = ConferenceStatusFlowItemSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
        "list": ["organizer", "expert", "tutor", "student"],
        "retrieve": ["organizer", "expert", "tutor", "student"],
    }
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["conference", "status", "is_enabled"]
    ordering_fields = ["order", "created_at"]
    ordering = ["order"]

    def get_queryset(self):
        queryset = super().get_queryset()
        conference_id = self.request.query_params.get("conference")
        if conference_id:
            conference = Conference.objects.filter(id=conference_id).first()
            if conference and not queryset.filter(conference=conference).exists():
                statuses = ProjectStatus.objects.filter(
                    is_archived=False
                ).filter(Q(conference_id=conference_id) | Q(conference__isnull=True)).order_by("name")
                ConferenceStatusFlowItem.objects.bulk_create(
                    [
                        ConferenceStatusFlowItem(conference=conference, status=status, order=index)
                        for index, status in enumerate(statuses)
                    ]
                )
            queryset = queryset.filter(conference_id=conference_id)
        return queryset


class ConferenceStageAvailabilityViewSet(viewsets.ModelViewSet):
    """ViewSet для доступных этапов конференции."""

    queryset = ConferenceStageAvailability.objects.all()
    serializer_class = ConferenceStageAvailabilitySerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
        "list": ["organizer", "expert", "tutor", "student"],
        "retrieve": ["organizer", "expert", "tutor", "student"],
    }
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["conference", "stage", "is_enabled"]
    ordering_fields = ["created_at"]
    ordering = ["created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        conference_id = self.request.query_params.get("conference")
        if conference_id:
            conference = Conference.objects.filter(id=conference_id).first()
            if conference and not queryset.filter(conference=conference).exists():
                stages = ParticipationStage.objects.filter(
                    is_archived=False
                ).filter(Q(conference_id=conference_id) | Q(conference__isnull=True)).order_by("name")
                ConferenceStageAvailability.objects.bulk_create(
                    [
                        ConferenceStageAvailability(conference=conference, stage=stage, is_enabled=True)
                        for stage in stages
                    ]
                )
            queryset = queryset.filter(conference_id=conference_id)
        return queryset


class ConferenceExpertViewSet(viewsets.ModelViewSet):
    """ViewSet для экспертов конференции."""

    queryset = ConferenceExpert.objects.all()
    serializer_class = ConferenceExpertSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
        "list": ["organizer"],
        "retrieve": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["conference", "expert"]
    search_fields = ["expert__last_name", "expert__first_name", "expert__email"]

    def get_queryset(self):
        queryset = super().get_queryset()
        conference_id = self.request.query_params.get("conference")
        if conference_id:
            queryset = queryset.filter(conference_id=conference_id)
        return queryset


class PresentationTypeViewSet(viewsets.ModelViewSet):
    """ViewSet для типов представления (привязаны к конференции)."""

    queryset = PresentationType.objects.filter(is_archived=False)
    serializer_class = PresentationTypeSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["place", "code"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()
        cid = self.request.query_params.get("conference")
        if cid:
            qs = qs.filter(Q(conference_id=cid) | Q(conference__isnull=True))
        return qs


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet для проектов."""

    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer", "tutor", "student"],
        "update": ["organizer", "tutor", "student"],
        "partial_update": ["organizer", "tutor", "student"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "section",
        "section__conference",
        "status",
        "stage",
        "presentation_type",
        "leader",
        "tutor",
        "team",
    ]
    search_fields = ["title", "description", "additional_info"]
    ordering_fields = ["title", "created_at"]
    ordering = ["title"]

    def get_queryset(self):
        queryset = super().get_queryset()
        include_archived = self.request.query_params.get("include_archived") == "1"
        if not include_archived:
            queryset = queryset.filter(is_archived=False)
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "organizer":
            return queryset
        if role_code == "expert":
            return queryset.filter(
                expert_assignments__assignment__expert=user
            ).distinct()
        if role_code == "tutor":
            return queryset.filter(tutor=user)
        if is_student_role(role_code):
            return queryset.filter(Q(leader=user) | Q(members=user)).distinct()
        return queryset.none()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_archived = True
        instance.save(update_fields=["is_archived"])
        return Response({"status": "archived"})

    @action(detail=True, methods=["get"])
    def download_file(self, request, pk=None):
        """Скачать файл проекта. Доступно организатору и эксперту по своему назначению."""
        project = self.get_object()
        if not project.files:
            return Response({"detail": "У проекта нет прикреплённого файла."}, status=404)
        filename = os.path.basename(project.files.name)
        response = FileResponse(
            project.files.open("rb"),
            as_attachment=True,
            filename=filename or f"project-{project.id}.bin",
        )
        return response


class CommentViewSet(viewsets.ModelViewSet):
    """ViewSet для комментариев."""

    queryset = Comment.objects.filter(is_archived=False)
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer", "expert", "tutor", "student"],
        "update": ["organizer", "expert", "tutor"],
        "partial_update": ["organizer", "expert", "tutor"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["project", "author"]
    search_fields = ["text"]
    ordering_fields = ["created_at"]
    ordering = ["created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "organizer":
            return queryset
        if role_code == "expert":
            return queryset.filter(
                Q(author=user) | Q(project__expert_assignments__assignment__expert=user)
            ).distinct()
        if role_code == "tutor":
            return queryset.filter(Q(author=user) | Q(project__tutor=user)).distinct()
        if is_student_role(role_code):
            return queryset.filter(
                Q(project__leader=user) | Q(project__members=user)
            ).distinct()
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        project = serializer.validated_data["project"]
        role_code = normalize_role_code(getattr(user.role, "code", ""))

        if role_code == "organizer":
            serializer.save()
            return

        allowed = False
        if role_code == "expert":
            allowed = project.expert_assignments.filter(assignment__expert=user).exists()
        elif role_code == "tutor":
            allowed = project.tutor_id == user.id
        elif is_student_role(role_code):
            allowed = project.leader_id == user.id or project.members.filter(id=user.id).exists()

        if not allowed:
            raise PermissionDenied("Нет доступа к этому проекту.")

        serializer.save(author=user)


class EvaluationCriterionViewSet(viewsets.ModelViewSet):
    """ViewSet для критериев оценки."""

    queryset = EvaluationCriterion.objects.filter(is_archived=False)
    serializer_class = EvaluationCriterionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["conference", "stage"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "max_score", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "organizer":
            return queryset
        if role_code == "expert":
            expert_projects = Project.objects.filter(
                expert_assignments__assignment__expert=user,
                is_archived=False,
            ).select_related("section__conference")
            conference_ids = {
                project.section.conference_id
                for project in expert_projects
                if project.section and project.section.conference_id
            }
            if conference_ids:
                filtered = queryset.filter(conference_id__in=conference_ids)
                if connection.vendor == "postgresql":
                    return filtered.order_by("conference_id", "name", "stage", "id").distinct(
                        "conference_id", "name", "stage"
                    )
                return filtered.distinct()
            return queryset.none()
        return queryset.none()


class ProjectScoreViewSet(viewsets.ModelViewSet):
    """ViewSet для оценок проектов."""

    queryset = ProjectScore.objects.filter(is_archived=False)
    serializer_class = ProjectScoreSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer", "expert"],
        "update": ["organizer", "expert"],
        "partial_update": ["organizer", "expert"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["project", "criterion", "evaluator"]
    search_fields = ["project__title"]
    ordering_fields = ["created_at", "score"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "organizer":
            return queryset
        if role_code == "expert":
            return queryset.filter(evaluator=user)
        if role_code == "tutor":
            return queryset.filter(project__tutor=user)
        if is_student_role(role_code):
            return queryset.filter(Q(project__leader=user) | Q(project__members=user)).distinct()
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "expert":
            serializer.save(evaluator=user)
            return
        serializer.save()


class ProjectResultViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet для результатов проектов."""

    queryset = ProjectResult.objects.filter(is_archived=False)
    serializer_class = ProjectResultSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["conference", "section", "is_winner", "is_prize"]
    search_fields = ["project__title"]
    ordering_fields = ["total_score", "rank"]
    ordering = ["rank"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code in {"organizer", "expert"}:
            return queryset
        if role_code == "tutor":
            return queryset.filter(project__tutor=user)
        if is_student_role(role_code):
            return queryset.filter(Q(project__leader=user) | Q(project__members=user)).distinct()
        return queryset.none()


class ExpertAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet для назначений эксперту."""

    queryset = ExpertAssignment.objects.filter(is_archived=False).select_related(
        "conference",
        "expert",
    ).prefetch_related(
        "items__project__section",
        "items__project__presentation_type__place",
    )
    serializer_class = ExpertAssignmentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
        "download_zip": ["organizer", "expert"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["conference", "expert", "stage"]
    search_fields = ["expert__last_name", "expert__first_name", "conference__title"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "expert":
            return queryset.filter(expert=user)
        if role_code == "organizer":
            return queryset
        return queryset.none()

    @action(detail=True, methods=["get"])
    def download_zip(self, request, pk=None):
        assignment = self.get_object()
        user = request.user
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "expert" and assignment.expert_id != user.id:
            return Response({"detail": "Forbidden"}, status=403)

        items = assignment.items.select_related("project")
        with tempfile.NamedTemporaryFile(suffix=".zip") as tmpfile:
            with zipfile.ZipFile(tmpfile, "w", zipfile.ZIP_DEFLATED) as zipf:
                for item in items:
                    project = item.project
                    if not project.files:
                        continue
                    filename = os.path.basename(project.files.name)
                    safe_title = slugify(project.title) or f"project-{project.id}"
                    arcname = f"{safe_title}-{project.id}-{filename}"
                    with project.files.open("rb") as file_obj:
                        zipf.writestr(arcname, file_obj.read())
            tmpfile.seek(0)
            response = HttpResponse(tmpfile.read(), content_type="application/zip")
            response["Content-Disposition"] = (
                f'attachment; filename="assignment_{assignment.id}.zip"'
            )
            return response


class ExpertAssignmentItemViewSet(viewsets.ModelViewSet):
    """ViewSet для проектов в назначениях."""

    queryset = ExpertAssignmentItem.objects.filter(is_archived=False)
    serializer_class = ExpertAssignmentItemSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer"],
        "update": ["organizer"],
        "partial_update": ["organizer"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["assignment", "project"]
    search_fields = ["project__title"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = normalize_role_code(getattr(user.role, "code", ""))
        if role_code == "expert":
            return queryset.filter(assignment__expert=user)
        if role_code == "organizer":
            return queryset
        return queryset.none()


class PublicStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        conferences_count = Conference.objects.filter(is_archived=False).count()
        sections_count = Section.objects.filter(is_archived=False).count()
        projects_count = Project.objects.filter(is_archived=False).count()
        participants_count = User.objects.filter(
            is_archived=False,
        ).filter(
            Q(role__code__iexact="student")
            | Q(role__code__iexact="student2")
            | Q(role__code__iexact="student3")
        ).count()
        experts_count = User.objects.filter(
            is_archived=False,
            role__code__iexact="expert",
        ).count()
        return Response(
            {
                "conferences": conferences_count,
                "sections": sections_count,
                "projects": projects_count,
                "participants": participants_count,
                "experts": experts_count,
            }
        )
