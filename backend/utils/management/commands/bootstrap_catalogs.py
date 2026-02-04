from django.core.management.base import BaseCommand

from conf.models import (
    AgeCategory,
    ParticipationStage,
    Place,
    PresentationType,
    ProjectStatus,
)
from users.models import EducationalOrganization, Role


class Command(BaseCommand):
    help = "Bootstrap minimal catalogs for first launch."

    def handle(self, *args, **options):
        self._roles()
        self._organizations()
        self._ages()
        self._statuses()
        self._stages()
        self._places_and_presentations()
        self.stdout.write(self.style.SUCCESS("Catalogs bootstrapped."))

    def _roles(self):
        roles = [
            ("Организатор", "organizer"),
            ("Эксперт", "expert"),
            ("Наставник", "tutor"),
            ("Ученик", "student"),
            ("Ученик 2", "student2"),
            ("Ученик 3", "student3"),
        ]
        for name, code in roles:
            Role.objects.get_or_create(name=name, code=code)

    def _organizations(self):
        EducationalOrganization.objects.get_or_create(
            name="РГСУ",
            city="Москва",
            defaults={"short_name": "РГСУ", "address": "ул. Вильгельма Пика, 4"},
        )

    def _ages(self):
        items = [
            ("14-18 лет", 14, 18),
            ("16-22 года", 16, 22),
            ("18-25 лет", 18, 25),
        ]
        for name, min_age, max_age in items:
            AgeCategory.objects.get_or_create(
                name=name,
                defaults={"min_age": min_age, "max_age": max_age},
            )

    def _statuses(self):
        items = [
            ("Новый", "new"),
            ("На рецензии", "in_review"),
            ("На доработку", "rework"),
            ("Согласован", "approved"),
            ("В финал", "final"),
        ]
        for name, code in items:
            ProjectStatus.objects.get_or_create(name=name, code=code)

    def _stages(self):
        items = [
            ("Отборочный", "qualifying"),
            ("Финал", "final"),
        ]
        for name, code in items:
            ParticipationStage.objects.get_or_create(name=name, code=code)

    def _places_and_presentations(self):
        main_place, _ = Place.objects.get_or_create(
            name="Главный корпус",
            address="Москва, ул. Вильгельма Пика, 4",
        )
        alt_place, _ = Place.objects.get_or_create(
            name="Корпус Б",
            address="Москва, 2-я Бауманская, 5",
        )
        self._presentation("Очный доклад", "oral", main_place)
        self._presentation("Стендовый", "poster", alt_place)
        self._presentation("Онлайн-доклад", "online", main_place)

    def _presentation(self, name: str, code: str, place: Place):
        pres, created = PresentationType.objects.get_or_create(
            code=code,
            defaults={"name": name, "place": place},
        )
        if created:
            return
        updates = []
        if pres.name != name:
            pres.name = name
            updates.append("name")
        if pres.place_id != place.id:
            pres.place = place
            updates.append("place")
        if updates:
            pres.save(update_fields=updates)
