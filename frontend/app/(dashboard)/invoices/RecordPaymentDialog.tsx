"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { Invoice, PaymentMethod, PaymentPayload } from "./types-and-api-notes"
import { paymentApi } from "./invoice-api"
import { kes } from "./invoice-utils"

const METHODS: PaymentMethod[] = ["M-Pesa", "Bank Transfer", "Cash", "Cheque", "Other"]

function apiErrorMessage(error: unknown) {
  const data = error && typeof error === "object" && "response" in error
    ? (error as { response?: { data?: unknown } }).response?.data : undefined
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>).map(([field, value]) =>
      `${field}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
    ).join("; ")
  }
  return error instanceof Error ? error.message : "Couldn't record this payment."
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function RecordPaymentDialog({
  invoice,
  onClose,
  onRecorded,
  mode = "payment",
}: {
  invoice: Invoice | null // null = closed
  onClose: () => void
  onRecorded: () => Promise<void> | void
  mode?: "payment" | "refund"
}) {
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>("M-Pesa")
  const [reference, setReference] = useState("")
  const [paidAt, setPaidAt] = useState(todayISO())
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (invoice) {
      setAmount(mode === "refund" ? invoice.amountPaid : invoice.balance)
      setMethod("M-Pesa")
      setReference("")
      setPaidAt(todayISO())
      setNotes("")
      setError("")
    }
  }, [invoice])

  if (!invoice) return null

  const isRefund = mode === "refund"
  const amountLimit = isRefund ? invoice.amountPaid : invoice.balance

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (amount <= 0) { setError("Payment amount must be greater than zero."); return }
    if (invoice && amount > amountLimit + 0.01) {
      setError(isRefund ? `That's more than the paid amount of ${kes(invoice.amountPaid)}.` : `That's more than the outstanding balance of ${kes(invoice.balance)}. Enter the exact amount received.`)
      return
    }

    const payload: PaymentPayload = { amount, method, reference: reference.trim() || undefined, paidAt, notes: notes.trim() || undefined }

    setSaving(true)
    try {
      await paymentApi.record(invoice!.id, payload, isRefund ? "refund" : "partial")
      await onRecorded()
      onClose()
    } catch (error) {
      setError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{isRefund ? "Refund payment" : "Record Payment"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.invoiceNumber} · {invoice.clientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

          <div className="flex justify-between text-sm rounded-lg bg-muted/40 border border-border px-4 py-3">
            <span className="text-muted-foreground">{isRefund ? "Amount paid" : "Outstanding balance"}</span>
            <span className="font-bold text-teal-700">{kes(amountLimit)}</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isRefund ? "Amount to refund" : "Amount received"} *</label>
            <input
              type="number" min={0} step="0.01" value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
              required
            />
            <button
              type="button"
              onClick={() => setAmount(amountLimit)}
              className="text-xs text-teal-700 font-semibold mt-1 hover:text-teal-800"
            >
              {isRefund ? "Refund full amount" : "Pay full balance"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date received</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reference {method === "M-Pesa" ? "(M-Pesa code)" : method === "Cheque" ? "(cheque #)" : "(optional)"}
            </label>
            <input value={reference} onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
              placeholder={method === "M-Pesa" ? "e.g. QJI8X7Y2Z1" : ""} />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          {!isRefund && amount > 0 && amount < invoice.balance && (
            <p className="text-xs text-amber-600">
              This is a partial payment. Remaining balance after this: {kes(invoice.balance - amount)}.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Saving…" : isRefund ? "Refund payment" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
