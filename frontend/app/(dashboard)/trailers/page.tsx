"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle, Download, Eye, MoreVertical, Pencil, Plus, Search, Trash2, Truck,
} from "lucide-react"
import { toast } from "sonner"
import { Table, Column } from "@/components/ui/Table"
import { Badge } from "@/components/ui/badge"
import { DetailsDialog } from "@/components/ui/DetailsDialog"
import type { Trailer } from "./types-and-api-notes"
import { TRAILER_STATUSES, TRAILER_TYPES, statusLabel, typeLabel } from "./types-and-api-notes"
import { trailerApi } from "./trailer-api"
import {
  EXPIRY_TONE_CLASS, apiErrorMessage, exportTrailersCSV, expiryTone, formatDate, formatMoney, needsAttention,
} from "./trailer-utils"
import { TrailerFormDialog } from "./TrailerFormDialog"
import { MainLayout } from "@/components/layout/main-layout"

const PAGE_SIZE = 20

function StatCard({ label, value, valueClass = "text-teal-700" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  )
}

function ExpiryCell({ value }: { value: string | null | undefined }) {
  const tone = expiryTone(value)
  return <span className={EXPIRY_TONE_CLASS[tone]}>{formatDate(value)}</span>
}

function ActionsMenu({ trailer, onAction }: { trailer: Trailer; onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ bottom: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const items = [
    { key: "view", label: "View details", icon: <Eye className="w-3.5 h-3.5" /> },
    { key: "edit", label: "Edit", icon: <Pencil className="w-3.5 h-3.5" /> },
    { key: "delete", label: "Delete", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true },
  ]

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right })
          setOpen((o) => !o)
        }}
        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="fixed z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1" style={pos || undefined}>
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => { setOpen(false); onAction(item.key) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted ${item.danger ? "text-red-600" : "text-foreground"}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TrailersPage() {
  const [rows, setRows] = useState<Trailer[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [typeFilter, setTypeFilter] = useState("All")
  const [attentionOnly, setAttentionOnly] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Trailer | null>(null)
  const [viewing, setViewing] = useState<Trailer | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await trailerApi.list({
        search: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        trailerType: typeFilter === "All" ? undefined : typeFilter,
        page,
      })
      setRows(res.results)
      setCount(res.count)
    } catch {
      setError("Unable to load trailers. Please try again.")
      setRows([]); setCount(0)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, typeFilter])

  const visibleRows = useMemo(
    () => (attentionOnly ? rows.filter(needsAttention) : rows),
    [rows, attentionOnly],
  )

  const stats = useMemo(() => {
    const available = rows.filter((t) => t.status === "available").length
    const rented = rows.filter((t) => t.status === "rented").length
    const attention = rows.filter(needsAttention).length
    return { available, rented, attention }
  }, [rows])

  async function handleAction(trailer: Trailer, action: string) {
    try {
      switch (action) {
        case "view": {
          // List endpoint is lightweight — fetch the full record for the details view.
          const full = await trailerApi.retrieve(trailer.id)
          setViewing(full)
          return
        }
        case "edit": {
          const full = await trailerApi.retrieve(trailer.id)
          setEditing(full); setDialogOpen(true)
          return
        }
        case "delete": {
          if (!window.confirm(`Delete ${trailer.trailer_number}? This can't be undone and may be blocked if it has rental history.`)) return
          await trailerApi.delete(trailer.id)
          toast.success(`Trailer ${trailer.trailer_number} deleted`)
          await load()
          return
        }
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, `Couldn't complete "${action}" for ${trailer.trailer_number}.`))
    }
  }

  async function handleSave(payload: Parameters<typeof trailerApi.create>[0]) {
    if (editing) await trailerApi.update(editing.id, payload)
    else await trailerApi.create(payload)
    await load()
  }

  const columns: Column<Trailer>[] = [
    { key: "trailer_number", label: "Trailer #", render: (r) => <span className="font-medium text-foreground">{r.trailer_number}</span> },
    { key: "registration_number", label: "Registration" },
    { key: "trailer_type", label: "Type", render: (r) => r.trailer_type_display || typeLabel(r.trailer_type) },
    { key: "yard_location", label: "Location", render: (r) => r.yard_location || "—" },
    { key: "insurance_expiry", label: "Insurance", render: (r) => <ExpiryCell value={r.insurance_expiry} /> },
    { key: "next_inspection_date", label: "Next inspection", render: (r) => <ExpiryCell value={r.next_inspection_date} /> },
    { key: "status", label: "Status", render: (r) => <Badge status={r.status_display || statusLabel(r.status)} /> },
    { key: "actions", label: "", render: (r) => <ActionsMenu trailer={r} onAction={(action) => handleAction(r, action)} /> },
  ]

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasFilters = Boolean(search) || statusFilter !== "All" || typeFilter !== "All" || attentionOnly

  return (
    <MainLayout title="Trailer Management">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Trailer management</h2>
          <p className="text-sm text-muted-foreground">{count} trailers in the fleet</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (visibleRows.length === 0) return toast.error("Nothing to export.")
              exportTrailersCSV(visibleRows)
              toast.success(`Exported ${visibleRows.length} trailer${visibleRows.length === 1 ? "" : "s"} to CSV`)
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => { setEditing(null); setDialogOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="w-4 h-4" /> Add trailer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <StatCard label="Total trailers" value={String(count)} valueClass="text-blue-600" />
        <StatCard label="Available" value={String(stats.available)} valueClass="text-teal-700" />
        <StatCard label="Rented" value={String(stats.rented)} valueClass="text-blue-600" />
        <StatCard label="Needs attention" value={String(stats.attention)} valueClass="text-amber-600" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 p-3 rounded-xl border border-border bg-muted/30">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by trailer #, registration, or VIN…"
            className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
          <option value="All">All Types</option>
          {TRAILER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
          <option value="All">All Statuses</option>
          {TRAILER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-input bg-card cursor-pointer">
          <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
          Compliance due soon
        </label>
      </div>

      {error ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-teal-700 text-white hover:bg-teal-800 text-sm">Retry</button>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <Table columns={columns} rows={visibleRows} loading={loading} getRowKey={(r) => String(r.id)} />
            {!loading && visibleRows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Truck className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground">No trailers found</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {hasFilters ? "Try adjusting your filters." : "Add your first trailer to get started."}
                </p>
              </div>
            )}
          </div>

          {count > PAGE_SIZE && !attentionOnly && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} · {count} total</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-accent">Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-input disabled:opacity-40 hover:bg-accent">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      <TrailerFormDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} onSave={handleSave} />

      <DetailsDialog
        open={Boolean(viewing)}
        onOpenChange={(o) => !o && setViewing(null)}
        title={viewing?.trailer_number || "Trailer"}
        description={viewing ? `${typeLabel(viewing.trailer_type)} · ${statusLabel(viewing.status)}` : undefined}
        fields={viewing ? [
          { label: "Registration", value: viewing.registration_number },
          { label: "VIN / chassis", value: viewing.vin },
          { label: "Brand", value: viewing.brand || "—" },
          { label: "Manufacturer", value: viewing.manufacturer || "—" },
          { label: "Model", value: viewing.model || "—" },
          { label: "Year", value: viewing.year != null ? String(viewing.year) : "—" },
          { label: "Capacity", value: viewing.capacity || "—" },
          { label: "Weight", value: viewing.weight || "—" },
          { label: "Dimensions", value: viewing.dimensions || "—" },
          { label: "Yard / location", value: viewing.yard_location || "—" },
          { label: "GPS", value: viewing.gps_lat && viewing.gps_lng ? `${viewing.gps_lat}, ${viewing.gps_lng}` : "—" },
          { label: "Purchase date", value: formatDate(viewing.purchase_date) },
          { label: "Purchase cost", value: formatMoney(viewing.purchase_cost) },
          { label: "Current value", value: formatMoney(viewing.current_value) },
          { label: "License expiry", value: <span className={EXPIRY_TONE_CLASS[expiryTone(viewing.license_expiry)]}>{formatDate(viewing.license_expiry)}</span> },
          { label: "Insurance expiry", value: <span className={EXPIRY_TONE_CLASS[expiryTone(viewing.insurance_expiry)]}>{formatDate(viewing.insurance_expiry)}</span> },
          { label: "Next inspection", value: <span className={EXPIRY_TONE_CLASS[expiryTone(viewing.next_inspection_date)]}>{formatDate(viewing.next_inspection_date)}</span> },
          { label: "QR code UID", value: viewing.qr_code_uid || "—" },
          { label: "Documents", value: viewing.documents?.length
            ? (
              <ul className="space-y-1 text-sm">
                {viewing.documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.file} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                      {d.document_type}
                    </a>
                    {d.expiry_date ? ` · expires ${formatDate(d.expiry_date)}` : ""}
                  </li>
                ))}
              </ul>
            )
            : "No documents uploaded" },
          { label: "Maintenance records", value: viewing.maintenance_records?.length
            ? `${viewing.maintenance_records.length} on file`
            : "None recorded" },
        ] : []}
      />
    </MainLayout>
  )
}
