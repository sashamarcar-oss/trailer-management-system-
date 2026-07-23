from django.db import models


class Quotation(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"), ("pending", "Pending"), ("accepted", "Accepted"),
        ("rejected", "Rejected"), ("expired", "Expired"),
    ]

    quotation_number = models.CharField(max_length=20, unique=True, editable=False)
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="quotations")
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


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="items")
    trailer = models.ForeignKey("trailers.Trailer", on_delete=models.PROTECT, related_name="quotation_items")
    duration_days = models.PositiveIntegerField(default=1)
    rate_per_day = models.DecimalField(max_digits=12, decimal_places=2)

    @property
    def subtotal(self):
        return self.duration_days * self.rate_per_day
