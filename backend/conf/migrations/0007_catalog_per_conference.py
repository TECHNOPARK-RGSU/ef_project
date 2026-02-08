# Generated manually for catalog_per_conference

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("conf", "0006_conference_expert"),
    ]

    operations = [
        migrations.AddField(
            model_name="agecategory",
            name="conference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="age_categories",
                to="conf.conference",
                verbose_name="Конференция",
            ),
        ),
        migrations.AlterField(
            model_name="agecategory",
            name="name",
            field=models.CharField(max_length=100, verbose_name="Название категории"),
        ),
        migrations.AddConstraint(
            model_name="agecategory",
            constraint=models.UniqueConstraint(
                fields=("conference", "name"),
                name="unique_agecategory_conf_name",
            ),
        ),
        migrations.AddField(
            model_name="projectstatus",
            name="conference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="project_statuses",
                to="conf.conference",
                verbose_name="Конференция",
            ),
        ),
        migrations.AlterField(
            model_name="projectstatus",
            name="name",
            field=models.CharField(max_length=100, verbose_name="Название статуса"),
        ),
        migrations.AlterField(
            model_name="projectstatus",
            name="code",
            field=models.CharField(max_length=50, verbose_name="Код статуса"),
        ),
        migrations.AddConstraint(
            model_name="projectstatus",
            constraint=models.UniqueConstraint(
                fields=("conference", "code"),
                name="unique_projectstatus_conf_code",
            ),
        ),
        migrations.AddField(
            model_name="participationstage",
            name="conference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="participation_stages",
                to="conf.conference",
                verbose_name="Конференция",
            ),
        ),
        migrations.AlterField(
            model_name="participationstage",
            name="name",
            field=models.CharField(max_length=100, verbose_name="Название этапа"),
        ),
        migrations.AlterField(
            model_name="participationstage",
            name="code",
            field=models.CharField(max_length=50, verbose_name="Код этапа"),
        ),
        migrations.AddConstraint(
            model_name="participationstage",
            constraint=models.UniqueConstraint(
                fields=("conference", "code"),
                name="unique_participationstage_conf_code",
            ),
        ),
        migrations.AddField(
            model_name="place",
            name="conference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="places",
                to="conf.conference",
                verbose_name="Конференция",
            ),
        ),
        migrations.AlterField(
            model_name="place",
            name="address",
            field=models.CharField(blank=True, max_length=300, verbose_name="Адрес"),
        ),
        migrations.AddField(
            model_name="presentationtype",
            name="conference",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="presentation_types",
                to="conf.conference",
                verbose_name="Конференция",
            ),
        ),
        migrations.AlterField(
            model_name="presentationtype",
            name="name",
            field=models.CharField(max_length=100, verbose_name="Тип представления"),
        ),
        migrations.AlterField(
            model_name="presentationtype",
            name="code",
            field=models.CharField(max_length=50, verbose_name="Код типа"),
        ),
        migrations.AddConstraint(
            model_name="presentationtype",
            constraint=models.UniqueConstraint(
                fields=("conference", "code"),
                name="unique_presentationtype_conf_code",
            ),
        ),
    ]
