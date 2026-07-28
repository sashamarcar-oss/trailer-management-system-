from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, ClientDocumentSigningRequestViewSet, ClientDocumentViewSet, ClientNoteViewSet

router = DefaultRouter()
router.register("documents", ClientDocumentViewSet, basename="client-document")
router.register("signing-requests", ClientDocumentSigningRequestViewSet, basename="client-signing-request")
router.register("notes", ClientNoteViewSet, basename="client-note")
router.register("", ClientViewSet, basename="client")

urlpatterns = router.urls
