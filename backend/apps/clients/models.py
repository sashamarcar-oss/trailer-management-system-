from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Client(models.Model):
    TYPE_CHOICES = [("individual", "Individual"), ("company", "Company")]
    PAYMENT_TERMS_CHOICES = [
        ("cash", "Cash"), ("net_7", "Net 7"), ("net_15", "Net 15"),
        ("net_30", "Net 30"), ("net_60", "Net 60"),
    ]

    code = models.CharField(max_length=20, unique=True, editable=False)
    client_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="company")
    name = models.CharField("Name / company name", max_length=200)
    contact_person = models.CharField(max_length=150, blank=True)
    contact_phone = models.CharField(max_length=30)
    email = models.EmailField()

    pin = models.CharField("Postal / location PIN", max_length=20, blank=True)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default="Kenya")

    kra_pin = models.CharField(max_length=30, blank=True)
    national_id = models.CharField(max_length=30, blank=True)
    passport = models.CharField(max_length=30, blank=True)
    business_registration = models.CharField(max_length=60, blank=True)

    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    outstanding_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    preferred_payment_terms = models.CharField(max_length=10, choices=PAYMENT_TERMS_CHOICES, default="net_30")

    rating = models.DecimalField(max_digits=2, decimal_places=1, default=0,
                                  validators=[MinValueValidator(0), MaxValueValidator(5)])
    blacklisted = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    branch = models.ForeignKey("core.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="clients")
    created_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.code:
            last = Client.objects.order_by("-id").first()
            next_id = (last.id + 1) if last else 101
            self.code = f"CL-{next_id}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ClientDocument(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="documents")
    label = models.CharField(max_length=150)
    file = models.FileField(upload_to="clients/documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class ClientNote(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="client_notes")
    author = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    note = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
