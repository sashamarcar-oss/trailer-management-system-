from rest_framework.routers import DefaultRouter
from .views import RentalViewSet, RentalInspectionViewSet

router = DefaultRouter()
router.register("inspections", RentalInspectionViewSet, basename="rental-inspection")
router.register("", RentalViewSet, basename="rental")

urlpatterns = router.urls
