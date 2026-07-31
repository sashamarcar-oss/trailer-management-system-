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
  Reserved: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "Under Maintenance": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "Partially Paid": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Damaged: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  Overdue: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  Cancelled: "bg-muted text-muted-foreground",
  Draft: "bg-muted text-muted-foreground",
  Expired: "bg-muted text-muted-foreground",
  Retired: "bg-muted text-muted-foreground",
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
