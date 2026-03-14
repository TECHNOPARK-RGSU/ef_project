from rest_framework import serializers
from users.models import EducationalOrganization, Role, StudentPeerLink, TutorStudentAccess, User


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
    allowed_student_ids = serializers.SerializerMethodField(read_only=True)
    scientific_supervisor_id = serializers.SerializerMethodField(read_only=True)
    peer_student_ids = serializers.SerializerMethodField(read_only=True)

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
            "allowed_student_ids",
            "scientific_supervisor_id",
            "peer_student_ids",
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

    def get_allowed_student_ids(self, obj: User) -> list[int]:
        role_code = (getattr(obj.role, "code", "") or "").lower()
        if role_code != "tutor":
            return []
        return list(
            TutorStudentAccess.objects.filter(tutor=obj, is_archived=False).values_list("student_id", flat=True)
        )

    def get_scientific_supervisor_id(self, obj: User) -> int | None:
        role_code = (getattr(obj.role, "code", "") or "").lower()
        if role_code not in {"student", "student2", "student3"}:
            return None
        return (
            TutorStudentAccess.objects.filter(student=obj, is_archived=False)
            .order_by("-updated_at", "-id")
            .values_list("tutor_id", flat=True)
            .first()
        )

    def get_peer_student_ids(self, obj: User) -> list[int]:
        role_code = (getattr(obj.role, "code", "") or "").lower()
        if role_code not in {"student", "student2", "student3"}:
            return []
        return list(
            StudentPeerLink.objects.filter(student=obj, is_archived=False).values_list("peer_id", flat=True)
        )


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
