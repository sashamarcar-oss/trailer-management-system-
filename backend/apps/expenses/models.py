from django.db import models


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Expense categories"

    def __str__(self):
        return self.name


class Vendor(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name


class Expense(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"), ("bank", "Bank"), ("cheque", "Cheque"),
        ("mobile_money", "Mobile Money"), ("card", "Card"),
    ]
    STATUS_CHOICES = [("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")]

    expense_number = models.CharField(max_length=20, unique=True, editable=False)
    date = models.DateField()
    trailer = models.ForeignKey("trailers.Trailer", null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses")
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name="expenses")
    vendor = models.ForeignKey(Vendor, null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses")
    vendor_name_freeform = models.CharField(max_length=150, blank=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default="bank")
    branch = models.ForeignKey("core.Branch", null=True, blank=True, on_delete=models.SET_NULL, related_name="expenses")
    receipt = models.FileField(upload_to="expenses/receipts/", null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    approved_by = models.ForeignKey("users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_expenses")
    paid_by = models.ForeignKey("users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="paid_expenses")

    recurring = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def save(self, *args, **kwargs):
        if not self.expense_number:
            last = Expense.objects.order_by("-id").first()
            next_id = (last.id + 1) if last else 5001
            self.expense_number = f"EX-{next_id}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.expense_number
