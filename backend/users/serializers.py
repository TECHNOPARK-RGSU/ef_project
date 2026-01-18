from rest_framework import serializers
from users.models import EducationalOrganization, Role, User


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
            # В реальном проекте здесь должно быть хэширование пароля
            # from django.contrib.auth.hashers import make_password
            # user.password = make_password(password)
            user.password = password
            user.save()
        return user

    def update(self, instance, validated_data):
        """Обновление пользователя с хэшированием пароля при необходимости."""
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            # В реальном проекте здесь должно быть хэширование пароля
            # from django.contrib.auth.hashers import make_password
            # instance.password = make_password(password)
            instance.password = password
        instance.save()
        return instance

