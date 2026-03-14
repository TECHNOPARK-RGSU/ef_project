from django.test import TestCase

from conf.models import (
    AgeCategory,
    Conference,
    EvaluationCriterion,
    ParticipationStage,
    Place,
    PresentationType,
    Project,
    ProjectStatus,
    ProjectScore,
    Section,
)
from conf.serializers import ProjectScoreSerializer, ProjectSerializer
from conf.services.results import calculate_results_for_conference
from users.models import Role, StudentPeerLink, TutorStudentAccess, User


class ResultsCalculationTests(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name="Организатор", code="organizer")
        self.user = User.objects.create_user(
            email="organizer@example.com",
            password="password",
            role=self.role,
            first_name="Анна",
            last_name="Организатор",
        )
        self.conference = Conference.objects.create(
            title="Тестовая конференция",
            start_date="2025-01-10",
            end_date="2025-01-12",
            winners_count=1,
            prizes_count=1,
            results_published=True,
        )
        self.category = AgeCategory.objects.create(name="10-12", min_age=10, max_age=12)
        self.section = Section.objects.create(
            name="Секция 1",
            conference=self.conference,
            category=self.category,
        )
        self.status = ProjectStatus.objects.create(name="Черновик", code="draft")
        self.stage = ParticipationStage.objects.create(name="Заочный", code="online")
        self.place = Place.objects.create(name="Зал 1", address="ул. Пушкина, 1")
        self.presentation_type = PresentationType.objects.create(
            name="Доклад",
            code="talk",
            place=self.place,
        )
        self.criteria_online = EvaluationCriterion.objects.create(
            conference=self.conference,
            name="Качество",
            max_score=10,
            stage="online",
        )
        self.criteria_offline = EvaluationCriterion.objects.create(
            conference=self.conference,
            name="Выступление",
            max_score=10,
            stage="offline",
        )

    def _create_project(self, title: str) -> Project:
        return Project.objects.create(
            title=title,
            description="Описание",
            leader=self.user,
            section=self.section,
            status=self.status,
            stage=self.stage,
            presentation_type=self.presentation_type,
        )

    def test_calculate_results_with_ties_uses_dense_ranks(self):
        project_a = self._create_project("Проект А")
        project_b = self._create_project("Проект Б")
        project_c = self._create_project("Проект В")

        ProjectScore.objects.create(
            project=project_a,
            criterion=self.criteria_online,
            evaluator=self.user,
            score=8,
        )
        ProjectScore.objects.create(
            project=project_a,
            criterion=self.criteria_offline,
            evaluator=self.user,
            score=7,
        )
        ProjectScore.objects.create(
            project=project_b,
            criterion=self.criteria_online,
            evaluator=self.user,
            score=8,
        )
        ProjectScore.objects.create(
            project=project_b,
            criterion=self.criteria_offline,
            evaluator=self.user,
            score=7,
        )
        ProjectScore.objects.create(
            project=project_c,
            criterion=self.criteria_online,
            evaluator=self.user,
            score=6,
        )
        ProjectScore.objects.create(
            project=project_c,
            criterion=self.criteria_offline,
            evaluator=self.user,
            score=6,
        )

        calculate_results_for_conference(self.conference)

        results = {result.project_id: result for result in self.conference.results.all()}
        self.assertEqual(results[project_a.id].rank, 1)
        self.assertEqual(results[project_b.id].rank, 1)
        self.assertTrue(results[project_a.id].is_winner)
        self.assertTrue(results[project_b.id].is_winner)
        self.assertEqual(results[project_c.id].rank, 2)
        self.assertTrue(results[project_c.id].is_prize)
        self.conference.refresh_from_db()
        self.assertFalse(self.conference.results_published)


class ProjectScoreValidationTests(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name="Эксперт", code="expert")
        self.user = User.objects.create_user(
            email="expert@example.com",
            password="password",
            role=self.role,
            first_name="Илья",
            last_name="Эксперт",
        )
        self.conference_a = Conference.objects.create(
            title="Конференция A",
            start_date="2025-02-10",
            end_date="2025-02-12",
        )
        self.conference_b = Conference.objects.create(
            title="Конференция B",
            start_date="2025-03-10",
            end_date="2025-03-12",
        )
        self.category = AgeCategory.objects.create(name="13-15", min_age=13, max_age=15)
        self.section_a = Section.objects.create(
            name="Секция A",
            conference=self.conference_a,
            category=self.category,
        )
        self.section_b = Section.objects.create(
            name="Секция B",
            conference=self.conference_b,
            category=self.category,
        )
        self.status = ProjectStatus.objects.create(name="Черновик", code="draft")
        self.stage = ParticipationStage.objects.create(name="Заочный", code="online")
        self.place = Place.objects.create(name="Зал 2", address="ул. Ленина, 2")
        self.presentation_type = PresentationType.objects.create(
            name="Стенд",
            code="poster",
            place=self.place,
        )
        self.project_a = Project.objects.create(
            title="Проект A",
            description="Описание",
            leader=self.user,
            section=self.section_a,
            status=self.status,
            stage=self.stage,
            presentation_type=self.presentation_type,
        )
        self.criterion_a = EvaluationCriterion.objects.create(
            conference=self.conference_a,
            name="Качество",
            max_score=10,
            stage="online",
        )
        self.criterion_b = EvaluationCriterion.objects.create(
            conference=self.conference_b,
            name="Достоверность",
            max_score=10,
            stage="online",
        )

    def test_rejects_negative_score(self):
        serializer = ProjectScoreSerializer(
            data={
                "project_id": self.project_a.id,
                "criterion_id": self.criterion_a.id,
                "evaluator_id": self.user.id,
                "score": -1,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("score", serializer.errors)

    def test_rejects_score_with_mismatched_conference(self):
        serializer = ProjectScoreSerializer(
            data={
                "project_id": self.project_a.id,
                "criterion_id": self.criterion_b.id,
                "evaluator_id": self.user.id,
                "score": 5,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("criterion_id", serializer.errors)


class ProjectRelationsValidationTests(TestCase):
    def setUp(self):
        self.student_role = Role.objects.create(name="Ученик", code="student")
        self.tutor_role = Role.objects.create(name="Наставник", code="tutor")
        self.organizer_role = Role.objects.create(name="Организатор", code="organizer")
        self.student = User.objects.create_user(
            email="student@example.com",
            password="password",
            role=self.student_role,
            first_name="Иван",
            last_name="Ученик",
        )
        self.peer = User.objects.create_user(
            email="peer@example.com",
            password="password",
            role=self.student_role,
            first_name="Петр",
            last_name="Соавтор",
        )
        self.foreign_peer = User.objects.create_user(
            email="foreign@example.com",
            password="password",
            role=self.student_role,
            first_name="Сергей",
            last_name="Чужой",
        )
        self.tutor = User.objects.create_user(
            email="tutor@example.com",
            password="password",
            role=self.tutor_role,
            first_name="Анна",
            last_name="Наставник",
        )
        self.foreign_tutor = User.objects.create_user(
            email="foreign-tutor@example.com",
            password="password",
            role=self.tutor_role,
            first_name="Ольга",
            last_name="НеПривязан",
        )
        self.organizer = User.objects.create_user(
            email="organizer@example.com",
            password="password",
            role=self.organizer_role,
            first_name="Мария",
            last_name="Организатор",
        )
        self.conference = Conference.objects.create(
            title="Тестовая конференция связей",
            start_date="2026-03-01",
            end_date="2026-03-02",
        )
        self.category = AgeCategory.objects.create(name="14-17", min_age=14, max_age=17)
        self.section = Section.objects.create(
            name="Секция связей",
            conference=self.conference,
            category=self.category,
        )
        self.status = ProjectStatus.objects.create(name="Новый", code="new")
        self.stage = ParticipationStage.objects.create(name="Отборочный", code="qualifying")
        self.place = Place.objects.create(name="Зал", address="ул. Пример, 1")
        self.presentation_type = PresentationType.objects.create(
            name="Доклад",
            code="oral",
            place=self.place,
        )

    def test_student_can_use_only_linked_tutor(self):
        serializer = ProjectSerializer(
            data={
                "title": "Тестовый проект",
                "leader_id": self.student.id,
                "tutor_id": self.foreign_tutor.id,
                "section_id": self.section.id,
                "status_id": self.status.id,
                "stage_id": self.stage.id,
                "presentation_type_id": self.presentation_type.id,
            },
            context={"request": type("Request", (), {"user": self.student})()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("tutor_id", serializer.errors)

    def test_student_project_gets_linked_tutor_automatically(self):
        TutorStudentAccess.objects.create(tutor=self.tutor, student=self.student)
        serializer = ProjectSerializer(
            data={
                "title": "Тестовый проект",
                "leader_id": self.student.id,
                "section_id": self.section.id,
                "status_id": self.status.id,
                "stage_id": self.stage.id,
                "presentation_type_id": self.presentation_type.id,
            },
            context={"request": type("Request", (), {"user": self.student})()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["tutor"], self.tutor)

    def test_student_can_add_only_linked_peers(self):
        StudentPeerLink.objects.create(student=self.student, peer=self.peer)
        StudentPeerLink.objects.create(student=self.peer, peer=self.student)

        invalid_serializer = ProjectSerializer(
            data={
                "title": "Тестовый проект",
                "leader_id": self.student.id,
                "member_ids": [self.foreign_peer.id],
                "section_id": self.section.id,
                "status_id": self.status.id,
                "stage_id": self.stage.id,
                "presentation_type_id": self.presentation_type.id,
            },
            context={"request": type("Request", (), {"user": self.student})()},
        )
        self.assertFalse(invalid_serializer.is_valid())
        self.assertIn("member_ids", invalid_serializer.errors)

        valid_serializer = ProjectSerializer(
            data={
                "title": "Тестовый проект",
                "leader_id": self.student.id,
                "member_ids": [self.peer.id],
                "section_id": self.section.id,
                "status_id": self.status.id,
                "stage_id": self.stage.id,
                "presentation_type_id": self.presentation_type.id,
            },
            context={"request": type("Request", (), {"user": self.student})()},
        )
        self.assertTrue(valid_serializer.is_valid(), valid_serializer.errors)
