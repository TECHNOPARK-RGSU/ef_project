from django.test import TestCase

from users.serializers import StudentTeamSerializer
from users.models import Role, User


class EmailUserManagerTests(TestCase):
    def setUp(self):
        self.student_role = Role.objects.create(name="Ученик", code="student")

    def test_create_user_uses_email_without_username(self):
        user = User.objects.create_user(
            email="student@example.com",
            password="secret123",
            role=self.student_role,
            first_name="Ivan",
            last_name="Petrov",
        )

        self.assertEqual(user.email, "student@example.com")
        self.assertTrue(user.check_password("secret123"))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_superuser_requires_flags(self):
        user = User.objects.create_superuser(
            email="admin@example.com",
            password="secret123",
            role=self.student_role,
        )

        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_create_user_without_email_raises_error(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="secret123", role=self.student_role)


class StudentTeamSerializerTests(TestCase):
    def setUp(self):
        self.student_role = Role.objects.create(name="Ученик", code="student")
        self.tutor_role = Role.objects.create(name="Наставник", code="tutor")
        self.tutor = User.objects.create_user(
            email="tutor@example.com",
            password="secret123",
            role=self.tutor_role,
            first_name="Tutor",
            last_name="Example",
        )
        self.student_a = User.objects.create_user(
            email="student-a@example.com",
            password="secret123",
            role=self.student_role,
            first_name="Ivan",
            last_name="A",
        )
        self.student_b = User.objects.create_user(
            email="student-b@example.com",
            password="secret123",
            role=self.student_role,
            first_name="Ivan",
            last_name="B",
        )
        self.student_c = User.objects.create_user(
            email="student-c@example.com",
            password="secret123",
            role=self.student_role,
            first_name="Ivan",
            last_name="C",
        )
        self.student_d = User.objects.create_user(
            email="student-d@example.com",
            password="secret123",
            role=self.student_role,
            first_name="Ivan",
            last_name="D",
        )

    def test_tutor_can_create_team_by_member_emails(self):
        serializer = StudentTeamSerializer(
            data={
                "name": "Команда А",
                "member_emails": [
                    "student-a@example.com",
                    "student-b@example.com",
                ],
            },
            context={"request": type("Request", (), {"user": self.tutor})()},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        team = serializer.save()
        self.assertEqual(team.tutor, self.tutor)
        self.assertEqual(team.members.count(), 2)

    def test_team_cannot_have_more_than_three_students(self):
        serializer = StudentTeamSerializer(
            data={
                "name": "Большая команда",
                "member_emails": [
                    "student-a@example.com",
                    "student-b@example.com",
                    "student-c@example.com",
                    "student-d@example.com",
                ],
            },
            context={"request": type("Request", (), {"user": self.tutor})()},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("member_emails", serializer.errors)
