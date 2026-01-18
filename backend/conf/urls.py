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

urlpatterns = [
    path("", include(router.urls)),
]

