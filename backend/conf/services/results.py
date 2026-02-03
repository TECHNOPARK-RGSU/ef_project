from decimal import Decimal

from django.db import transaction
from django.db.models import Avg

from conf.models import (
    Conference,
    EvaluationCriterion,
    Project,
    ProjectResult,
    ProjectScore,
    Section,
)


def calculate_results_for_conference(conference: Conference) -> int:
    criteria = EvaluationCriterion.objects.filter(conference=conference)
    projects = Project.objects.filter(
        section__conference=conference,
        section__isnull=False,
        is_archived=False,
    )

    with transaction.atomic():
        ProjectResult.objects.filter(conference=conference).delete()

        results = []
        for project in projects:
            online_sum = Decimal("0")
            offline_sum = Decimal("0")
            for criterion in criteria:
                avg_score = (
                    ProjectScore.objects.filter(project=project, criterion=criterion)
                    .aggregate(avg=Avg("score"))
                    .get("avg")
                ) or Decimal("0")
                if criterion.stage == "online":
                    online_sum += Decimal(avg_score)
                else:
                    offline_sum += Decimal(avg_score)

            results.append(
                ProjectResult(
                    conference=conference,
                    section=project.section,
                    project=project,
                    online_score=online_sum,
                    offline_score=offline_sum,
                    total_score=online_sum + offline_sum,
                )
            )

        ProjectResult.objects.bulk_create(results)
        _apply_rankings(conference)

        if conference.results_published:
            conference.results_published = False
            conference.save(update_fields=["results_published"])

    return projects.count()


def _apply_rankings(conference: Conference) -> None:
    winners_count = conference.winners_count or 0
    prizes_count = conference.prizes_count or 0

    for section in Section.objects.filter(conference=conference):
        section_results = list(
            ProjectResult.objects.filter(section=section).order_by(
                "-total_score", "-offline_score", "-online_score", "project__id"
            )
        )
        rank = 0
        last_key = None
        for result in section_results:
            score_key = (result.total_score, result.offline_score, result.online_score)
            if score_key != last_key:
                rank += 1
                last_key = score_key
            result.rank = rank
            result.is_winner = rank <= winners_count
            result.is_prize = rank > winners_count and rank <= (
                winners_count + prizes_count
            )

        ProjectResult.objects.bulk_update(
            section_results, ["rank", "is_winner", "is_prize"]
        )
