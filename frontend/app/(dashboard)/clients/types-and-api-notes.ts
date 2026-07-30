/**
 * ASSUMPTIONS — read this first
 * ──────────────────────────────
 * Same approach as quotations/invoices/rentals: built against the shapes
 * below since I don't have your real `@/types` or `@/lib/api`. Reconcile
 * field names with your actual backend.
 *
 * Confirmed with you:
 *   - no KRA PIN / registration fields needed
 *   - status is a simple Active/Inactive toggle, not a multi-state workflow
 *
 * I kept your existing field names (code, client_type, contact_phone,
 * outstanding_balance, rating) rather than renaming them,
 * and only added what's missing.
 */

// ── Add/merge into @/types ────────────────────────────────────────────────

export type ClientStatus = "Active" | "Inactive"

export interface ClientDocument {
  id: number
  label: string
  file: string
  uploaded_at: string
}

export interface ClientDocumentSigningRequest {
  id: number
  client: number | string
  token: string
  contract_status: string
  inspection_status: string
  contract_status_display: string
  inspection_status_display: string
  viewed_at?: string | null
  signed_at?: string | null
  uploaded_at?: string | null
  verified_at?: string | null
  is_complete: boolean
}

export interface Client {
  id: string
  code: string
  name: string
  client_type: string              // e.g. "Individual" | "Company" — kept as string to match your existing data
  contact_phone: string
  contact_email?: string
  secondary_contact_name?: string   // for company accounts — the actual person you deal with day to day
  secondary_contact_phone?: string
  address?: string
  kra_pin?: string
  business_registration?: string
  national_id?: string
  passport?: string
  currency?: "USD" | "KES"
  documents?: ClientDocument[]
  document_signing_requests?: ClientDocumentSigningRequest[]

  status: ClientStatus



  payment_terms_days?: number         // e.g. 30 for "Net 30"
  rating?: number                      // 1-5, existing field

  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ClientPayload {
  name: string
  client_type: string
  contact_phone: string
  contact_email?: string
  secondary_contact_name?: string
  secondary_contact_phone?: string
  address?: string
  kra_pin?: string
  business_registration?: string
  national_id?: string
  passport?: string
  currency?: "USD" | "KES"
  drivers_license_file?: File | null
  insurance_file?: File | null
  dot_file?: File | null
  payment_terms_days?: number
  notes?: string
}

export interface StatementLine {
  date: string
  type: "Invoice" | "Payment" | "Credit Note"
  reference: string           // invoice # or payment ref
  debit: number                // increases balance owed (invoices)
  credit: number                // decreases balance owed (payments, credit notes)
  runningBalance: number
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ── Add/merge into @/lib/api (api.clients) ────────────────────────────────
//
// api.clients.list(params?: { search?: string; status?: string; clientType?: string; page?: number })
//   => Promise<Paginated<Client>>
// api.clients.get(id: string) => Promise<Client>
// api.clients.create(payload: ClientPayload) => Promise<Client>
// api.clients.update(id: string, payload: ClientPayload) => Promise<Client>
// api.clients.setStatus(id: string, status: ClientStatus) => Promise<Client>
// api.clients.delete(id: string) => Promise<void>                 // should probably be blocked server-side if the client has any history
// api.clients.getStatement(id: string, params?: { from?: string; to?: string }) => Promise<StatementLine[]>
