from rest_framework import serializers
from .models import Trailer, TrailerImage, TrailerDocument, MaintenanceRecord, DamageReport


class TrailerImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrailerImage
        fields = "__all__"


class TrailerDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrailerDocument
        fields = "__all__"


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceRecord
        fields = "__all__"


class DamageReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DamageReport
        fields = "__all__"
        read_only_fields = ["reported_by"]


class TrailerSerializer(serializers.ModelSerializer):
    images = TrailerImageSerializer(many=True, read_only=True)
    documents = TrailerDocumentSerializer(many=True, read_only=True)
    maintenance_records = MaintenanceRecordSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    trailer_type_display = serializers.CharField(source="get_trailer_type_display", read_only=True)

    class Meta:
        model = Trailer
        fields = "__all__"
        read_only_fields = ["qr_code_uid", "created_by", "created_at", "updated_at"]

    def validate_trailer_type(self, value):
        mapping = {
            "flatbed": "flatbed",
            "low loader": "low_loader",
            "fuel tanker": "fuel_tanker",
            "container trailer": "container",
            "side tipper": "side_tipper",
            "box trailer": "box",
            "curtain trailer": "curtain",
            "refrigerated trailer": "refrigerated",
            "skeletal trailer": "skeletal",
            "extendable trailer": "extendable",
            "livestock trailer": "livestock",
            "other": "other",
        }
        return mapping.get(value.strip().lower(), value.strip().lower().replace(" ", "_"))

    def validate_status(self, value):
        mapping = {
            "available": "available",
            "reserved": "reserved",
            "rented": "rented",
            "under maintenance": "under_maintenance",
            "damaged": "damaged",
            "retired": "retired",
        }
        return mapping.get(value.strip().lower(), value.strip().lower().replace(" ", "_"))


class TrailerListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for table views."""
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    trailer_type_display = serializers.CharField(source="get_trailer_type_display", read_only=True)

    class Meta:
        model = Trailer
        fields = [
            "id", "trailer_number", "registration_number", "trailer_type", "trailer_type_display",
            "status", "status_display", "yard_location", "next_inspection_date", "insurance_expiry",
        ]
