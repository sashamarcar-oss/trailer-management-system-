from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related("client", "rental").prefetch_related("items", "payments").all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "client", "is_recurring"]
    search_fields = ["invoice_number", "client__name"]
    ordering_fields = ["invoice_date", "due_date"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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
