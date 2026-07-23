"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { axiosClient } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  AlertCircle, BarChart3, CheckCircle2, Clock, DollarSign,
  Download, RefreshCw, FileText, Eye,
  Users, Truck, TrendingUp, Calendar,
  Search, Wrench, PackageCheck, MapPin,
} from "lucide-react"
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts"

// ─── NOTE ON DATA SHAPES ────────────────────────────────────────────────────
// Field names below (trailer_name, client_name, daily_rate, etc.) are my best
// guess at what your /logistics/* endpoints return, following the same
// snake_case + fallback pattern as the ApexHR page (r.foo ?? r.fooAlt).
// Adjust the field lookups in the `safeStr`/`Number(...)` calls below to match
// your actual backend once you wire this up — the rest of the page (tabs,
// filters, charts, exports) will keep working unchanged.

// ─── Types ────────────────────────────────────────────────────────────────
type MainTab = "Reports" | "Analytics"

type ReportModule = "Rentals" | "Fleet" | "Clients" | "Finance" | "Maintenance" | "Tax Summary"
type RentalsSubTab = "Rental History" | "Active Rentals" | "Overdue Returns"
type FleetSubTab = "Trailer Inventory" | "Utilization" | "Maintenance Schedule"
type ClientsSubTab = "Client Statements" | "Outstanding Payments" | "Client Activity"
type FinanceSubTab = "Revenue Register" | "Expense Register" | "Profit & Loss"

type AnalyticsModule = "Utilization" | "Fleet" | "Clients" | "Finance" | "Maintenance"
type UtilizationSubTab = "Overview" | "Trends"
type FleetAnalyticsSubTab = "Overview" | "By Type"
type ClientsAnalyticsSubTab = "Overview" | "Top Clients"
type FinanceAnalyticsSubTab = "Overview" | "Trends"

const REPORT_MODULES: ReportModule[] = ["Rentals", "Fleet", "Clients", "Finance", "Maintenance", "Tax Summary"]
const ANALYTICS_MODULES: AnalyticsModule[] = ["Utilization", "Fleet", "Clients", "Finance", "Maintenance"]
const CHART_COLORS = ["#0F6E56", "#10B981", "#F59E0B", "#6366F1", "#EF4444", "#3B82F6", "#EC4899"]
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const EXPENSE_CATEGORIES = ["Fuel", "Repairs", "Insurance", "Permits & Licensing", "Tolls", "Staff", "Other"]

// ─── Currency / date helpers ────────────────────────────────────────────────
const ksh = (v: number) => `Ksh ${v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtKsh = (v: unknown) => ksh(typeof v === "number" ? v : 0)
const fmtCount = (v: unknown) => `${typeof v === "number" ? v : 0}`

function parseDate(d: unknown): Date {
  const parsed = new Date(d as string)
  return parsed
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>
    const candidate = obj.name ?? obj.label ?? obj.title ?? obj.value
    if (typeof candidate === "string") return candidate
    if (typeof candidate === "number") return String(candidate)
  }
  return ""
}

function extractResults<T>(data: { results?: T[] } | T[] | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.results ?? []
}

function startDateForRange(range: string): Date {
  const now = new Date()
  if (range === "1month") return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  if (range === "6months") return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  if (range === "1year") return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  return new Date(0)
}

function resolveMonthRange(mode: "This Month" | "Last Month" | "This Year" | "Custom", month: number, year: number) {
  const now = new Date()
  if (mode === "This Month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { start, end, label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}` }
  }
  if (mode === "Last Month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, end, label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}` }
  }
  if (mode === "This Year") {
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear() + 1, 0, 1)
    return { start, end, label: `${start.getFullYear()}` }
  }
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  return { start, end, label: `${MONTH_NAMES[month]} ${year}` }
}

// ─── UI Components (shared look & feel) ────────────────────────────────────

function MainTabBar({ active, onChange }: { active: MainTab; onChange: (t: MainTab) => void }) {
  return (
    <div className="flex gap-2">
      {(["Reports", "Analytics"] as MainTab[]).map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold border transition-all ${
            active === t ? "bg-teal-700 text-white border-teal-700 shadow-sm" : "bg-card text-muted-foreground border-input hover:bg-accent"
          }`}>
          {t === "Reports" ? <FileText className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
          {t}
        </button>
      ))}
    </div>
  )
}

function ModuleNav<T extends string>({ modules, active, onChange, icons }: {
  modules: T[]; active: T; onChange: (m: T) => void; icons?: Partial<Record<T, React.ReactNode>>
}) {
  return (
    <div className="border-b border-border overflow-x-auto">
      <nav className="flex gap-0 min-w-max">
        {modules.map((m) => (
          <button key={m} onClick={() => onChange(m)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
              active === m ? "border-teal-600 text-teal-700" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {icons?.[m]}
            {m}
          </button>
        ))}
      </nav>
    </div>
  )
}

function SubTabBar<T extends string>({ tabs, active, onChange }: { tabs: T[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            active === t ? "bg-card text-foreground border-border shadow-sm font-semibold" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}>
          {t}
        </button>
      ))}
    </div>
  )
}

function PeriodBar({ periods, active, onChange }: { periods: string[]; active: string; onChange: (p: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {periods.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            active === p ? "bg-teal-700 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}>
          {p}
        </button>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, valueClass = "text-teal-700", icon, iconBg = "bg-teal-100" }: {
  label: string; value: string; sub?: string; valueClass?: string; icon?: React.ReactNode; iconBg?: string
}) {
  return (
    <Card className="bg-card border-border rounded-xl">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          {icon && <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

function ExportBtn({ onClick, label = "Export", variant = "outline" }: { onClick: () => void; label?: string; variant?: "outline" | "teal" }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        variant === "teal" ? "bg-teal-700 text-white hover:bg-teal-800" : "border border-input bg-card hover:bg-accent"
      }`}>
      <Download className="w-4 h-4" /> {label}
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <FileText className="w-10 h-10 text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  )
}

function SectionHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

function DataTable({ headers, rows, emptyMsg = "No data." }: { headers: string[]; rows: React.ReactNode[][]; emptyMsg?: string }) {
  return (
    <div className="overflow-x-auto border border-border rounded-xl">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-4 py-10 text-center text-muted-foreground">{emptyMsg}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="border-b border-border hover:bg-muted/40 transition-colors">
              {row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardHeader({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pb-2", className)}>{children}</div>
}

function CardContent({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pt-3", className)}>{children}</div>
}

function CardTitle({ children, className }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold", className)}>{children}</h3>
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const cls =
    s === "completed" || s === "active" || s === "available" || s === "paid"
      ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
      : s === "pending" || s === "in transit" || s === "scheduled"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>
}

function pieLabel({ name, percent }: { name?: string; percent?: number }) {
  if (!percent || percent === 0) return ""
  return `${name ?? ""} ${(percent * 100).toFixed(0)}%`
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function TrailerReportsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [mainTab, setMainTab] = useState<MainTab>("Reports")
  const [reportModule, setReportModule] = useState<ReportModule>("Rentals")
  const [analyticsModule, setAnalyticsModule] = useState<AnalyticsModule>("Utilization")

  const [rentalsSubTab, setRentalsSubTab] = useState<RentalsSubTab>("Rental History")
  const [fleetSubTab, setFleetSubTab] = useState<FleetSubTab>("Trailer Inventory")
  const [clientsSubTab, setClientsSubTab] = useState<ClientsSubTab>("Client Statements")
  const [financeSubTab, setFinanceSubTab] = useState<FinanceSubTab>("Revenue Register")

  const [utilSubTab, setUtilSubTab] = useState<UtilizationSubTab>("Overview")
  const [fleetAnalyticsSubTab, setFleetAnalyticsSubTab] = useState<FleetAnalyticsSubTab>("Overview")
  const [clientsAnalyticsSubTab, setClientsAnalyticsSubTab] = useState<ClientsAnalyticsSubTab>("Overview")
  const [financeAnalyticsSubTab, setFinanceAnalyticsSubTab] = useState<FinanceAnalyticsSubTab>("Overview")

  const [range, setRange] = useState("all")
  const [analyticsPeriod, setAnalyticsPeriod] = useState("This Month")
  const [expCatFilter, setExpCatFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [trailerTypeFilter, setTrailerTypeFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")

  const [rentalMode, setRentalMode] = useState<"This Month" | "Last Month" | "This Year" | "Custom">("This Month")
  const [rentalMonth, setRentalMonth] = useState(new Date().getMonth())
  const [rentalYear, setRentalYear] = useState(new Date().getFullYear())

  // ── data ──
  const [rentals, setRentals] = useState<Record<string, unknown>[]>([])
  const [trailers, setTrailers] = useState<Record<string, unknown>[]>([])
  const [clients, setClients] = useState<Record<string, unknown>[]>([])
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([])
  const [maintenance, setMaintenance] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const updateUrl = useCallback((view: string, mod: string) => {
    const params = new URLSearchParams()
    params.set("view", view.toLowerCase())
    params.set("module", mod.toLowerCase().replace(/ /g, "-"))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname])

  const handleMainTab = (t: MainTab) => { setMainTab(t); updateUrl(t, t === "Reports" ? reportModule : analyticsModule) }
  const handleReportModule = (m: ReportModule) => { setReportModule(m); updateUrl("Reports", m) }
  const handleAnalyticsModule = (m: AnalyticsModule) => { setAnalyticsModule(m); updateUrl("Analytics", m) }

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [rentalsRes, trailersRes, clientsRes, expensesRes, maintenanceRes] = await Promise.all([
        axiosClient.get<Record<string, unknown>[] | { results: Record<string, unknown>[] }>("/logistics/rentals/").catch(
          (): { data: Record<string, unknown>[] } => ({ data: [] })
        ),
        axiosClient.get<Record<string, unknown>[] | { results: Record<string, unknown>[] }>("/logistics/trailers/").catch(
          (): { data: Record<string, unknown>[] } => ({ data: [] })
        ),
        axiosClient.get<Record<string, unknown>[] | { results: Record<string, unknown>[] }>("/logistics/clients/").catch(
          (): { data: Record<string, unknown>[] } => ({ data: [] })
        ),
        axiosClient.get<Record<string, unknown>[] | { results: Record<string, unknown>[] }>("/logistics/expenses/").catch(
          (): { data: Record<string, unknown>[] } => ({ data: [] })
        ),
        axiosClient.get<Record<string, unknown>[] | { results: Record<string, unknown>[] }>("/logistics/maintenance/").catch(
          (): { data: Record<string, unknown>[] } => ({ data: [] })
        ),
      ])
      setRentals(extractResults<Record<string, unknown>>(rentalsRes?.data))
      setTrailers(extractResults<Record<string, unknown>>(trailersRes?.data))
      setClients(extractResults<Record<string, unknown>>(clientsRes?.data))
      setExpenses(extractResults<Record<string, unknown>>(expensesRes?.data))
      setMaintenance(extractResults<Record<string, unknown>>(maintenanceRes?.data))
      setLastFetched(new Date())
    } catch {
      setError("Unable to load reports. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const start = useMemo(() => startDateForRange(range), [range])

  // ── Rentals ──
  const rentalStatus = (r: Record<string, unknown>) => safeStr(r.status).toLowerCase()

  const activeRentals = useMemo(() => rentals.filter((r) => rentalStatus(r) === "active"), [rentals])
  const overdueRentals = useMemo(() => rentals.filter((r) => {
    if (rentalStatus(r) !== "active") return false
    const due = r.end_date || r.due_date
    if (!due) return false
    return new Date(due as string) < new Date()
  }), [rentals])

  const rentalMonthRange = useMemo(() => resolveMonthRange(rentalMode, rentalMonth, rentalYear), [rentalMode, rentalMonth, rentalYear])

  const rentalsInPeriod = useMemo(() => rentals.filter((r) => {
    const raw = r.start_date || r.created_at
    if (!raw) return false
    const d = new Date(raw as string)
    return !isNaN(d.getTime()) && d >= rentalMonthRange.start && d < rentalMonthRange.end
  }), [rentals, rentalMonthRange])

  const filteredRentalHistory = useMemo(() => rentals.filter((r) => {
    const trailerName = safeStr(r.trailer_name || r.trailer).toLowerCase()
    const clientName = safeStr(r.client_name || r.client).toLowerCase()
    if (searchQuery && !trailerName.includes(searchQuery.toLowerCase()) && !clientName.includes(searchQuery.toLowerCase())) return false
    if (statusFilter !== "All" && safeStr(r.status) !== statusFilter) return false
    return true
  }), [rentals, searchQuery, statusFilter])

  const rentalTotals = useMemo(() => ({
    total: rentals.length,
    active: activeRentals.length,
    overdue: overdueRentals.length,
    revenue: rentals.reduce((s, r) => s + (Number(r.total_amount ?? r.amount) || 0), 0),
  }), [rentals, activeRentals, overdueRentals])

  // ── Fleet ──
  const trailerStatus = (t: Record<string, unknown>) => safeStr(t.status).toLowerCase()

  const filteredTrailers = useMemo(() => trailers.filter((t) => {
    const name = safeStr(t.name || t.trailer_name).toLowerCase()
    if (searchQuery && !name.includes(searchQuery.toLowerCase()) && !safeStr(t.plate_number).toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (statusFilter !== "All" && safeStr(t.status) !== statusFilter) return false
    if (trailerTypeFilter !== "All" && safeStr(t.type) !== trailerTypeFilter) return false
    return true
  }), [trailers, searchQuery, statusFilter, trailerTypeFilter])

  const trailerTypeOptions = useMemo(() => {
    const seen = new Set<string>()
    trailers.forEach((t) => { const ty = safeStr(t.type); if (ty) seen.add(ty) })
    return Array.from(seen).sort()
  }, [trailers])

  const fleetTotals = useMemo(() => ({
    total: trailers.length,
    available: trailers.filter((t) => trailerStatus(t) === "available").length,
    rented: trailers.filter((t) => trailerStatus(t) === "rented").length,
    inMaintenance: trailers.filter((t) => trailerStatus(t) === "maintenance").length,
  }), [trailers])

  const utilizationRate = useMemo(() => {
    if (fleetTotals.total === 0) return 0
    return Math.round((fleetTotals.rented / fleetTotals.total) * 100)
  }, [fleetTotals])

  const utilizationByTrailer = useMemo(() =>
    trailers.map((t) => {
      const rentalsForTrailer = rentals.filter((r) => safeStr(r.trailer_id ?? r.trailer) === safeStr(t.id))
      const daysRented = rentalsForTrailer.reduce((s, r) => {
        const sD = r.start_date ? new Date(r.start_date as string) : null
        const eD = r.end_date ? new Date(r.end_date as string) : new Date()
        if (!sD || isNaN(sD.getTime())) return s
        return s + Math.max(0, Math.round((eD.getTime() - sD.getTime()) / 86400000))
      }, 0)
      return {
        name: safeStr(t.name || t.trailer_name) || safeStr(t.id),
        plate: safeStr(t.plate_number) || "—",
        type: safeStr(t.type) || "—",
        status: safeStr(t.status) || "Available",
        daysRented,
        rentalsCount: rentalsForTrailer.length,
      }
    })
  , [trailers, rentals])

  const fleetByTypeData = useMemo(() => {
    const map: Record<string, number> = {}
    trailers.forEach((t) => { const ty = safeStr(t.type) || "Other"; map[ty] = (map[ty] || 0) + 1 })
    return Object.entries(map).map(([name, count]) => ({ name, count }))
  }, [trailers])

  // ── Clients ──
  const filteredClients = useMemo(() => clients.filter((c) => {
    const name = safeStr(c.name || c.company_name).toLowerCase()
    if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false
    return true
  }), [clients, searchQuery])

  const clientsWithBalance = useMemo(() => clients.filter((c) => (Number(c.outstanding_balance) || 0) > 0), [clients])

  const clientTotals = useMemo(() => ({
    total: clients.length,
    outstanding: clients.reduce((s, c) => s + (Number(c.outstanding_balance) || 0), 0),
    withBalance: clientsWithBalance.length,
  }), [clients, clientsWithBalance])

  const topClients = useMemo(() => {
    return [...clients]
      .map((c) => ({
        name: safeStr(c.name || c.company_name) || "—",
        totalSpend: Number(c.total_spend ?? c.lifetime_value) || 0,
        rentalsCount: Number(c.total_rentals ?? c.rentals_count) || 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 8)
  }, [clients])

  // ── Finance ──
  const filteredExpenses = useMemo(() => expenses.filter((e) => {
    if (!e.date) return false
    const d = parseDate(e.date)
    if (isNaN(d.getTime())) return false
    if (range !== "all" && d < start) return false
    if (expCatFilter !== "All" && safeStr(e.category) !== expCatFilter) return false
    if (statusFilter !== "All" && safeStr(e.status) !== statusFilter) return false
    return true
  }), [expenses, range, start, expCatFilter, statusFilter])

  const revenueTotal = rentalTotals.revenue
  const expenseTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [filteredExpenses])
  const profitLoss = revenueTotal - expenseTotal

  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach((e) => { const cat = safeStr(e.category) || "Other"; map[cat] = (map[cat] || 0) + (Number(e.amount) || 0) })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [filteredExpenses])

  const revenueTrendData = useMemo(() => {
    const map: Record<string, { key: string; label: string; revenue: number; expenses: number }> = {}
    rentals.forEach((r) => {
      const raw = r.start_date || r.created_at
      if (!raw) return
      const d = new Date(raw as string)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
      if (!map[key]) map[key] = { key, label, revenue: 0, expenses: 0 }
      map[key].revenue += Number(r.total_amount ?? r.amount) || 0
    })
    expenses.forEach((e) => {
      if (!e.date) return
      const d = parseDate(e.date)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
      if (!map[key]) map[key] = { key, label, revenue: 0, expenses: 0 }
      map[key].expenses += Number(e.amount) || 0
    })
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).map((m) => ({ name: m.label, revenue: m.revenue, expenses: m.expenses, profit: m.revenue - m.expenses }))
  }, [rentals, expenses])

  // ── Maintenance ──
  const filteredMaintenance = useMemo(() => maintenance.filter((m) => {
    if (statusFilter !== "All" && safeStr(m.status) !== statusFilter) return false
    return true
  }), [maintenance, statusFilter])

  const maintenanceTotals = useMemo(() => ({
    total: maintenance.length,
    scheduled: maintenance.filter((m) => safeStr(m.status).toLowerCase() === "scheduled").length,
    completed: maintenance.filter((m) => safeStr(m.status).toLowerCase() === "completed").length,
    totalCost: maintenance.reduce((s, m) => s + (Number(m.cost) || 0), 0),
  }), [maintenance])

  // ── CSV / PDF exports ──
  function csvDownload(filename: string, rows: string[]) {
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const exportRentalHistoryCSV = () => csvDownload("rental-history", [
    "Rental History",
    "Rental ID,Trailer,Client,Start Date,End Date,Daily Rate,Total Amount,Status",
    ...filteredRentalHistory.map((r) =>
      [safeStr(r.id), safeStr(r.trailer_name || r.trailer), safeStr(r.client_name || r.client), safeStr(r.start_date),
        safeStr(r.end_date), Number(r.daily_rate) || 0, Number(r.total_amount ?? r.amount) || 0, safeStr(r.status)].join(",")
    ),
  ])

  const exportTrailerInventoryCSV = () => csvDownload("trailer-inventory", [
    "Trailer Inventory",
    "Trailer ID,Name,Type,Plate Number,Status,Purchase Date,Purchase Price",
    ...filteredTrailers.map((t) =>
      [safeStr(t.id), safeStr(t.name || t.trailer_name), safeStr(t.type), safeStr(t.plate_number),
        safeStr(t.status), safeStr(t.purchase_date), Number(t.purchase_price) || 0].join(",")
    ),
  ])

  const exportClientStatementsCSV = () => csvDownload("client-statements", [
    "Client Statements",
    "Client,Total Rentals,Total Spend,Outstanding Balance",
    ...filteredClients.map((c) =>
      [safeStr(c.name || c.company_name), Number(c.total_rentals ?? c.rentals_count) || 0,
        Number(c.total_spend ?? c.lifetime_value) || 0, Number(c.outstanding_balance) || 0].join(",")
    ),
  ])

  const exportRevenueCSV = () => csvDownload("revenue-report", [
    "Revenue Report",
    "Rental ID,Trailer,Client,Date,Amount,Status",
    ...rentals.map((r) =>
      [safeStr(r.id), safeStr(r.trailer_name || r.trailer), safeStr(r.client_name || r.client),
        safeStr(r.start_date), Number(r.total_amount ?? r.amount) || 0, safeStr(r.status)].join(",")
    ),
  ])

  const exportExpensesCSV = () => csvDownload("expense-report", [
    "Expense Report",
    "ID,Category,Amount,Date,Status,Description",
    ...filteredExpenses.map((e) =>
      [safeStr(e.id), safeStr(e.category), Number(e.amount) || 0, safeStr(e.date), safeStr(e.status), `"${safeStr(e.description)}"`].join(",")
    ),
  ])

  const exportProfitLossCSV = () => csvDownload("profit-loss", [
    "Profit & Loss",
    "Metric,Amount",
    `Total Revenue,${revenueTotal}`,
    `Total Expenses,${expenseTotal}`,
    `Net Profit / Loss,${profitLoss}`,
  ])

  const exportMaintenanceCSV = () => csvDownload("maintenance-schedule", [
    "Maintenance Schedule",
    "Trailer,Type,Date,Cost,Status,Next Service Date",
    ...filteredMaintenance.map((m) =>
      [safeStr(m.trailer_name || m.trailer), safeStr(m.type), safeStr(m.date), Number(m.cost) || 0,
        safeStr(m.status), safeStr(m.next_service_date)].join(",")
    ),
  ])

  const exportTaxSummaryCSV = () => csvDownload("tax-summary", [
    "Tax Summary",
    "Metric,Amount",
    `Gross Revenue,${revenueTotal}`,
    `Deductible Expenses,${expenseTotal}`,
    `Taxable Profit,${profitLoss}`,
  ])

  // ── Loading / Error ──
  if (loading) return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-56 bg-muted rounded-lg" />
      <div className="h-4 w-72 bg-muted rounded" />
      <div className="flex gap-2">{[0,1].map(i => <div key={i} className="h-10 w-28 bg-muted rounded-lg" />)}</div>
      <div className="h-12 bg-muted rounded-xl" />
      <div className="grid grid-cols-4 gap-4">{[0,1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}</div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  )

  if (error) return (
    <div className="min-h-96 flex flex-col items-center justify-center gap-4 text-center p-6">
      <AlertCircle className="h-12 w-12 text-red-500" />
      <p className="text-sm text-muted-foreground max-w-md">{error}</p>
      <button onClick={load} className="px-4 py-2 rounded-lg bg-teal-700 text-white hover:bg-teal-800">Retry</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-5 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-sm text-teal-600 mt-0.5">Fleet, rentals, clients, and finance reporting</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 border border-input rounded-lg text-sm font-medium hover:bg-accent">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {lastFetched && <span className="text-xs text-muted-foreground">Updated {lastFetched.toLocaleTimeString("en-KE")}</span>}
          </div>
        </div>
        <div className="mt-4">
          <MainTabBar active={mainTab} onChange={handleMainTab} />
        </div>
      </div>

      {/* ── Module nav ──────────────────────────────────────────────── */}
      {mainTab === "Reports" ? (
        <ModuleNav modules={REPORT_MODULES} active={reportModule} onChange={handleReportModule}
          icons={{
            Rentals: <PackageCheck className="w-4 h-4" />,
            Fleet: <Truck className="w-4 h-4" />,
            Clients: <Users className="w-4 h-4" />,
            Finance: <DollarSign className="w-4 h-4" />,
            Maintenance: <Wrench className="w-4 h-4" />,
            "Tax Summary": <CheckCircle2 className="w-4 h-4" />,
          }} />
      ) : (
        <ModuleNav modules={ANALYTICS_MODULES} active={analyticsModule} onChange={handleAnalyticsModule}
          icons={{
            Utilization: <TrendingUp className="w-4 h-4" />,
            Fleet: <Truck className="w-4 h-4" />,
            Clients: <Users className="w-4 h-4" />,
            Finance: <DollarSign className="w-4 h-4" />,
            Maintenance: <Wrench className="w-4 h-4" />,
          }} />
      )}

      <div className="px-6 py-6 space-y-6">

        {/* ══════════════ REPORTS ══════════════ */}
        {mainTab === "Reports" && (
          <>
            {/* ─── Rentals ─── */}
            {reportModule === "Rentals" && (
              <section className="space-y-5">
                <SubTabBar tabs={["Rental History", "Active Rentals", "Overdue Returns"] as RentalsSubTab[]} active={rentalsSubTab} onChange={setRentalsSubTab} />

                {rentalsSubTab === "Rental History" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by trailer or client..."
                          className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                      <div className="ml-auto"><ExportBtn onClick={exportRentalHistoryCSV} label="Export" variant="teal" /></div>
                    </div>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="Total Rentals" value={String(rentalTotals.total)} valueClass="text-blue-600" icon={<PackageCheck className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
                      <StatCard label="Active Rentals" value={String(rentalTotals.active)} valueClass="text-teal-700" icon={<Truck className="w-5 h-5 text-teal-700" />} iconBg="bg-teal-100" />
                      <StatCard label="Overdue Returns" value={String(rentalTotals.overdue)} valueClass="text-red-600" icon={<AlertCircle className="w-5 h-5 text-red-600" />} iconBg="bg-red-100" />
                      <StatCard label="Total Revenue" value={ksh(rentalTotals.revenue)} valueClass="text-purple-600" icon={<DollarSign className="w-5 h-5 text-purple-600" />} iconBg="bg-purple-100" />
                    </div>
                    <DataTable
                      headers={["RENTAL ID", "TRAILER", "CLIENT", "START DATE", "END DATE", "DAILY RATE", "TOTAL", "STATUS", "ACTIONS"]}
                      emptyMsg="No rentals match the current filters."
                      rows={filteredRentalHistory.slice(0, 30).map((r) => [
                        <span className="font-mono text-foreground">{safeStr(r.id)}</span>,
                        <span className="font-medium">{safeStr(r.trailer_name || r.trailer) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(r.client_name || r.client) || "—"}</span>,
                        <span className="text-muted-foreground whitespace-nowrap">{safeStr(r.start_date) || "—"}</span>,
                        <span className="text-muted-foreground whitespace-nowrap">{safeStr(r.end_date) || "—"}</span>,
                        <span>{ksh(Number(r.daily_rate) || 0)}</span>,
                        <span className="font-semibold">{ksh(Number(r.total_amount ?? r.amount) || 0)}</span>,
                        <StatusBadge status={safeStr(r.status) || "Active"} />,
                        <button className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Eye className="w-4 h-4" /></button>,
                      ])}
                    />
                  </div>
                )}

                {rentalsSubTab === "Active Rentals" && (
                  <div className="space-y-5">
                    <SectionHeader title="Active Rentals" sub="Trailers currently out with clients" />
                    <DataTable
                      headers={["TRAILER", "CLIENT", "PICKUP LOCATION", "START DATE", "EXPECTED RETURN", "DAILY RATE"]}
                      emptyMsg="No active rentals."
                      rows={activeRentals.map((r) => [
                        <span className="font-medium">{safeStr(r.trailer_name || r.trailer) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(r.client_name || r.client) || "—"}</span>,
                        <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{safeStr(r.pickup_location) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(r.start_date) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(r.end_date || r.due_date) || "—"}</span>,
                        <span>{ksh(Number(r.daily_rate) || 0)}</span>,
                      ])}
                    />
                  </div>
                )}

                {rentalsSubTab === "Overdue Returns" && (
                  <div className="space-y-5">
                    <SectionHeader title="Overdue Returns" sub="Rentals past their expected return date" />
                    {overdueRentals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <CheckCircle2 className="w-12 h-12 text-muted-foreground/30" />
                        <p className="text-lg font-semibold text-foreground">No Overdue Returns</p>
                        <p className="text-sm text-teal-600">All active rentals are within their return window</p>
                      </div>
                    ) : (
                      <DataTable
                        headers={["TRAILER", "CLIENT", "EXPECTED RETURN", "DAYS OVERDUE", "DAILY RATE"]}
                        rows={overdueRentals.map((r) => {
                          const due = new Date((r.end_date || r.due_date) as string)
                          const daysOverdue = Math.floor((Date.now() - due.getTime()) / 86400000)
                          return [
                            <span className="font-medium">{safeStr(r.trailer_name || r.trailer) || "—"}</span>,
                            <span className="text-muted-foreground">{safeStr(r.client_name || r.client) || "—"}</span>,
                            <span className="text-muted-foreground">{due.toLocaleDateString("en-KE")}</span>,
                            <span className="font-semibold text-red-600">{daysOverdue}d</span>,
                            <span>{ksh(Number(r.daily_rate) || 0)}</span>,
                          ]
                        })}
                      />
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ─── Fleet ─── */}
            {reportModule === "Fleet" && (
              <section className="space-y-5">
                <SubTabBar tabs={["Trailer Inventory", "Utilization", "Maintenance Schedule"] as FleetSubTab[]} active={fleetSubTab} onChange={setFleetSubTab} />

                {fleetSubTab === "Trailer Inventory" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by name or plate number..."
                          className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                      <select value={trailerTypeFilter} onChange={(e) => setTrailerTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
                        <option value="All">All Types</option>
                        {trailerTypeOptions.map((t) => <option key={`type-${t}`} value={t}>{t}</option>)}
                      </select>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
                        <option value="All">All Status</option>
                        <option value="Available">Available</option>
                        <option value="Rented">Rented</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                      <div className="ml-auto"><ExportBtn onClick={exportTrailerInventoryCSV} label="Export" variant="teal" /></div>
                    </div>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="Total Trailers" value={String(fleetTotals.total)} valueClass="text-blue-600" icon={<Truck className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
                      <StatCard label="Available" value={String(fleetTotals.available)} valueClass="text-teal-700" icon={<CheckCircle2 className="w-5 h-5 text-teal-700" />} iconBg="bg-teal-100" />
                      <StatCard label="Rented" value={String(fleetTotals.rented)} valueClass="text-amber-600" icon={<PackageCheck className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-100" />
                      <StatCard label="In Maintenance" value={String(fleetTotals.inMaintenance)} valueClass="text-red-600" icon={<Wrench className="w-5 h-5 text-red-600" />} iconBg="bg-red-100" />
                    </div>
                    <DataTable
                      headers={["TRAILER ID", "NAME", "TYPE", "PLATE NUMBER", "STATUS", "PURCHASE DATE", "PURCHASE PRICE", "ACTIONS"]}
                      emptyMsg="No trailers match the current filters."
                      rows={filteredTrailers.slice(0, 30).map((t) => [
                        <span className="font-mono text-foreground">{safeStr(t.id)}</span>,
                        <span className="font-medium">{safeStr(t.name || t.trailer_name) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(t.type) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(t.plate_number) || "—"}</span>,
                        <StatusBadge status={safeStr(t.status) || "Available"} />,
                        <span className="text-muted-foreground">{safeStr(t.purchase_date) || "—"}</span>,
                        <span className="font-semibold">{ksh(Number(t.purchase_price) || 0)}</span>,
                        <Link href={`/fleet/trailers/${safeStr(t.id)}`} className="inline-flex p-1.5 rounded hover:bg-teal-100 text-teal-700"><Eye className="w-3.5 h-3.5" /></Link>,
                      ])}
                    />
                  </div>
                )}

                {fleetSubTab === "Utilization" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard label="Fleet Utilization" value={`${utilizationRate}%`} valueClass="text-teal-700" sub="Currently rented" />
                      <StatCard label="Available Trailers" value={String(fleetTotals.available)} valueClass="text-blue-600" />
                      <StatCard label="Rented Trailers" value={String(fleetTotals.rented)} valueClass="text-amber-600" />
                    </div>
                    <DataTable
                      headers={["TRAILER", "TYPE", "PLATE NUMBER", "STATUS", "DAYS RENTED (LIFETIME)", "TOTAL RENTALS"]}
                      emptyMsg="No utilization data available."
                      rows={utilizationByTrailer.slice(0, 30).map((u) => [
                        <span className="font-medium">{u.name}</span>,
                        <span className="text-muted-foreground">{u.type}</span>,
                        <span className="text-muted-foreground">{u.plate}</span>,
                        <StatusBadge status={u.status} />,
                        <span className="font-semibold text-teal-700">{u.daysRented}d</span>,
                        <span>{u.rentalsCount}</span>,
                      ])}
                    />
                  </div>
                )}

                {fleetSubTab === "Maintenance Schedule" && (
                  <div className="space-y-5">
                    <SectionHeader title="Maintenance Schedule" sub="Upcoming and completed trailer maintenance"
                      actions={<ExportBtn onClick={exportMaintenanceCSV} label="Export" variant="teal" />} />
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                      <StatCard label="Scheduled" value={String(maintenanceTotals.scheduled)} valueClass="text-amber-600" />
                      <StatCard label="Completed" value={String(maintenanceTotals.completed)} valueClass="text-teal-700" />
                      <StatCard label="Total Cost" value={ksh(maintenanceTotals.totalCost)} valueClass="text-red-600" />
                    </div>
                    <DataTable
                      headers={["TRAILER", "TYPE", "DATE", "COST", "STATUS", "NEXT SERVICE"]}
                      emptyMsg="No maintenance records found."
                      rows={filteredMaintenance.slice(0, 30).map((m) => [
                        <span className="font-medium">{safeStr(m.trailer_name || m.trailer) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(m.type) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(m.date) || "—"}</span>,
                        <span className="font-semibold">{ksh(Number(m.cost) || 0)}</span>,
                        <StatusBadge status={safeStr(m.status) || "Scheduled"} />,
                        <span className="text-muted-foreground">{safeStr(m.next_service_date) || "—"}</span>,
                      ])}
                    />
                  </div>
                )}
              </section>
            )}

            {/* ─── Clients ─── */}
            {reportModule === "Clients" && (
              <section className="space-y-5">
                <SubTabBar tabs={["Client Statements", "Outstanding Payments", "Client Activity"] as ClientsSubTab[]} active={clientsSubTab} onChange={setClientsSubTab} />

                {clientsSubTab === "Client Statements" && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by client name..."
                          className="pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                      <div className="ml-auto"><ExportBtn onClick={exportClientStatementsCSV} label="Export" variant="teal" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard label="Total Clients" value={String(clientTotals.total)} valueClass="text-blue-600" />
                      <StatCard label="Clients with Balance" value={String(clientTotals.withBalance)} valueClass="text-amber-600" />
                      <StatCard label="Total Outstanding" value={ksh(clientTotals.outstanding)} valueClass="text-red-600" />
                    </div>
                    <DataTable
                      headers={["CLIENT", "TOTAL RENTALS", "TOTAL SPEND", "OUTSTANDING BALANCE", "ACTIONS"]}
                      emptyMsg="No clients match the current filters."
                      rows={filteredClients.slice(0, 30).map((c) => [
                        <span className="font-medium">{safeStr(c.name || c.company_name) || "—"}</span>,
                        <span>{Number(c.total_rentals ?? c.rentals_count) || 0}</span>,
                        <span className="font-semibold text-teal-700">{ksh(Number(c.total_spend ?? c.lifetime_value) || 0)}</span>,
                        <span className={Number(c.outstanding_balance) > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}>{ksh(Number(c.outstanding_balance) || 0)}</span>,
                        <Link href={`/clients/${safeStr(c.id)}`} className="inline-flex p-1.5 rounded hover:bg-teal-100 text-teal-700"><Eye className="w-3.5 h-3.5" /></Link>,
                      ])}
                    />
                  </div>
                )}

                {clientsSubTab === "Outstanding Payments" && (
                  <div className="space-y-5">
                    <SectionHeader title="Outstanding Payments" sub="Clients with an unpaid balance" />
                    {clientsWithBalance.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <CheckCircle2 className="w-12 h-12 text-muted-foreground/30" />
                        <p className="text-lg font-semibold text-foreground">No Outstanding Payments</p>
                        <p className="text-sm text-teal-600">All client accounts are settled</p>
                      </div>
                    ) : (
                      <DataTable
                        headers={["CLIENT", "OUTSTANDING BALANCE", "LAST RENTAL DATE"]}
                        rows={clientsWithBalance.map((c) => [
                          <span className="font-medium">{safeStr(c.name || c.company_name) || "—"}</span>,
                          <span className="font-semibold text-red-600">{ksh(Number(c.outstanding_balance) || 0)}</span>,
                          <span className="text-muted-foreground">{safeStr(c.last_rental_date) || "—"}</span>,
                        ])}
                      />
                    )}
                  </div>
                )}

                {clientsSubTab === "Client Activity" && (
                  <div className="space-y-5">
                    <SectionHeader title="Client Activity" sub="Rental frequency per client" />
                    <DataTable
                      headers={["CLIENT", "TOTAL RENTALS", "LAST RENTAL DATE"]}
                      emptyMsg="No client activity data."
                      rows={clients.map((c) => [
                        <span className="font-medium">{safeStr(c.name || c.company_name) || "—"}</span>,
                        <span className="font-semibold text-teal-700">{Number(c.total_rentals ?? c.rentals_count) || 0}</span>,
                        <span className="text-muted-foreground">{safeStr(c.last_rental_date) || "—"}</span>,
                      ])}
                    />
                  </div>
                )}
              </section>
            )}

            {/* ─── Finance ─── */}
            {reportModule === "Finance" && (
              <section className="space-y-5">
                <SubTabBar tabs={["Revenue Register", "Expense Register", "Profit & Loss"] as FinanceSubTab[]} active={financeSubTab} onChange={setFinanceSubTab} />
                <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/40 rounded-xl border border-border">
                  <select value={range} onChange={(e) => setRange(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
                    <option value="all">All Time</option>
                    <option value="1month">Past 1 Month</option>
                    <option value="6months">Past 6 Months</option>
                    <option value="1year">Past 1 Year</option>
                  </select>
                  {financeSubTab === "Expense Register" && (
                    <select value={expCatFilter} onChange={(e) => setExpCatFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
                      <option value="All">All Categories</option>
                      {EXPENSE_CATEGORIES.map((c) => <option key={`cat-${c}`} value={c}>{c}</option>)}
                    </select>
                  )}
                  <div className="ml-auto flex gap-2">
                    {financeSubTab === "Revenue Register" && <ExportBtn onClick={exportRevenueCSV} label="Export CSV" variant="teal" />}
                    {financeSubTab === "Expense Register" && <ExportBtn onClick={exportExpensesCSV} label="Export CSV" variant="teal" />}
                    {financeSubTab === "Profit & Loss" && <ExportBtn onClick={exportProfitLossCSV} label="Export CSV" variant="teal" />}
                  </div>
                </div>

                {financeSubTab === "Revenue Register" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard label="Total Revenue" value={ksh(revenueTotal)} valueClass="text-teal-700" />
                      <StatCard label="Rentals Counted" value={String(rentals.length)} valueClass="text-blue-600" />
                      <StatCard label="Avg. Revenue / Rental" value={ksh(rentals.length ? revenueTotal / rentals.length : 0)} valueClass="text-purple-600" />
                    </div>
                    <DataTable
                      headers={["RENTAL ID", "TRAILER", "CLIENT", "DATE", "AMOUNT", "STATUS"]}
                      emptyMsg="No revenue records found."
                      rows={rentals.slice(0, 25).map((r) => [
                        <span className="font-mono">{safeStr(r.id)}</span>,
                        <span>{safeStr(r.trailer_name || r.trailer) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(r.client_name || r.client) || "—"}</span>,
                        <span className="text-muted-foreground">{safeStr(r.start_date) || "—"}</span>,
                        <span className="font-semibold">{ksh(Number(r.total_amount ?? r.amount) || 0)}</span>,
                        <StatusBadge status={safeStr(r.status) || "Active"} />,
                      ])}
                    />
                  </div>
                )}

                {financeSubTab === "Expense Register" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="Total Expenses" value={String(filteredExpenses.length)} valueClass="text-blue-600" />
                      <StatCard label="Total Amount" value={ksh(expenseTotal)} valueClass="text-red-600" />
                    </div>
                    <DataTable
                      headers={["EXPENSE ID", "DATE", "CATEGORY", "DESCRIPTION", "AMOUNT", "STATUS"]}
                      emptyMsg="No expenses match the current filters."
                      rows={filteredExpenses.slice(0, 25).map((e) => [
                        <span className="font-mono">{safeStr(e.id)}</span>,
                        <span className="text-muted-foreground whitespace-nowrap">{safeStr(e.date)}</span>,
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{safeStr(e.category)}</span>,
                        <span className="text-muted-foreground max-w-36 truncate block">{safeStr(e.description)}</span>,
                        <span className="font-semibold whitespace-nowrap">{ksh(Number(e.amount) || 0)}</span>,
                        <StatusBadge status={safeStr(e.status) || "Approved"} />,
                      ])}
                    />
                  </div>
                )}

                {financeSubTab === "Profit & Loss" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard label="Total Revenue" value={ksh(revenueTotal)} valueClass="text-teal-700" />
                      <StatCard label="Total Expenses" value={ksh(expenseTotal)} valueClass="text-red-600" />
                      <StatCard label="Net Profit / Loss" value={ksh(profitLoss)} valueClass={profitLoss >= 0 ? "text-teal-700" : "text-red-600"} />
                    </div>
                    <Card className="bg-card border-border rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Revenue vs Expenses</CardTitle></CardHeader>
                      <CardContent>
                        {revenueTrendData.length === 0 ? <EmptyState message="No financial trend data." /> : (
                          <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={revenueTrendData}>
                              <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.2} />
                                  <stop offset="95%" stopColor="#0F6E56" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={fmtKsh} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Area type="monotone" dataKey="revenue" stroke="#0F6E56" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                              <Area type="monotone" dataKey="expenses" stroke="#EF4444" fill="url(#expGrad)" strokeWidth={2} name="Expenses" strokeDasharray="4 4" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </section>
            )}

            {/* ─── Maintenance (top-level report) ─── */}
            {reportModule === "Maintenance" && (
              <section className="space-y-5">
                <SectionHeader title="Maintenance" sub="Fleet maintenance costs and schedule"
                  actions={<ExportBtn onClick={exportMaintenanceCSV} label="Export CSV" variant="teal" />} />
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="Total Records" value={String(maintenanceTotals.total)} valueClass="text-blue-600" />
                  <StatCard label="Scheduled" value={String(maintenanceTotals.scheduled)} valueClass="text-amber-600" />
                  <StatCard label="Completed" value={String(maintenanceTotals.completed)} valueClass="text-teal-700" />
                  <StatCard label="Total Cost" value={ksh(maintenanceTotals.totalCost)} valueClass="text-red-600" />
                </div>
                <DataTable
                  headers={["TRAILER", "TYPE", "DATE", "COST", "STATUS", "NEXT SERVICE"]}
                  emptyMsg="No maintenance records found."
                  rows={filteredMaintenance.slice(0, 30).map((m) => [
                    <span className="font-medium">{safeStr(m.trailer_name || m.trailer) || "—"}</span>,
                    <span className="text-muted-foreground">{safeStr(m.type) || "—"}</span>,
                    <span className="text-muted-foreground">{safeStr(m.date) || "—"}</span>,
                    <span className="font-semibold">{ksh(Number(m.cost) || 0)}</span>,
                    <StatusBadge status={safeStr(m.status) || "Scheduled"} />,
                    <span className="text-muted-foreground">{safeStr(m.next_service_date) || "—"}</span>,
                  ])}
                />
              </section>
            )}

            {/* ─── Tax Summary ─── */}
            {reportModule === "Tax Summary" && (
              <section className="space-y-5">
                <SectionHeader title="Tax Summary" sub="Gross revenue, deductible expenses, and taxable profit"
                  actions={<ExportBtn onClick={exportTaxSummaryCSV} label="Export CSV" variant="teal" />} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard label="Gross Revenue" value={ksh(revenueTotal)} valueClass="text-teal-700" />
                  <StatCard label="Deductible Expenses" value={ksh(expenseTotal)} valueClass="text-red-600" />
                  <StatCard label="Taxable Profit" value={ksh(profitLoss)} valueClass={profitLoss >= 0 ? "text-teal-700" : "text-red-600"} />
                </div>
                <EmptyState message="Detailed tax filing breakdowns will appear here once statutory categories are configured." />
              </section>
            )}
          </>
        )}

        {/* ══════════════ ANALYTICS ══════════════ */}
        {mainTab === "Analytics" && (
          <>
            {/* ─── Utilization Analytics ─── */}
            {analyticsModule === "Utilization" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                  <PeriodBar periods={["This Month", "Last 3M", "Last 6M", "All Time"]} active={analyticsPeriod} onChange={setAnalyticsPeriod} />
                  <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 border border-input rounded-lg text-sm font-medium hover:bg-accent">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
                <SubTabBar tabs={["Overview", "Trends"] as UtilizationSubTab[]} active={utilSubTab} onChange={setUtilSubTab} />

                {utilSubTab === "Overview" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard label="Fleet Utilization" value={`${utilizationRate}%`} valueClass="text-teal-700" icon={<TrendingUp className="w-5 h-5 text-teal-700" />} iconBg="bg-teal-100" />
                      <StatCard label="Total Trailers" value={String(fleetTotals.total)} valueClass="text-blue-600" icon={<Truck className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
                      <StatCard label="Currently Rented" value={String(fleetTotals.rented)} valueClass="text-amber-600" icon={<PackageCheck className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-100" />
                      <StatCard label="In Maintenance" value={String(fleetTotals.inMaintenance)} valueClass="text-red-600" icon={<Wrench className="w-5 h-5 text-red-600" />} iconBg="bg-red-100" />
                    </div>
                    <Card className="bg-card border-border rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Days Rented by Trailer</CardTitle></CardHeader>
                      <CardContent>
                        {utilizationByTrailer.length === 0 ? <EmptyState message="No utilization data." /> : (
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={utilizationByTrailer.slice(0, 10)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={fmtCount} />
                              <Bar dataKey="daysRented" fill="#0F6E56" radius={[4,4,0,0]} name="Days Rented" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
                {utilSubTab === "Trends" && (
                  <EmptyState message="Utilization trend charts will appear once enough rental history has accumulated." />
                )}
              </section>
            )}

            {/* ─── Fleet Analytics ─── */}
            {analyticsModule === "Fleet" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                  <PeriodBar periods={["This Month", "Last 3M", "Last 6M", "All Time"]} active={analyticsPeriod} onChange={setAnalyticsPeriod} />
                </div>
                <SubTabBar tabs={["Overview", "By Type"] as FleetAnalyticsSubTab[]} active={fleetAnalyticsSubTab} onChange={setFleetAnalyticsSubTab} />

                {fleetAnalyticsSubTab === "Overview" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="bg-card border-border rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Fleet Status</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Available", value: fleetTotals.available },
                                { name: "Rented", value: fleetTotals.rented },
                                { name: "Maintenance", value: fleetTotals.inMaintenance },
                              ]}
                              dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                              label={pieLabel} labelLine={false}>
                              <Cell fill="#10B981" /><Cell fill="#F59E0B" /><Cell fill="#EF4444" />
                            </Pie>
                            <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card className="bg-card border-border rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Trailers by Type</CardTitle></CardHeader>
                      <CardContent>
                        {fleetByTypeData.length === 0 ? <EmptyState message="No fleet data." /> : (
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={fleetByTypeData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={fmtCount} />
                              <Bar dataKey="count" fill="#6366F1" radius={[4,4,0,0]} name="Count" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
                {fleetAnalyticsSubTab === "By Type" && (
                  <DataTable
                    headers={["TYPE", "TRAILER COUNT"]}
                    emptyMsg="No fleet data for this period."
                    rows={fleetByTypeData.map((t) => [
                      <span className="font-medium">{t.name}</span>,
                      <span className="font-semibold text-teal-700">{t.count}</span>,
                    ])}
                  />
                )}
              </section>
            )}

            {/* ─── Clients Analytics ─── */}
            {analyticsModule === "Clients" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                  <PeriodBar periods={["This Month", "Last 3M", "Last 6M", "All Time"]} active={analyticsPeriod} onChange={setAnalyticsPeriod} />
                </div>
                <SubTabBar tabs={["Overview", "Top Clients"] as ClientsAnalyticsSubTab[]} active={clientsAnalyticsSubTab} onChange={setClientsAnalyticsSubTab} />

                {clientsAnalyticsSubTab === "Overview" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard label="Total Clients" value={String(clientTotals.total)} valueClass="text-blue-600" />
                      <StatCard label="With Outstanding Balance" value={String(clientTotals.withBalance)} valueClass="text-amber-600" />
                      <StatCard label="Total Outstanding" value={ksh(clientTotals.outstanding)} valueClass="text-red-600" />
                    </div>
                    <Card className="bg-card border-border rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Clients by Spend</CardTitle></CardHeader>
                      <CardContent>
                        {topClients.length === 0 ? <EmptyState message="No client spend data." /> : (
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={topClients}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={fmtKsh} />
                              <Bar dataKey="totalSpend" fill="#0F6E56" radius={[4,4,0,0]} name="Total Spend" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
                {clientsAnalyticsSubTab === "Top Clients" && (
                  <DataTable
                    headers={["CLIENT", "TOTAL RENTALS", "TOTAL SPEND"]}
                    emptyMsg="No client data for this period."
                    rows={topClients.map((c) => [
                      <span className="font-medium">{c.name}</span>,
                      <span>{c.rentalsCount}</span>,
                      <span className="font-semibold text-teal-700">{ksh(c.totalSpend)}</span>,
                    ])}
                  />
                )}
              </section>
            )}

            {/* ─── Finance Analytics ─── */}
            {analyticsModule === "Finance" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                  <PeriodBar periods={["This Month", "Last 3M", "Last 6M", "All Time"]} active={analyticsPeriod} onChange={setAnalyticsPeriod} />
                </div>
                <SubTabBar tabs={["Overview", "Trends"] as FinanceAnalyticsSubTab[]} active={financeAnalyticsSubTab} onChange={setFinanceAnalyticsSubTab} />

                {financeAnalyticsSubTab === "Overview" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard label="Total Revenue" value={ksh(revenueTotal)} valueClass="text-teal-700" />
                      <StatCard label="Total Expenses" value={ksh(expenseTotal)} valueClass="text-red-600" />
                      <StatCard label="Net Profit" value={ksh(profitLoss)} valueClass={profitLoss >= 0 ? "text-teal-700" : "text-red-600"} />
                    </div>
                    <Card className="bg-card border-border rounded-xl">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Spend by Category</CardTitle></CardHeader>
                      <CardContent>
                        {categoryChartData.length === 0 ? <EmptyState message="No expense data." /> : (
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={categoryChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={fmtKsh} />
                              <Bar dataKey="value" radius={[4,4,0,0]} name="Amount">
                                {categoryChartData.map((_, i) => <Cell key={String(i)} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
                {financeAnalyticsSubTab === "Trends" && (
                  <Card className="bg-card border-border rounded-xl">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Revenue vs Expenses Over Time</CardTitle></CardHeader>
                    <CardContent>
                      {revenueTrendData.length === 0 ? <EmptyState message="No financial trend data." /> : (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={revenueTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={fmtKsh} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="revenue" fill="#0F6E56" name="Revenue" radius={[4,4,0,0]} />
                            <Bar dataKey="expenses" fill="#EF4444" name="Expenses" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                )}
              </section>
            )}

            {/* ─── Maintenance Analytics ─── */}
            {analyticsModule === "Maintenance" && (
              <section className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="Total Records" value={String(maintenanceTotals.total)} valueClass="text-blue-600" />
                  <StatCard label="Scheduled" value={String(maintenanceTotals.scheduled)} valueClass="text-amber-600" />
                  <StatCard label="Completed" value={String(maintenanceTotals.completed)} valueClass="text-teal-700" />
                  <StatCard label="Total Cost" value={ksh(maintenanceTotals.totalCost)} valueClass="text-red-600" />
                </div>
                <EmptyState message="Maintenance trend charts will appear once more service history is logged." />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}