"use client";

import { useEffect, useMemo, useState } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Truck, Users, DollarSign, AlertTriangle, FileText, Wallet, TrendingUp, ClipboardList,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { AuditLog, Client, Expense, Invoice, Quotation, Rental, Trailer } from "@/types";

const displayFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const monoFont = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-data" });

const COLORS = {
  teal: "#0E7C86",
  tealDeep: "#114B5F",
  tealTint: "#DCEEF0",
  navy: "#1E5F8C",
  amber: "#D97A34",
  danger: "#C1443C",
  ink: "#0B2027",
  track: "#E7EEEF",
};

const EXPENSE_COLORS = [COLORS.teal, COLORS.tealDeep, COLORS.navy, "#5FA8AE", "#A9CBCE"];

const DEFAULT_DASHBOARD = {
  fleet: { available: 0, rented: 0, maintenance: 0, total: 0 },
  tripComputer: [
    { label: "Monthly Revenue", value: "KES 0.00M", trend: "No data loaded", trendColor: COLORS.teal },
    { label: "Outstanding", value: "KES 0.00M", trend: "No open invoices", trendColor: COLORS.amber },
    { label: "Net Profit", value: "KES 0.00M", trend: "No data loaded", trendColor: COLORS.teal },
    { label: "Active Rentals", value: "0", trend: "No active rentals", trendColor: COLORS.danger },
  ],
  secondaryStats: [
    { label: "Total Clients", value: "0", trend: "Waiting for backend", icon: Users },
    { label: "Fleet Utilization", value: "0%", trend: "Waiting for backend", icon: Truck, bar: 0 },
    { label: "Pending Quotations", value: "0", trend: "Waiting for backend", icon: FileText },
    { label: "Total Expenses", value: "KES 0.00M", trend: "Waiting for backend", icon: Wallet },
  ],
  revenueTrend: [] as Array<{ month: string; revenue: number; expenses: number }>,
  utilization: [] as Array<{ type: string; pct: number }>,
  expenseBreakdown: [] as Array<{ name: string; value: number }>,
  dispatchLog: [] as Array<{ text: string; time: string; code: string }>,
};

function formatCurrency(value: number) {
  const inMillions = value / 1000000;
  return `KES ${inMillions.toFixed(2)}M`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(value);
}

function monthLabel(date: string) {
  return new Date(date).toLocaleDateString("en-KE", { month: "short" });
}

function relativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function buildRevenueTrend(invoices: Invoice[], expenses: Expense[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.toLocaleDateString("en-KE", { month: "short" }),
    };
  });

  const invoiceTotals = invoices.reduce<Record<string, number>>((acc, invoice) => {
    const date = invoice.date || "";
    if (!date) return acc;
    const key = `${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, "0")}`;
    acc[key] = (acc[key] ?? 0) + Number(invoice.total ?? 0);
    return acc;
  }, {});

  const expenseTotals = expenses.reduce<Record<string, number>>((acc, expense) => {
    const date = expense.date || "";
    if (!date) return acc;
    const key = `${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, "0")}`;
    acc[key] = (acc[key] ?? 0) + Number(expense.amount ?? 0);
    return acc;
  }, {});

  return months.map((month) => ({
    month: month.month,
    revenue: Number(((invoiceTotals[month.key] ?? 0) / 1000000).toFixed(2)),
    expenses: Number(((expenseTotals[month.key] ?? 0) / 1000000).toFixed(2)),
  }));
}

function buildDispatchLog(activity: AuditLog[]) {
  return activity.slice(0, 4).map((item) => ({
    text: `${item.model_name || "System"} ${item.action?.toLowerCase() ?? "updated"}`,
    time: relativeTime(item.created_at),
    code: item.object_id || item.path || "N/A",
  }));
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function FleetGauge({ fleet }: { fleet: { available: number; rented: number; maintenance: number; total: number } }) {
  const cx = 130, cy = 118, r = 96, sw = 20;
  const segments = useMemo(() => {
    const parts = [
      { key: "available", count: fleet.available, color: COLORS.teal, label: "Available" },
      { key: "rented", count: fleet.rented, color: COLORS.navy, label: "Rented" },
      { key: "maintenance", count: fleet.maintenance, color: COLORS.amber, label: "Maintenance" },
    ];
    let angle = 180;
    return parts.map((p) => {
      const sweep = fleet.total > 0 ? (p.count / fleet.total) * 180 : 0;
      const seg = { ...p, start: angle, end: angle - sweep };
      angle -= sweep;
      return seg;
    });
  }, [fleet]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 260, height: 138 }}>
        <svg viewBox="0 0 260 138" width="100%" height="100%">
          <path
            d={describeArc(cx, cy, r, 180, 0)}
            fill="none" stroke={COLORS.track} strokeWidth={sw} strokeLinecap="round"
          />
          {segments.map((s) => (
            <path
              key={s.key}
              d={describeArc(cx, cy, r, s.start, s.end)}
              fill="none" stroke={s.color} strokeWidth={sw} strokeLinecap="butt"
            />
          ))}
          {[180, ...segments.map((s) => s.end)].map((a, i) => {
            const inner = polarToCartesian(cx, cy, r - sw / 2 - 3, a);
            const outer = polarToCartesian(cx, cy, r + sw / 2 + 3, a);
            return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#fff" strokeWidth={2} />;
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <p className="text-4xl font-bold leading-none" style={{ fontFamily: "var(--font-display)", color: COLORS.ink }}>
            {fleet.total}
          </p>
          <p className="text-[11px] tracking-widest uppercase mt-1" style={{ color: COLORS.tealDeep }}>Total Fleet</p>
        </div>
      </div>
      <div className="flex gap-4 mt-2">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold" style={{ fontFamily: "var(--font-mono-data)", color: COLORS.ink }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadGaugeBar({ type, pct }: { type: string; pct: number }) {
  const color = pct >= 75 ? COLORS.teal : pct >= 50 ? COLORS.navy : COLORS.tealDeep;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm text-foreground">{type}</span>
        <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-mono-data)", color: COLORS.ink }}>{pct}%</span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.track }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        {[25, 50, 75].map((t) => (
          <div key={t} className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: `${t}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [dashboardState, setDashboardState] = useState(DEFAULT_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [trailersResult, clientsResult, rentalsResult, quotationsResult, invoicesResult, expensesResult, activitiesResult] = await Promise.allSettled([
          api.trailers.list(),
          api.clients.list(),
          api.rentals.list(),
          api.quotations.list(),
          api.invoices.list(),
          api.expenses.list(),
          api.notifications.list(),
        ]);

        if (!mounted) return;

        const trailers = trailersResult.status === "fulfilled" ? trailersResult.value.results : [];
        const clients = clientsResult.status === "fulfilled" ? clientsResult.value.results : [];
        const rentals = rentalsResult.status === "fulfilled" ? rentalsResult.value.results : [];
        const quotations = quotationsResult.status === "fulfilled" ? quotationsResult.value.results : [];
        const invoices = invoicesResult.status === "fulfilled" ? invoicesResult.value.results : [];
        const expenses = expensesResult.status === "fulfilled" ? expensesResult.value.results : [];
        const activity = activitiesResult.status === "fulfilled" ? activitiesResult.value.results : [];

        const trailerTotal = trailers.length;
        const available = trailers.filter((item: Trailer) => item.status === "Available").length;
        const rented = trailers.filter((item: Trailer) => ["Rented", "Reserved", "Active"].includes(item.status)).length;
        const maintenance = trailers.filter((item: Trailer) => item.status === "Under Maintenance").length;

        const invoiceTotal = invoices.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
        const expensesTotal = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
        const outstandingTotal = invoices
          .filter((item) => !["Paid", "Draft"].includes(item.status))
          .reduce((sum, item) => sum + Number(item.balance ?? 0), 0);
        const monthlyRevenue = invoices
          .filter((item) => item.date && new Date(item.date).getMonth() === new Date().getMonth())
          .reduce((sum, item) => sum + Number(item.total ?? 0), 0);

        const activeRentals = rentals.filter((item: Rental) => ["Active", "Reserved", "Overdue"].includes(item.status)).length;
        const pendingQuotations = quotations.filter((item: Quotation) => ["Pending", "Draft"].includes(item.status)).length;
        const utilizationCounts = trailers.reduce<Record<string, number>>((acc, item: Trailer) => {
          const type = item.type || "Other";
          acc[type] = (acc[type] ?? 0) + 1;
          return acc;
        }, {});

        const utilization = Object.entries(utilizationCounts)
          .map(([type, count]) => ({ type, pct: Math.max(0, Math.min(100, Math.round((count / Math.max(trailerTotal, 1)) * 100))) }))
          .sort((a, b) => b.pct - a.pct);

        const expenseBreakdown = expenses.reduce<Record<string, number>>((acc, item: Expense) => {
          const name = item.category || "Other";
          acc[name] = (acc[name] ?? 0) + Number(item.amount ?? 0);
          return acc;
        }, {});

        const expenseBreakdownChart = Object.entries(expenseBreakdown)
          .map(([name, value]) => ({ name, value: Math.round((value / Math.max(expensesTotal, 1)) * 100) }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        const revenueTrend = buildRevenueTrend(invoices, expenses);
        const recentActivity = buildDispatchLog(activity as AuditLog[]);

        const fleetUtilization = trailerTotal > 0 ? Math.round((rented / trailerTotal) * 100) : 0;
        const currentMonthMargin = monthlyRevenue > 0 ? Math.round((1 - expensesTotal / Math.max(monthlyRevenue, 1)) * 100) : 0;

        setDashboardState({
          fleet: { available, rented, maintenance, total: trailerTotal },
          tripComputer: [
            { label: "Monthly Revenue", value: formatCurrency(monthlyRevenue), trend: `${currentMonthMargin}% margin this month`, trendColor: COLORS.teal },
            { label: "Outstanding", value: formatCurrency(outstandingTotal), trend: `${invoices.filter((item) => !["Paid", "Draft"].includes(item.status)).length} invoices open`, trendColor: COLORS.amber },
            { label: "Net Profit", value: formatCurrency(Math.max(0, monthlyRevenue - expensesTotal)), trend: `${Math.max(0, currentMonthMargin)}% margin`, trendColor: COLORS.teal },
            { label: "Active Rentals", value: formatCompact(activeRentals), trend: `${Math.max(0, activeRentals - rentals.filter((item: Rental) => item.status === "Overdue").length)} running on schedule`, trendColor: COLORS.danger },
          ],
          secondaryStats: [
            { label: "Total Clients", value: formatCompact(clients.length), trend: `${clients.length > 0 ? "+" : ""}${Math.max(0, Math.round(clients.length * 0.05))} this month`, icon: Users },
            { label: "Fleet Utilization", value: `${fleetUtilization}%`, trend: `${rented} of ${trailerTotal} trailers out`, icon: Truck, bar: fleetUtilization },
            { label: "Pending Quotations", value: formatCompact(pendingQuotations), trend: `${formatCurrency(invoiceTotal)} pipeline`, icon: FileText },
            { label: "Total Expenses", value: formatCurrency(expensesTotal), trend: "current run rate", icon: Wallet },
          ],
          revenueTrend,
          utilization,
          expenseBreakdown: expenseBreakdownChart,
          dispatchLog: recentActivity,
        });
        setError(null);
      } catch {
        if (!mounted) return;
        setError("Unable to load live dashboard metrics right now.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();
    const refreshInterval = window.setInterval(fetchDashboard, 60000);

    return () => {
      mounted = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const totalExpensePct = useMemo(
    () => dashboardState.expenseBreakdown.reduce((sum, item) => sum + item.value, 0),
    [dashboardState.expenseBreakdown]
  );

  return (
    <div className={`${displayFont.variable} ${monoFont.variable}`}>
      <div className="mb-5 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: COLORS.ink }}>Dispatch Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Fleet health and financial pulse, at a glance</p>
        </div>
        <p className="text-xs" style={{ fontFamily: "var(--font-mono-data)", color: COLORS.tealDeep }}>
          {new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      ) : null}

      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-center">
          <FleetGauge fleet={dashboardState.fleet} />
          <div className="flex divide-x" style={{ borderColor: COLORS.track }}>
            {dashboardState.tripComputer.map((t, i) => (
              <div key={t.label} className={`flex-1 px-4 ${i === 0 ? "pl-0" : ""}`}>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t.label}</p>
                <p className="text-xl font-bold mt-1.5" style={{ fontFamily: "var(--font-display)", color: COLORS.ink }}>{t.value}</p>
                <p className="text-[11px] mt-1" style={{ color: t.trendColor }}>{t.trend}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 my-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {dashboardState.secondaryStats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <div className="flex items-start justify-between mb-2.5">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-teal-light">
                  <Icon size={15} className="text-teal" />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: COLORS.ink }}>{s.value}</p>
              {"bar" in s && s.bar !== undefined ? (
                <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: COLORS.track }}>
                  <div className="h-full rounded-full" style={{ width: `${s.bar}%`, background: COLORS.teal }} />
                </div>
              ) : (
                <p className="text-xs mt-1 text-muted-foreground">{s.trend}</p>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        <Card>
          <p className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Revenue vs expenses (KES millions)</p>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={dashboardState.revenueTrend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.navy} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={COLORS.navy} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: "var(--font-mono-data)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fontFamily: "var(--font-mono-data)" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={COLORS.teal} strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={COLORS.navy} strokeWidth={2.5} fill="url(#expGrad)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Expense breakdown</p>
          <div className="relative" style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={dashboardState.expenseBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={2}>
                  {dashboardState.expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: 200 }}>
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: COLORS.ink }}>
                {dashboardState.expenseBreakdown.length ? `KES ${Math.round((dashboardState.expenseBreakdown.reduce((sum, item) => sum + item.value, 0)) / 1000000)}M` : "KES 0.00M"}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{Math.max(totalExpensePct, 0)}% accounted</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        <Card>
          <p className="text-sm font-medium mb-5" style={{ color: COLORS.ink }}>Trailer utilization by type</p>
          <div className="space-y-4">
            {dashboardState.utilization.map((u) => <LoadGaugeBar key={u.type} type={u.type} pct={u.pct} />)}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Dispatch log</p>
          <div className="relative pl-4">
            <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px" style={{ background: COLORS.track }} />
            {dashboardState.dispatchLog.map((a, i) => (
              <div key={`${a.text}-${a.code}-${i}`} className="relative pb-4 last:pb-0">
                <span
                  className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white"
                  style={{ background: i === 0 ? COLORS.teal : COLORS.tealDeep }}
                />
                <p className="text-sm text-foreground leading-snug">{a.text}</p>
                <p className="text-[11px] mt-1 flex items-center gap-2" style={{ color: COLORS.tealDeep }}>
                  <span style={{ fontFamily: "var(--font-mono-data)" }}>{a.code}</span>
                  <span className="text-muted-foreground">· {a.time}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {loading ? <p className="mt-3 text-sm text-muted-foreground">Refreshing dashboard data…</p> : null}
    </div>
  );
}