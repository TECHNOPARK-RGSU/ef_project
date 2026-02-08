from django.db import migrations


def merge_student_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    User = apps.get_model("users", "User")

    student_role = Role.objects.filter(code__iexact="student").first()
    legacy_roles = list(Role.objects.filter(code__iexact="student2")) + list(
        Role.objects.filter(code__iexact="student3")
    )

    if not student_role and legacy_roles:
        student_role = legacy_roles.pop(0)
        student_role.code = "student"
        student_role.name = "Ученик"
        student_role.is_archived = False
        student_role.save(update_fields=["code", "name", "is_archived"])

    if student_role:
        if legacy_roles:
            User.objects.filter(role__in=legacy_roles).update(role=student_role)
            Role.objects.filter(id__in=[role.id for role in legacy_roles]).update(is_archived=True)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(merge_student_roles, migrations.RunPython.noop),
    ]
