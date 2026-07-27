from rest_framework import serializers
from .models import Rental, RentalInspection


class RentalInspectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RentalInspection
        fields = "__all__"
        read_only_fields = ["inspected_by"]


class RentalSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    trailer_number = serializers.CharField(source="trailer.trailer_number", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    inspections = RentalInspectionSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = Rental
        fields = "__all__"
        read_only_fields = [
            "rental_number", "created_by", "created_at", "updated_at", "status",
            "actual_return_date", "confirmed_at", "confirmed_by", "cancelled_at", "cancelled_by",
            "cancellation_reason", "deposit_received", "deposit_refunded", "deposit_forfeited", "deposit_notes",
        ]

    def get_total(self, obj):
        return (
            obj.rate - obj.discount + obj.tax + obj.fuel_charges +
            obj.extra_charges + obj.late_return_charges + obj.damage_charges
        )

    def validate(self, attrs):
        if self.instance and "status" in attrs and attrs["status"] != self.instance.status:
            raise serializers.ValidationError({"status": "Use the rental lifecycle actions to change status."})
        trailer = attrs.get("trailer", getattr(self.instance, "trailer", None))
        pickup = attrs.get("pickup_date", getattr(self.instance, "pickup_date", None))
        ret = attrs.get("return_date", getattr(self.instance, "return_date", None))
        if trailer and pickup and ret:
            overlapping = Rental.objects.filter(
                trailer=trailer, status__in=["reserved", "active"],
                pickup_date__lte=ret, return_date__gte=pickup,
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                raise serializers.ValidationError(
                    "This trailer is already booked for an overlapping date range."
                )
        return attrs
