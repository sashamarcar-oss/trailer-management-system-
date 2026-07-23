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
            model_name = resource.replace("-", " ").rstrip("s").title().replace(" ", "")
            if len(parts) >= 3 and parts[2] and parts[2] != "":
                object_id = parts[2]

        if not object_id:
            data = getattr(response, "data", None)
            if isinstance(data, dict):
                object_id = str(data.get("id") or data.get("pk") or "")

        return model_name, object_id

    def _build_metadata(self, request, response):
        metadata = {
            "status_code": getattr(response, "status_code", None),
        }
        if request.method == "POST" and request.path.endswith("/login/"):
            metadata["login_email"] = request.data.get("email") if hasattr(request, "data") else None
        return metadata
