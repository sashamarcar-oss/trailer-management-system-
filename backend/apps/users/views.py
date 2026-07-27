from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .models import User, Role, Permission
from .serializers import UserSerializer, AdminUserSerializer, RoleSerializer, PermissionSerializer
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

    def _admin_users(self):
        return User.objects.select_related("role").filter(role__name=Role.ADMINISTRATOR).order_by("first_name", "last_name", "email")

    @action(detail=False, methods=["get", "post"], url_path="admin-users")
    def admin_users(self, request):
        if request.method == "GET":
            return Response(AdminUserSerializer(self._admin_users(), many=True).data)
        serializer = AdminUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(AdminUserSerializer(serializer.save()).data, status=201)

    @action(detail=True, methods=["patch"], url_path="admin-user")
    def admin_user(self, request, pk=None):
        admin = self._admin_users().filter(pk=pk).first()
        if not admin:
            raise ValidationError("Administrator account not found.")
        if "deactivated" in request.data:
            if admin.pk == request.user.pk:
                raise ValidationError("You cannot deactivate your own administrator account.")
            deactivated = bool(request.data["deactivated"])
            admin.deactivated = deactivated
            admin.is_active = not deactivated
            admin.save(update_fields=["deactivated", "is_active"])
            return Response(AdminUserSerializer(admin).data)
        serializer = AdminUserSerializer(admin, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(AdminUserSerializer(serializer.save()).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsSuperAdmin]


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.prefetch_related("roles").all()
    serializer_class = PermissionSerializer
    permission_classes = [IsSuperAdmin]
