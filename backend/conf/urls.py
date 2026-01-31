from django.urls import path, include
from rest_framework.routers import DefaultRouter
from conf.views import (
    PlaceViewSet,
    ConferenceViewSet,
    AgeCategoryViewSet,
    SectionViewSet,
    ProjectStatusViewSet,
    ParticipationStageViewSet,
    PresentationTypeViewSet,
    ProjectViewSet,
    CommentViewSet,
    EvaluationCriterionViewSet,
    ProjectScoreViewSet,
    ProjectResultViewSet,
    ExpertAssignmentViewSet,
    ExpertAssignmentItemViewSet,
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
]
