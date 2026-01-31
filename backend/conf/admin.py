from django.contrib import admin

from conf.models import (
    Conference,
    AgeCategory,
    Section,
    ProjectStatus,
    ParticipationStage,
    Place,
    PresentationType,
    Project,
    Comment,
    EvaluationCriterion,
    ProjectScore,
    ProjectResult,
    ExpertAssignment,
    ExpertAssignmentItem,
)

admin.site.register(Conference)
admin.site.register(AgeCategory)
admin.site.register(Section)
admin.site.register(ProjectStatus)
admin.site.register(ParticipationStage)
admin.site.register(Place)
admin.site.register(PresentationType)
admin.site.register(Project)
admin.site.register(Comment)
admin.site.register(EvaluationCriterion)
admin.site.register(ProjectScore)
admin.site.register(ProjectResult)
admin.site.register(ExpertAssignment)
admin.site.register(ExpertAssignmentItem)
