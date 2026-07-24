from rest_framework import viewsets, permissions
from .models import Expense, ExpenseCategory, Vendor
from .serializers import ExpenseSerializer, ExpenseCategorySerializer, VendorSerializer
from .filters import ExpenseFilter


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("trailer", "category", "vendor", "branch").all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = ExpenseFilter
    search_fields = ["expense_number", "vendor_name_freeform", "notes"]
    ordering_fields = ["date", "amount", "created_at"]



class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]
