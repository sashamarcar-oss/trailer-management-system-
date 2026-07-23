"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { api } from "@/lib/api"
import type { ClientLite, Invoice, InvoicePayload } from "./types-and-api-notes"
import { DEFAULT_VAT_PERCENT, computeTotals, kes, lineItemAmount } from "./invoice-utils"

type DraftLineItem = {
  key: string
  trailerId?: string | null
  description: string
  quantity: number
  rate: number
  rateUnit: "day" | "week" | "month" | "flat"
}

function emptyLineItem(): DraftLineItem {
  return { key: crypto.randomUUID(), description: "", quantity: 1, rate: 0, rateUnit: "day" }
}
function todayISO() { return new Date().toISOString().slice(0, 10) }
function in30DaysISO() {
  const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
}

export function InvoiceFormDialog({
  open,
  onClose,
  onSave,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSave: (payload: InvoicePayload) => Promise<void>
  editing: Invoice | null // null = creating standalone; pre-filled invoices from quotation/rental should be created via api.invoices.fromQuotation/fromRental instead of this form
}) {
  const [clientId, setClientId] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [date, setDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState(in30DaysISO())
  const [items, setItems] = useState<DraftLineItem[]>([emptyLineItem()])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [vatPercent, setVatPercent] = useState(DEFAULT_VAT_PERCENT)
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("Payment due within 30 days of invoice date.")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [clients, setClients] = useState<ClientLite[]>([])

  useEffect(() => {
    if (!open) return
    api.clients?.list?.().then((res: { results: ClientLite[] }) => setClients(res.results)).catch(() => setClients([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setClientId(editing.clientId || "")
      setClientName(editing.clientName)
      setClientEmail(editing.clientEmail || "")
      setClientPhone(editing.clientPhone || "")
      setDate(editing.date?.slice(0, 10) || todayISO())
      setDueDate(editing.dueDate?.slice(0, 10) || in30DaysISO())
      setItems(
        editing.lineItems.length
          ? editing.lineItems.map((li) => ({
              key: li.id || crypto.randomUUID(), trailerId: li.trailerId,
              description: li.description, quantity: li.quantity, rate: li.rate, rateUnit: li.rateUnit,
            }))
          : [emptyLineItem()],
      )
      setDiscountPercent(editing.discountPercent || 0)
      setVatPercent(editing.vatPercent ?? DEFAULT_VAT_PERCENT)
      setNotes(editing.notes || "")
      setTerms(editing.terms || "")
    } else {
      setClientId(""); setClientName(""); setClientEmail(""); setClientPhone("")
      setDate(todayISO()); setDueDate(in30DaysISO())
      setItems([emptyLineItem()])
      setDiscountPercent(0); setVatPercent(DEFAULT_VAT_PERCENT)
      setNotes(""); setTerms("Payment due within 30 days of invoice date.")
    }
    setError("")
  }, [open, editing])

  const totals = useMemo(() => computeTotals(items, discountPercent, vatPercent), [items, discountPercent, vatPercent])

  if (!open) return null

  function updateItem(key: string, patch: Partial<DraftLineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }
  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev))
  }
  function addItem() { setItems((prev) => [...prev, emptyLineItem()]) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!clientName.trim()) { setError("Client name is required."); return }
    if (items.some((it) => !it.description.trim())) { setError("Every line item needs a description."); return }
    if (new Date(dueDate) < new Date(date)) { setError("Due date can't be before the invoice date."); return }

    const payload: InvoicePayload = {
      clientId: clientId || null,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      date, dueDate,
      lineItems: items.map((it) => ({
        trailerId: it.trailerId || null, description: it.description.trim(),
        quantity: Number(it.quantity) || 0, rate: Number(it.rate) || 0, rateUnit: it.rateUnit,
      })),
      discountPercent: Number(discountPercent) || 0,
      vatPercent: Number(vatPercent) || 0,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
    }

    setSaving(true)
    try {
      await onSave(payload)
      onClose()
    } catch {
      setError("Couldn't save this invoice. Please check the details and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? `Edit ${editing.invoiceNumber}` : "New Invoice"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

          {editing?.sourceType && (
            <div className="px-4 py-2.5 rounded-lg bg-blue-50 text-blue-700 text-xs border border-blue-200">
              Generated from {editing.sourceType} #{editing.sourceId}. Editing here only changes the invoice, not the source record.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</label>
              <select
                value={clientId}
                onChange={(e) => {
                  const id = e.target.value; setClientId(id)
                  const c = clients.find((cl) => cl.id === id)
                  if (c) { setClientName(c.name); setClientEmail(c.email || ""); setClientPhone(c.phone || "") }
                }}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
              >
                <option value="">Type client details manually…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client name *</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" placeholder="e.g. Acme Logistics Ltd" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client email</label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" placeholder="billing@client.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client phone</label>
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" placeholder="07xx xxx xxx" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line items</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.key} className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg border border-border">
                  <input
                    value={it.description} onChange={(e) => updateItem(it.key, { description: e.target.value })}
                    placeholder="Description" className="col-span-4 px-2 py-2 rounded-lg border border-input bg-card text-xs" />
                  <input
                    type="number" min={0} value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })}
                    className="col-span-2 px-2 py-2 rounded-lg border border-input bg-card text-xs" />
                  <input
                    type="number" min={0} value={it.rate} onChange={(e) => updateItem(it.key, { rate: Number(e.target.value) })}
                    className="col-span-2 px-2 py-2 rounded-lg border border-input bg-card text-xs" />
                  <select
                    value={it.rateUnit} onChange={(e) => updateItem(it.key, { rateUnit: e.target.value as DraftLineItem["rateUnit"] })}
                    className="col-span-2 px-2 py-2 rounded-lg border border-input bg-card text-xs">
                    <option value="day">per day</option>
                    <option value="week">per week</option>
                    <option value="month">per month</option>
                    <option value="flat">flat</option>
                  </select>
                  <div className="col-span-1 flex items-center justify-end pt-2">
                    <span className="text-xs font-semibold whitespace-nowrap">{kes(lineItemAmount(it))}</span>
                  </div>
                  <button type="button" onClick={() => removeItem(it.key)}
                    className="col-span-1 justify-self-end p-1.5 rounded hover:bg-red-50 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discount (%)</label>
              <input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT (%)</label>
              <input type="number" min={0} max={100} value={vatPercent} onChange={(e) => setVatPercent(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{kes(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount ({discountPercent}%)</span><span>- {kes(totals.discountAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">VAT ({vatPercent}%)</span><span>{kes(totals.vatAmount)}</span></div>
            <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border"><span>Total</span><span className="text-teal-700">{kes(totals.total)}</span></div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terms & conditions</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Create invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
