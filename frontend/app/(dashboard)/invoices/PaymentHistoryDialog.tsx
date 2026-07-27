"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { kes } from "./invoice-utils"
import type { Invoice } from "./types-and-api-notes"

function formatPaymentDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
}

export function PaymentHistoryDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!invoice) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment history</DialogTitle>
          <DialogDescription>
            {invoice.invoiceNumber} · {invoice.clientName}
          </DialogDescription>
        </DialogHeader>

        {invoice.payments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            No payments have been recorded for this invoice yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Method</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Reference</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-2 text-muted-foreground">{formatPaymentDate(payment.paidAt)}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{kes(payment.amount)}</td>
                    <td className="px-3 py-2 text-foreground">{payment.method}</td>
                    <td className="px-3 py-2 text-muted-foreground">{payment.reference || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{payment.recordedBy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
