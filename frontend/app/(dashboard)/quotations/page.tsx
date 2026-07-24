"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle, Copy, Download, Eye, FileText, MoreVertical,
  Pencil, Plus, Search, Send, Trash2, ArrowRightCircle, CheckCircle2, XCircle,
} from "lucide-react"
import { ModuleHeader } from "@/components/ui/ModuleHeader"
import { Table, Column } from "@/components/ui/Table"
import { Badge } from "@/components/ui/badge"
import type { Paginated, Quotation, QuotationPayload, QuotationStatus } from "./types-and-api-notes"
import { quotationApi } from "./quotation-api"
import {
  QUOTATION_STATUSES, canConvert, canDelete, canEdit, canMarkAcceptedRejected, canSend,
  exportQuotationPDF, exportQuotationsCSV, isExpiringSoon, kes,
} from "./quotation-utils"
import { QuotationFormDialog } from "./QuotationFormDialog"
import { DetailsDialog } from "@/components/ui/DetailsDialog"

function StatCard({ label, value, valueClass = "text-teal-700" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  )
}

// ── Row actions menu ─────────────────────────────────────────────────────
function ActionsMenu({ quotation, onAction }: { quotation: Quotation; onAction: (action: string) => void }) {
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
    ...(canEdit(quotation.status) ? [{ key: "edit", label: "Edit", icon: <Pencil className="w-3.5 h-3.5" /> }] : []),
    { key: "duplicate", label: "Duplicate", icon: <Copy className="w-3.5 h-3.5" /> },
    { key: "pdf", label: "Download PDF", icon: <Download className="w-3.5 h-3.5" /> },
    ...(canSend(quotation.status) ? [{ key: "send", label: "Send to client", icon: <Send className="w-3.5 h-3.5" /> }] : []),
    ...(canMarkAcceptedRejected(quotation.status)
      ? [
          { key: "accept", label: "Mark accepted", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
          { key: "reject", label: "Mark rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
        ]
      : []),
    ...(canConvert(quotation.status)
      ? [{ key: "convert", label: "Convert to rental", icon: <ArrowRightCircle className="w-3.5 h-3.5" /> }]
      : []),
    ...(canDelete(quotation.status)
      ? [{ key: "delete", label: "Delete", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true }]
      : []),
  ]

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }); setOpen((o) => !o) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1" style={menuPosition || undefined}>
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => { setOpen(false); onAction(item.key) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted ${
                item.danger ? "text-red-600" : "text-foreground"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function QuotationsPage() {
  const [rows, setRows] = useState<Quotation[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "All">("All")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Quotation | null>(null)
  const [viewing, setViewing] = useState<Quotation | null>(null)
  const [actionError, setActionError] = useState("")
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res: Paginated<Quotation> = await quotationApi.list({
        search: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
      })
      setRows(res.results)
      setCount(res.count)
    } catch {
      setError("Unable to load quotations. Please try again.")
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, fromDate, toDate, page])

  useEffect(() => { load() }, [load])

  // Reset to page 1 whenever filters change (not on page change itself)
  useEffect(() => { setPage(1) }, [search, statusFilter, fromDate, toDate])

  const stats = useMemo(() => {
    const totalValue = rows.reduce((s, r) => s + (r.total ?? r.value ?? 0), 0)
    const accepted = rows.filter((r) => r.status === "Accepted").length
    const expiringSoon = rows.filter((r) => isExpiringSoon(r)).length
    return { total: count, totalValue, accepted, expiringSoon }
  }, [rows, count])

  async function handleAction(quotation: Quotation, action: string) {
    setActionError("")
    try {
      switch (action) {
        case "view": setViewing(quotation); return
        case "edit":
          setEditing(quotation); setDialogOpen(true)
          return
        case "pdf":
          exportQuotationPDF(quotation)
          return
        case "duplicate": {
          await quotationApi.duplicate(quotation.id)
          await load()
          return
        }
        case "send": {
          await quotationApi.send(quotation.id)
          await load()
          return
        }
        case "accept": {
          await quotationApi.markStatus(quotation.id, "Accepted")
          await load()
          return
        }
        case "reject": {
          await quotationApi.markStatus(quotation.id, "Rejected")
          await load()
          return
        }
        case "convert": {
          setConvertingId(quotation.id)
          await quotationApi.convert(quotation.id)
          await load()
          return
        }
        case "delete": {
          if (!window.confirm(`Delete ${quotation.quotationNumber}? This can't be undone.`)) return
          await quotationApi.delete(quotation.id)
          await load()
          return
        }
      }
    } catch {
      setActionError(`Couldn't complete "${action}" for ${quotation.quotationNumber}. Please try again.`)
    } finally {
      setConvertingId(null)
    }
  }

  async function handleSave(payload: QuotationPayload) {
    if (editing) {
      await quotationApi.update(editing.id, payload)
    } else {
      await quotationApi.create(payload)
    }
    await load()
  }

  const columns: Column<Quotation>[] = [
    { key: "id", label: "Quotation #", render: (r) => <span className="font-medium text-foreground">{r.quotationNumber}</span> },
    { key: "client", label: "Client", render: (r) => r.clientName },
    { key: "issueDate", label: "Issued" },
    {
      key: "expiryDate",
      label: "Expiry",
      render: (r) => (
        <span className={isExpiringSoon(r) ? "text-amber-600 font-semibold" : ""}>
          {r.expiryDate}{isExpiringSoon(r) ? " · expiring soon" : ""}
        </span>
      ),
    },
    { key: "value", label: "Value", render: (r) => kes(r.total ?? r.value) },
    { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <ActionsMenu
          quotation={r}
          onAction={(action) => handleAction(r, action)}
        />
      ),
    },
  ]

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <ModuleHeader title="Quotations" subtitle="Build, send, and convert quotations to rentals" />
        <div className="flex gap-2">
          <button
            onClick={() => exportQuotationsCSV(rows)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => { setEditing(null); setDialogOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="w-4 h-4" /> New Quotation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <StatCard label="Total Quotations" value={String(stats.total)} valueClass="text-blue-600" />
        <StatCard label="Total Value (page)" value={kes(stats.totalValue)} />
        <StatCard label="Accepted (page)" value={String(stats.accepted)} valueClass="text-green-600" />
        <StatCard label="Expiring Soon" value={String(stats.expiringSoon)} valueClass="text-amber-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mt-4 p-3 rounded-xl border border-border bg-muted/30">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or quotation #…"
            className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full"
          />
        </div>
        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QuotationStatus | "All")}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm"
        >
          <option value="All">All Statuses</option>
          {QUOTATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
                <p className="text-sm font-semibold text-foreground">No quotations found</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {search || statusFilter !== "All" || fromDate || toDate
                    ? "Try adjusting your filters."
                    : "Create your first quotation to get started."}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {count > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {count} total
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-accent"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-accent"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <QuotationFormDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
      <DetailsDialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)} title={viewing?.quotationNumber || "Quotation details"} description={viewing?.clientName} fields={viewing ? [
        { label: "Status", value: viewing.status }, { label: "Issued", value: viewing.issueDate },
        { label: "Expires", value: viewing.expiryDate }, { label: "Subtotal", value: kes(viewing.subtotal) },
        { label: "VAT", value: kes(viewing.vatAmount) }, { label: "Total", value: kes(viewing.total) },
        { label: "Items", value: viewing.lineItems.map((item) => `${item.description} × ${item.quantity} — ${kes(item.amount)}`).join("; ") },
        { label: "Notes", value: viewing.notes },
      ] : []} />

      {convertingId && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-lg bg-card border border-border shadow-lg text-sm">
          Converting quotation to a rental…
        </div>
      )}
    </div>
  )
}
