"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle, Download, Eye, FileText, MoreVertical, Pencil, Plus, Search,
  Trash2, Ban, PlayCircle, PackageCheck,
} from "lucide-react"
import { ModuleHeader } from "@/components/ui/ModuleHeader"
import { Table, Column } from "@/components/ui/Table"
import { Badge } from "@/components/ui/badge"
import type { Rental, RentalPayload, RentalStatus, Paginated } from "./types-and-api-notes"
import { rentalApi } from "./rental-api"
import {
  RENTAL_STATUSES, canCancel, canDelete, canEdit, canActivate, canMarkReturned,
  daysOverdue, depositBalance, displayStatus, exportRentalAgreementPDF, exportRentalsCSV, isOverdue, kes,
} from "./rental-utils"
import { RentalFormDialog } from "./RentalFormDialog"
import { CheckoutDialog } from "./CheckoutDialog"
import { ReturnDialog } from "./ReturnDialog"
import { DetailsDialog } from "@/components/ui/DetailsDialog"

function StatCard({ label, value, valueClass = "text-teal-700" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  )
}

function ActionsMenu({ rental, onAction }: { rental: Rental; onAction: (action: string) => void }) {
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
    ...(canEdit(rental.status) ? [{ key: "edit", label: "Edit", icon: <Pencil className="w-3.5 h-3.5" /> }] : []),
    { key: "agreement", label: "Download agreement", icon: <Download className="w-3.5 h-3.5" /> },
    ...(canActivate(rental.status) ? [{ key: "checkout", label: "Check out (activate)", icon: <PlayCircle className="w-3.5 h-3.5" /> }] : []),
    ...(canMarkReturned(rental.status) ? [{ key: "return", label: "Process return", icon: <PackageCheck className="w-3.5 h-3.5" /> }] : []),
    ...(canCancel(rental.status) ? [{ key: "cancel", label: "Cancel rental", icon: <Ban className="w-3.5 h-3.5" />, danger: true }] : []),
    ...(canDelete(rental.status) ? [{ key: "delete", label: "Delete", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true }] : []),
  ]

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }); setOpen((o) => !o) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed z-50 w-52 rounded-lg border border-border bg-card shadow-lg py-1" style={menuPosition || undefined}>
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

export default function RentalsPage() {
  const [rows, setRows] = useState<Rental[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<RentalStatus | "Overdue" | "All">("All")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Rental | null>(null)
  const [viewing, setViewing] = useState<Rental | null>(null)
  const [checkingOut, setCheckingOut] = useState<Rental | null>(null)
  const [returning, setReturning] = useState<Rental | null>(null)
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res: Paginated<Rental> = await rentalApi.list({
        search: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter === "Overdue" ? "Active" : statusFilter,
        overdueOnly: statusFilter === "Overdue" || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
      })
      setRows(res.results)
      setCount(res.count)
    } catch {
      setError("Unable to load rentals. Please try again.")
      setRows([]); setCount(0)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, fromDate, toDate, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, fromDate, toDate])

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "Active").length
    const overdue = rows.filter(isOverdue).length
    const depositsHeld = rows.reduce((s, r) => s + depositBalance(r), 0)
    const totalValue = rows.reduce((s, r) => s + r.total, 0)
    return { active, overdue, depositsHeld, totalValue }
  }, [rows])

  async function handleAction(rental: Rental, action: string) {
    setActionError("")
    try {
      switch (action) {
        case "view": setViewing(rental); return
        case "edit": setEditing(rental); setDialogOpen(true); return
        case "agreement": exportRentalAgreementPDF(rental); return
        case "checkout": setCheckingOut(rental); return
        case "return": setReturning(rental); return
        case "cancel": {
          const reason = window.prompt(`Cancel ${rental.rentalNumber}? Optionally add a reason:`)
          if (reason === null) return
          await rentalApi.cancel(rental.id, reason || undefined); await load(); return
        }
        case "delete": {
          if (!window.confirm(`Delete ${rental.rentalNumber}? This can't be undone.`)) return
          await rentalApi.delete(rental.id); await load(); return
        }
      }
    } catch {
      setActionError(`Couldn't complete "${action}" for ${rental.rentalNumber}. Please try again.`)
    }
  }

  async function handleSave(payload: RentalPayload) {
    if (editing) await rentalApi.update(editing.id, payload)
    else await rentalApi.create(payload)
    await load()
  }

  const columns: Column<Rental>[] = [
    { key: "id", label: "Rental #", render: (r) => <span className="font-medium text-foreground">{r.rentalNumber}</span> },
    { key: "client", label: "Client", render: (r) => r.clientName },
    {
      key: "trailer", label: "Trailer(s)",
      render: (r) => (
        <span className="text-muted-foreground">
          {r.trailers.length <= 1
            ? r.trailers[0]?.trailerName || "—"
            : `${r.trailers[0]?.trailerName} +${r.trailers.length - 1} more`}
        </span>
      ),
    },
    { key: "pickupDate", label: "Pickup" },
    {
      key: "returnDate", label: "Return",
      render: (r) => (
        <span className={isOverdue(r) ? "text-red-600 font-semibold" : ""}>
          {r.actualReturnDate || r.scheduledReturnDate}
          {isOverdue(r) ? ` · ${daysOverdue(r)}d overdue` : ""}
        </span>
      ),
    },
    { key: "total", label: "Total", render: (r) => kes(r.total) },
    {
      key: "deposit", label: "Deposit",
      render: (r) => <span className={depositBalance(r) > 0 ? "font-medium" : "text-muted-foreground"}>{kes(depositBalance(r))} held</span>,
    },
    { key: "status", label: "Status", render: (r) => <Badge status={displayStatus(r)} /> },
    { key: "actions", label: "", render: (r) => <ActionsMenu rental={r} onAction={(action) => handleAction(r, action)} /> },
  ]

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <ModuleHeader title="Rental management" subtitle="Quotation → agreement → active → return" />
        <div className="flex gap-2">
          <button onClick={() => exportRentalsCSV(rows)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditing(null); setDialogOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800">
            <Plus className="w-4 h-4" /> New Rental
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <StatCard label="Active Rentals" value={String(stats.active)} valueClass="text-blue-600" />
        <StatCard label="Overdue" value={String(stats.overdue)} valueClass="text-red-600" />
        <StatCard label="Deposits Held" value={kes(stats.depositsHeld)} valueClass="text-amber-600" />
        <StatCard label="Total Value (page)" value={kes(stats.totalValue)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 p-3 rounded-xl border border-border bg-muted/30">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client, trailer, or rental #…"
            className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RentalStatus | "Overdue" | "All")}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
          <option value="All">All Statuses</option>
          <option value="Overdue">Overdue</option>
          {RENTAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                <p className="text-sm font-semibold text-foreground">No rentals found</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {search || statusFilter !== "All" || fromDate || toDate
                    ? "Try adjusting your filters."
                    : "Create a rental directly, or generate one from an accepted quotation."}
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

      <RentalFormDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} onSave={handleSave} />
      <CheckoutDialog rental={checkingOut} onClose={() => setCheckingOut(null)} onDone={load} />
      <ReturnDialog rental={returning} onClose={() => setReturning(null)} onDone={load} />
      <DetailsDialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)} title={viewing?.rentalNumber || "Rental details"} description={viewing ? `${viewing.clientName} · ${viewing.trailers.map((trailer) => trailer.trailerName).join(", ")}` : undefined} fields={viewing ? [{ label: "Status", value: displayStatus(viewing) }, { label: "Pickup date", value: viewing.pickupDate }, { label: "Return date", value: viewing.scheduledReturnDate }, { label: "Subtotal", value: kes(viewing.subtotal) }, { label: "Total", value: kes(viewing.total) }, { label: "Deposit", value: kes(viewing.depositAmount) }, { label: "Notes", value: viewing.notes }] : []} />
    </div>
  )
}
