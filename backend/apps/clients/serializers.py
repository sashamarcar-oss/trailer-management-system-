from rest_framework import serializers
from .models import Client, ClientDocument, ClientNote


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
    client_type_display = serializers.CharField(source="get_client_type_display", read_only=True)
    preferred_payment_terms_display = serializers.CharField(source="get_preferred_payment_terms_display", read_only=True)

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["code", "outstanding_balance", "created_by", "created_at", "updated_at"]

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
            if not attrs.get("national_id", getattr(self.instance, "national_id", "")) and \
               not attrs.get("passport", getattr(self.instance, "passport", "")):
                raise serializers.ValidationError({"national_id": "Provide a National ID or Passport number."})
        return attrs
