import django_filters
from .models import Trailer


class TrailerFilter(django_filters.FilterSet):
    next_inspection_before = django_filters.DateFilter(field_name="next_inspection_date", lookup_expr="lte")
    insurance_expiry_before = django_filters.DateFilter(field_name="insurance_expiry", lookup_expr="lte")

    class Meta:
        model = Trailer
        fields = ["status", "trailer_type", "branch", "yard_location"]
