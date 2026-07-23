from rest_framework.routers import DefaultRouter
from .views import TrailerViewSet, MaintenanceRecordViewSet, DamageReportViewSet

router = DefaultRouter()
router.register("", TrailerViewSet, basename="trailer")
router.register("maintenance-records", MaintenanceRecordViewSet, basename="maintenance-record")
router.register("damage-reports", DamageReportViewSet, basename="damage-report")

urlpatterns = router.urls
