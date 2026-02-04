import os
import tempfile
import zipfile

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import render
from openpyxl import Workbook
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
from conf.services.results import calculate_results_for_conference
from utils.permissions import RoleBasedPermission
from users.models import User


class PlaceViewSet(viewsets.ModelViewSet):
    """ViewSet для мест."""

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
        role_code = getattr(user.role, "code", "").lower()
        if role_code in {"organizer", "expert"}:
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

        experts = User.objects.filter(role__code__iexact="expert", is_archived=False)
        if not experts.exists():
            return Response({"detail": "No experts found."}, status=400)

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
            for expert in experts:
                assignment, _ = ExpertAssignment.objects.get_or_create(
                    conference=conference,
                    expert=expert,
                    stage=stage,
                    defaults={"max_projects": per_expert},
                )
                if assignment.max_projects != per_expert:
                    assignment.max_projects = per_expert
                    assignment.save(update_fields=["max_projects"])

                slice_projects = available_projects[:per_expert]
                available_projects = available_projects[per_expert:]
                items = [
                    ExpertAssignmentItem(assignment=assignment, project=project)
                    for project in slice_projects
                ]
                ExpertAssignmentItem.objects.bulk_create(items, ignore_conflicts=True)
                created_items += len(items)
                if not available_projects:
                    break

        return Response(
            {
                "status": "ok",
                "assigned": created_items,
                "experts": experts.count(),
                "remaining": len(available_projects),
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
        response.write("section,project,online_score,offline_score,total_score,rank,is_winner,is_prize\n")
        for result in results:
            response.write(
                f"{result.section.name},"
                f"{result.project.title},"
                f"{result.online_score},"
                f"{result.offline_score},"
                f"{result.total_score},"
                f"{result.rank},"
                f"{int(result.is_winner)},"
                f"{int(result.is_prize)}\n"
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
                "is_winner",
                "is_prize",
            ]
        )
        for result in results:
            sheet.append(
                [
                    result.section.name,
                    result.project.title,
                    float(result.online_score),
                    float(result.offline_score),
                    float(result.total_score),
                    result.rank,
                    int(result.is_winner),
                    int(result.is_prize),
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
    """ViewSet для возрастных категорий."""

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
    """ViewSet для статусов проекта."""

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


class ParticipationStageViewSet(viewsets.ModelViewSet):
    """ViewSet для этапов участия."""

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


class PresentationTypeViewSet(viewsets.ModelViewSet):
    """ViewSet для типов представления."""

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


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet для проектов."""

    queryset = Project.objects.filter(is_archived=False)
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer", "tutor", "student", "student2", "student3"],
        "update": ["organizer", "tutor", "student", "student2", "student3"],
        "partial_update": ["organizer", "tutor", "student", "student2", "student3"],
        "destroy": ["organizer"],
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "section",
        "status",
        "stage",
        "presentation_type",
        "leader",
        "tutor",
    ]
    search_fields = ["title", "description", "additional_info"]
    ordering_fields = ["title", "created_at"]
    ordering = ["title"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_superuser", False):
            return queryset
        role_code = getattr(user.role, "code", "").lower()
        if role_code == "organizer":
            return queryset
        if role_code == "expert":
            return queryset.filter(
                expert_assignments__assignment__expert=user
            ).distinct()
        if role_code == "tutor":
            return queryset.filter(tutor=user)
        if role_code in {"student", "student2", "student3"}:
            return queryset.filter(Q(leader=user) | Q(members=user)).distinct()
        return queryset.none()


class CommentViewSet(viewsets.ModelViewSet):
    """ViewSet для комментариев."""

    queryset = Comment.objects.filter(is_archived=False)
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    role_requirements = {
        "create": ["organizer", "expert", "tutor"],
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
        role_code = getattr(user.role, "code", "").lower()
        if role_code == "organizer":
            return queryset
        if role_code == "expert":
            return queryset.filter(
                Q(author=user) | Q(project__expert_assignments__assignment__expert=user)
            ).distinct()
        if role_code == "tutor":
            return queryset.filter(Q(author=user) | Q(project__tutor=user)).distinct()
        if role_code in {"student", "student2", "student3"}:
            return queryset.filter(
                Q(project__leader=user) | Q(project__members=user)
            ).distinct()
        return queryset.none()


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
        role_code = getattr(user.role, "code", "").lower()
        if role_code in {"organizer", "expert"}:
            return queryset
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
        role_code = getattr(user.role, "code", "").lower()
        if role_code == "organizer":
            return queryset
        if role_code == "expert":
            return queryset.filter(evaluator=user)
        if role_code == "tutor":
            return queryset.filter(project__tutor=user)
        if role_code in {"student", "student2", "student3"}:
            return queryset.filter(Q(project__leader=user) | Q(project__members=user)).distinct()
        return queryset.none()


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
        role_code = getattr(user.role, "code", "").lower()
        if role_code == "expert":
            return queryset.filter(expert=user)
        if role_code == "organizer":
            return queryset
        return queryset.none()

    @action(detail=True, methods=["get"])
    def download_zip(self, request, pk=None):
        assignment = self.get_object()
        user = request.user
        role_code = getattr(user.role, "code", "").lower()
        if role_code == "expert" and assignment.expert_id != user.id:
            return Response({"detail": "Forbidden"}, status=403)

        items = assignment.items.select_related("project")
        if not items.exists():
            return Response({"detail": "No files to download."}, status=404)

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
        role_code = getattr(user.role, "code", "").lower()
        if role_code == "expert":
            return queryset.filter(assignment__expert=user)
        if role_code == "organizer":
            return queryset
        return queryset.none()
