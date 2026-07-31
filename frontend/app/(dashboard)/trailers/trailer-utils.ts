import type { Trailer } from "./types-and-api-notes"
import { statusLabel, typeLabel } from "./types-and-api-notes"

/** Parse a decimal-string field into a number (0 when null/blank). */
export function num(value: string | number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatMoney(value: string | number | null | undefined): string {
  const n = num(value)
  if (!value && value !== 0) return "—"
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" })
}

/** Whole days from today until `date`. Negative = already past. null when no date. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export type ExpiryTone = "expired" | "soon" | "ok" | "none"

/** Classify a compliance date: expired / expiring within `window` days / ok. */
export function expiryTone(value: string | null | undefined, window = 30): ExpiryTone {
  const days = daysUntil(value)
  if (days === null) return "none"
  if (days < 0) return "expired"
  if (days <= window) return "soon"
  return "ok"
}

export const EXPIRY_TONE_CLASS: Record<ExpiryTone, string> = {
  expired: "text-red-600 font-semibold",
  soon: "text-amber-600 font-semibold",
  ok: "text-foreground",
  none: "text-muted-foreground",
}

/** True when the next inspection is overdue or within 30 days. */
export function needsAttention(trailer: Trailer): boolean {
  const tone = expiryTone(trailer.next_inspection_date)
  return tone === "expired" || tone === "soon"
}

export function exportTrailersCSV(rows: Trailer[]) {
  const header = [
    "Trailer #", "Registration", "VIN", "Type", "Status", "Yard / Location",
    "Next Inspection",
  ]
  const lines = rows.map((t) =>
    [
      t.trailer_number,
      t.registration_number,
      t.vin ?? "",
      typeLabel(t.trailer_type),
      statusLabel(t.status),
      `"${(t.yard_location ?? "").replace(/"/g, '""')}"`,
      t.next_inspection_date ?? "",
    ].join(","),
  )
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `trailers-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Best-effort human message from a DRF error response. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = error && typeof error === "object" && "response" in error
    ? (error as { response?: { data?: unknown } }).response?.data
    : undefined
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
      .join("; ")
  }
  return fallback
}
