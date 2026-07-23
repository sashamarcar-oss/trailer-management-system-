/**
 * ASSUMPTIONS — read this first
 * ──────────────────────────────
 * I don't have your real `@/types` or `@/lib/api` source, so the module I've
 * built assumes the shapes below. Reconcile these with your actual backend:
 *   - field names may differ (e.g. `client` vs `clientId` vs `clientName`)
 *   - some endpoints (send/convert/duplicate) may not exist yet on your API
 *     and will need a backend route added
 *   - money is treated as KES with 16% VAT (Kenya standard rate) — change
 *     `DEFAULT_VAT_PERCENT` in quotation-utils.ts if that's wrong
 *
 * Wherever your real types differ, the compiler will point you to every
 * spot that needs adjusting — that's intentional, better than silently
 * mismatched at runtime.
 */

// ── Add/merge into @/types ──────────────────────────────────────────────

export type QuotationStatus =
  | "Draft"
  | "Sent"
  | "Viewed"
  | "Accepted"
  | "Rejected"
  | "Expired"
  | "Converted"

export interface QuotationLineItem {
  id: string
  trailerId?: string | null   // link to fleet inventory, if selected from list
  description: string          // free text if no trailerId, else trailer name/spec
  quantity: number
  rate: number                 // rate per unit (see rateUnit)
  rateUnit: "day" | "week" | "month" | "flat"
  amount: number                // quantity * rate, computed client-side, sent to API
}

export interface Quotation {
  id: string
  quotationNumber: string       // e.g. "QT-2026-0043"
  clientId?: string | null
  clientName: string
  clientEmail?: string
  clientPhone?: string
  issueDate: string             // ISO date string
  expiryDate: string            // ISO date string
  status: QuotationStatus
  lineItems: QuotationLineItem[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  vatPercent: number
  vatAmount: number
  total: number
  value: number                 // kept for backward-compat with existing table column; equals `total`
  notes?: string
  terms?: string
  convertedRentalId?: string | null
  createdAt: string
  updatedAt: string
}

export interface QuotationPayload {
  clientId?: string | null
  clientName: string
  clientEmail?: string
  clientPhone?: string
  issueDate: string
  expiryDate: string
  lineItems: Omit<QuotationLineItem, "id" | "amount">[]
  discountPercent: number
  vatPercent: number
  notes?: string
  terms?: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ClientLite {
  id: string
  name: string
  email?: string
  phone?: string
}

export interface TrailerLite {
  id: string
  name: string          // e.g. "Flatbed 40ft - KAB 123X"
  defaultRate?: number
  defaultRateUnit?: "day" | "week" | "month" | "flat"
}

// ── Add/merge into @/lib/api (api.quotations) ───────────────────────────
//
// api.quotations.list(params?: { search?: string; status?: string; from?: string; to?: string; page?: number })
//   => Promise<Paginated<Quotation>>
// api.quotations.get(id: string) => Promise<Quotation>
// api.quotations.create(payload: QuotationPayload) => Promise<Quotation>
// api.quotations.update(id: string, payload: QuotationPayload) => Promise<Quotation>
// api.quotations.delete(id: string) => Promise<void>
// api.quotations.send(id: string) => Promise<Quotation>            // emails client, sets status "Sent"
// api.quotations.markStatus(id: string, status: QuotationStatus) => Promise<Quotation>
// api.quotations.duplicate(id: string) => Promise<Quotation>
// api.quotations.convert(id: string) => Promise<{ rentalId: string }>
//
// api.clients.list() => Promise<Paginated<ClientLite>>   (used for the client picker)
// api.trailers.list() => Promise<Paginated<TrailerLite>> (used for the line-item picker)
//
// If any of these endpoints don't exist yet on your backend, the page
// degrades gracefully (catches the error, shows an empty list) rather
// than crashing — but you'll want to add them for full functionality,
// especially create/update/convert which are the core of this module.
