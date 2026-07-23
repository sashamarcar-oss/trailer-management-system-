"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle, Download, Eye, FileText, MoreVertical, Pencil, Plus, Search,
  Trash2, Ban, CheckCircle2, ReceiptText,
} from "lucide-react"
import { ModuleHeader } from "@/components/ui/ModuleHeader"
import { Table, Column } from "@/components/ui/Table"
import type { Client, ClientPayload, ClientStatus, Paginated, StatementLine } from "./types-and-api-notes"
import { clientApi } from "./client-api"
import {
  availableCredit, creditUtilizationPercent, exportClientStatementPDF, exportClientsCSV, isOverLimit, kes,
} from "./client-utils"
import { ClientFormDialog } from "./ClientFormDialog"

function StatCard({ label, value, valueClass = "text-teal-700" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: ClientStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      status === "Active" ? "bg-teal-100 text-teal-700" : "bg-muted text-muted-foreground"
    }`}>
      {status}
    </span>
  )
}

function ActionsMenu({ client, onAction }: { client: Client; onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const items: { key: string; label: string; icon: React.ReactNode; danger?: boolean }[] = [
    { key: "view", label: "View profile", icon: <Eye className="w-3.5 h-3.5" /> },
    { key: "edit", label: "Edit", icon: <Pencil className="w-3.5 h-3.5" /> },
    { key: "statement", label: "Download statement", icon: <ReceiptText className="w-3.5 h-3.5" /> },
    client.status === "Active"
      ? { key: "deactivate", label: "Mark inactive", icon: <Ban className="w-3.5 h-3.5" />, danger: true }
      : { key: "activate", label: "Mark active", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { key: "delete", label: "Delete", icon: <Trash2 className="w-3.5 h-3.5" />, danger: true },
  ]

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
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

export default function ClientsPage() {
  const router = useRouter()

  const [rows, setRows] = useState<Client[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "All">("All")
  const [overLimitOnly, setOverLimitOnly] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [actionError, setActionError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res: Paginated<Client> = await clientApi.list({
        search: search || undefined,
        status: statusFilter === "All" ? undefined : statusFilter,
        clientType: typeFilter === "All" ? undefined : typeFilter,
        overLimitOnly: overLimitOnly || undefined,
        page,
      })
      setRows(res.results)
      setCount(res.count)
    } catch {
      setError("Unable to load clients. Please try again.")
      setRows([]); setCount(0)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter, overLimitOnly, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, typeFilter, overLimitOnly])

  const stats = useMemo(() => {
    const totalOutstanding = rows.reduce((s, c) => s + c.outstanding_balance, 0)
    const totalCreditExtended = rows.reduce((s, c) => s + c.credit_limit, 0)
    const overLimitCount = rows.filter(isOverLimit).length
    return { totalOutstanding, totalCreditExtended, overLimitCount }
  }, [rows])

  async function handleAction(client: Client, action: string) {
    setActionError("")
    try {
      switch (action) {
        case "view": router.push(`/clients/${client.id}`); return
        case "edit": setEditing(client); setDialogOpen(true); return
        case "statement": {
          const lines: StatementLine[] = await clientApi.getStatement(client.id)
          exportClientStatementPDF(client, lines, "All time")
          return
        }
        case "deactivate": await clientApi.setStatus(client.id, "Inactive"); await load(); return
        case "activate": await clientApi.setStatus(client.id, "Active"); await load(); return
        case "delete": {
          if (!window.confirm(`Delete ${client.name}? This can't be undone and may be blocked if they have rental/invoice history.`)) return
          await clientApi.delete(client.id); await load(); return
        }
      }
    } catch {
      setActionError(`Couldn't complete "${action}" for ${client.name}. Please try again.`)
    }
  }

  async function handleSave(payload: ClientPayload) {
    if (editing) await clientApi.update(editing.id, payload)
    else await clientApi.create(payload)
    await load()
  }

  const columns: Column<Client>[] = [
    { key: "code", label: "Client ID" },
    { key: "name", label: "Name", render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: "client_type", label: "Type" },
    { key: "contact_phone", label: "Contact" },
    {
      key: "outstanding_balance", label: "Outstanding",
      render: (r) => <span className={isOverLimit(r) ? "text-red-600 font-semibold" : ""}>{kes(r.outstanding_balance)}</span>,
    },
    {
      key: "credit_limit", label: "Credit Limit / Available",
      render: (r) => (
        <div className="min-w-32">
          <div className="flex justify-between text-xs">
            <span>{kes(r.credit_limit)}</span>
            <span className={availableCredit(r) < 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
              {availableCredit(r) < 0 ? `${kes(Math.abs(availableCredit(r)))} over` : `${kes(availableCredit(r))} free`}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full ${isOverLimit(r) ? "bg-red-500" : creditUtilizationPercent(r) > 80 ? "bg-amber-500" : "bg-teal-600"}`}
              style={{ width: `${creditUtilizationPercent(r)}%` }}
            />
          </div>
        </div>
      ),
    },
    { key: "rating", label: "Rating", render: (r) => (r.rating ? `★ ${r.rating}` : "—") },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", label: "", render: (r) => <ActionsMenu client={r} onAction={(action) => handleAction(r, action)} /> },
  ]

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <ModuleHeader title="Client management" subtitle={`${count} clients`} />
        <div className="flex gap-2">
          <button onClick={() => exportClientsCSV(rows)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditing(null); setDialogOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <StatCard label="Total Clients" value={String(count)} valueClass="text-blue-600" />
        <StatCard label="Total Outstanding" value={kes(stats.totalOutstanding)} valueClass="text-amber-600" />
        <StatCard label="Credit Extended" value={kes(stats.totalCreditExtended)} />
        <StatCard label="Over Credit Limit" value={String(stats.overLimitCount)} valueClass="text-red-600" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 p-3 rounded-xl border border-border bg-muted/30">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code, or phone…"
            className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
          <option value="All">All Types</option>
          <option value="Individual">Individual</option>
          <option value="Company">Company</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClientStatus | "All")}
          className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-input bg-card cursor-pointer">
          <input type="checkbox" checked={overLimitOnly} onChange={(e) => setOverLimitOnly(e.target.checked)} />
          Over limit only
        </label>
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
                <p className="text-sm font-semibold text-foreground">No clients found</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {search || statusFilter !== "All" || typeFilter !== "All" || overLimitOnly
                    ? "Try adjusting your filters."
                    : "Add your first client to get started."}
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

      <ClientFormDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} onSave={handleSave} />
    </div>
  )
}
