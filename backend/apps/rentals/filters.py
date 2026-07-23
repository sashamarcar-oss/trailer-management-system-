import django_filters
from .models import Rental


class RentalFilter(django_filters.FilterSet):
    pickup_after = django_filters.DateFilter(field_name="pickup_date", lookup_expr="gte")
    return_before = django_filters.DateFilter(field_name="return_date", lookup_expr="lte")

    class Meta:
        model = Rental
        fields = ["status", "rental_type", "client", "trailer"]
