from rest_framework.permissions import BasePermission
from .models import Role


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and
            (user.is_superuser or (user.role and user.role.name == Role.SUPER_ADMIN))
        )


class IsAdministratorOrAbove(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser or (user.role and user.role.name in (Role.SUPER_ADMIN, Role.ADMINISTRATOR)):
            return True
        return False


class IsAccountant(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role and
            user.role.name in (Role.SUPER_ADMIN, Role.ACCOUNTANT)
        )


class IsOperationsOfficer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role and
            user.role.name in (Role.SUPER_ADMIN, Role.OPERATIONS_OFFICER)
        )


class HasModulePermission(BasePermission):
    """Generic permission-codename check, e.g. HasModulePermission('manage_trailers')."""

    def __init__(self, codename: str):
        self.codename = codename

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_permission(self.codename))
