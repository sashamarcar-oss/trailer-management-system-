import { axiosClient } from "@/lib/api"
import type { Client, ClientPayload, ClientStatus, Paginated, StatementLine } from "./types-and-api-notes"

type BackendClientDocument = {
  id: number
  label: string
  file: string
  uploaded_at: string
}

type BackendDocumentSigningRequest = {
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

type BackendClient = {
  id: number | string
  code: string
  name: string
  client_type: string
  contact_person?: string
  contact_phone: string
  email: string
  address?: string
  preferred_payment_terms?: string
  rating?: number | string
  blacklisted?: boolean
  notes?: string
  created_at?: string
  updated_at?: string
  kra_pin?: string
  national_id?: string
  passport?: string
  business_registration?: string
  currency?: "USD" | "KES"
  documents?: BackendClientDocument[]
  document_signing_requests?: BackendDocumentSigningRequest[]
}

type BackendInvoice = {
  invoice_number: string
  invoice_date: string
  total?: number | string
  balance?: number | string
  client: number | string
}

type BackendPayment = {
  invoice: number | string
  amount: number | string
  payment_date?: string
  reference_number?: string
  client: number | string
}

const numberValue = (value: number | string | undefined) => Number(value || 0)

function mapClient(item: BackendClient): Client {
  const terms = item.preferred_payment_terms?.replace("net_", "")
  return {
    id: String(item.id), code: item.code, name: item.name,
    client_type: item.client_type === "company" ? "Company" : "Individual",
    contact_phone: item.contact_phone, contact_email: item.email,
    secondary_contact_name: item.contact_person, address: item.address,
    status: item.blacklisted ? "Inactive" : "Active",
    payment_terms_days: terms === "cash" ? 0 : Number(terms || 30), rating: numberValue(item.rating), notes: item.notes,
    kra_pin: item.kra_pin, business_registration: item.business_registration,
    national_id: item.national_id, passport: item.passport,
    currency: item.currency || "USD",
    documents: item.documents?.map((document) => ({
      id: document.id,
      label: document.label,
      file: document.file,
      uploaded_at: document.uploaded_at,
    })),
    document_signing_requests: item.document_signing_requests?.map((request) => ({
      id: request.id,
      client: request.client,
      token: request.token,
      contract_status: request.contract_status,
      inspection_status: request.inspection_status,
      contract_status_display: request.contract_status_display,
      inspection_status_display: request.inspection_status_display,
      viewed_at: request.viewed_at,
      signed_at: request.signed_at,
      uploaded_at: request.uploaded_at,
      verified_at: request.verified_at,
      is_complete: request.is_complete,
    })),
    createdAt: item.created_at || "", updatedAt: item.updated_at || "",
  }
}

function toBackendPayload(payload: ClientPayload) {
  const type = payload.client_type.toLowerCase()
  const paymentTerms = payload.payment_terms_days ? `net_${payload.payment_terms_days}` : "cash"
  const body = {
    name: payload.name,
    client_type: type,
    contact_person: payload.secondary_contact_name || "",
    contact_phone: payload.contact_phone,
    email: payload.contact_email,
    address: payload.address || "",
    city: "",
    country: "Kenya",
    currency: payload.currency || "USD",
    preferred_payment_terms: paymentTerms,
    notes: payload.notes || "",
    kra_pin: payload.kra_pin || "",
    business_registration: payload.business_registration || "",
    national_id: payload.national_id || "",
    passport: payload.passport || "",
  }

  const hasFiles = Boolean(
    payload.drivers_license_file || payload.insurance_file || payload.dot_file
  )

  if (!hasFiles) return body

  const formData = new FormData()
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value))
    }
  })

  if (payload.drivers_license_file) formData.append("drivers_license_file", payload.drivers_license_file)
  if (payload.insurance_file) formData.append("insurance_file", payload.insurance_file)
  if (payload.dot_file) formData.append("dot_file", payload.dot_file)

  return formData
}

export const clientApi = {
  async list(params: { search?: string; status?: string; clientType?: string; page?: number }): Promise<Paginated<Client>> {
    const { data } = await axiosClient.get<{ count: number; next: string | null; previous: string | null; results: BackendClient[] }>("/clients/", {
      params: {
        search: params.search, client_type: params.clientType?.toLowerCase(), blacklisted: params.status === "Inactive" ? true : undefined, page: params.page,
      },
    })
    let results = data.results.map(mapClient)
    if (params.status === "Active") results = results.filter((client) => client.status === "Active")
    return { ...data, results }
  },
  async retrieve(id: string): Promise<Client> { const { data } = await axiosClient.get<BackendClient>(`/clients/${id}/`); return mapClient(data) },
  async create(payload: ClientPayload): Promise<Client> {
    const body = toBackendPayload(payload)
    const config = body instanceof FormData ? { headers: { "Content-Type": undefined } } : undefined
    const { data } = await axiosClient.post<BackendClient>("/clients/", body, config)
    return mapClient(data)
  },
  async update(id: string, payload: ClientPayload): Promise<Client> {
    const body = toBackendPayload(payload)
    const config = body instanceof FormData ? { headers: { "Content-Type": undefined } } : undefined
    const { data } = await axiosClient.patch<BackendClient>(`/clients/${id}/`, body, config)
    return mapClient(data)
  },
  async setStatus(id: string, status: ClientStatus): Promise<Client> { const { data } = await axiosClient.patch<BackendClient>(`/clients/${id}/`, { blacklisted: status === "Inactive" }); return mapClient(data) },
  async sendDocuments(id: string, context?: { rental?: string; quotation?: string }): Promise<unknown> {
    return axiosClient.post(`/clients/${id}/send-documents/`, context || {})
  },
  async delete(id: string): Promise<void> { await axiosClient.delete(`/clients/${id}/`) },
  async getStatement(id: string): Promise<StatementLine[]> {
    const [invoiceResponse, paymentResponse] = await Promise.all([
      axiosClient.get<{ results: BackendInvoice[] }>("/invoices/", { params: { client: id } }),
      axiosClient.get<{ results: BackendPayment[] }>("/invoices/payments/", { params: { client: id } }),
    ])
    const entries = [
      ...invoiceResponse.data.results.map((invoice) => ({ date: invoice.invoice_date, type: "Invoice" as const, reference: invoice.invoice_number, debit: numberValue(invoice.total), credit: 0 })),
      ...paymentResponse.data.results.map((payment) => ({ date: payment.payment_date || "", type: "Payment" as const, reference: payment.reference_number || `Payment ${payment.invoice}`, debit: 0, credit: numberValue(payment.amount) })),
    ].sort((a, b) => a.date.localeCompare(b.date))
    let runningBalance = 0
    return entries.map((entry) => ({ ...entry, runningBalance: runningBalance += entry.debit - entry.credit }))
  },
}
