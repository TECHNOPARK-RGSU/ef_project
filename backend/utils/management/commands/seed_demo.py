from __future__ import annotations

from datetime import timedelta
from math import ceil
from random import Random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from rest_framework.authtoken.models import Token

from conf.models import (
    AgeCategory,
    Comment,
    Conference,
    EvaluationCriterion,
    ExpertAssignment,
    ExpertAssignmentItem,
    ParticipationStage,
    Place,
    PresentationType,
    Project,
    ProjectScore,
    ProjectStatus,
    Section,
)
from conf.services.results import calculate_results_for_conference
from users.models import EducationalOrganization, Role, User


class Command(BaseCommand):
    help = "Seed realistic demo data for development and testing"

    DEFAULT_PASSWORD = "password123"

    def handle(self, *args, **options):
        randomizer = Random(42)

        roles = self._seed_roles()
        organizations = self._seed_organizations()
        age_categories = self._seed_age_categories()
        statuses = self._seed_statuses()
        stages = self._seed_stages()
        presentations = self._seed_places_and_presentations()
        users = self._seed_users(roles, organizations)
        conferences = self._seed_conferences(users["organizers"])
        sections = self._seed_sections(conferences, age_categories)
        criteria = self._seed_criteria(conferences)
        projects = self._seed_projects(
            users=users,
            sections=sections,
            statuses=statuses,
            stages=stages,
            presentations=presentations,
        )

        self._seed_comments(projects, users["experts"], statuses)
        self._seed_scores(projects, criteria, users["experts"], statuses, randomizer)
        self._seed_assignments(conferences, projects, users["experts"])

        for conference in conferences.values():
            self._recalculate_results(conference)

        self._print_tokens(users)
        self.stdout.write(self.style.SUCCESS(f"Demo data seeded. Password for demo users: {self.DEFAULT_PASSWORD}"))

    def _seed_roles(self) -> dict[str, Role]:
        role_map: dict[str, tuple[str, str]] = {
            "organizer": ("Организатор", "organizer"),
            "expert": ("Эксперт", "expert"),
            "tutor": ("Наставник", "tutor"),
            "student": ("Ученик", "student"),
        }
        roles: dict[str, Role] = {}
        for key, (name, code) in role_map.items():
            roles[key], _ = Role.objects.get_or_create(name=name, code=code)
        return roles

    def _seed_organizations(self) -> list[EducationalOrganization]:
        org_specs = [
            ("Российский государственный социальный университет", "РГСУ", "Москва", "ул. Вильгельма Пика, 4"),
            ("МГТУ им. Н.Э. Баумана", "МГТУ", "Москва", "2-я Бауманская, 5"),
            ("НИУ ВШЭ", "ВШЭ", "Москва", "Покровский бульвар, 11"),
            ("Санкт-Петербургский политехнический университет Петра Великого", "СПбПУ", "Санкт-Петербург", "Политехническая, 29"),
            ("Казанский (Приволжский) федеральный университет", "КФУ", "Казань", "Кремлевская, 18"),
            ("Южный федеральный университет", "ЮФУ", "Ростов-на-Дону", "Большая Садовая, 105/42"),
            ("Уральский федеральный университет", "УрФУ", "Екатеринбург", "Мира, 19"),
            ("Новосибирский государственный технический университет", "НГТУ", "Новосибирск", "пр-т Карла Маркса, 20"),
        ]

        organizations: list[EducationalOrganization] = []
        for name, short_name, city, address in org_specs:
            org, _ = EducationalOrganization.objects.get_or_create(
                name=name,
                city=city,
                defaults={"short_name": short_name, "address": address},
            )
            updates = []
            if org.short_name != short_name:
                org.short_name = short_name
                updates.append("short_name")
            if org.address != address:
                org.address = address
                updates.append("address")
            if updates:
                org.save(update_fields=updates)
            organizations.append(org)
        return organizations

    def _seed_age_categories(self) -> dict[str, AgeCategory]:
        specs = {
            "school": ("14-18 лет", 14, 18),
            "college": ("16-22 года", 16, 22),
            "young": ("18-25 лет", 18, 25),
        }
        categories: dict[str, AgeCategory] = {}
        for key, (name, min_age, max_age) in specs.items():
            categories[key], _ = AgeCategory.objects.get_or_create(
                name=name,
                defaults={"min_age": min_age, "max_age": max_age},
            )
        return categories

    def _seed_statuses(self) -> dict[str, ProjectStatus]:
        specs = {
            "new": ("Новый", "new"),
            "in_review": ("На рецензии", "in_review"),
            "rework": ("На доработку", "rework"),
            "approved": ("Согласован", "approved"),
            "final": ("В финал", "final"),
        }
        statuses: dict[str, ProjectStatus] = {}
        for key, (name, code) in specs.items():
            statuses[key], _ = ProjectStatus.objects.get_or_create(name=name, code=code)
        return statuses

    def _seed_stages(self) -> dict[str, ParticipationStage]:
        specs = {
            "qualifying": ("Отборочный", "qualifying"),
            "final": ("Финал", "final"),
        }
        stages: dict[str, ParticipationStage] = {}
        for key, (name, code) in specs.items():
            stages[key], _ = ParticipationStage.objects.get_or_create(name=name, code=code)
        return stages

    def _seed_places_and_presentations(self) -> dict[str, PresentationType]:
        main_place, _ = Place.objects.get_or_create(
            name="Главный корпус",
            address="Москва, ул. Вильгельма Пика, 4",
        )
        tech_place, _ = Place.objects.get_or_create(
            name="Технопарк кампуса",
            address="Москва, пр-т Мира, 119",
        )

        oral = self._get_or_create_presentation_type("Очный доклад", "oral", main_place)
        poster = self._get_or_create_presentation_type("Стендовый доклад", "poster", tech_place)
        online = self._get_or_create_presentation_type("Онлайн-доклад", "online", main_place)
        return {"oral": oral, "poster": poster, "online": online}

    def _seed_users(self, roles: dict[str, Role], organizations: list[EducationalOrganization]) -> dict[str, list[User]]:
        organizers_data = [
            ("organizer01@example.com", "Анна", "Савельева", "Михайловна"),
            ("organizer02@example.com", "Владимир", "Назаров", "Павлович"),
        ]
        experts_data = [
            ("expert01@example.com", "Алексей", "Смирнов", "Игоревич"),
            ("expert02@example.com", "Екатерина", "Лебедева", "Андреевна"),
            ("expert03@example.com", "Дмитрий", "Кузнецов", "Сергеевич"),
            ("expert04@example.com", "Марина", "Попова", "Викторовна"),
            ("expert05@example.com", "Павел", "Егоров", "Романович"),
            ("expert06@example.com", "Ольга", "Тимофеева", "Александровна"),
        ]
        tutors_data = [
            ("tutor01@example.com", "Ирина", "Орлова", "Петровна"),
            ("tutor02@example.com", "Николай", "Федоров", "Александрович"),
            ("tutor03@example.com", "Светлана", "Журавлева", "Юрьевна"),
            ("tutor04@example.com", "Артем", "Белов", "Станиславович"),
            ("tutor05@example.com", "Татьяна", "Васильева", "Олеговна"),
            ("tutor06@example.com", "Константин", "Голубев", "Ильич"),
            ("tutor07@example.com", "Елена", "Громова", "Сергеевна"),
            ("tutor08@example.com", "Роман", "Воронов", "Михайлович"),
        ]
        students_data = [
            ("student01@example.com", "Алина", "Крылова", "Игоревна"),
            ("student02@example.com", "Матвей", "Селиванов", "Олегович"),
            ("student03@example.com", "Виктория", "Ершова", "Владимировна"),
            ("student04@example.com", "Максим", "Гусев", "Андреевич"),
            ("student05@example.com", "Арина", "Мартынова", "Павловна"),
            ("student06@example.com", "Илья", "Нефедов", "Игоревич"),
            ("student07@example.com", "Софья", "Баранова", "Романовна"),
            ("student08@example.com", "Егор", "Демидов", "Александрович"),
            ("student09@example.com", "Дарья", "Лукина", "Андреевна"),
            ("student10@example.com", "Андрей", "Капустин", "Сергеевич"),
            ("student11@example.com", "Ксения", "Куликова", "Ильинична"),
            ("student12@example.com", "Арсений", "Медведев", "Денисович"),
            ("student13@example.com", "Мария", "Исаева", "Олеговна"),
            ("student14@example.com", "Тимур", "Винокуров", "Дмитриевич"),
            ("student15@example.com", "Елизавета", "Ширяева", "Алексеевна"),
            ("student16@example.com", "Георгий", "Князев", "Романович"),
            ("student17@example.com", "Полина", "Коновалова", "Дмитриевна"),
            ("student18@example.com", "Никита", "Трофимов", "Ильич"),
            ("student19@example.com", "Олеся", "Киреева", "Максимовна"),
            ("student20@example.com", "Ярослав", "Поляков", "Евгеньевич"),
            ("student21@example.com", "Вероника", "Антонова", "Сергеевна"),
            ("student22@example.com", "Даниил", "Минаев", "Олегович"),
            ("student23@example.com", "Кира", "Яковлева", "Артемовна"),
            ("student24@example.com", "Степан", "Елисеев", "Владимирович"),
        ]

        users: dict[str, list[User]] = {
            "organizers": [],
            "experts": [],
            "tutors": [],
            "students": [],
        }

        for idx, payload in enumerate(organizers_data):
            users["organizers"].append(
                self._get_or_create_user(
                    *payload,
                    role=roles["organizer"],
                    educational_organization=organizations[idx % len(organizations)],
                )
            )

        for idx, payload in enumerate(experts_data):
            users["experts"].append(
                self._get_or_create_user(
                    *payload,
                    role=roles["expert"],
                    educational_organization=organizations[idx % len(organizations)],
                )
            )

        for idx, payload in enumerate(tutors_data):
            users["tutors"].append(
                self._get_or_create_user(
                    *payload,
                    role=roles["tutor"],
                    educational_organization=organizations[idx % len(organizations)],
                )
            )

        student_roles = [roles["student"]]
        for idx, payload in enumerate(students_data):
            users["students"].append(
                self._get_or_create_user(
                    *payload,
                    role=student_roles[idx % len(student_roles)],
                    educational_organization=organizations[idx % len(organizations)],
                )
            )

        return users

    def _seed_conferences(self, organizers: list[User]) -> dict[str, Conference]:
        today = timezone.now().date()
        conference_specs = {
            "science_days": {
                "title": "Межвузовские дни науки 2026",
                "description": "Весенняя сессия научно-исследовательских и проектных работ.",
                "start_date": today + timedelta(days=20),
                "end_date": today + timedelta(days=23),
                "location": "Москва, РГСУ",
                "format": "hybrid",
                "is_online": True,
                "winners_count": 1,
                "prizes_count": 2,
            },
            "online_research": {
                "title": "Онлайн-конференция исследователей 2026",
                "description": "Заочный этап с видео-защитой проектов и экспертизой материалов.",
                "start_date": today + timedelta(days=35),
                "end_date": today + timedelta(days=37),
                "location": "Онлайн",
                "format": "online",
                "is_online": True,
                "winners_count": 1,
                "prizes_count": 2,
            },
            "engineering_session": {
                "title": "Очная инженерная сессия 2026",
                "description": "Очные защиты инженерных разработок в аудиториях и лабораториях.",
                "start_date": today + timedelta(days=50),
                "end_date": today + timedelta(days=52),
                "location": "Москва, МГТУ",
                "format": "offline",
                "is_online": False,
                "winners_count": 1,
                "prizes_count": 2,
            },
        }

        conferences: dict[str, Conference] = {}
        for key, payload in conference_specs.items():
            conference, _ = Conference.objects.get_or_create(
                title=payload["title"],
                defaults=payload,
            )
            updates = []
            for field, value in payload.items():
                if getattr(conference, field) != value:
                    setattr(conference, field, value)
                    updates.append(field)
            if updates:
                conference.save(update_fields=updates)
            conference.organizers.set(organizers)
            conferences[key] = conference
        return conferences

    def _seed_sections(
        self,
        conferences: dict[str, Conference],
        age_categories: dict[str, AgeCategory],
    ) -> dict[str, list[Section]]:
        section_specs = {
            "science_days": [
                ("Цифровые образовательные сервисы", "school"),
                ("Инженерные прототипы", "college"),
                ("Экологические решения", "school"),
                ("Социальные практики", "young"),
            ],
            "online_research": [
                ("Аналитика данных и ИИ", "young"),
                ("Веб-платформы и мобильные сервисы", "college"),
                ("Био- и медтех исследования", "college"),
            ],
            "engineering_session": [
                ("Робототехника", "college"),
                ("Автоматизация и IoT", "young"),
                ("Энергетические системы", "college"),
                ("Промышленный дизайн", "school"),
            ],
        }

        sections: dict[str, list[Section]] = {}
        for conference_key, rows in section_specs.items():
            conference = conferences[conference_key]
            sections[conference_key] = []
            for name, category_key in rows:
                section, _ = Section.objects.get_or_create(
                    name=name,
                    conference=conference,
                    category=age_categories[category_key],
                )
                sections[conference_key].append(section)
        return sections

    def _seed_criteria(self, conferences: dict[str, Conference]) -> dict[tuple[int, str], list[EvaluationCriterion]]:
        criteria_titles = {
            "online": [
                "Актуальность темы",
                "Логика исследования",
                "Качество прикладных материалов",
            ],
            "offline": [
                "Качество очной защиты",
                "Ответы на вопросы экспертов",
                "Практическая значимость",
            ],
        }

        criteria: dict[tuple[int, str], list[EvaluationCriterion]] = {}
        for conference in conferences.values():
            for stage in ("online", "offline"):
                key = (conference.id, stage)
                criteria[key] = []
                for title in criteria_titles[stage]:
                    criterion, _ = EvaluationCriterion.objects.get_or_create(
                        conference=conference,
                        stage=stage,
                        name=title,
                        defaults={"max_score": 10},
                    )
                    criteria[key].append(criterion)
        return criteria

    def _seed_projects(
        self,
        users: dict[str, list[User]],
        sections: dict[str, list[Section]],
        statuses: dict[str, ProjectStatus],
        stages: dict[str, ParticipationStage],
        presentations: dict[str, PresentationType],
    ) -> list[Project]:
        templates = [
            "Система мониторинга качества воздуха в учебных аудиториях",
            "Мобильный ассистент для планирования учебного проекта",
            "Платформа наставничества для школьных исследовательских команд",
            "Интерактивный музейный гид с AR-маршрутами",
            "Интеллектуальный контроль энергопотребления кампуса",
            "Автоматизированная теплица для школьных лабораторий",
            "Комплекс ранней профориентации на основе навыков",
            "Робот-ассистент для лабораторных измерений",
            "Сервис адаптивного расписания внеурочной деятельности",
            "Система анализа данных школьного экологического мониторинга",
            "Прототип умной парковки для вузовского кампуса",
            "Конструктор цифровых тренажеров по инженерной графике",
            "Инструмент проверки доступности городской среды",
            "Платформа сетевого взаимодействия студенческих команд",
            "Система прогнозирования посещаемости образовательных событий",
            "Голосовой помощник для навигации в учебном корпусе",
            "Умный стенд для демонстрации инженерных прототипов",
            "Сервис формирования исследовательских гипотез",
            "Цифровой архив проектных работ с экспертными рецензиями",
            "Дашборд для сопровождения индивидуальных траекторий",
            "Лабораторный комплект IoT-датчиков для школьников",
            "Гибридная площадка для проведения очных и онлайн-защит",
            "Система предупреждения о рисках срыва проектного графика",
            "Платформа межвузовских кейс-чемпионатов",
            "Алгоритм распределения экспертов по секциям",
            "Сервис подготовки презентаций по шаблонам конференции",
            "Модуль проверки полноты конкурсной заявки",
            "Цифровой помощник координатора конференции",
            "Система оценивания докладов по прозрачным критериям",
            "Инструмент командной доработки проекта после рецензии",
            "Тренажер публичного выступления для школьных конференций",
            "Панель мониторинга статусов проектов для организатора",
            "Платформа обмена методиками проектной деятельности",
            "Сервис обратной связи между экспертами и участниками",
            "Интерактивная карта площадок очной защиты",
            "Модуль публикации итогов и формирования протоколов",
        ]

        conference_keys = list(sections.keys())
        students = users["students"]
        tutors = users["tutors"]
        status_cycle = [
            statuses["new"],
            statuses["in_review"],
            statuses["rework"],
            statuses["approved"],
            statuses["approved"],
            statuses["final"],
        ]

        projects: list[Project] = []
        for idx, title in enumerate(templates):
            conference_key = conference_keys[idx % len(conference_keys)]
            section_list = sections[conference_key]
            section = section_list[idx % len(section_list)]
            leader = students[idx % len(students)]
            tutor = tutors[idx % len(tutors)] if idx % 5 != 0 else None
            status = status_cycle[idx % len(status_cycle)]
            stage = stages["final"] if status.code == "final" else stages["qualifying"]
            presentation_type = self._select_presentation_type(
                section.conference.format,
                idx,
                presentations,
            )

            project, _ = Project.objects.get_or_create(
                title=title,
                section=section,
                leader=leader,
                defaults={
                    "description": (
                        f"Проект направлен на решение практической задачи в секции «{section.name}». "
                        "Содержит методику, прототип и план внедрения."
                    ),
                    "additional_info": "Демо-материалы доступны по запросу оргкомитета.",
                    "tutor": tutor,
                    "status": status,
                    "stage": stage,
                    "presentation_type": presentation_type,
                },
            )

            updates = []
            if project.tutor_id != (tutor.id if tutor else None):
                project.tutor = tutor
                updates.append("tutor")
            if project.status_id != status.id:
                project.status = status
                updates.append("status")
            if project.stage_id != stage.id:
                project.stage = stage
                updates.append("stage")
            if project.presentation_type_id != presentation_type.id:
                project.presentation_type = presentation_type
                updates.append("presentation_type")
            if updates:
                project.save(update_fields=updates)

            member_candidates = [user for user in students if user.id != leader.id]
            members = [
                member_candidates[(idx + 1) % len(member_candidates)],
            ]
            if idx % 3 == 0:
                members.append(member_candidates[(idx + 2) % len(member_candidates)])
            project.members.set(members)

            projects.append(project)

        return projects

    def _seed_comments(
        self,
        projects: list[Project],
        experts: list[User],
        statuses: dict[str, ProjectStatus],
    ):
        for idx, project in enumerate(projects):
            expert = experts[idx % len(experts)]
            code = (project.status.code or "").lower()

            if code == statuses["rework"].code:
                Comment.objects.get_or_create(
                    project=project,
                    author=expert,
                    text="Требуется уточнить методику и добавить подтверждение расчётов в приложении.",
                )
                Comment.objects.get_or_create(
                    project=project,
                    author=project.leader,
                    text="Исправления вносим, обновленную версию загрузим до конца недели.",
                )
            elif code == statuses["in_review"].code:
                Comment.objects.get_or_create(
                    project=project,
                    author=expert,
                    text="Работа принята на рецензию, ожидайте итоговый комментарий эксперта.",
                )
            elif code in {statuses["approved"].code, statuses["final"].code}:
                Comment.objects.get_or_create(
                    project=project,
                    author=expert,
                    text="Материалы подготовлены качественно, можно допускать к следующему этапу.",
                )

    def _seed_scores(
        self,
        projects: list[Project],
        criteria: dict[tuple[int, str], list[EvaluationCriterion]],
        experts: list[User],
        statuses: dict[str, ProjectStatus],
        randomizer: Random,
    ):
        for idx, project in enumerate(projects):
            code = (project.status.code or "").lower()
            if code not in {statuses["approved"].code, statuses["final"].code}:
                continue

            mode = "online" if project.presentation_type.code == "online" else "offline"
            key = (project.section.conference_id, mode)
            current_criteria = criteria.get(key, [])
            if not current_criteria:
                continue

            for c_idx, criterion in enumerate(current_criteria[:2]):
                evaluator = experts[(idx + c_idx) % len(experts)]
                score_value = randomizer.randint(7, criterion.max_score)
                ProjectScore.objects.update_or_create(
                    project=project,
                    criterion=criterion,
                    evaluator=evaluator,
                    defaults={"score": score_value},
                )

    def _seed_assignments(
        self,
        conferences: dict[str, Conference],
        projects: list[Project],
        experts: list[User],
    ):
        for conference in conferences.values():
            conference_projects = [
                project for project in projects if project.section.conference_id == conference.id
            ]
            online_projects = [
                project for project in conference_projects if project.presentation_type.code == "online"
            ]
            offline_projects = [
                project for project in conference_projects if project.presentation_type.code != "online"
            ]
            self._seed_assignments_stage(conference, "online", experts, online_projects)
            self._seed_assignments_stage(conference, "offline", experts, offline_projects)

    def _seed_assignments_stage(
        self,
        conference: Conference,
        stage: str,
        experts: list[User],
        projects: list[Project],
    ):
        if not projects or not experts:
            return

        per_expert = max(1, ceil(len(projects) / len(experts)))
        assignments: dict[int, ExpertAssignment] = {}

        with transaction.atomic():
            for expert in experts:
                assignment, _ = ExpertAssignment.objects.get_or_create(
                    conference=conference,
                    expert=expert,
                    stage=stage,
                    defaults={"max_projects": per_expert},
                )
                if assignment.max_projects != per_expert:
                    assignment.max_projects = per_expert
                    assignment.save(update_fields=["max_projects"])
                assignments[expert.id] = assignment

            for index, project in enumerate(projects):
                expert = experts[index % len(experts)]
                ExpertAssignmentItem.objects.get_or_create(
                    assignment=assignments[expert.id],
                    project=project,
                )

    def _select_presentation_type(
        self,
        conference_format: str,
        index: int,
        presentations: dict[str, PresentationType],
    ) -> PresentationType:
        if conference_format == "online":
            return presentations["online"]
        if conference_format == "offline":
            return presentations["oral"] if index % 2 == 0 else presentations["poster"]
        if index % 3 == 0:
            return presentations["online"]
        return presentations["oral"] if index % 2 == 0 else presentations["poster"]

    def _get_or_create_presentation_type(self, name: str, code: str, place: Place) -> PresentationType:
        presentation, created = PresentationType.objects.get_or_create(
            code=code,
            defaults={"name": name, "place": place},
        )
        if created:
            return presentation

        updates = []
        if presentation.name != name:
            presentation.name = name
            updates.append("name")
        if presentation.place_id != place.id:
            presentation.place = place
            updates.append("place")
        if updates:
            presentation.save(update_fields=updates)
        return presentation

    def _get_or_create_user(
        self,
        email: str,
        first_name: str,
        last_name: str,
        middle_name: str,
        role: Role,
        educational_organization: EducationalOrganization,
    ) -> User:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "middle_name": middle_name,
                "role": role,
                "educational_organization": educational_organization,
                "city": educational_organization.city,
            },
        )

        updates = []
        if user.first_name != first_name:
            user.first_name = first_name
            updates.append("first_name")
        if user.last_name != last_name:
            user.last_name = last_name
            updates.append("last_name")
        if user.middle_name != middle_name:
            user.middle_name = middle_name
            updates.append("middle_name")
        if user.role_id != role.id:
            user.role = role
            updates.append("role")
        if user.educational_organization_id != educational_organization.id:
            user.educational_organization = educational_organization
            updates.append("educational_organization")
        if user.city != educational_organization.city:
            user.city = educational_organization.city
            updates.append("city")

        if created:
            user.set_password(self.DEFAULT_PASSWORD)
            updates.append("password")

        if updates:
            user.save(update_fields=updates)

        return user

    def _recalculate_results(self, conference: Conference):
        calculate_results_for_conference(conference)

    def _print_tokens(self, users: dict[str, list[User]]):
        for label, user in (
            ("Organizer", users["organizers"][0]),
            ("Expert", users["experts"][0]),
            ("Tutor", users["tutors"][0]),
            ("Student", users["students"][0]),
        ):
            token, _ = Token.objects.get_or_create(user=user)
            self.stdout.write(self.style.SUCCESS(f"{label} token ({user.email}): {token.key}"))
