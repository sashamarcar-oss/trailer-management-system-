from rest_framework import serializers
from .models import Client, ClientDocument, ClientDocumentSigningRequest, DocumentSigningEvent, ClientNote


class DocumentSigningEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentSigningEvent
        fields = "__all__"


class ClientDocumentSigningRequestSerializer(serializers.ModelSerializer):
    events = DocumentSigningEventSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    rental_number = serializers.CharField(source="rental.rental_number", read_only=True, allow_null=True)
    contract_status_display = serializers.CharField(source="get_contract_status_display", read_only=True)
    inspection_status_display = serializers.CharField(source="get_inspection_status_display", read_only=True)
    is_complete = serializers.BooleanField(read_only=True)
    contract_pdf = serializers.FileField(read_only=True)
    inspection_pdf = serializers.FileField(read_only=True)
    signed_contract_file = serializers.FileField(read_only=True)
    signed_inspection_file = serializers.FileField(read_only=True)

    class Meta:
        model = ClientDocumentSigningRequest
        fields = [
            "id", "client", "client_name", "rental", "rental_number", "quotation", "token", "contract_pdf",
            "inspection_pdf", "signed_contract_file", "signed_inspection_file", "contract_status",
            "contract_status_display", "inspection_status", "inspection_status_display", "viewed_at",
            "signed_at", "uploaded_at", "verified_at", "notes", "created_at", "updated_at", "events", "is_complete"
        ]
        read_only_fields = [
            "token", "client", "rental", "quotation", "contract_pdf", "inspection_pdf",
            "signed_contract_file", "signed_inspection_file", "contract_status", "inspection_status",
            "viewed_at", "signed_at", "uploaded_at", "verified_at",
        ]


class ClientDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientDocument
        fields = "__all__"


class ClientNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientNote
        fields = "__all__"
        read_only_fields = ["author"]


class ClientSerializer(serializers.ModelSerializer):
    documents = ClientDocumentSerializer(many=True, read_only=True)
    client_notes = ClientNoteSerializer(many=True, read_only=True)
    document_signing_requests = ClientDocumentSigningRequestSerializer(many=True, read_only=True)
    client_type_display = serializers.CharField(source="get_client_type_display", read_only=True)
    preferred_payment_terms_display = serializers.CharField(source="get_preferred_payment_terms_display", read_only=True)
    drivers_license_file = serializers.FileField(write_only=True, required=False, allow_null=True)
    insurance_file = serializers.FileField(write_only=True, required=False, allow_null=True)
    dot_file = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["code", "created_by", "created_at", "updated_at"]

    def validate_client_type(self, value):
        return value.strip().lower()

    def validate_preferred_payment_terms(self, value):
        mapping = {
            "cash": "cash",
            "net 7": "net_7",
            "net 15": "net_15",
            "net 30": "net_30",
            "net 60": "net_60",
        }
        return mapping.get(value.strip().lower(), value.strip().lower())

    def create(self, validated_data):
        document_files = self._pop_document_files(validated_data)
        client = super().create(validated_data)
        self._create_client_documents(client, document_files)
        return client

    def update(self, instance, validated_data):
        document_files = self._pop_document_files(validated_data)
        client = super().update(instance, validated_data)
        self._create_client_documents(client, document_files)
        return client

    def _pop_document_files(self, validated_data):
        return {
            "drivers_license_file": validated_data.pop("drivers_license_file", None),
            "insurance_file": validated_data.pop("insurance_file", None),
            "dot_file": validated_data.pop("dot_file", None),
        }

    def _create_client_documents(self, client, files):
        labels = {
            "drivers_license_file": "Driver's license",
            "insurance_file": "Insurance document",
            "dot_file": "DOT documentation",
        }
        for field_name, file_obj in files.items():
            if file_obj:
                ClientDocument.objects.create(client=client, label=labels[field_name], file=file_obj)

    def validate(self, attrs):
        client_type = attrs.get("client_type", getattr(self.instance, "client_type", None))
        if client_type == "company":
            if not attrs.get("kra_pin", getattr(self.instance, "kra_pin", "")):
                raise serializers.ValidationError({"kra_pin": "KRA PIN is required for a company client."})
            if not attrs.get("business_registration", getattr(self.instance, "business_registration", "")):
                raise serializers.ValidationError({
                    "business_registration": "Business registration number is required for a company client."
                })
        if client_type == "individual":
            if not attrs.get("passport", getattr(self.instance, "passport", "")):
                raise serializers.ValidationError({"passport": "Passport number is required for an individual client."})
        return attrs
