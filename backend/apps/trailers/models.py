import uuid
from django.db import models


class Trailer(models.Model):
    TYPE_CHOICES = [
        ("flatbed", "Flatbed"), ("low_loader", "Low Loader"), ("fuel_tanker", "Fuel Tanker"),
        ("container", "Container Trailer"), ("side_tipper", "Side Tipper"), ("box", "Box Trailer"),
        ("curtain", "Curtain Trailer"), ("refrigerated", "Refrigerated Trailer"),
        ("skeletal", "Skeletal Trailer"), ("extendable", "Extendable Trailer"),
        ("livestock", "Livestock Trailer"), ("other", "Other"),
    ]
    STATUS_CHOICES = [
        ("available", "Available"), ("reserved", "Reserved"), ("rented", "Rented"),
        ("under_maintenance", "Under Maintenance"), ("damaged", "Damaged"), ("retired", "Retired"),
    ]

    trailer_number = models.CharField(max_length=30, unique=True)
    registration_number = models.CharField(max_length=30, unique=True)
    vin = models.CharField("VIN / chassis number", max_length=60, unique=True)
    trailer_type = models.CharField(max_length=30, choices=TYPE_CHOICES)

    brand = models.CharField(max_length=100, blank=True)
    manufacturer = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    capacity = models.CharField(max_length=50, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    dimensions = models.CharField(max_length=100, blank=True)

    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    current_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="available")

    branch = models.ForeignKey("core.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="trailers")
    yard_location = models.CharField(max_length=150, blank=True)
    gps_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    gps_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    license_expiry = models.DateField(null=True, blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)
    next_inspection_date = models.DateField(null=True, blank=True)

    qr_code_uid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    created_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["trailer_number"]

    def __str__(self):
        return self.trailer_number


class TrailerImage(models.Model):
    trailer = models.ForeignKey(Trailer, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="trailers/images/")
    caption = models.CharField(max_length=150, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class TrailerDocument(models.Model):
    DOC_TYPES = [
        ("insurance", "Insurance certificate"), ("logbook", "Logbook"),
        ("inspection_report", "Inspection report"), ("other", "Other"),
    ]
    trailer = models.ForeignKey(Trailer, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=30, choices=DOC_TYPES, default="other")
    file = models.FileField(upload_to="trailers/documents/")
    expiry_date = models.DateField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class MaintenanceRecord(models.Model):
    SERVICE_TYPES = [
        ("repair", "Repair"), ("service", "Service"), ("tyre_replacement", "Tyre replacement"),
        ("brake_service", "Brake service"), ("inspection", "Inspection"),
        ("insurance_renewal", "Insurance renewal"), ("license_renewal", "License renewal"),
    ]
    trailer = models.ForeignKey(Trailer, on_delete=models.CASCADE, related_name="maintenance_records")
    service_type = models.CharField(max_length=30, choices=SERVICE_TYPES)
    workshop = models.CharField(max_length=150, blank=True)
    mechanic = models.CharField(max_length=150, blank=True)
    parts_used = models.TextField(blank=True)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    downtime_days = models.PositiveIntegerField(default=0)
    scheduled_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-scheduled_date"]


class DamageReport(models.Model):
    STAGE_CHOICES = [("before_rental", "Before rental"), ("after_return", "After return")]
    trailer = models.ForeignKey(Trailer, on_delete=models.CASCADE, related_name="damage_reports")
    rental = models.ForeignKey("rentals.Rental", null=True, blank=True, on_delete=models.SET_NULL, related_name="damage_reports")
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    description = models.TextField()
    damage_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    repair_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    insurance_claim_reference = models.CharField(max_length=100, blank=True)
    reported_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
