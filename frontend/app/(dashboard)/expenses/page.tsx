"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/ui/ModuleHeader";
import { Table, Column } from "@/components/ui/Table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { ExpenseForm } from "@/components/modules/expenses/expense-form";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { expenseStatuses } from "@/lib/validations/expense";
import { Expense, Paginated } from "@/types";

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    const role = user?.role_name?.toLowerCase();
    setIsAdmin(role === "super_admin" || role === "administrator");
    refresh();
  }, []);

  function refresh() {
    setLoading(true);
    api.expenses
      .list()
      .then((res: Paginated<Expense>) => setRows(res.results))
      .finally(() => setLoading(false));
  }

  async function changeStatus(expense: Expense, status: Expense["status"]) {
    if (status === expense.status) return;
    setUpdatingId(expense.id);
    try {
      const updated = await api.expenses.update(expense.id, { status });
      setRows((prev) => prev.map((row) => (row.id === expense.id ? updated : row)));
      toast.success(`Expense ${expense.id} status changed to ${status}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? "Could not update the expense status.");
      refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  const total = rows.reduce((sum, e) => sum + Number(e.amount), 0);

  const columns: Column<Expense>[] = [
    { key: "id", label: "Expense #" },
    { key: "date", label: "Date" },
    { key: "trailer", label: "Trailer", render: (r) => r.trailer || "—" },
    { key: "category", label: "Category" },
    { key: "vendor", label: "Vendor" },
    { key: "amount", label: "Amount", render: (r) => `KES ${Number(r.amount).toLocaleString()}` },
    {
      key: "status",
      label: isAdmin ? "Status (edit)" : "Status",
      render: (r) => isAdmin ? (
        <Select
          value={r.status}
          onValueChange={(status) => changeStatus(r, status as Expense["status"])}
          disabled={updatingId === r.id}
        >
          <SelectTrigger className="h-8 w-36" aria-label={`Edit status for expense ${r.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {expenseStatuses.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : <Badge status={r.status} />,
    },
  ];

  return (
    <div>
      <ModuleHeader
        title="Expense management"
        subtitle={`KES ${total.toLocaleString()} recorded`}
        actionLabel="Record expense"
        onAction={() => setFormOpen(true)}
      />
      <Table columns={columns} rows={rows} loading={loading} getRowKey={(r) => r.id} />

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(expense) => setRows((prev) => [expense, ...prev])}
      />
    </div>
  );
}
