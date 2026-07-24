from django.db import models
from decimal import Decimal


class Invoice(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"), ("pending", "Pending"), ("paid", "Paid"),
        ("partially_paid", "Partially Paid"), ("overdue", "Overdue"), ("cancelled", "Cancelled"),
    ]

    invoice_number = models.CharField(max_length=20, unique=True, editable=False)
    client = models.ForeignKey("clients.Client", null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")
    client_name = models.CharField(max_length=200, blank=True)
    client_email = models.EmailField(blank=True)
    client_phone = models.CharField(max_length=30, blank=True)
    rental = models.ForeignKey("rentals.Rental", null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")

    invoice_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()

    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    vat = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    is_recurring = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    terms = models.TextField(blank=True)

    created_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-invoice_date"]

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            last = Invoice.objects.order_by("-id").first()
            next_id = (last.id + 1) if last else 2024
            self.invoice_number = f"INV-{next_id}"
        super().save(*args, **kwargs)

    @property
    def total(self):
        subtotal = sum(item.subtotal for item in self.items.all())
        return subtotal - self.discount + self.tax + self.vat

    @property
    def amount_paid(self):
        return sum(
            ((p.amount if p.payment_type != "refund" else -p.amount) for p in self.payments.all()),
            Decimal("0.00"),
        )

    @property
    def balance(self):
        return self.total - self.amount_paid

    def __str__(self):
        return self.invoice_number


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    description = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    trailer = models.ForeignKey("trailers.Trailer", null=True, blank=True, on_delete=models.SET_NULL, related_name="invoice_items")

    @property
    def subtotal(self):
        return self.quantity * self.unit_price


class Payment(models.Model):
    METHOD_CHOICES = [
        ("cash", "Cash"), ("bank", "Bank"), ("cheque", "Cheque"),
        ("mobile_money", "Mobile Money"), ("card", "Card"),
    ]
    TYPE_CHOICES = [
        ("deposit", "Deposit"), ("partial", "Partial Payment"), ("full", "Full Payment"),
        ("advance", "Advance Payment"), ("refund", "Refund"),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payments")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="payments")
    payment_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="partial")
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="bank")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference_number = models.CharField(max_length=100, blank=True)
    payment_date = models.DateField(auto_now_add=True)
    recorded_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-payment_date"]

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.amount}"
