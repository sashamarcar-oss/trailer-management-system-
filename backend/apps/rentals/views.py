from datetime import date
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .models import Rental, RentalInspection
from .serializers import RentalSerializer, RentalInspectionSerializer
from .filters import RentalFilter


class RentalViewSet(viewsets.ModelViewSet):
    queryset = Rental.objects.select_related("client", "trailer", "quotation").prefetch_related("inspections").all()
    serializer_class = RentalSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = RentalFilter
    search_fields = ["rental_number", "client__name", "trailer__trailer_number"]
    ordering_fields = ["pickup_date", "return_date", "created_at"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, status="draft")

    def perform_destroy(self, instance):
        if not (self.request.user.is_superuser or self.request.user.has_permission("delete_rentals")):
            raise PermissionDenied("Only an administrator may delete a draft rental.")
        if instance.status != "draft":
            raise ValidationError("Only draft rentals may be deleted. Cancelled rentals are retained for audit history.")
        instance.delete()

    def _transition(self, rental, expected, target):
        if rental.status not in expected:
            labels = ", ".join(expected)
            raise ValidationError({"status": f"This action requires status: {labels}. Current status: {rental.status}."})
        rental.status = target

    def _sync_invoice(self, rental):
        invoice = rental.invoices.order_by("-id").first()
        if not invoice:
            return
        item = invoice.items.first()
        if item:
            item.quantity = 1
            item.unit_price = self._rental_total(rental)
            item.description = f"Trailer rental {rental.rental_number}"
            item.save(update_fields=["quantity", "unit_price", "description"])
        invoice.due_date = rental.return_date
        invoice.save(update_fields=["due_date"])

    @staticmethod
    def _rental_total(rental):
        return (
            rental.rate - rental.discount + rental.tax + rental.fuel_charges +
            rental.extra_charges + rental.late_return_charges + rental.damage_charges
        )

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        with transaction.atomic():
            rental = Rental.objects.select_for_update().select_related("trailer").get(pk=pk)
            self._transition(rental, ["draft"], "reserved")
            conflict = Rental.objects.filter(trailer=rental.trailer, status__in=["reserved", "active"], pickup_date__lte=rental.return_date, return_date__gte=rental.pickup_date).exclude(pk=rental.pk).exists()
            if conflict:
                raise ValidationError("This trailer is no longer available for the selected dates.")
            rental.confirmed_at = timezone.now()
            rental.confirmed_by = request.user
            rental.save(update_fields=["status", "confirmed_at", "confirmed_by", "updated_at"])
            rental.trailer.status = "reserved"
            rental.trailer.save(update_fields=["status"])
        return Response(self.get_serializer(rental).data)

    @action(detail=True, methods=["post"], url_path="dispatch")
    def start_rental(self, request, pk=None):
        with transaction.atomic():
            rental = Rental.objects.select_for_update().select_related("client").get(pk=pk)
            self._transition(rental, ["reserved"], "active")
            from apps.clients.models import ClientDocumentSigningRequest
            documents_complete = ClientDocumentSigningRequest.objects.filter(
                client=rental.client, rental=rental,
                contract_status__in=["signed", "uploaded", "verified"],
                inspection_status__in=["signed", "uploaded", "verified"],
            ).exists()
            if not documents_complete:
                raise ValidationError({"documents": "Both the signed rental contract and pre-rental inspection report must be received before checkout."})
            inspection = request.data.get("inspection") or {}
            notes = str(inspection.get("condition_notes") or "").strip()
            if not notes:
                raise ValidationError({"inspection": "Checkout condition notes are required before dispatch."})
            rental.save(update_fields=["status", "updated_at"])
            RentalInspection.objects.create(rental=rental, stage="pickup", checklist=inspection.get("checklist") or {}, notes=notes, inspected_by=request.user)
        return Response(self.get_serializer(rental).data)

    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        new_return = request.data.get("return_date")
        try:
            new_return = date.fromisoformat(new_return)
        except (TypeError, ValueError):
            raise ValidationError({"return_date": "Provide a valid return date (YYYY-MM-DD)."})
        with transaction.atomic():
            rental = Rental.objects.select_for_update().get(pk=pk)
            self._transition(rental, ["active"], "active")
            if new_return <= rental.return_date:
                raise ValidationError({"return_date": "The extension date must be after the current return date."})
            if Rental.objects.filter(trailer=rental.trailer, status__in=["reserved", "active"], pickup_date__lte=new_return, return_date__gte=rental.return_date).exclude(pk=rental.pk).exists():
                raise ValidationError({"return_date": "The trailer is booked during the requested extension period."})
            original_days = max(1, (rental.return_date - rental.pickup_date).days)
            added_days = (new_return - rental.return_date).days
            rental.extra_charges += (rental.rate / Decimal(original_days)) * added_days
            rental.return_date = new_return
            rental.save(update_fields=["return_date", "extra_charges", "updated_at"])
            self._sync_invoice(rental)
        return Response(self.get_serializer(rental).data)

    @action(detail=True, methods=["post"], url_path="generate-invoice")
    def generate_invoice(self, request, pk=None):
        from apps.invoices.models import Invoice, InvoiceItem
        with transaction.atomic():
            rental = Rental.objects.select_for_update().select_related("client", "trailer").get(pk=pk)
            if rental.status not in ["active", "returned", "completed"]:
                raise ValidationError("An invoice can be generated only after dispatch.")
            invoice = rental.invoices.order_by("-id").first()
            if not invoice:
                invoice = Invoice.objects.create(client=rental.client, rental=rental, due_date=rental.return_date, status="pending", created_by=request.user, notes=f"Generated from rental {rental.rental_number}.")
                InvoiceItem.objects.create(invoice=invoice, description=f"Trailer rental {rental.rental_number}", quantity=1, unit_price=self._rental_total(rental), trailer=rental.trailer)
        from apps.invoices.serializers import InvoiceSerializer
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="record-payment")
    def record_payment(self, request, pk=None):
        from apps.invoices.models import Payment
        rental = self.get_object()
        invoice = rental.invoices.order_by("-id").first()
        if not invoice:
            raise ValidationError("Generate an invoice before recording a rental payment.")
        try:
            amount = Decimal(str(request.data.get("amount")))
        except Exception:
            raise ValidationError({"amount": "Provide a valid payment amount."})
        if amount <= 0 or amount > invoice.balance:
            raise ValidationError({"amount": "Payment must be greater than zero and cannot exceed the outstanding balance."})
        payment = Payment.objects.create(invoice=invoice, client=invoice.client, amount=amount, payment_type=request.data.get("payment_type", "partial"), method=request.data.get("method", "bank"), reference_number=request.data.get("reference_number", ""), recorded_by=request.user)
        invoice.refresh_from_db()
        invoice.status = "paid" if invoice.balance <= 0 else "partially_paid"
        invoice.save(update_fields=["status"])
        from apps.invoices.serializers import PaymentSerializer
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="record-deposit")
    def record_deposit(self, request, pk=None):
        rental = self.get_object()
        try:
            amount = Decimal(str(request.data.get("amount")))
        except Exception:
            raise ValidationError({"amount": "Provide a valid deposit amount."})
        if amount <= 0 or rental.deposit_received + amount > rental.security_deposit:
            raise ValidationError({"amount": "Deposit cannot exceed the required security deposit."})
        rental.deposit_received += amount
        rental.deposit_notes = request.data.get("notes", rental.deposit_notes)
        rental.save(update_fields=["deposit_received", "deposit_notes", "updated_at"])
        return Response(self.get_serializer(rental).data)

    @action(detail=True, methods=["post"], url_path="return")
    def return_trailer(self, request, pk=None):
        with transaction.atomic():
            rental = Rental.objects.select_for_update().get(pk=pk)
            self._transition(rental, ["active"], "returned")
            inspection = request.data.get("inspection") or {}
            notes = str(inspection.get("condition_notes") or "").strip()
            if not notes:
                raise ValidationError({"inspection": "Return condition notes are required."})
            try:
                actual_return = date.fromisoformat(request.data.get("actual_return_date"))
            except (TypeError, ValueError):
                raise ValidationError({"actual_return_date": "Provide a valid actual return date."})
            try:
                refunded = Decimal(str(request.data.get("deposit_refunded", 0)))
                forfeited = Decimal(str(request.data.get("deposit_forfeited", 0)))
            except Exception:
                raise ValidationError({"deposit": "Provide valid deposit settlement amounts."})
            if refunded < 0 or forfeited < 0 or refunded + forfeited > rental.deposit_received:
                raise ValidationError({"deposit": "Refunded and forfeited amounts cannot exceed the deposit received."})
            rental.actual_return_date = actual_return
            rental.deposit_refunded = refunded
            rental.deposit_forfeited = forfeited
            rental.deposit_notes = str(request.data.get("deposit_notes") or "")
            rental.save(update_fields=["status", "actual_return_date", "deposit_refunded", "deposit_forfeited", "deposit_notes", "updated_at"])
            RentalInspection.objects.create(rental=rental, stage="return", checklist=inspection.get("checklist") or {}, notes=notes, inspected_by=request.user)
        return Response(self.get_serializer(rental).data)

    @action(detail=True, methods=["post"], url_path="refund-deposit")
    def refund_deposit(self, request, pk=None):
        rental = self.get_object()
        if rental.status not in ["returned", "completed"]:
            raise ValidationError("A deposit can be refunded only after the trailer is returned.")
        try:
            amount = Decimal(str(request.data.get("amount")))
        except Exception:
            raise ValidationError({"amount": "Provide a valid refund amount."})
        available = rental.deposit_received - rental.deposit_refunded - rental.deposit_forfeited
        if amount <= 0 or amount > available:
            raise ValidationError({"amount": "Refund cannot exceed the unsettled deposit held."})
        rental.deposit_refunded += amount
        rental.deposit_notes = request.data.get("notes", rental.deposit_notes)
        rental.save(update_fields=["deposit_refunded", "deposit_notes", "updated_at"])
        return Response(self.get_serializer(rental).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        with transaction.atomic():
            rental = Rental.objects.select_for_update().get(pk=pk)
            self._transition(rental, ["returned"], "completed")
            invoice = rental.invoices.order_by("-id").first()
            if invoice and invoice.balance > 0:
                raise ValidationError("Settle the linked invoice before completing this rental.")
            if rental.deposit_received != rental.deposit_refunded + rental.deposit_forfeited:
                raise ValidationError("Settle the entire received deposit before completing this rental.")
            rental.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(rental).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        with transaction.atomic():
            rental = Rental.objects.select_for_update().get(pk=pk)
            self._transition(rental, ["draft", "reserved"], "cancelled")
            rental.cancelled_by = request.user
            rental.cancelled_at = timezone.now()
            rental.cancellation_reason = str(request.data.get("reason") or "")
            rental.save(update_fields=["status", "cancelled_by", "cancelled_at", "cancellation_reason", "updated_at"])
        return Response(self.get_serializer(rental).data)


class RentalInspectionViewSet(viewsets.ModelViewSet):
    queryset = RentalInspection.objects.select_related("rental").all()
    serializer_class = RentalInspectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["rental", "stage"]

    def perform_create(self, serializer):
        serializer.save(inspected_by=self.request.user)
