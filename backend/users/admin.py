from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from users.models import EducationalOrganization, Role, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "last_name", "first_name", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_superuser", "is_active")
    ordering = ("email",)
    search_fields = ("email", "last_name", "first_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Персональная информация",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "middle_name",
                    "phone",
                    "city",
                    "date_of_birth",
                    "educational_organization",
                    "role",
                )
            },
        ),
        ("Права", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Важные даты", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "role", "is_staff", "is_superuser"),
            },
        ),
    )


admin.site.register(EducationalOrganization)
admin.site.register(Role)
