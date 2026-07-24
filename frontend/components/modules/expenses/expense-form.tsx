"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  expenseSchema, expenseCategories, paymentMethods, expenseStatuses, ExpenseFormValues,
} from "@/lib/validations/expense";
import { Expense } from "@/types";
import { api } from "@/lib/api";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Expense | null;
  onSaved: (expense: Expense, isEdit: boolean) => void;
}

export function ExpenseForm({ open, onOpenChange, editing, onSaved }: ExpenseFormProps) {
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      status: "Pending",
    },
  });

  useEffect(() => {
    reset(editing ? {
      date: editing.date, trailer: editing.trailer || "", category: editing.category as ExpenseFormValues["category"],
      vendor: editing.vendor || "", amount: Number(editing.amount), paymentMethod: editing.paymentMethod as ExpenseFormValues["paymentMethod"],
      status: editing.status, notes: editing.notes || "", branch: "",
    } : { date: new Date().toISOString().slice(0, 10), trailer: "", category: undefined, vendor: "", amount: undefined, paymentMethod: undefined, status: "Pending", notes: "", branch: "" });
  }, [editing, open, reset]);

  async function onSubmit(values: ExpenseFormValues) {
    try {
      const payload = {
        date: values.date,
        category_name: values.category,
        vendor_name: values.vendor,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        status: values.status,
        notes: values.notes,
      } as const;

      if (values.trailer) {
        (payload as any).trailer_number = values.trailer;
      }
      if (values.branch) {
        (payload as any).branch_name = values.branch;
      }

      const saved = editing ? await api.expenses.update(editing.id, payload) : await api.expenses.create(payload);
      onSaved(saved, Boolean(editing));
      toast.success(`Expense ${saved.id} ${editing ? "updated" : "recorded"}`);
      reset();
      onOpenChange(false);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.response?.data ?? error?.message;
      const message = typeof detail === "string" ? detail : JSON.stringify(detail);
      toast.error(`Couldn't record the expense. ${message || "Try again."}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Record an expense"}</DialogTitle>
          <DialogDescription>Log an operational expense against a trailer or the business.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-xs text-red-600 mt-1">{errors.date.message}</p>}
            </div>
            <div>
              <Label htmlFor="trailer">Trailer (optional)</Label>
              <Input id="trailer" placeholder="TR-027" {...register("trailer")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v as any, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-600 mt-1">{errors.category.message}</p>}
            </div>
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Input id="vendor" placeholder="Nairobi Diesel Works" {...register("vendor")} />
              {errors.vendor && <p className="text-xs text-red-600 mt-1">{errors.vendor.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input id="amount" type="number" placeholder="45000" {...register("amount", { valueAsNumber: true })} />
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <Label>Payment method</Label>
              <Select value={watch("paymentMethod")} onValueChange={(v) => setValue("paymentMethod", v as any, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.paymentMethod && <p className="text-xs text-red-600 mt-1">{errors.paymentMethod.message}</p>}
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={watch("status")}
              onValueChange={(v) => setValue("status", v as ExpenseFormValues["status"], { shouldValidate: true })}
            >
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {expenseStatuses.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.status && <p className="text-xs text-red-600 mt-1">{errors.status.message}</p>}
          </div>

          <div>
            <Label htmlFor="branch">Branch (optional)</Label>
            <Input id="branch" placeholder="Nairobi HQ" {...register("branch")} />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" placeholder="Additional detail for this expense" {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : editing ? "Save changes" : "Save expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
