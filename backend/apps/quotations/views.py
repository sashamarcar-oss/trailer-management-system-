from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Quotation
from .serializers import QuotationSerializer


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.select_related("client").prefetch_related("items").all()
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "client"]
    search_fields = ["quotation_number", "client__name"]
    ordering_fields = ["issue_date", "expiry_date"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def convert_to_rental(self, request, pk=None):
        """Converts an accepted quotation directly into a rental (Module 5 requirement)."""
        quotation = self.get_object()
        if quotation.status != "accepted":
            return Response({"detail": "Only accepted quotations can be converted."}, status=400)
        # In a full implementation, create the Rental + RentalItems here from
        # quotation.items and return the new rental's serialized data.
        return Response({"detail": f"{quotation.quotation_number} ready for conversion.", "quotation_id": quotation.id})
