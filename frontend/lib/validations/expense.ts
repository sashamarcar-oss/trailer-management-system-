import { z } from "zod";

export const expenseCategories = [
  "Fuel", "Repairs", "Maintenance", "Tyres", "Insurance", "License", "Staff",
  "Office", "Utilities", "Cleaning", "Parking", "Security", "Marketing",
  "Legal", "Equipment", "Travel", "Miscellaneous",
] as const;

export const paymentMethods = ["Cash", "Bank", "Cheque", "Mobile Money", "Card"] as const;
export const expenseStatuses = ["Pending", "Approved", "Rejected"] as const;

export const expenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  trailer: z.string().optional(),
  category: z.enum(expenseCategories, { required_error: "Select a category" }),
  vendor: z.string().min(1, "Vendor is required"),
  amount: z
    .number({ invalid_type_error: "Amount is required" })
    .positive("Amount must be greater than zero"),
  paymentMethod: z.enum(paymentMethods, { required_error: "Select a payment method" }),
  status: z.enum(expenseStatuses, { required_error: "Select a status" }),
  branch: z.string().optional(),
  notes: z.string().optional(),
  recurring: z.boolean().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
