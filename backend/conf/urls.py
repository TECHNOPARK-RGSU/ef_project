from django.urls import path, include
from rest_framework.routers import DefaultRouter
from conf.views import (
    PlaceViewSet,
    ConferenceViewSet,
    AgeCategoryViewSet,
    SectionViewSet,
    ProjectStatusViewSet,
    ParticipationStageViewSet,
    ConferenceStatusFlowItemViewSet,
    ConferenceStageAvailabilityViewSet,
    ConferenceExpertViewSet,
    PresentationTypeViewSet,
    ProjectViewSet,
    CommentViewSet,
    EvaluationCriterionViewSet,
    ProjectScoreViewSet,
    ProjectResultViewSet,
    ExpertAssignmentViewSet,
    ExpertAssignmentItemViewSet,
    PublicStatsView,
)

router = DefaultRouter()
router.register(r"places", PlaceViewSet, basename="place")
router.register(r"conferences", ConferenceViewSet, basename="conference")
router.register(r"age-categories", AgeCategoryViewSet, basename="age-category")
router.register(r"sections", SectionViewSet, basename="section")
router.register(r"project-statuses", ProjectStatusViewSet, basename="project-status")
router.register(
    r"participation-stages",
    ParticipationStageViewSet,
    basename="participation-stage",
)
router.register(
    r"conference-status-flow",
    ConferenceStatusFlowItemViewSet,
    basename="conference-status-flow",
)
router.register(
    r"conference-stages",
    ConferenceStageAvailabilityViewSet,
    basename="conference-stages",
)
router.register(
    r"conference-experts",
    ConferenceExpertViewSet,
    basename="conference-experts",
)
router.register(
    r"presentation-types",
    PresentationTypeViewSet,
    basename="presentation-type",
)
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"comments", CommentViewSet, basename="comment")
router.register(r"criteria", EvaluationCriterionViewSet, basename="criterion")
router.register(r"scores", ProjectScoreViewSet, basename="score")
router.register(r"results", ProjectResultViewSet, basename="result")
router.register(r"assignments", ExpertAssignmentViewSet, basename="assignment")
router.register(r"assignment-items", ExpertAssignmentItemViewSet, basename="assignment-item")

urlpatterns = [
    path("", include(router.urls)),
    path("public-stats/", PublicStatsView.as_view(), name="public-stats"),
]
