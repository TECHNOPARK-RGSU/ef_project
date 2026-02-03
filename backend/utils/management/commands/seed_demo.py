from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from conf.models import (
    AgeCategory,
    Conference,
    ParticipationStage,
    Place,
    PresentationType,
    Project,
    ProjectStatus,
    Section,
    EvaluationCriterion,
    ProjectScore,
    Comment,
    ExpertAssignment,
    ExpertAssignmentItem,
)
from conf.services.results import calculate_results_for_conference
from users.models import EducationalOrganization, Role, User
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = "Seed demo data for local development"

    def handle(self, *args, **options):
        organizer_role = self._get_or_create_role("Организатор", "organizer")
        expert_role = self._get_or_create_role("Эксперт", "expert")
        tutor_role = self._get_or_create_role("Наставник", "tutor")
        student_role = self._get_or_create_role("Ученик", "student")
        student2_role = self._get_or_create_role("Ученик 2", "student2")
        student3_role = self._get_or_create_role("Ученик 3", "student3")

        org, _ = EducationalOrganization.objects.get_or_create(
            name="РГСУ",
            city="Москва",
            defaults={"short_name": "РГСУ", "address": "ул. Вильгельма Пика, 4"},
        )
        org2, _ = EducationalOrganization.objects.get_or_create(
            name="МГТУ",
            city="Москва",
            defaults={"short_name": "МГТУ", "address": "2-я Бауманская, 5"},
        )

        organizer = self._get_or_create_user(
            email="organizer@example.com",
            first_name="Анна",
            last_name="Организатор",
            role=organizer_role,
            educational_organization=org,
        )
        expert = self._get_or_create_user(
            email="expert@example.com",
            first_name="Илья",
            last_name="Эксперт",
            role=expert_role,
            educational_organization=org,
        )
        expert2 = self._get_or_create_user(
            email="expert2@example.com",
            first_name="Екатерина",
            last_name="Эксперт",
            role=expert_role,
            educational_organization=org2,
        )
        participant = self._get_or_create_user(
            email="participant@example.com",
            first_name="Мария",
            last_name="Участник",
            role=student_role,
            educational_organization=org,
        )
        participant2 = self._get_or_create_user(
            email="student2@example.com",
            first_name="Сергей",
            last_name="Ученик2",
            role=student2_role,
            educational_organization=org,
        )
        participant3 = self._get_or_create_user(
            email="student3@example.com",
            first_name="Ольга",
            last_name="Ученик3",
            role=student3_role,
            educational_organization=org2,
        )
        tutor = self._get_or_create_user(
            email="tutor@example.com",
            first_name="Ирина",
            last_name="Наставник",
            role=tutor_role,
            educational_organization=org,
        )

        age_14_18 = self._get_or_create_age("14-18 лет", 14, 18)
        age_16_22 = self._get_or_create_age("16-22 года", 16, 22)
        age_18_25 = self._get_or_create_age("18-25 лет", 18, 25)

        status_new = self._get_or_create_status("Новый", "new")
        status_review = self._get_or_create_status("На доработку", "rework")
        self._get_or_create_status("Согласован", "approved")
        self._get_or_create_status("В финал", "final")

        stage_qual = self._get_or_create_stage("Отборочный", "qualifying")
        self._get_or_create_stage("Финал", "final")

        place, _ = Place.objects.get_or_create(
            name="Главный корпус",
            address="Москва, ул. Вильгельма Пика, 4",
        )
        place2, _ = Place.objects.get_or_create(
            name="Корпус Б",
            address="Москва, 2-я Бауманская, 5",
        )
        pres_oral = self._get_or_create_presentation_type("Очный доклад", "oral", place)
        pres_poster = self._get_or_create_presentation_type("Стендовый", "poster", place2)
        pres_online = self._get_or_create_presentation_type("Онлайн-доклад", "online", place)

        conference, _ = Conference.objects.get_or_create(
            title="Межвузовские дни науки",
            defaults={
                "description": "Весенняя научная сессия для студентов и школьников.",
                "start_date": timezone.now().date(),
                "end_date": timezone.now().date(),
                "location": "Москва, кампус РГСУ",
                "format": "hybrid",
                "is_online": True,
            },
        )
        conference.organizers.add(organizer)
        conference_online, _ = Conference.objects.get_or_create(
            title="Онлайн-конференция исследователей",
            defaults={
                "description": "Заочный этап с защитой в видео-формате.",
                "start_date": timezone.now().date(),
                "end_date": timezone.now().date(),
                "location": "Онлайн",
                "format": "online",
                "is_online": True,
            },
        )
        conference_online.organizers.add(organizer)
        conference_offline, _ = Conference.objects.get_or_create(
            title="Очная инженерная сессия",
            defaults={
                "description": "Очный этап с защитой в аудиториях.",
                "start_date": timezone.now().date(),
                "end_date": timezone.now().date(),
                "location": "Москва, МГТУ",
                "format": "offline",
                "is_online": False,
            },
        )
        conference_offline.organizers.add(organizer)

        section_science, _ = Section.objects.get_or_create(
            name="Научные исследования",
            conference=conference,
            category=age_14_18,
        )
        Section.objects.get_or_create(
            name="Проектная инженерия",
            conference=conference,
            category=age_16_22,
        )
        Section.objects.get_or_create(
            name="Гуманитарные практики",
            conference=conference,
            category=age_14_18,
        )
        section_online, _ = Section.objects.get_or_create(
            name="Цифровые решения",
            conference=conference_online,
            category=age_18_25,
        )
        section_offline, _ = Section.objects.get_or_create(
            name="Прикладная инженерия",
            conference=conference_offline,
            category=age_16_22,
        )

        project, _ = Project.objects.get_or_create(
            title="Энергоэффективный кампус",
            leader=participant,
            section=section_science,
            status=status_new,
            stage=stage_qual,
            presentation_type=pres_oral,
            defaults={
                "description": "Проект по снижению энергопотребления учебных корпусов.",
                "additional_info": "Демо-проект для учебной платформы.",
            },
        )
        project2, _ = Project.objects.get_or_create(
            title="Умная навигация по кампусу",
            leader=participant2,
            tutor=tutor,
            section=section_science,
            status=status_review,
            stage=stage_qual,
            presentation_type=pres_poster,
            defaults={
                "description": "Прототип навигации с AR-метками.",
                "additional_info": "Нужен отзыв эксперта по UX.",
            },
        )
        project3, _ = Project.objects.get_or_create(
            title="Онлайн-платформа профориентации",
            leader=participant3,
            section=section_online,
            status=status_new,
            stage=stage_qual,
            presentation_type=pres_online,
            defaults={
                "description": "Сервис для профориентации школьников.",
                "additional_info": "Демо-версия доступна по ссылке.",
            },
        )
        project4, _ = Project.objects.get_or_create(
            title="Робот-ассистент для лабораторий",
            leader=participant,
            tutor=tutor,
            section=section_offline,
            status=status_review,
            stage=stage_qual,
            presentation_type=pres_oral,
            defaults={
                "description": "Ассистент для контроля лабораторных измерений.",
                "additional_info": "Требуется очная защита.",
            },
        )

        criterion_online, _ = EvaluationCriterion.objects.get_or_create(
            conference=conference,
            name="Актуальность темы",
            stage="online",
            defaults={"max_score": 10},
        )
        criterion_offline, _ = EvaluationCriterion.objects.get_or_create(
            conference=conference,
            name="Качество доклада",
            stage="offline",
            defaults={"max_score": 10},
        )
        criterion_online2, _ = EvaluationCriterion.objects.get_or_create(
            conference=conference,
            name="Новизна решения",
            stage="online",
            defaults={"max_score": 10},
        )
        criterion_offline2, _ = EvaluationCriterion.objects.get_or_create(
            conference=conference,
            name="Качество презентации",
            stage="offline",
            defaults={"max_score": 10},
        )
        EvaluationCriterion.objects.get_or_create(
            conference=conference_online,
            name="Полнота исследования",
            stage="online",
            defaults={"max_score": 10},
        )
        EvaluationCriterion.objects.get_or_create(
            conference=conference_offline,
            name="Практическая ценность",
            stage="offline",
            defaults={"max_score": 10},
        )

        ProjectScore.objects.get_or_create(
            project=project,
            criterion=criterion_online,
            evaluator=expert,
            defaults={"score": 8},
        )
        ProjectScore.objects.get_or_create(
            project=project,
            criterion=criterion_offline,
            evaluator=expert,
            defaults={"score": 9},
        )
        ProjectScore.objects.get_or_create(
            project=project,
            criterion=criterion_online2,
            evaluator=expert,
            defaults={"score": 7},
        )
        ProjectScore.objects.get_or_create(
            project=project2,
            criterion=criterion_online,
            evaluator=expert2,
            defaults={"score": 6},
        )
        ProjectScore.objects.get_or_create(
            project=project2,
            criterion=criterion_offline,
            evaluator=expert2,
            defaults={"score": 7},
        )
        ProjectScore.objects.get_or_create(
            project=project3,
            criterion=criterion_online,
            evaluator=expert,
            defaults={"score": 8},
        )
        ProjectScore.objects.get_or_create(
            project=project4,
            criterion=criterion_offline,
            evaluator=expert,
            defaults={"score": 9},
        )

        Comment.objects.get_or_create(
            project=project,
            author=expert,
            defaults={"text": "Усилить обоснование экономического эффекта."},
        )
        Comment.objects.get_or_create(
            project=project2,
            author=tutor,
            defaults={"text": "Добавить демонстрационное видео в презентацию."},
        )

        self._seed_assignments(conference, "online", [expert, expert2], [project, project2])
        self._seed_assignments(conference, "offline", [expert], [project, project2])
        self._seed_assignments(conference_online, "online", [expert2], [project3])
        self._seed_assignments(conference_offline, "offline", [expert], [project4])

        self._recalculate_results(conference)
        self._recalculate_results(conference_online)
        self._recalculate_results(conference_offline)

        token, _ = Token.objects.get_or_create(user=organizer)
        self.stdout.write(self.style.SUCCESS(f"Organizer token: {token.key}"))

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))

    def _get_or_create_role(self, name: str, code: str) -> Role:
        role, _ = Role.objects.get_or_create(name=name, code=code)
        return role

    def _get_or_create_user(self, email: str, first_name: str, last_name: str, role: Role, educational_organization):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "educational_organization": educational_organization,
            },
        )
        if created:
            user.set_password("password123")
            user.save(update_fields=["password"])
        return user

    def _get_or_create_age(self, name: str, min_age: int, max_age: int) -> AgeCategory:
        age, _ = AgeCategory.objects.get_or_create(
            name=name,
            defaults={"min_age": min_age, "max_age": max_age},
        )
        return age

    def _get_or_create_status(self, name: str, code: str) -> ProjectStatus:
        status, _ = ProjectStatus.objects.get_or_create(name=name, code=code)
        return status

    def _get_or_create_stage(self, name: str, code: str) -> ParticipationStage:
        stage, _ = ParticipationStage.objects.get_or_create(name=name, code=code)
        return stage

    def _get_or_create_presentation_type(self, name: str, code: str, place: Place) -> PresentationType:
        pres, created = PresentationType.objects.get_or_create(
            code=code,
            defaults={"name": name, "place": place},
        )
        if not created:
            updates = []
            if pres.name != name:
                pres.name = name
                updates.append("name")
            if pres.place_id != place.id:
                pres.place = place
                updates.append("place")
            if updates:
                pres.save(update_fields=updates)
        return pres

    def _seed_assignments(self, conference, stage: str, experts: list[User], projects: list[Project]):
        if not experts or not projects:
            return
        with transaction.atomic():
            for expert in experts:
                assignment, _ = ExpertAssignment.objects.get_or_create(
                    conference=conference,
                    expert=expert,
                    stage=stage,
                    defaults={"max_projects": len(projects)},
                )
                for project in projects:
                    ExpertAssignmentItem.objects.get_or_create(
                        assignment=assignment,
                        project=project,
                    )

    def _recalculate_results(self, conference: Conference):
        calculate_results_for_conference(conference)
