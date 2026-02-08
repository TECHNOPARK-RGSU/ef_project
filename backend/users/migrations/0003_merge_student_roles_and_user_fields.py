from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_alter_user_managers_user_date_joined_user_groups_and_more"),
        ("users", "0002_merge_student_roles"),
    ]

    operations = []
