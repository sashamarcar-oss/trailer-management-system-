"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle, Copy, Download, Eye, FileText, MoreVertical,
  Pencil, Plus, Search, Send, Trash2, Ban, Wallet, Bell,
} from "lucide-react"
import { ModuleHeader } from "@/components/ui/ModuleHeader"
import { Table, Column } from "@/components/ui/Table"
import { Badge } from "@/components/ui/badge"
import type { Invoice, InvoicePayload, InvoiceStatus, Paginated } from "./types-and-api-notes"
import { invoiceApi } from "./invoice-api"
import {
  INVOICE_STATUSES, canDelete, canEdit, canRecordPayment, canRefund, canRemind, canSend, canVoid,
  computeAgingSummary, daysOverdue, exportInvoicePDF, exportInvoicesCSV, isOverdue, kes,
} from "./invoice-utils"
import { InvoiceFormDialog } from "./InvoiceFormDialog"
import { RecordPaymentDialog } from "./RecordPaymentDialog"
import { DetailsDialog } from "@/components/ui/DetailsDialog"

function StatCard({ label, value, valueClass = "text-teal-700" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  )
}

function ActionsMenu({ invoice, onAction }: { invoice: Invoice; onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ bottom: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const items: { key: string; label: string; icon: React.ReactNode; danger?: boolean }[] = [
    { key: "view", label: "View", icon: <Eye className="w-3.5 h-3.5" /> },
    ...(canEdit(invoice.status) ? [{ key: "edit", label: "Edit", icon: <Pencil className="w-3.5 h-3.5" /> }] : []),
    { key: "duplicate", label: "Duplicate", icon: <Copy className="w-3.5 h-3.5" /> },
    { key: "pdf", label: "Download PDF", icon: <Download className="w-3.5 h-3.5" /> },
    ...(canSend(invoice.status) ? [{ key: "send", label: "Send to client", icon: <Send className="w-3.5 h-3.5" /> }] : []),
    ...(canRecordPayment(invoice) ? [{ key: "payment", label: "Record payment", icon: <Wallet className="w-3.5 h-3.5" /> }] : []),
    ...(canRefund(invoice) ? [{ key: "refund", label: "Refund", icon: <Wallet className="w-3.5 h-3.5" /> }] : []),
    ...(canRemind(invoice) ? [{ key: "remind", label: "Send reminder", icon: <Bell className="w-3.5 h-3.5" /> }] : []),
    ...(canVoid(invoice.status) ? [{ key: "void", label: "Void invoice", icon: <Ban className="w-3.5 h-3.5" />, danger: true }] : []),
    ...(canDelete(invoice.status) ? [{ key: "delete", label: "Delete", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true }] : []),
  ]

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }); setOpen((o) => !o) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1" style={menuPosition || undefined}>
          {items.map((item) => (
            <button key={item.key} onClick={() => { setOpen(false); onAction(item.key) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted ${item.danger ? "text-red-600" : "text-foreground"}`}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All")
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [viewing, setViewing] = useState<Invoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)
  const [refundingInvoice, setRefundingInvoice] = useState<Invoice | null>(null)
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res: Paginated<Invoice> = await invoiceApi.list({
        search: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        overdueOnly: overdueOnly || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
      })
      setRows(res.results)
      setCount(res.count)
    } catch {
      setError("Unable to load invoices. Please try again.")
      setRows([]); setCount(0)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, overdueOnly, fromDate, toDate, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, overdueOnly, fromDate, toDate])

  const aging = useMemo(() => computeAgingSummary(rows), [rows])
  const stats = useMemo(() => {
    const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0)
    const overdueAmount = rows.filter(isOverdue).reduce((s, r) => s + r.balance, 0)
    const paidCount = rows.filter((r) => r.status === "Paid").length
    return { totalOutstanding, overdueAmount, paidCount }
  }, [rows])

  async function handleAction(invoice: Invoice, action: string) {
    setActionError("")
    try {
      switch (action) {
        case "view": setViewing(invoice); return
        case "edit": setEditing(invoice); setDialogOpen(true); return
        case "pdf": exportInvoicePDF(invoice); return
        case "payment": setPayingInvoice(invoice); return
        case "refund": setRefundingInvoice(invoice); return
        case "duplicate": await invoiceApi.create({
          clientId: invoice.clientId, clientName: invoice.clientName, clientEmail: invoice.clientEmail,
          clientPhone: invoice.clientPhone, date: new Date().toISOString().slice(0, 10), dueDate: invoice.dueDate,
          lineItems: invoice.lineItems.map(({ trailerId, description, quantity, rate, rateUnit }) => ({ trailerId, description, quantity, rate, rateUnit })),
          discountPercent: invoice.discountPercent, vatPercent: invoice.vatPercent, notes: invoice.notes, terms: invoice.terms,
        }); await load(); return
        case "send": await invoiceApi.send(invoice.id); await load(); return
        case "remind": await invoiceApi.sendReminder(invoice.id); return
        case "void": {
          const reason = window.prompt(`Void ${invoice.invoiceNumber}? Optionally add a reason:`)
          if (reason === null) return
          await invoiceApi.void(invoice.id, reason || undefined); await load(); return
        }
        case "delete": {
          if (!window.confirm(`Delete ${invoice.invoiceNumber}? This can't be undone.`)) return
          await invoiceApi.delete(invoice.id); await load(); return
        }
      }
    } catch {
      setActionError(`Couldn't complete "${action}" for ${invoice.invoiceNumber}. Please try again.`)
    }
  }

  async function handleSave(payload: InvoicePayload) {
    if (editing) await invoiceApi.update(editing.id, payload)
    else await invoiceApi.create(payload)
    await load()
  }

  const columns: Column<Invoice>[] = [
    { key: "id", label: "Invoice #", render: (r) => <span className="font-medium text-foreground">{r.invoiceNumber}</span> },
    { key: "client", label: "Client", render: (r) => r.clientName },
    { key: "date", label: "Date" },
    {
      key: "dueDate", label: "Due",
      render: (r) => (
        <span className={isOverdue(r) ? "text-red-600 font-semibold" : ""}>
          {r.dueDate}{isOverdue(r) ? ` · ${daysOverdue(r)}d overdue` : ""}
        </span>
      ),
    },
    { key: "total", label: "Total", render: (r) => kes(r.total) },
    { key: "balance", label: "Balance", render: (r) => <span className={r.balance > 0 ? "font-semibold" : "text-muted-foreground"}>{kes(r.balance)}</span> },
    { key: "status", label: "Status", render: (r) => <Badge status={isOverdue(r) ? "Overdue" : r.status} /> },
    { key: "actions", label: "", render: (r) => <ActionsMenu invoice={r} onAction={(action) => handleAction(r, action)} /> },
  ]

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <ModuleHeader title="Invoice management" subtitle="Track dues, payments, and outstanding balances" />
        <div className="flex gap-2">
          <button onClick={() => exportInvoicesCSV(rows)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditing(null); setDialogOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <StatCard label="Total Outstanding" value={kes(stats.totalOutstanding)} valueClass="text-amber-600" />
        <StatCard label="Overdue Amount" value={kes(stats.overdueAmount)} valueClass="text-red-600" />
        <StatCard label="Paid (page)" value={String(stats.paidCount)} valueClass="text-green-600" />
        <StatCard label="Total Invoices" value={String(count)} valueClass="text-blue-600" />
      </div>

      {/* Aging summary */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Aging Summary (outstanding balances)</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Current", value: aging.current, cls: "text-foreground" },
            { label: "1–30 days", value: aging["1-30"], cls: "text-amber-600" },
            { label: "31–60 days", value: aging["31-60"], cls: "text-orange-600" },
            { label: "61–90 days", value: aging["61-90"], cls: "text-red-500" },
            { label: "90+ days", value: aging["90+"], cls: "text-red-700" },
          ].map((b) => (
            <div key={b.label} className="text-xs">
              <p className="font-semibold text-muted-foreground">{b.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${b.cls}`}>{kes(b.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mt-4 p-3 rounded-xl border border-border bg-muted/30">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client or invoice #…"
            className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "All")}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
          <option value="All">All Statuses</option>
          {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-input bg-card cursor-pointer">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Overdue only
        </label>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm" />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm" />
      </div>

      {actionError && (
        <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
        </div>
      )}

      {error ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-teal-700 text-white hover:bg-teal-800 text-sm">Retry</button>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <Table columns={columns} rows={rows} loading={loading} getRowKey={(r) => r.id} />
            {!loading && rows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground">No invoices found</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {search || statusFilter !== "All" || overdueOnly || fromDate || toDate
                    ? "Try adjusting your filters."
                    : "Create your first invoice, or generate one from a quotation or rental."}
                </p>
              </div>
            )}
          </div>

          {count > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} · {count} total</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-accent">Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-accent">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      <InvoiceFormDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} onSave={handleSave} />
      <RecordPaymentDialog invoice={payingInvoice} onClose={() => setPayingInvoice(null)} onRecorded={load} />
      <RecordPaymentDialog invoice={refundingInvoice} mode="refund" onClose={() => setRefundingInvoice(null)} onRecorded={load} />
      <DetailsDialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)} title={viewing?.invoiceNumber || "Invoice details"} description={viewing?.clientName} fields={viewing ? [{ label: "Status", value: viewing.status }, { label: "Invoice date", value: viewing.date }, { label: "Due date", value: viewing.dueDate }, { label: "Total", value: kes(viewing.total) }, { label: "Paid", value: kes(viewing.amountPaid) }, { label: "Balance", value: kes(viewing.balance) }, { label: "Items", value: viewing.lineItems.map((item) => `${item.description} × ${item.quantity} — ${kes(item.amount)}`).join("; ") }, { label: "Notes", value: viewing.notes }] : []} />
    </div>
  )
}
