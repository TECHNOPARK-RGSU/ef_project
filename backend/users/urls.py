from django.urls import path, include
from rest_framework.routers import DefaultRouter
from users.views import (
    EducationalOrganizationViewSet,
    RoleViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register(
    r"educational-organizations",
    EducationalOrganizationViewSet,
    basename="educational-organization",
)
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    path("me/", UserViewSet.as_view({"get": "me"}), name="users-me"),
    path("", include(router.urls)),
]
