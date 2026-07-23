from django.contrib import admin
from .models import Client, ClientDocument, ClientNote


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "client_type", "city", "outstanding_balance", "blacklisted"]
    list_filter = ["client_type", "blacklisted", "city"]
    search_fields = ["code", "name", "email"]


admin.site.register(ClientDocument)
admin.site.register(ClientNote)
