from django.db import models


class Branch(models.Model):
    name = models.CharField(max_length=120)
    location = models.CharField(max_length=200, blank=True)
    manager = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="managed_branches"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CompanySettings(models.Model):
    company_name = models.CharField(max_length=200, default="TrailerOps")
    logo = models.ImageField(upload_to="company/", null=True, blank=True)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=16.00)
    currency = models.CharField(max_length=10, default="KES")
    invoice_prefix = models.CharField(max_length=20, default="INV-")
    quotation_prefix = models.CharField(max_length=20, default="QT-")
    theme = models.CharField(max_length=20, default="teal-blue")

    class Meta:
        verbose_name_plural = "Company settings"

    def __str__(self):
        return self.company_name


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ("CREATE", "Create"), ("UPDATE", "Update"), ("DELETE", "Delete"),
        ("LOGIN", "Login"), ("LOGOUT", "Logout"), ("VIEW", "View"),
    ]
    user = models.ForeignKey(
        "users.User", null=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=50, blank=True)
    path = models.CharField(max_length=255, blank=True)
    method = models.CharField(max_length=10, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} {self.action} {self.model_name} at {self.created_at}"
