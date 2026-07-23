from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/auth/", include("apps.users.auth_urls")),
    path("api/users/", include("apps.users.urls")),
    path("api/clients/", include("apps.clients.urls")),
    path("api/trailers/", include("apps.trailers.urls")),
    path("api/rentals/", include("apps.rentals.urls")),
    path("api/quotations/", include("apps.quotations.urls")),
    path("api/invoices/", include("apps.invoices.urls")),
    path("api/expenses/", include("apps.expenses.urls")),
    path("api/core/", include("apps.core.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
