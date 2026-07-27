from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.core.models import AuditLog
from apps.invoices.models import Invoice
from apps.clients.models import Client


class InvoiceAuditLogTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="audituser", email="audit@example.com", password="Password123")
        self.client_model = Client.objects.create(
            name="Acme Ltd",
            contact_phone="0712345678",
            email="acme@example.com",
            code="CL-999",
        )

    def test_payment_creation_creates_audit_log(self):
        invoice = Invoice.objects.create(
            invoice_number="INV-TEST-1",
            client=self.client_model,
            client_name="Acme Ltd",
            due_date="2030-01-01",
            created_by=self.user,
        )

        response = self.client.post(
            "/api/invoices/payments/",
            {
                "invoice": invoice.id,
                "amount": "1000",
                "method": "cash",
                "payment_type": "partial",
                "reference_number": "ABC123",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer " + self._token(),
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(AuditLog.objects.filter(path="/api/invoices/payments/", model_name="Payment").exists())

    def _token(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(self.user)
        return str(refresh.access_token)
