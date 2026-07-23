from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.Model):
    SUPER_ADMIN = "super_admin"
    ADMINISTRATOR = "administrator"
    ACCOUNTANT = "accountant"
    OPERATIONS_OFFICER = "operations_officer"

    ROLE_CHOICES = [
        (SUPER_ADMIN, "Super Admin"),
        (ADMINISTRATOR, "Administrator"),
        (ACCOUNTANT, "Accountant"),
        (OPERATIONS_OFFICER, "Operations Officer"),
    ]

    name = models.CharField(max_length=30, choices=ROLE_CHOICES, unique=True)
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.get_name_display()


class Permission(models.Model):
    """Fine-grained permission flags that can be attached to a role, e.g.
    'manage_trailers', 'create_quotations', 'generate_invoices'."""
    codename = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=150)
    roles = models.ManyToManyField(Role, related_name="permissions", blank=True)

    def __str__(self):
        return self.label


class User(AbstractUser):
    role = models.ForeignKey(Role, null=True, on_delete=models.SET_NULL, related_name="users")
    phone = models.CharField(max_length=20, blank=True)
    branch = models.ForeignKey(
        "core.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="staff"
    )
    two_factor_enabled = models.BooleanField(default=False)
    is_active_session = models.BooleanField(default=False)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    deactivated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def has_permission(self, codename: str) -> bool:
        if self.is_superuser or (self.role and self.role.name == Role.SUPER_ADMIN):
            return True
        if not self.role:
            return False
        return self.role.permissions.filter(codename=codename).exists()

    def __str__(self):
        return self.get_full_name() or self.username
