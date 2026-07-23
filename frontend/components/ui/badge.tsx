import * as React from "react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Available: "bg-teal-light text-teal",
  Active: "bg-teal-light text-teal",
  Approved: "bg-teal-light text-teal",
  Paid: "bg-teal-light text-teal",
  Accepted: "bg-teal-light text-teal",
  Rented: "bg-blue-light text-blue",
  Completed: "bg-blue-light text-blue",
  Reserved: "bg-amber-100 text-amber-800",
  Pending: "bg-amber-100 text-amber-800",
  "Under Maintenance": "bg-amber-100 text-amber-800",
  "Partially Paid": "bg-amber-100 text-amber-800",
  Damaged: "bg-red-100 text-red-800",
  Overdue: "bg-red-100 text-red-800",
  Rejected: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-100 text-gray-600",
  Draft: "bg-gray-100 text-gray-600",
  Expired: "bg-gray-100 text-gray-600",
  Retired: "bg-gray-100 text-gray-600",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-blue-light text-blue"
      )}
    >
      {status}
    </span>
  );
}
