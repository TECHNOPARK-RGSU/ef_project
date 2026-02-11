from django.test import TestCase

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
