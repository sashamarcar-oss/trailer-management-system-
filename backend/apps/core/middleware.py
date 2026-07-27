from .models import AuditLog

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class AuditLogMiddleware:
    """Logs every write request made against the API for compliance and traceability."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.path.startswith("/api/") and request.method in WRITE_METHODS:
            if request.path.startswith("/api/auth/"):
                return response

            user = getattr(request, "user", None)
            action = "CREATE" if request.method == "POST" else "DELETE" if request.method == "DELETE" else "UPDATE"
            model_name, object_id = self._get_resource_identifiers(request, response)

            AuditLog.objects.create(
                user=user if user and user.is_authenticated else None,
                action=action,
                model_name=model_name,
                object_id=object_id,
                path=request.path,
                method=request.method,
                ip_address=request.META.get("REMOTE_ADDR"),
                metadata=self._build_metadata(request, response),
            )

        return response

    def _get_resource_identifiers(self, request, response):
        model_name = ""
        object_id = ""
        parts = [part for part in request.path.strip("/").split("/") if part]

        if len(parts) >= 2 and parts[0] == "api":
            resource = parts[1]
            if resource == "invoices" and len(parts) >= 3 and parts[2] == "payments":
                model_name = "Payment"
            else:
                model_name = resource.replace("-", " ").rstrip("s").title().replace(" ", "")
                if resource == "invoices" and len(parts) >= 3 and parts[2] and parts[2] != "":
                    object_id = parts[2]
                elif len(parts) >= 3 and parts[2] and parts[2] != "":
                    object_id = parts[2]

        if not object_id:
            data = getattr(response, "data", None)
            if isinstance(data, dict):
                object_id = str(data.get("id") or data.get("pk") or "")

        if not object_id and request.path.startswith("/api/invoices/payments/") and hasattr(request, "data"):
            data = request.data or {}
            if isinstance(data, dict):
                invoice_id = data.get("invoice")
                if invoice_id:
                    object_id = str(invoice_id)

        return model_name, object_id

    def _build_metadata(self, request, response):
        metadata = {
            "status_code": getattr(response, "status_code", None),
        }
        if request.method == "POST" and request.path.endswith("/login/"):
            metadata["login_email"] = request.data.get("email") if hasattr(request, "data") else None

        if request.path.startswith("/api/invoices/"):
            if hasattr(request, "data"):
                data = request.data or {}
                if isinstance(data, dict):
                    if "status" in data:
                        metadata["invoice_status"] = data.get("status")
                    if "notes" in data:
                        metadata["note"] = data.get("notes")
                    if "client" in data:
                        metadata["client_id"] = data.get("client")
            if isinstance(getattr(response, "data", None), dict):
                invoice_data = response.data or {}
                if "invoice_number" in invoice_data:
                    metadata["invoice_number"] = invoice_data.get("invoice_number")
                if "status" in invoice_data:
                    metadata["invoice_status"] = invoice_data.get("status")

        if request.path.startswith("/api/invoices/payments/") and hasattr(request, "data"):
            data = request.data or {}
            if isinstance(data, dict):
                metadata["payment_amount"] = data.get("amount")
                metadata["payment_method"] = data.get("method")
                metadata["payment_type"] = data.get("payment_type")
                metadata["payment_reference"] = data.get("reference_number")
        return metadata
