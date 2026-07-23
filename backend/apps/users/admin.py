from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Permission


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "role", "branch", "is_active", "deactivated"]
    list_filter = ["role", "branch", "is_active", "deactivated"]


admin.site.register(Role)
admin.site.register(Permission)
