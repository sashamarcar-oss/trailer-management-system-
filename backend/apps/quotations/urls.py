from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import QuotationResponseView, QuotationViewSet

router = DefaultRouter()
router.register("", QuotationViewSet, basename="quotation")

urlpatterns = [
    path("respond/<uuid:token>/", QuotationResponseView.as_view(), name="quotation-respond"),
    *router.urls,
]
