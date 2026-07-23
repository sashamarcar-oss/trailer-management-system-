from rest_framework import viewsets, permissions
from .models import Expense, ExpenseCategory, Vendor
from .serializers import ExpenseSerializer, ExpenseCategorySerializer, VendorSerializer
from .filters import ExpenseFilter
from apps.users.permissions import IsAccountant, IsAdministratorOrAbove


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("trailer", "category", "vendor", "branch").all()
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = ExpenseFilter
    search_fields = ["expense_number", "vendor_name_freeform", "notes"]
    ordering_fields = ["date", "amount", "created_at"]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAccountant()]
        if self.action in ("update", "partial_update"):
            return [IsAdministratorOrAbove()]
        return super().get_permissions()


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]
