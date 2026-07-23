"use client";

import { useMemo } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Truck, Users, DollarSign, AlertTriangle, FileText, Wallet, TrendingUp, ClipboardList,
} from "lucide-react";
import { Card } from "@/components/ui/card";

// ── Type system ──────────────────────────────────────────────────────────
// Space Grotesk carries every number on this page — condensed, technical,
// closer to a stamped gauge face than a marketing headline.
// IBM Plex Mono is reserved for anything that reads as a record: codes,
// timestamps, references — the manifest register.
const displayFont = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const monoFont = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-data" });

// ── Palette (white / teal, kept intentional rather than default gray) ──
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

// ── Data (same figures as before, reorganized for the new layout) ──────
const fleet = { available: 37, rented: 39, maintenance: 8, total: 84 };

const tripComputer = [
  { label: "Monthly Revenue", value: "KES 8.42M", trend: "+12.4% vs last month", trendColor: COLORS.teal },
  { label: "Outstanding", value: "KES 1.16M", trend: "18 invoices open", trendColor: COLORS.amber },
  { label: "Net Profit", value: "KES 5.55M", trend: "65.9% margin", trendColor: COLORS.teal },
  { label: "Active Rentals", value: "39", trend: "5 running overdue", trendColor: COLORS.danger },
];

const secondaryStats = [
  { label: "Total Clients", value: "156", trend: "+9 this month", icon: Users },
  { label: "Fleet Utilization", value: "46%", trend: "39 of 84 trailers out", icon: Truck, bar: 46 },
  { label: "Pending Quotations", value: "14", trend: "KES 2.3M value", icon: FileText },
  { label: "Total Expenses", value: "KES 2.87M", trend: "this month", icon: Wallet },
];

const revenueTrend = [
  { month: "Feb", revenue: 6.1, expenses: 2.3 },
  { month: "Mar", revenue: 6.8, expenses: 2.5 },
  { month: "Apr", revenue: 7.2, expenses: 2.4 },
  { month: "May", revenue: 6.9, expenses: 2.6 },
  { month: "Jun", revenue: 7.8, expenses: 2.7 },
  { month: "Jul", revenue: 8.42, expenses: 2.87 },
];

const utilization = [
  { type: "Flatbed", pct: 72 },
  { type: "Low Loader", pct: 58 },
  { type: "Fuel Tanker", pct: 81 },
  { type: "Container", pct: 64 },
  { type: "Side Tipper", pct: 45 },
];

const expenseBreakdown = [
  { name: "Fuel", value: 32 },
  { name: "Maintenance", value: 24 },
  { name: "Insurance", value: 18 },
  { name: "Tyres", value: 14 },
  { name: "Other", value: 12 },
];
const EXPENSE_COLORS = [COLORS.teal, COLORS.tealDeep, COLORS.navy, "#5FA8AE", "#A9CBCE"];
const totalExpensePct = expenseBreakdown.reduce((s, e) => s + e.value, 0);

const dispatchLog = [
  { text: "Invoice INV-2041 marked as paid", time: "12 min ago", code: "INV-2041" },
  { text: "Trailer TR-014 returned from Kamau Logistics", time: "48 min ago", code: "TR-014" },
  { text: "Quotation QT-0088 accepted by Zenith Freight", time: "1 hr ago", code: "QT-0088" },
  { text: "Maintenance scheduled for TR-027 (brake service)", time: "3 hrs ago", code: "TR-027" },
];

// ── Gauge math ───────────────────────────────────────────────────────────
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

function FleetGauge() {
  const cx = 130, cy = 118, r = 96, sw = 20;
  const segments = useMemo(() => {
    const parts = [
      { key: "available", count: fleet.available, color: COLORS.teal, label: "Available" },
      { key: "rented", count: fleet.rented, color: COLORS.navy, label: "Rented" },
      { key: "maintenance", count: fleet.maintenance, color: COLORS.amber, label: "Maintenance" },
    ];
    let angle = 180;
    return parts.map((p) => {
      const sweep = (p.count / fleet.total) * 180;
      const seg = { ...p, start: angle, end: angle - sweep };
      angle -= sweep;
      return seg;
    });
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 260, height: 138 }}>
        <svg viewBox="0 0 260 138" width="100%" height="100%">
          {/* background track */}
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
          {/* boundary ticks — mark real category edges, not decoration */}
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

      {/* ── Instrument cluster: fleet gauge + trip computer ─────────── */}
      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-center">
          <FleetGauge />
          <div className="flex divide-x" style={{ borderColor: COLORS.track }}>
            {tripComputer.map((t, i) => (
              <div key={t.label} className={`flex-1 px-4 ${i === 0 ? "pl-0" : ""}`}>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{t.label}</p>
                <p className="text-xl font-bold mt-1.5" style={{ fontFamily: "var(--font-display)", color: COLORS.ink }}>{t.value}</p>
                <p className="text-[11px] mt-1" style={{ color: t.trendColor }}>{t.trend}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Secondary readouts ──────────────────────────────────────── */}
      <div className="grid gap-3 my-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {secondaryStats.map((s) => {
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

      {/* ── Revenue / expense trend + breakdown ─────────────────────── */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        <Card>
          <p className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Revenue vs expenses (KES millions)</p>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={revenueTrend}>
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
                <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={85} paddingAngle={2}>
                  {expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: 200 }}>
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)", color: COLORS.ink }}>KES 2.87M</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{totalExpensePct}% accounted</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Utilization gauges + dispatch log ───────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        <Card>
          <p className="text-sm font-medium mb-5" style={{ color: COLORS.ink }}>Trailer utilization by type</p>
          <div className="space-y-4">
            {utilization.map((u) => <LoadGaugeBar key={u.type} type={u.type} pct={u.pct} />)}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Dispatch log</p>
          <div className="relative pl-4">
            <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px" style={{ background: COLORS.track }} />
            {dispatchLog.map((a, i) => (
              <div key={i} className="relative pb-4 last:pb-0">
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
    </div>
  );
}