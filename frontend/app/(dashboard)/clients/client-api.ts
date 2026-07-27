import { axiosClient } from "@/lib/api"
import type { Client, ClientPayload, ClientStatus, Paginated, StatementLine } from "./types-and-api-notes"

type BackendClientDocument = {
  id: number
  label: string
  file: string
  uploaded_at: string
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
  credit_limit?: number | string
  outstanding_balance?: number | string
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
    credit_limit: numberValue(item.credit_limit), outstanding_balance: numberValue(item.outstanding_balance), overdue_balance: 0,
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
    credit_limit: payload.credit_limit,
    preferred_payment_terms: paymentTerms,
    notes: payload.notes || "",
    kra_pin: payload.kra_pin || "",
    business_registration: payload.business_registration || "",
    national_id: payload.national_id || "",
    passport: payload.passport || "",
  }

  const hasFiles = Boolean(
    payload.drivers_license_file || payload.insurance_file || payload.dot_file ||
    payload.signed_contract_file || payload.inspection_report_file
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
  if (payload.signed_contract_file) formData.append("signed_contract_file", payload.signed_contract_file)
  if (payload.inspection_report_file) formData.append("inspection_report_file", payload.inspection_report_file)

  return formData
}

export const clientApi = {
  async list(params: { search?: string; status?: string; clientType?: string; overLimitOnly?: boolean; page?: number }): Promise<Paginated<Client>> {
    const { data } = await axiosClient.get<{ count: number; next: string | null; previous: string | null; results: BackendClient[] }>("/clients/", {
      params: {
        search: params.search, client_type: params.clientType?.toLowerCase(), blacklisted: params.status === "Inactive" ? true : undefined, page: params.page,
      },
    })
    let results = data.results.map(mapClient)
    if (params.status === "Active") results = results.filter((client) => client.status === "Active")
    if (params.overLimitOnly) results = results.filter((client) => client.outstanding_balance > client.credit_limit)
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
