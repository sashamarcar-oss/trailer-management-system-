import django_filters
from .models import Client


class ClientFilter(django_filters.FilterSet):
    min_credit_limit = django_filters.NumberFilter(field_name="credit_limit", lookup_expr="gte")

    class Meta:
        model = Client
        fields = ["client_type", "city", "blacklisted", "preferred_payment_terms", "branch"]
