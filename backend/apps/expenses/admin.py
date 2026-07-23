from django.contrib import admin
from .models import Expense, ExpenseCategory, Vendor

admin.site.register(Expense)
admin.site.register(ExpenseCategory)
admin.site.register(Vendor)
