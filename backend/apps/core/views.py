from rest_framework import viewsets, permissions
from .models import Branch, CompanySettings, AuditLog
from .serializers import BranchSerializer, CompanySettingsSerializer, AuditLogSerializer
from apps.users.permissions import IsSuperAdmin


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["is_active"]
    search_fields = ["name", "location"]


class CompanySettingsViewSet(viewsets.ModelViewSet):
    queryset = CompanySettings.objects.all()
    serializer_class = CompanySettingsSerializer
    permission_classes = [IsSuperAdmin]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["action", "model_name", "user"]
    ordering_fields = ["created_at"]


class RecentActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """Recent write events used by the dashboard notification centre."""
    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset()[:20]
