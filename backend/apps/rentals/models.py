from django.db import models


class Rental(models.Model):
    TYPE_CHOICES = [("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly"), ("long_term", "Long Term")]
    STATUS_CHOICES = [
        ("draft", "Draft"), ("reserved", "Reserved"), ("active", "Active"),
        ("completed", "Completed"), ("cancelled", "Cancelled"), ("overdue", "Overdue"),
    ]

    rental_number = models.CharField(max_length=20, unique=True, editable=False)
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="rentals")
    trailer = models.ForeignKey("trailers.Trailer", on_delete=models.PROTECT, related_name="rentals")
    quotation = models.ForeignKey("quotations.Quotation", null=True, blank=True, on_delete=models.SET_NULL, related_name="rentals")

    rental_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="monthly")
    pickup_date = models.DateField()
    return_date = models.DateField()
    actual_return_date = models.DateField(null=True, blank=True)

    pickup_location = models.CharField(max_length=200, blank=True)
    dropoff_location = models.CharField(max_length=200, blank=True)

    rate = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    security_deposit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fuel_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    extra_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    late_return_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    damage_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    agreement_signed = models.BooleanField(default=False)
    agreement_file = models.FileField(upload_to="rentals/agreements/", null=True, blank=True)
    signature_file = models.FileField(upload_to="rentals/signatures/", null=True, blank=True)

    created_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pickup_date"]

    def save(self, *args, **kwargs):
        if not self.rental_number:
            last = Rental.objects.order_by("-id").first()
            next_id = (last.id + 1) if last else 3301
            self.rental_number = f"RN-{next_id}"
        super().save(*args, **kwargs)

        # Keep trailer availability in sync with rental lifecycle.
        if self.status == "active":
            self.trailer.status = "rented"
            self.trailer.save(update_fields=["status"])
        elif self.status in ("completed", "cancelled") and self.trailer.status == "rented":
            self.trailer.status = "available"
            self.trailer.save(update_fields=["status"])

    def __str__(self):
        return self.rental_number


class RentalInspection(models.Model):
    STAGE_CHOICES = [("pickup", "Pickup"), ("return", "Return")]

    rental = models.ForeignKey(Rental, on_delete=models.CASCADE, related_name="inspections")
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    checklist = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    inspected_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    inspected_at = models.DateTimeField(auto_now_add=True)
