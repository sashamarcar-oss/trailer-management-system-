from decimal import Decimal
from rest_framework import serializers
from .models import Invoice, InvoiceItem, Payment


class InvoiceItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceItem
        fields = "__all__"
        read_only_fields = ["invoice"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["payment_date", "recorded_by"]
        extra_kwargs = {"client": {"required": False}}


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, read_only=True)
    client_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    sourceType = serializers.SerializerMethodField()
    sourceId = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = ["invoice_number", "invoice_date", "created_by", "created_at"]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        invoice = Invoice.objects.create(**validated_data)
        for item in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item)
        return invoice

    def validate(self, attrs):
        for field in ("client_name", "client_email", "client_phone"):
            if field in self.initial_data:
                attrs[field] = self.initial_data[field]

        items = self.initial_data.get("items") or []
        for idx, item in enumerate(items):
            quantity = int(item.get("quantity") or 0)
            unit_price = Decimal(str(item.get("unit_price") or 0))
            if quantity < 1:
                raise serializers.ValidationError({"items": f"Line {idx + 1}: quantity must be at least 1."})
            if unit_price <= 0:
                raise serializers.ValidationError({"items": f"Line {idx + 1}: unit_price must be greater than zero."})
        return attrs

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                InvoiceItem.objects.create(invoice=instance, **item)
        return instance

    def get_client_name(self, obj):
        return obj.client.name if obj.client else obj.client_name

    def get_sourceType(self, obj):
        if obj.quotation is not None:
            return "quotation"
        if obj.rental is not None:
            return "rental"
        return None

    def get_sourceId(self, obj):
        if obj.quotation is not None:
            return str(obj.quotation.id)
        if obj.rental is not None:
            return str(obj.rental.id)
        return None
