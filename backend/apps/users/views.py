from rest_framework import viewsets, permissions
from .models import User, Role, Permission
from .serializers import UserSerializer, RoleSerializer, PermissionSerializer
from .permissions import IsSuperAdmin, IsAdministratorOrAbove


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("role", "branch").all()
    serializer_class = UserSerializer
    permission_classes = [IsAdministratorOrAbove]
    filterset_fields = ["role", "branch", "is_active", "deactivated"]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["created_at", "last_login"]

    def get_permissions(self):
        if self.action in ("destroy",):
            return [IsSuperAdmin()]
        return super().get_permissions()


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsSuperAdmin]


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.prefetch_related("roles").all()
    serializer_class = PermissionSerializer
    permission_classes = [IsSuperAdmin]
