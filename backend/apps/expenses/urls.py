from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet, ExpenseCategoryViewSet, VendorViewSet

router = DefaultRouter()
router.register("categories", ExpenseCategoryViewSet, basename="expense-category")
router.register("vendors", VendorViewSet, basename="vendor")
router.register("", ExpenseViewSet, basename="expense")

urlpatterns = router.urls
