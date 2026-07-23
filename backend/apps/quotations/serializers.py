from rest_framework import serializers
from .models import Quotation, QuotationItem


class QuotationItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = QuotationItem
        fields = "__all__"


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, required=False)
    client_name = serializers.CharField(source="client.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

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
