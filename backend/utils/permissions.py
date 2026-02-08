from rest_framework.permissions import BasePermission, SAFE_METHODS

from utils.roles import normalize_role_code, normalize_role_set


class RoleBasedPermission(BasePermission):
    """Role-based permissions for write operations.

    Views can define role_requirements mapping with action -> list of role codes.
    Safe methods are allowed for any authenticated user (handled by global IsAuthenticated).
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if getattr(user, "is_superuser", False):
            return True

        action = getattr(view, "action", None)
        if not action:
            action = {
                "POST": "create",
                "PUT": "update",
                "PATCH": "partial_update",
                "DELETE": "destroy",
            }.get(request.method)

        role_requirements = getattr(view, "role_requirements", {})
        allowed_roles = normalize_role_set(role_requirements.get(action))
        if not allowed_roles:
            return True

        role = getattr(user, "role", None)
        role_code = normalize_role_code(getattr(role, "code", ""))
        return role_code in allowed_roles
