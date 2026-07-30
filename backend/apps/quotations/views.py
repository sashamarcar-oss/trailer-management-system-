from datetime import timedelta
from io import BytesIO
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import AuditLog
from .models import Quotation, QuotationResponseToken
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
                rental_type="monthly",
                pickup_date=pickup_date,
                return_date=pickup_date + timedelta(days=item.duration_days * 30),
                rate=item.rate_per_day * item.duration_days,
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

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        quotation = Quotation.objects.select_related("client").prefetch_related("items__trailer").get(pk=pk)
        if quotation.status != "draft":
            raise ValidationError({"status": "Only draft quotations can be sent to clients."})
        if not quotation.client_email:
            raise ValidationError({"client_email": "A client email address is required to send this quotation."})

        expires_at = timezone.now() + timedelta(hours=settings.QUOTATION_RESPONSE_TOKEN_TTL_HOURS)
        accept_token = QuotationResponseToken.objects.create(
            quotation=quotation,
            action="accept",
            expires_at=expires_at,
        )
        reject_token = QuotationResponseToken.objects.create(
            quotation=quotation,
            action="reject",
            expires_at=expires_at,
        )

        accept_url = f"{settings.BACKEND_BASE_URL}/api/quotations/respond/{accept_token.token}/"
        reject_url = f"{settings.BACKEND_BASE_URL}/api/quotations/respond/{reject_token.token}/"

        subject = f"Quotation {quotation.quotation_number} from TrailerOps"
        text_body = (
            f"Quotation {quotation.quotation_number}\n"
            f"Client: {quotation.client_name or quotation.client.email}\n"
            f"Valid until: {quotation.expiry_date}\n\n"
            f"Total: {quotation.value}\n\n"
            f"Accept this quotation: {accept_url}\n"
            f"Reject this quotation: {reject_url}\n"
            "\nIf the link does not work, copy and paste it into your browser."
        )

        subtotal = sum(item.subtotal for item in quotation.items.all())
        html_body = f"""
            <html>
            <body style='font-family: Arial, sans-serif; color: #1f2937;'>
            <h2>Quotation {quotation.quotation_number}</h2>
            <p>Dear {quotation.client_name or 'Customer'},</p>
            <p>Your quotation is ready. Review the details and choose an action below.</p>
            <p><strong>Valid until:</strong> {quotation.expiry_date}</p>
            <table cellpadding='6' cellspacing='0' border='1' style='border-collapse: collapse; width: 100%; max-width: 680px;'>
            <thead><tr style='background: #0f6e56; color: #ffffff; text-align:left;'><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
        """
        for item in quotation.items.all():
            description = item.description or (item.trailer.trailer_number if item.trailer else "Trailer rental")
            amount = item.subtotal
            html_body += (
                f"<tr><td>{description}</td>"
                f"<td>{item.duration_days}</td>"
                f"<td>{item.rate_per_day}</td>"
                f"<td>{amount}</td></tr>"
            )
        html_body += f"""
            </tbody>
            </table>
            <p><strong>Subtotal:</strong> {subtotal}</p>
            <p><strong>Discount:</strong> {quotation.discount}</p>
            <p><strong>Tax:</strong> {quotation.tax}</p>
            <p><strong>Total:</strong> {quotation.value}</p>
            <p>
                <a href='{accept_url}' style='display:inline-block;margin-right:12px;padding:10px 18px;background:#0f6e56;color:#ffffff;text-decoration:none;border-radius:6px;'>Accept Quotation</a>
                <a href='{reject_url}' style='display:inline-block;padding:10px 18px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;'>Reject Quotation</a>
            </p>
            <p>If these actions do not work, copy and paste the full link into your browser.</p>
            <p>Thank you,<br/>TrailerOps</p>
            </body>
            </html>
        """

        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[quotation.client_email],
        )
        message.attach_alternative(html_body, "text/html")
        message.attach(f"{quotation.quotation_number}.pdf", self._build_pdf_attachment(quotation), "application/pdf")

        try:
            sent = message.send(fail_silently=False)
        except Exception as exc:
            accept_token.delete()
            reject_token.delete()
            raise ValidationError({"email": f"Failed to send quotation email: {exc}"})

        if sent == 0:
            accept_token.delete()
            reject_token.delete()
            raise ValidationError({"email": "Failed to send quotation email."})

        quotation.status = "pending"
        quotation.save(update_fields=["status"])
        serializer = QuotationSerializer(quotation)
        return Response(serializer.data, status=200)

    def _build_pdf_attachment(self, quotation: Quotation) -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        normal = styles["Normal"]
        heading = ParagraphStyle("Heading", parent=styles["Heading1"], fontSize=16, spaceAfter=12)
        small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9)

        items = [
            ["Description", "Qty", "Rate/day", "Subtotal"]
        ]
        for item in quotation.items.all():
            description = item.description or (item.trailer.trailer_number if item.trailer else "Trailer rental")
            items.append([
                Paragraph(description, normal),
                str(item.duration_days),
                f"{item.rate_per_day}",
                f"{item.subtotal}",
            ])

        total_rows = [
            ["Subtotal", "", "", f"{sum(item.subtotal for item in quotation.items.all())}"],
            ["Discount", "", "", f"{quotation.discount}"],
            ["Tax", "", "", f"{quotation.tax}"],
            ["Total", "", "", f"{quotation.value}"],
        ]

        story = [
            Paragraph(f"Quotation {quotation.quotation_number}", heading),
            Paragraph(f"Client: {quotation.client_name or quotation.client.email}", normal),
            Paragraph(f"Issue date: {quotation.issue_date}", normal),
            Paragraph(f"Expiry date: {quotation.expiry_date}", normal),
            Spacer(1, 12),
            Table(items, colWidths=[3 * inch, inch, inch, inch], style=[
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f6e56")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.black),
                ("BOX", (0, 0), (-1, -1), 0.25, colors.black),
            ]),
            Spacer(1, 12),
        ]
        for row in total_rows:
            story.append(Paragraph(f"<b>{row[0]}</b>: {row[3]}", normal))
        if quotation.notes:
            story.append(Spacer(1, 12))
            story.append(Paragraph("Notes:", styles["Heading3"]))
            story.append(Paragraph(quotation.notes, normal))
        if quotation.terms:
            story.append(Spacer(1, 12))
            story.append(Paragraph("Terms & Conditions:", styles["Heading3"]))
            story.append(Paragraph(quotation.terms, normal))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()


class QuotationResponseView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            response_token = QuotationResponseToken.objects.select_related("quotation").get(token=token)
        except QuotationResponseToken.DoesNotExist:
            raise ValidationError({"detail": "Invalid or expired response link."})

        if response_token.is_used or response_token.is_expired:
            raise ValidationError({"detail": "This response link is no longer valid."})

        quotation = response_token.quotation
        with transaction.atomic():
            response_token.mark_used()
            QuotationResponseToken.objects.filter(
                quotation=quotation,
                used_at__isnull=True,
            ).exclude(pk=response_token.pk).update(
                used_at=timezone.now(),
                reason=f"Superseded by {response_token.action}",
            )
            if response_token.action == "accept":
                quotation.status = "accepted"
            else:
                quotation.status = "rejected"
            quotation.save(update_fields=["status"])
            AuditLog.objects.create(
                user=None,
                action="UPDATE",
                model_name="Quotation",
                object_id=str(quotation.id),
                path=request.path,
                method=request.method,
                metadata={"response_action": response_token.action, "quotation_number": quotation.quotation_number},
            )

        return Response({"detail": f"Quotation has been {quotation.status}.", "status": quotation.status}, status=status.HTTP_200_OK)
