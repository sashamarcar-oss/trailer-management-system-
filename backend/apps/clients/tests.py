from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.clients.models import Client
from apps.rentals.models import Rental
from apps.trailers.models import Trailer
from apps.users.models import User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ClientDocumentSigningTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", email="admin@example.com", password="Password123", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_send_documents_creates_signature_request_and_sends_email(self):
        client = Client.objects.create(
            name="Acme Logistics",
            contact_phone="0712345678",
            email="client@example.com",
            contact_person="Jane Doe",
            country="Kenya",
            created_by=self.user,
        )

        response = self.client.post(f"/api/clients/{client.id}/send-documents/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(client.document_signing_requests.exists())
        request = client.document_signing_requests.get()
        self.assertEqual(request.contract_status, "sent")
        self.assertEqual(request.inspection_status, "sent")

    def test_send_documents_for_reserved_rental_requires_payment(self):
        client = Client.objects.create(
            name="Acme Logistics",
            contact_phone="0712345678",
            email="client@example.com",
            contact_person="Jane Doe",
            country="Kenya",
            created_by=self.user,
        )
        trailer = Trailer.objects.create(
            trailer_number="TR-100",
            registration_number="REG-100",
            vin="VIN-100",
            trailer_type="flatbed",
            created_by=self.user,
        )
        rental = Rental.objects.create(
            client=client,
            trailer=trailer,
            pickup_date="2026-01-01",
            return_date="2026-01-05",
            rate=500,
            security_deposit=250,
            status="reserved",
            created_by=self.user,
        )

        response = self.client.post(
            f"/api/clients/{client.id}/send-documents/",
            {"rental": rental.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("payment", response.data["detail"].lower())

    def test_dispatch_is_blocked_until_both_documents_are_complete(self):
        client = Client.objects.create(
            name="Acme Logistics",
            contact_phone="0712345678",
            email="client@example.com",
            contact_person="Jane Doe",
            country="Kenya",
            created_by=self.user,
        )
        trailer = Trailer.objects.create(
            trailer_number="TR-100",
            registration_number="REG-100",
            vin="VIN-100",
            trailer_type="flatbed",
            created_by=self.user,
        )
        rental = Rental.objects.create(
            client=client,
            trailer=trailer,
            pickup_date="2026-01-01",
            return_date="2026-01-05",
            rate=500,
            status="reserved",
            created_by=self.user,
        )

        response = self.client.post(
            f"/api/rentals/{rental.id}/dispatch/",
            {"inspection": {"condition_notes": "Ready for pickup", "checklist": {}}},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("documents", response.data["detail"].lower())
