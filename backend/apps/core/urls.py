from rest_framework.routers import DefaultRouter
from .views import BranchViewSet, CompanySettingsViewSet, AuditLogViewSet, RecentActivityViewSet

router = DefaultRouter()
router.register("branches", BranchViewSet, basename="branch")
router.register("company-settings", CompanySettingsViewSet, basename="company-settings")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")
router.register("recent-activity", RecentActivityViewSet, basename="recent-activity")

urlpatterns = router.urls
