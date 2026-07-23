from rest_framework import viewsets, permissions
from .models import Client, ClientDocument, ClientNote
from .serializers import ClientSerializer, ClientDocumentSerializer, ClientNoteSerializer
from .filters import ClientFilter


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.select_related("branch").prefetch_related("documents", "client_notes").all()
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = ClientFilter
    search_fields = ["name", "contact_person", "email", "contact_phone", "code"]
    ordering_fields = ["name", "created_at", "outstanding_balance", "credit_limit"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ClientDocumentViewSet(viewsets.ModelViewSet):
    queryset = ClientDocument.objects.select_related("client").all()
    serializer_class = ClientDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["client"]


class ClientNoteViewSet(viewsets.ModelViewSet):
    queryset = ClientNote.objects.select_related("client", "author").all()
    serializer_class = ClientNoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["client"]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
