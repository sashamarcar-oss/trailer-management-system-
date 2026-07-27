from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Role, Permission


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "description"]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "codename", "label"]


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "phone",
            "role", "role_name", "branch", "is_active", "deactivated",
            "two_factor_enabled", "is_superuser", "last_login", "created_at",
        ]
        read_only_fields = ["id", "last_login", "created_at"]


class AdminUserSerializer(serializers.ModelSerializer):
    """Safe in-app administrator provisioning; role and access are fixed server-side."""

    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True, required=False)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "first_name", "last_name", "email", "phone", "is_active", "deactivated",
            "role_name", "created_at", "password", "confirm_password",
        ]
        read_only_fields = ["id", "role_name", "created_at"]

    def validate_email(self, value):
        queryset = User.objects.filter(email__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower().strip()

    def validate(self, attrs):
        password = attrs.get("password")
        confirmation = attrs.pop("confirm_password", None)
        if self.instance is None and not password:
            raise serializers.ValidationError({"password": "A password is required for a new administrator."})
        if password and password != confirmation:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        role, _ = Role.objects.get_or_create(name=Role.ADMINISTRATOR, defaults={"description": "Full TrailerOps dashboard administrator"})
        email = validated_data["email"]
        base_username = email.split("@", 1)[0]
        username = base_username
        suffix = 2
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username}{suffix}"
            suffix += 1
        user = User(username=username, role=role, is_active=True, deactivated=False, **validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        # Deactivation is intentionally handled by the view so it cannot be
        # hidden inside a general profile edit.
        validated_data.pop("is_active", None)
        validated_data.pop("deactivated", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        login_value = attrs["email"].strip()
        password = attrs["password"]

        user = authenticate(username=login_value, password=password)
        if not user:
            user_obj = User.objects.filter(email__iexact=login_value).first()
            if user_obj:
                user = authenticate(username=user_obj.username, password=password)

        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if user.deactivated:
            raise serializers.ValidationError("This account has been deactivated.")
        attrs["user"] = user
        return attrs

    def create_tokens(self, user):
        refresh = RefreshToken.for_user(user)
        return {"access": str(refresh.access_token), "refresh": str(refresh)}


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    uid = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
