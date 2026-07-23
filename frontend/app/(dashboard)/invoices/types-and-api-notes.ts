/**
 * ASSUMPTIONS — read this first
 * ──────────────────────────────
 * Same approach as the quotations module: I don't have your real `@/types`
 * or `@/lib/api`, so this is built against the shapes below. Reconcile field
 * names with your actual backend — the compiler will flag every mismatch.
 *
 * Key assumption: an invoice CAN originate from a quotation or a rental
 * (optional `sourceType` / `sourceId` link) but can also be created
 * standalone. If your system always requires one or the other, tighten
 * `InvoicePayload` accordingly.
 *
 * Money: KES, VAT-inclusive totals, same 16% default as quotations.
 */

// ── Add/merge into @/types ──────────────────────────────────────────────

export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Void"

export type PaymentMethod = "M-Pesa" | "Bank Transfer" | "Cash" | "Cheque" | "Other"

export interface InvoiceLineItem {
  id: string
  trailerId?: string | null
  description: string
  quantity: number
  rate: number
  rateUnit: "day" | "week" | "month" | "flat"
  amount: number
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  method: PaymentMethod
  reference?: string        // M-Pesa code, cheque #, transaction ref
  paidAt: string            // ISO date string
  recordedBy?: string
  notes?: string
}

export interface Invoice {
  id: string
  invoiceNumber: string        // e.g. "INV-2026-0117"
  clientId?: string | null
  clientName: string
  clientEmail?: string
  clientPhone?: string
  date: string                 // issue date, ISO
  dueDate: string               // ISO
  status: InvoiceStatus
  lineItems: InvoiceLineItem[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  vatPercent: number
  vatAmount: number
  total: number
  amountPaid: number
  balance: number               // total - amountPaid, authoritative from backend
  payments: Payment[]
  sourceType?: "quotation" | "rental" | null
  sourceId?: string | null
  notes?: string
  terms?: string
  createdAt: string
  updatedAt: string
}

export interface InvoicePayload {
  clientId?: string | null
  clientName: string
  clientEmail?: string
  clientPhone?: string
  date: string
  dueDate: string
  lineItems: Omit<InvoiceLineItem, "id" | "amount">[]
  discountPercent: number
  vatPercent: number
  sourceType?: "quotation" | "rental" | null
  sourceId?: string | null
  notes?: string
  terms?: string
}

export interface PaymentPayload {
  amount: number
  method: PaymentMethod
  reference?: string
  paidAt: string
  notes?: string
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

// ── Add/merge into @/lib/api (api.invoices, api.payments) ───────────────
//
// api.invoices.list(params?: { search?: string; status?: string; from?: string; to?: string; overdueOnly?: boolean; page?: number })
//   => Promise<Paginated<Invoice>>
// api.invoices.get(id: string) => Promise<Invoice>
// api.invoices.create(payload: InvoicePayload) => Promise<Invoice>
// api.invoices.update(id: string, payload: InvoicePayload) => Promise<Invoice>
// api.invoices.delete(id: string) => Promise<void>            // typically only for Draft
// api.invoices.void(id: string, reason?: string) => Promise<Invoice>
// api.invoices.send(id: string) => Promise<Invoice>            // emails client, sets status "Sent"
// api.invoices.sendReminder(id: string) => Promise<void>       // overdue nudge, doesn't change status
// api.invoices.fromQuotation(quotationId: string) => Promise<Invoice>
// api.invoices.fromRental(rentalId: string) => Promise<Invoice>
//
// api.payments.record(invoiceId: string, payload: PaymentPayload) => Promise<{ invoice: Invoice; payment: Payment }>
// api.payments.delete(paymentId: string) => Promise<Invoice>   // void a mis-entered payment, returns updated invoice
//
// api.clients.list() => Promise<Paginated<ClientLite>>
//
// If any endpoint doesn't exist yet, the page degrades gracefully rather
// than crashing — but record-payment and the aging summary are the core
// of this module, so those are worth prioritizing on the backend first.
