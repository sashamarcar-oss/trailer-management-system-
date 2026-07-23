from rest_framework import serializers
from .models import Expense, ExpenseCategory, Vendor
from apps.trailers.models import Trailer
from apps.core.models import Branch


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = "__all__"


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = "__all__"


class ExpenseSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(read_only=True)
    vendor = serializers.PrimaryKeyRelatedField(read_only=True, required=False)
    trailer = serializers.PrimaryKeyRelatedField(read_only=True, required=False)
    branch = serializers.PrimaryKeyRelatedField(read_only=True, required=False)
    payment_method = serializers.CharField(read_only=True)

    category_name = serializers.CharField(write_only=True, required=True)
    vendor_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    trailer_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    branch_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    paymentMethod = serializers.CharField(write_only=True)
    status = serializers.CharField(required=False, allow_blank=True)
    category_display = serializers.CharField(source="category.name", read_only=True)
    vendor_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = ["expense_number", "approved_by", "created_at"]

    def get_vendor_display(self, obj):
        return obj.vendor.name if obj.vendor else obj.vendor_name_freeform

    def validate_paymentMethod(self, value):
        mapping = {
            "cash": "cash",
            "bank": "bank",
            "cheque": "cheque",
            "mobile money": "mobile_money",
            "mobile_money": "mobile_money",
            "card": "card",
        }
        normalized = value.strip().lower()
        return mapping.get(normalized, normalized)

    def validate_status(self, value):
        return value.strip().lower() if isinstance(value, str) and value else "pending"

    def create(self, validated_data):
        validated_data = self._prepare_related_data(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._prepare_related_data(validated_data)
        return super().update(instance, validated_data)

    def _prepare_related_data(self, validated_data):
        category_name = validated_data.pop("category_name", None)
        vendor_name = validated_data.pop("vendor_name", None)
        trailer_number = validated_data.pop("trailer_number", None)
        branch_name = validated_data.pop("branch_name", None)
        payment_method = validated_data.pop("paymentMethod", None)

        if payment_method is not None:
            validated_data["payment_method"] = payment_method

        if category_name:
            category, _ = ExpenseCategory.objects.get_or_create(name=category_name)
            validated_data["category"] = category

        if vendor_name:
            vendor = Vendor.objects.filter(name__iexact=vendor_name).first()
            if vendor:
                validated_data["vendor"] = vendor
            else:
                validated_data["vendor_name_freeform"] = vendor_name

        if trailer_number:
            trailer = Trailer.objects.filter(trailer_number__iexact=trailer_number).first()
            validated_data["trailer"] = trailer

        if branch_name:
            branch = Branch.objects.filter(name__iexact=branch_name).first()
            validated_data["branch"] = branch

        return validated_data
