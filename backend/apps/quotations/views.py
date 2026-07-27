from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Quotation
from .serializers import QuotationSerializer


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.select_related("client").prefetch_related("items").all()
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "client"]
    search_fields = ["quotation_number", "client__name"]
    ordering_fields = ["issue_date", "expiry_date"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def convert_to_rental(self, request, pk=None):
        """Create exactly one linked rental and mark the quotation converted."""
        from apps.rentals.models import Rental

        with transaction.atomic():
            quotation = Quotation.objects.select_for_update().prefetch_related("items__trailer", "rentals").get(pk=pk)
            existing_rental = quotation.rentals.order_by("id").first()
            if existing_rental:
                raise ValidationError({"detail": "This quotation has already been converted to a rental.", "rental_id": existing_rental.id})
            if quotation.status != "accepted":
                raise ValidationError({"detail": "Only accepted quotations can be converted."})
            if not quotation.client:
                raise ValidationError({"client": "Link the quotation to a saved client before converting it to a rental."})

            item = next((item for item in quotation.items.all() if item.trailer_id), None)
            if not item:
                raise ValidationError({"items": "Add at least one trailer item before converting this quotation."})

            pickup_date = timezone.localdate()
            rental = Rental.objects.create(
                client=quotation.client,
                trailer=item.trailer,
                quotation=quotation,
                rental_type="daily",
                pickup_date=pickup_date,
                return_date=pickup_date + timedelta(days=max(item.duration_days, 1)),
                rate=item.rate_per_day,
                status="draft",
                created_by=request.user,
            )
            quotation.status = "converted"
            quotation.save(update_fields=["status"])

        return Response({"rental_id": rental.id, "quotation_id": quotation.id, "status": "converted"}, status=201)

    @action(detail=True, methods=["post"], url_path="convert_to_invoice")
    def convert_to_invoice(self, request, pk=None):
        from apps.invoices.models import Invoice, InvoiceItem
        from apps.invoices.serializers import InvoiceSerializer

        with transaction.atomic():
            quotation = Quotation.objects.select_for_update().prefetch_related("items__trailer", "invoices").get(pk=pk)
            existing_invoice = quotation.invoices.order_by("id").first()
            if existing_invoice:
                raise ValidationError({"detail": "This quotation has already been converted to an invoice.", "invoice_id": existing_invoice.id})
            if quotation.status != "accepted":
                raise ValidationError({"detail": "Only accepted quotations can be converted to an invoice."})
            if not quotation.client:
                raise ValidationError({"client": "Link the quotation to a saved client before converting it to an invoice."})
            if not quotation.items.exists():
                raise ValidationError({"items": "Add at least one item before converting this quotation."})

            due_date = timezone.localdate() + timedelta(days=30)
            invoice = Invoice.objects.create(
                client=quotation.client,
                quotation=quotation,
                due_date=due_date,
                status="pending",
                notes=quotation.notes,
                terms=quotation.terms,
                discount=quotation.discount,
                tax=quotation.tax,
                created_by=request.user,
            )
            for item in quotation.items.all():
                InvoiceItem.objects.create(
                    invoice=invoice,
                    trailer=item.trailer,
                    description=item.description or (item.trailer.trailer_number if item.trailer else "Trailer rental"),
                    quantity=item.duration_days,
                    unit_price=item.rate_per_day,
                )
            quotation.status = "converted"
            quotation.save(update_fields=["status"])

        return Response(InvoiceSerializer(invoice).data, status=201)
