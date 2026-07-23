from rest_framework import viewsets, permissions
from .models import Trailer, MaintenanceRecord, DamageReport
from .serializers import (
    TrailerSerializer, TrailerListSerializer, MaintenanceRecordSerializer, DamageReportSerializer,
)
from .filters import TrailerFilter
from apps.users.permissions import HasModulePermission


class TrailerViewSet(viewsets.ModelViewSet):
    queryset = Trailer.objects.select_related("branch").prefetch_related("images", "documents").all()
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = TrailerFilter
    search_fields = ["trailer_number", "registration_number", "vin"]
    ordering_fields = ["trailer_number", "next_inspection_date", "created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return TrailerListSerializer
        return TrailerSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("trailer").all()
    serializer_class = MaintenanceRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["trailer", "service_type"]
    ordering_fields = ["scheduled_date"]


class DamageReportViewSet(viewsets.ModelViewSet):
    queryset = DamageReport.objects.select_related("trailer", "rental").all()
    serializer_class = DamageReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["trailer", "stage"]

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)
