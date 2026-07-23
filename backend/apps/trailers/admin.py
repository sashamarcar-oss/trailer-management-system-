from django.contrib import admin
from .models import Trailer, TrailerImage, TrailerDocument, MaintenanceRecord, DamageReport

admin.site.register(Trailer)
admin.site.register(TrailerImage)
admin.site.register(TrailerDocument)
admin.site.register(MaintenanceRecord)
admin.site.register(DamageReport)
