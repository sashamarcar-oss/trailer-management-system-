import uuid
from django.db import models
from django.utils import timezone


class Quotation(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"), ("pending", "Pending"), ("accepted", "Accepted"),
        ("converted", "Converted"), ("rejected", "Rejected"), ("expired", "Expired"),
    ]

    quotation_number = models.CharField(max_length=20, unique=True, editable=False)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="quotations")
    client_name = models.CharField(max_length=200, blank=True)
    client_email = models.EmailField(blank=True)
    client_phone = models.CharField(max_length=30, blank=True)
    issue_date = models.DateField(auto_now_add=True)
    expiry_date = models.DateField()

    terms = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    created_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-issue_date"]

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            last = Quotation.objects.order_by("-id").first()
            next_id = (last.id + 1) if last else 91
            self.quotation_number = f"QT-{next_id:04d}"
        super().save(*args, **kwargs)

    @property
    def value(self):
        subtotal = sum(item.subtotal for item in self.items.all())
        return subtotal - self.discount + self.tax

    def __str__(self):
        return self.quotation_number


class QuotationResponseToken(models.Model):
    ACTION_CHOICES = [
        ("accept", "Accept"),
        ("reject", "Reject"),
    ]

    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name="response_tokens",
    )
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["token"]), models.Index(fields=["quotation", "action"])]

    @property
    def is_used(self):
        return self.used_at is not None

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()

    def mark_used(self, reason=""):
        self.used_at = timezone.now()
        if reason:
            self.reason = reason
        self.save(update_fields=["used_at", "reason"])

    def __str__(self):
        return f"{self.quotation.quotation_number} {self.action} token"


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="items")
    trailer = models.ForeignKey("trailers.Trailer", null=True, blank=True, on_delete=models.SET_NULL, related_name="quotation_items")
    description = models.CharField(max_length=255, blank=True)
    duration_days = models.PositiveIntegerField(default=1)
    rate_per_day = models.DecimalField(max_digits=12, decimal_places=2)

    @property
    def subtotal(self):
        return self.duration_days * self.rate_per_day
