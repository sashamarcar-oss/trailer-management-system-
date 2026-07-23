from rest_framework import viewsets, permissions
from .models import Rental, RentalInspection
from .serializers import RentalSerializer, RentalInspectionSerializer
from .filters import RentalFilter


class RentalViewSet(viewsets.ModelViewSet):
    queryset = Rental.objects.select_related("client", "trailer", "quotation").prefetch_related("inspections").all()
    serializer_class = RentalSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = RentalFilter
    search_fields = ["rental_number", "client__name", "trailer__trailer_number"]
    ordering_fields = ["pickup_date", "return_date", "created_at"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class RentalInspectionViewSet(viewsets.ModelViewSet):
    queryset = RentalInspection.objects.select_related("rental").all()
    serializer_class = RentalInspectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["rental", "stage"]

    def perform_create(self, serializer):
        serializer.save(inspected_by=self.request.user)
