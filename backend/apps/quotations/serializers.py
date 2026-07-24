from rest_framework import serializers
from .models import Quotation, QuotationItem


class QuotationItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = QuotationItem
        fields = "__all__"
        read_only_fields = ["quotation"]


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, required=False)
    client_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    converted_rental_id = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = "__all__"
        read_only_fields = ["quotation_number", "issue_date", "created_by", "created_at"]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        quotation = Quotation.objects.create(**validated_data)
        for item in items_data:
            QuotationItem.objects.create(quotation=quotation, **item)
        return quotation

    def validate(self, attrs):
        # ``client_name`` is represented as the linked client's name when a
        # client exists, but remains writable for prospect quotations.
        for field in ("client_name", "client_email", "client_phone"):
            if field in self.initial_data:
                attrs[field] = self.initial_data[field]
        return attrs

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                QuotationItem.objects.create(quotation=instance, **item)
        return instance

    def get_client_name(self, obj):
        return obj.client.name if obj.client else obj.client_name

    def get_converted_rental_id(self, obj):
        rental = obj.rentals.order_by("id").first()
        return rental.id if rental else None
