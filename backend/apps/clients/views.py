from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.models import AuditLog
from .models import Client, ClientDocument, ClientDocumentSigningRequest, DocumentSigningEvent, ClientNote
from .serializers import ClientSerializer, ClientDocumentSerializer, ClientDocumentSigningRequestSerializer, ClientNoteSerializer
from .filters import ClientFilter


class ClientDocumentSigningRequestViewSet(viewsets.ModelViewSet):
    queryset = ClientDocumentSigningRequest.objects.select_related("client", "rental", "quotation").prefetch_related("events").all()
    serializer_class = ClientDocumentSigningRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["client", "rental", "quotation"]

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        if not request.user.is_staff:
            raise PermissionDenied("Only an administrator can verify signed documents.")
        signing_request = self.get_object()
        if not signing_request.is_complete:
            raise ValidationError({"documents": "Both signed documents must be received before verification."})
        signing_request.contract_status = "verified"
        signing_request.inspection_status = "verified"
        signing_request.verified_at = timezone.now()
        signing_request.save(update_fields=["contract_status", "inspection_status", "verified_at", "updated_at"])
        DocumentSigningEvent.objects.create(request=signing_request, event_type="verified", details="Documents verified by rental administrator")
        AuditLog.objects.create(user=request.user, action="UPDATE", model_name="ClientDocumentSigningRequest", object_id=str(signing_request.id), path=request.path, method=request.method, metadata={"client_id": signing_request.client_id, "status": "verified"})
        return Response(self.get_serializer(signing_request).data)


class ClientDocumentViewSet(viewsets.ModelViewSet):
    queryset = ClientDocument.objects.select_related("client").all()
    serializer_class = ClientDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["client"]


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.select_related("branch").prefetch_related("documents", "client_notes", "document_signing_requests").all()
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Client create/update can upload files, while document dispatch carries
    # rental/quotation context as JSON.
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_class = ClientFilter
    search_fields = ["name", "contact_person", "email", "contact_phone", "code"]
    ordering_fields = ["name", "created_at", "credit_limit"]

    def get_permissions(self):
        if self.action in {"submit_document_signing", "review_documents"}:
            return [permissions.AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({"client": "This client cannot be deleted because it is linked to rental records."})

    @action(detail=True, methods=["post"], url_path="send-documents")
    def send_documents(self, request, pk=None):
        client = self.get_object()
        rental_id = request.data.get("rental")
        quotation_id = request.data.get("quotation")
        rental = None
        quotation = None
        if rental_id:
            from apps.rentals.models import Rental
            rental = Rental.objects.filter(pk=rental_id, client=client).first()
            if not rental:
                raise ValidationError({"rental": "Choose a rental that belongs to this client."})
            if rental.status != "reserved":
                raise ValidationError({"detail": "Documents can only be sent for a reserved rental after payment has been recorded and before checkout is activated."})
            from apps.invoices.models import Invoice
            invoice = rental.invoices.order_by("-id").first()
            if not invoice or invoice.balance > 0:
                raise ValidationError({"detail": "Payment must be recorded before the client receives the rental documents."})
        if quotation_id:
            from apps.quotations.models import Quotation
            quotation = Quotation.objects.filter(pk=quotation_id, client=client).first()
            if not quotation:
                raise ValidationError({"quotation": "Choose a quotation that belongs to this client."})
            raise ValidationError({"detail": "Rental documents are only sent from rentals, not quotations."})

        # A resend is an auditable new delivery, while preserving previously
        # completed documents instead of silently reopening a signed agreement.
        request_obj = ClientDocumentSigningRequest.objects.create(
            client=client, rental=rental, quotation=quotation,
            contract_status="sent", inspection_status="sent",
        )

        DocumentSigningEvent.objects.create(request=request_obj, event_type="sent", details="Documents were sent to client")
        self._send_documents_email(request_obj, request)

        serializer = ClientDocumentSigningRequestSerializer(request_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="document-signing")
    def submit_document_signing(self, request):
        token = request.data.get("token") or request.query_params.get("token")
        if not token:
            raise ValidationError({"token": "A valid document signing token is required."})
        try:
            request_obj = ClientDocumentSigningRequest.objects.select_related("client").get(token=token)
        except ClientDocumentSigningRequest.DoesNotExist:
            raise ValidationError({"token": "This document link is invalid."})
        action_type = (request.data.get("action") or "sign").lower()
        if action_type == "decline":
            request_obj.contract_status = "draft"
            request_obj.inspection_status = "draft"
            request_obj.notes = "Client declined the agreement"
            request_obj.save(update_fields=["contract_status", "inspection_status", "notes", "updated_at"])
            DocumentSigningEvent.objects.create(request=request_obj, event_type="declined", details="Client declined the documents")
            return Response({"detail": "Documents declined."})

        signed_any = False
        uploaded_any = False
        if "signed_contract_file" in request.FILES:
            request_obj.signed_contract_file = request.FILES["signed_contract_file"]
            request_obj.contract_status = "uploaded"
            request_obj.uploaded_at = timezone.now()
            signed_any = uploaded_any = True
        elif request.data.get("signed_contract") == "true":
            if not str(request.data.get("signature_name") or "").strip():
                raise ValidationError({"signature_name": "Type your full name to sign electronically."})
            request_obj.contract_status = "signed"
            request_obj.signed_at = timezone.now()
            signed_any = True

        if "signed_inspection_file" in request.FILES:
            request_obj.signed_inspection_file = request.FILES["signed_inspection_file"]
            request_obj.inspection_status = "uploaded"
            request_obj.uploaded_at = timezone.now()
            signed_any = uploaded_any = True
        elif request.data.get("signed_inspection") == "true":
            request_obj.inspection_status = "signed"
            request_obj.signed_at = timezone.now()
            signed_any = True

        if request.data.get("signature_name"):
            request_obj.notes = f"Electronically signed by: {str(request.data['signature_name']).strip()}"

        if not signed_any:
            raise ValidationError({"documents": "Sign or upload at least one document."})

        request_obj.save(update_fields=["signed_contract_file", "signed_inspection_file", "contract_status", "inspection_status", "signed_at", "uploaded_at", "notes", "updated_at"])
        DocumentSigningEvent.objects.create(request=request_obj, event_type="uploaded" if uploaded_any else "signed", details="Client completed document signing")
        AuditLog.objects.create(user=None, action="UPDATE", model_name="ClientDocumentSigningRequest", object_id=str(request_obj.id), path=request.path, method=request.method, metadata={"client_id": request_obj.client_id, "status": "signed"})
        self._notify_admin(request_obj)
        return Response(ClientDocumentSigningRequestSerializer(request_obj).data)

    @action(detail=False, methods=["get"], url_path="review-documents")
    def review_documents(self, request):
        token = request.query_params.get("token")
        try:
            request_obj = ClientDocumentSigningRequest.objects.select_related("client", "rental", "quotation").get(token=token)
        except (ClientDocumentSigningRequest.DoesNotExist, ValueError):
            raise ValidationError({"token": "This document link is invalid."})
        if not request_obj.viewed_at:
            request_obj.contract_status = "viewed" if request_obj.contract_status == "sent" else request_obj.contract_status
            request_obj.inspection_status = "viewed" if request_obj.inspection_status == "sent" else request_obj.inspection_status
            request_obj.viewed_at = timezone.now()
            request_obj.save(update_fields=["contract_status", "inspection_status", "viewed_at", "updated_at"])
            DocumentSigningEvent.objects.create(request=request_obj, event_type="viewed", details="Client viewed the documents")
        return Response(ClientDocumentSigningRequestSerializer(request_obj).data)

    def _send_documents_email(self, signing_request, request):
        if not signing_request.contract_pdf or not signing_request.inspection_pdf:
            contract_pdf = self._build_pdf(signing_request.client.name, "Rental Contract", signing_request.rental, signing_request.quotation)
            inspection_pdf = self._build_pdf(signing_request.client.name, "Pre-Rental Inspection Report", signing_request.rental, signing_request.quotation)
            signing_request.contract_pdf.save("rental_contract.pdf", ContentFile(contract_pdf), save=False)
            signing_request.inspection_pdf.save("pre_rental_inspection_report.pdf", ContentFile(inspection_pdf), save=False)
            signing_request.save(update_fields=["contract_pdf", "inspection_pdf", "updated_at"])

        subject = f"Review and sign your rental documents for {signing_request.client.name}"
        portal_base_url = getattr(settings, "FRONTEND_BASE_URL", settings.BACKEND_BASE_URL)
        review_url = f"{portal_base_url.rstrip('/')}/sign/{signing_request.token}"
        text = (
            f"Hello {signing_request.client.contact_person or signing_request.client.name},\n\n"
            f"Please review and sign the rental contract and inspection report.\n"
            f"Review & Sign Documents: {review_url}\n"
        )
        html = f"""
        <html><body style='font-family: Arial, sans-serif; color: #111827;'>
        <h2>Review & Sign Documents</h2>
        <p>Dear {signing_request.client.contact_person or signing_request.client.name},</p>
        <p>Your rental documents are ready for review. Please use the secure link below to review and sign them.</p>
        <p><a href='{review_url}' style='background:#0f6e56;padding:12px 18px;color:#ffffff;text-decoration:none;border-radius:6px;'>Review & Sign Documents</a></p>
        <p><strong>Rental contract</strong> and <strong>pre-rental inspection report</strong> are attached below.</p>
        <p>Thank you,<br/>TrailerOps</p>
        </body></html>
        """
        message = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [signing_request.client.email])
        message.attach_alternative(html, "text/html")
        signing_request.contract_pdf.open("rb")
        signing_request.inspection_pdf.open("rb")
        try:
            message.attach("rental_contract.pdf", signing_request.contract_pdf.read(), "application/pdf")
            message.attach("pre_rental_inspection_report.pdf", signing_request.inspection_pdf.read(), "application/pdf")
        finally:
            signing_request.contract_pdf.close()
            signing_request.inspection_pdf.close()
        message.send(fail_silently=False)

    def _build_pdf(self, client_name, title, rental=None, quotation=None):
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from reportlab.lib.units import inch

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = [Paragraph(title, styles["Title"]), Spacer(1, 0.2 * inch)]
        story.append(Paragraph(f"Client: {client_name}", styles["BodyText"]))
        if rental:
            story.append(Paragraph(f"Rental: {rental.rental_number}", styles["BodyText"]))
            story.append(Paragraph(f"Pickup: {rental.pickup_date} / Return: {rental.return_date}", styles["BodyText"]))
        if quotation:
            story.append(Paragraph(f"Quotation: {quotation.quotation_number}", styles["BodyText"]))
        story.append(Spacer(1, 0.2 * inch))
        data = [["Item", "Value"], ["Company", "TrailerOps"], ["Document", title], ["Status", "Pending client review"]]
        table = Table(data, colWidths=[2.5 * inch, 3 * inch])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f6e56")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ]))
        story.append(table)
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    def _notify_admin(self, signing_request):
        from apps.users.models import User

        recipients = list(User.objects.filter(is_staff=True).exclude(email="").values_list("email", flat=True))
        if recipients:
            subject = f"Documents received from {signing_request.client.name}"
            body = (
                f"{signing_request.client.name} has completed a document signing request.\n"
                f"Contract: {signing_request.get_contract_status_display()}\n"
                f"Inspection: {signing_request.get_inspection_status_display()}\n"
                "Review and verify the documents before checkout."
            )
            EmailMultiAlternatives(subject, body, settings.DEFAULT_FROM_EMAIL, recipients).send(fail_silently=True)
        AuditLog.objects.create(user=None, action="UPDATE", model_name="ClientDocumentSigningRequest", object_id=str(signing_request.id), path="/api/clients/document-signing", method="POST", metadata={"client_id": signing_request.client_id, "status": "signed"})


class ClientNoteViewSet(viewsets.ModelViewSet):
    queryset = ClientNote.objects.select_related("client", "author").all()
    serializer_class = ClientNoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["client"]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
