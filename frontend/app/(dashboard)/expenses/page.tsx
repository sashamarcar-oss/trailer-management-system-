"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
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
import { DetailsDialog } from "@/components/ui/DetailsDialog";

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);

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
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewing(r)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-700 hover:bg-teal-50"><Eye className="h-3.5 w-3.5" /> View</button>
          <button onClick={() => { setEditing(r); setFormOpen(true); }} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button onClick={async () => { if (!window.confirm(`Delete expense ${r.id}?`)) return; try { await api.expenses.remove(r.id); setRows((prev) => prev.filter((expense) => expense.id !== r.id)); toast.success("Expense deleted"); } catch (error: any) { toast.error(error?.response?.data?.detail || "Could not delete the expense."); } }} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <ModuleHeader
        title="Expense management"
        subtitle={`KES ${total.toLocaleString()} recorded`}
        actionLabel="Record expense"
        onAction={() => { setEditing(null); setFormOpen(true); }}
      />
      <Table columns={columns} rows={rows} loading={loading} getRowKey={(r) => r.id} />

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={(expense, isEdit) => setRows((prev) => isEdit ? prev.map((row) => row.id === expense.id ? expense : row) : [expense, ...prev])}
      />
      <DetailsDialog
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing ? `Expense ${viewing.id}` : "Expense details"}
        description={viewing?.category}
        fields={viewing ? [
          { label: "Date", value: viewing.date }, { label: "Status", value: viewing.status },
          { label: "Amount", value: `KES ${Number(viewing.amount).toLocaleString()}` }, { label: "Trailer", value: viewing.trailer },
          { label: "Vendor", value: viewing.vendor }, { label: "Payment method", value: viewing.paymentMethod },
          { label: "Notes", value: viewing.notes },
        ] : []}
      />
    </div>
  );
}
