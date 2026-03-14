from rest_framework import serializers
from users.models import EducationalOrganization, Role, StudentTeam, User
from utils.roles import is_student_role, normalize_role_code


class EducationalOrganizationSerializer(serializers.ModelSerializer):
    """Сериализатор для образовательной организации."""

    class Meta:
        model = EducationalOrganization
        fields = [
            "id",
            "name",
            "short_name",
            "city",
            "address",
            "website",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RoleSerializer(serializers.ModelSerializer):
    """Сериализатор для роли."""

    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "code",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для пользователя."""

    educational_organization = EducationalOrganizationSerializer(read_only=True)
    educational_organization_id = serializers.PrimaryKeyRelatedField(
        queryset=EducationalOrganization.objects.all(),
        source="educational_organization",
        write_only=True,
        required=False,
        allow_null=True,
    )
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        write_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "last_name",
            "first_name",
            "middle_name",
            "email",
            "password",
            "phone",
            "city",
            "date_of_birth",
            "educational_organization",
            "educational_organization_id",
            "role",
            "role_id",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def create(self, validated_data):
        """Хэширование пароля при создании пользователя."""
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user

    def update(self, instance, validated_data):
        """Обновление пользователя с хэшированием пароля при необходимости."""
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class StudentTeamSerializer(serializers.ModelSerializer):
    """Сериализатор команды учеников наставника."""

    tutor = UserSerializer(read_only=True)
    tutor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="tutor",
        write_only=True,
        required=False,
        allow_null=True,
    )
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="members",
        many=True,
        write_only=True,
        required=False,
    )
    member_emails = serializers.ListField(
        child=serializers.EmailField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = StudentTeam
        fields = [
            "id",
            "name",
            "tutor",
            "tutor_id",
            "members",
            "member_ids",
            "member_emails",
            "created_at",
            "updated_at",
            "is_archived",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["tutor_id"].required = False

    def validate(self, attrs):
        request = self.context.get("request")
        request_user = getattr(request, "user", None)
        request_role_code = normalize_role_code(getattr(getattr(request_user, "role", None), "code", ""))

        tutor = attrs.get("tutor", getattr(self.instance, "tutor", None))
        if tutor is None and request_role_code == "tutor":
            attrs["tutor"] = request_user
            tutor = request_user

        if tutor is None:
            raise serializers.ValidationError({"tutor_id": "Укажите наставника команды."})

        tutor_role_code = normalize_role_code(getattr(getattr(tutor, "role", None), "code", ""))
        if tutor_role_code != "tutor":
            raise serializers.ValidationError({"tutor_id": "Команда может быть создана только для наставника."})

        if request_role_code == "tutor" and request_user and tutor.id != request_user.id:
            raise serializers.ValidationError({"tutor_id": "Наставник может управлять только своими командами."})

        name = (attrs.get("name", getattr(self.instance, "name", "")) or "").strip()
        if not name:
            raise serializers.ValidationError({"name": "Укажите название команды."})
        existing = StudentTeam.objects.filter(
            tutor=tutor,
            name=name,
            is_archived=False,
        )
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError({"name": "У наставника уже есть команда с таким названием."})

        member_emails = self.initial_data.get("member_emails")
        resolved_members = None
        if member_emails is not None:
            if not isinstance(member_emails, list):
                raise serializers.ValidationError({"member_emails": "Ожидается список email."})
            normalized_emails = sorted(
                {
                    str(email).strip().lower()
                    for email in member_emails
                    if str(email).strip()
                }
            )
            members = list(
                User.objects.filter(
                    email__in=normalized_emails,
                    is_archived=False,
                ).select_related("role")
            )
            found_emails = {member.email.lower() for member in members if member.email}
            missing_emails = [email for email in normalized_emails if email not in found_emails]
            if missing_emails:
                raise serializers.ValidationError(
                    {"member_emails": f"Не найдены пользователи: {', '.join(missing_emails)}."}
                )
            resolved_members = members
        elif "members" in attrs:
            resolved_members = list(attrs["members"])
        elif self.instance is not None:
            resolved_members = list(self.instance.members.select_related("role").all())

        if not resolved_members:
            raise serializers.ValidationError(
                {"member_emails": "Добавьте хотя бы одного ученика в команду."}
            )

        if len(resolved_members) > 3:
            raise serializers.ValidationError(
                {"member_emails": "В одной команде может быть не более 3 учеников."}
            )

        invalid_members = [
            member.email or f"id={member.id}"
            for member in resolved_members
            if not is_student_role(getattr(getattr(member, "role", None), "code", ""))
        ]
        if invalid_members:
            raise serializers.ValidationError(
                {"member_emails": f"В команду можно добавлять только учеников: {', '.join(invalid_members)}."}
            )

        attrs["resolved_members"] = resolved_members
        return attrs

    def create(self, validated_data):
        members = validated_data.pop("resolved_members", [])
        validated_data.pop("members", None)
        validated_data.pop("member_emails", None)
        team = StudentTeam.objects.create(**validated_data)
        team.members.set(members)
        return team

    def update(self, instance, validated_data):
        members = validated_data.pop("resolved_members", None)
        validated_data.pop("members", None)
        validated_data.pop("member_emails", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if members is not None:
            instance.members.set(members)
        return instance


REGISTRATION_ALLOWED_ROLES = ("student", "tutor", "expert")


class RegistrationSerializer(serializers.Serializer):
    """Регистрация пользователя с выбором роли: ученик, наставник, эксперт."""

    last_name = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    role_code = serializers.ChoiceField(
        choices=[(c, c) for c in REGISTRATION_ALLOWED_ROLES],
        default="student",
        required=False,
    )
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    city = serializers.CharField(max_length=255, required=False, allow_blank=True)
    educational_organization_id = serializers.PrimaryKeyRelatedField(
        queryset=EducationalOrganization.objects.all(),
        source="educational_organization",
        required=False,
        allow_null=True,
    )

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже существует.")
        return value

    def create(self, validated_data):
        role_code = validated_data.pop("role_code", "student")
        role = Role.objects.filter(code__iexact=role_code).first()
        if not role or role_code.lower() not in REGISTRATION_ALLOWED_ROLES:
            raise serializers.ValidationError("Недопустимая роль для регистрации.")
        password = validated_data.pop("password")
        user = User.objects.create(role=role, **validated_data)
        user.set_password(password)
        user.save(update_fields=["password"])
        return user
