"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { api } from "@/lib/api"
import type { ClientLite, Quotation, QuotationPayload, TrailerLite } from "./types-and-api-notes"
import { DEFAULT_VAT_PERCENT, computeTotals, kes, lineItemAmount } from "./quotation-utils"

type DraftLineItem = {
  key: string // local-only key for React lists, not sent to API
  trailerId?: string | null
  description: string
  quantity: number
  rate: number
  rateUnit: "day" | "week" | "month" | "flat"
}

function emptyLineItem(): DraftLineItem {
  return { key: crypto.randomUUID(), description: "", quantity: 1, rate: 0, rateUnit: "day" }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function in14DaysISO() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

export function QuotationFormDialog({
  open,
  onClose,
  onSave,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSave: (payload: QuotationPayload) => Promise<void>
  editing: Quotation | null // null = creating a new quotation
}) {
  const [clientId, setClientId] = useState<string>("")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [issueDate, setIssueDate] = useState(todayISO())
  const [expiryDate, setExpiryDate] = useState(in14DaysISO())
  const [items, setItems] = useState<DraftLineItem[]>([emptyLineItem()])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [vatPercent, setVatPercent] = useState(DEFAULT_VAT_PERCENT)
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("Quotation valid for 14 days from issue date. Prices subject to change thereafter.")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [clients, setClients] = useState<ClientLite[]>([])
  const [trailers, setTrailers] = useState<TrailerLite[]>([])

  // Load reference data for pickers; degrade quietly if endpoints are missing.
  useEffect(() => {
    if (!open) return
    api.clients?.list?.().then((res: { results: ClientLite[] }) => setClients(res.results)).catch(() => setClients([]))
    api.trailers?.list?.().then((res) => setTrailers(res.results.map((trailer) => ({
      id: trailer.id,
      name: `${trailer.trailerNumber} - ${trailer.registrationNumber}`,
    })))).catch(() => setTrailers([]))
  }, [open])

  // Populate form when opening for edit, reset when opening for create.
  useEffect(() => {
    if (!open) return
    if (editing) {
      setClientId(editing.clientId || "")
      setClientName(editing.clientName)
      setClientEmail(editing.clientEmail || "")
      setClientPhone(editing.clientPhone || "")
      setIssueDate(editing.issueDate?.slice(0, 10) || todayISO())
      setExpiryDate(editing.expiryDate?.slice(0, 10) || in14DaysISO())
      setItems(
        editing.lineItems.length
          ? editing.lineItems.map((li) => ({
              key: li.id || crypto.randomUUID(),
              trailerId: li.trailerId,
              description: li.description,
              quantity: li.quantity,
              rate: li.rate,
              rateUnit: li.rateUnit,
            }))
          : [emptyLineItem()],
      )
      setDiscountPercent(editing.discountPercent || 0)
      setVatPercent(editing.vatPercent ?? DEFAULT_VAT_PERCENT)
      setNotes(editing.notes || "")
      setTerms(editing.terms || "")
    } else {
      setClientId(""); setClientName(""); setClientEmail(""); setClientPhone("")
      setIssueDate(todayISO()); setExpiryDate(in14DaysISO())
      setItems([emptyLineItem()])
      setDiscountPercent(0); setVatPercent(DEFAULT_VAT_PERCENT)
      setNotes("")
      setTerms("Quotation valid for 14 days from issue date. Prices subject to change thereafter.")
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
  function addItem() {
    setItems((prev) => [...prev, emptyLineItem()])
  }
  function pickTrailer(key: string, trailerId: string) {
    const t = trailers.find((tr) => tr.id === trailerId)
    updateItem(key, {
      trailerId: trailerId || null,
      description: t?.name || "",
      rate: t?.defaultRate ?? 0,
      rateUnit: t?.defaultRateUnit ?? "day",
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!clientName.trim()) { setError("Client name is required."); return }
    if (items.some((it) => !it.description.trim())) { setError("Every line item needs a description."); return }
    if (new Date(expiryDate) < new Date(issueDate)) { setError("Expiry date can't be before the issue date."); return }

    const payload: QuotationPayload = {
      clientId: clientId || null,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      issueDate,
      expiryDate,
      lineItems: items.map((it) => ({
        trailerId: it.trailerId || null,
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        rate: Number(it.rate) || 0,
        rateUnit: it.rateUnit,
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
      setError("Couldn't save this quotation. Please check the details and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? `Edit ${editing.quotationNumber}` : "New Quotation"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
          )}

          {/* Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</label>
              <select
                value={clientId}
                onChange={(e) => {
                  const id = e.target.value
                  setClientId(id)
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
              <input
                value={clientName} onChange={(e) => setClientName(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
                placeholder="e.g. Acme Logistics Ltd"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client email</label>
              <input
                type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
                placeholder="billing@client.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client phone</label>
              <input
                value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
                placeholder="07xx xxx xxx"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issue date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expiry date</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line items</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.key} className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg border border-border">
                  <select
                    value={it.trailerId || ""}
                    onChange={(e) => pickTrailer(it.key, e.target.value)}
                    className="col-span-3 px-2 py-2 rounded-lg border border-input bg-card text-xs"
                  >
                    <option value="">Custom item…</option>
                    {trailers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input
                    value={it.description}
                    onChange={(e) => updateItem(it.key, { description: e.target.value })}
                    placeholder="Description"
                    className="col-span-3 px-2 py-2 rounded-lg border border-input bg-card text-xs"
                  />
                  <input
                    type="number" min={0} value={it.quantity}
                    onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })}
                    className="col-span-1 px-2 py-2 rounded-lg border border-input bg-card text-xs"
                  />
                  <input
                    type="number" min={0} value={it.rate}
                    onChange={(e) => updateItem(it.key, { rate: Number(e.target.value) })}
                    className="col-span-2 px-2 py-2 rounded-lg border border-input bg-card text-xs"
                  />
                  <select
                    value={it.rateUnit}
                    onChange={(e) => updateItem(it.key, { rateUnit: e.target.value as DraftLineItem["rateUnit"] })}
                    className="col-span-2 px-2 py-2 rounded-lg border border-input bg-card text-xs"
                  >
                    <option value="day">per day</option>
                    <option value="week">per week</option>
                    <option value="month">per month</option>
                    <option value="flat">flat</option>
                  </select>
                  <div className="col-span-1 flex items-center justify-end gap-1 pt-2">
                    <span className="text-xs font-semibold whitespace-nowrap">{kes(lineItemAmount(it))}</span>
                  </div>
                  <button type="button" onClick={() => removeItem(it.key)}
                    className="col-span-12 sm:col-span-1 justify-self-end p-1.5 rounded hover:bg-red-50 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Discount / VAT */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discount (%)</label>
              <input type="number" min={0} max={100} value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT (%)</label>
              <input type="number" min={0} max={100} value={vatPercent}
                onChange={(e) => setVatPercent(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{kes(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount ({discountPercent}%)</span><span>- {kes(totals.discountAmount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">VAT ({vatPercent}%)</span><span>{kes(totals.vatAmount)}</span></div>
            <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border"><span>Total</span><span className="text-teal-700">{kes(totals.total)}</span></div>
          </div>

          {/* Notes / terms */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes (internal or client-facing)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terms & conditions</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Create quotation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
