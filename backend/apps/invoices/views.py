from datetime import timedelta

from django.utils import timezone
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("client", "rental", "quotation").prefetch_related("items", "payments").all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "client", "is_recurring"]
    search_fields = ["invoice_number", "client__name"]
    ordering_fields = ["invoice_date", "due_date"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="create-rental")
    def create_rental(self, request, pk=None):
        from apps.rentals.models import Rental

        invoice = self.get_object()
        if invoice.rental:
            return Response({"rental_id": invoice.rental.id}, status=status.HTTP_200_OK)
        if invoice.status != "paid":
            raise ValidationError("A rental can only be created from a fully paid invoice.")

        item = invoice.items.first()
        if not item or not item.trailer:
            raise ValidationError({"items": "Invoice must include a trailer item with a linked trailer to create a rental."})

        months = max(1, int(item.quantity or 1))
        pickup_date = timezone.localdate()
        return_date = pickup_date + timedelta(days=months * 30)

        rental = Rental.objects.create(
            client=invoice.client,
            trailer=item.trailer,
            quotation=invoice.quotation,
            rental_type="monthly",
            pickup_date=pickup_date,
            return_date=return_date,
            rate=item.unit_price * months,
            status="draft",
            created_by=request.user,
        )
        invoice.rental = rental
        invoice.save(update_fields=["rental"])
        return Response({"rental_id": rental.id}, status=status.HTTP_201_CREATED)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("invoice", "client").all()
    serializer_class = PaymentSerializer
    # Payments also power client statements, so every authenticated dashboard
    # user must be able to retrieve and record them.
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["invoice", "client", "method", "payment_type"]
    ordering_fields = ["payment_date"]

    def perform_create(self, serializer):
        invoice = serializer.validated_data["invoice"]
        if not invoice.client:
            raise ValidationError({"invoice": "Payments require an invoice linked to a client."})
        amount = serializer.validated_data["amount"]
        is_refund = serializer.validated_data.get("payment_type") == "refund"
        if is_refund and amount > invoice.amount_paid:
            raise ValidationError({"amount": "Refund amount cannot exceed the amount paid on this invoice."})
        if not is_refund and amount > invoice.balance:
            raise ValidationError({"amount": "Payment amount cannot exceed the outstanding invoice balance."})
        serializer.save(recorded_by=self.request.user, client=invoice.client)
        invoice.refresh_from_db()
        if invoice.balance <= 0:
            invoice.status = "paid"
        elif invoice.amount_paid > 0:
            invoice.status = "partially_paid"
        else:
            invoice.status = "pending"
        invoice.save(update_fields=["status"])
