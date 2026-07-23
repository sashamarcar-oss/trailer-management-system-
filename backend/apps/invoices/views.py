from rest_framework import viewsets, permissions
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer
from apps.users.permissions import IsAccountant


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
    permission_classes = [IsAccountant]
    filterset_fields = ["invoice", "client", "method", "payment_type"]
    ordering_fields = ["payment_date"]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)
