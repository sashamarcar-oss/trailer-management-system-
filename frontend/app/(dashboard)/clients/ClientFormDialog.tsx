"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { api } from "@/lib/api"
import type { Client, ClientPayload } from "./types-and-api-notes"

export function ClientFormDialog({
  open,
  onClose,
  onSave,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSave: (payload: ClientPayload) => Promise<void>
  editing: Client | null // null = creating
}) {
  const [name, setName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [address, setAddress] = useState("")
  const [passport, setPassport] = useState("")
  const [currency, setCurrency] = useState<"USD" | "KES">("USD")
  const [driversLicenseFile, setDriversLicenseFile] = useState<File | null>(null)
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [dotFile, setDotFile] = useState<File | null>(null)
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setContactPhone(editing.contact_phone || "")
      setContactEmail(editing.contact_email || "")
      setAddress(editing.address || "")
      setPassport(editing.passport || "")
      setCurrency(editing.currency || "USD")
      setPaymentTermsDays(editing.payment_terms_days ?? 30)
      setNotes(editing.notes || "")
    } else {
      setName(""); setContactPhone(""); setContactEmail("")
      setAddress(""); setPassport(""); setCurrency("USD")
      setDriversLicenseFile(null); setInsuranceFile(null); setDotFile(null)
      setPaymentTermsDays(30); setNotes("")
    }
    setError("")
  }, [open, editing])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim()) { setError("Client name is required."); return }
    if (!contactPhone.trim()) { setError("A contact phone number is required."); return }
    if (!contactEmail.trim()) { setError("An email address is required."); return }
    if (!passport.trim()) { setError("A passport number is required."); return }

    const payload: ClientPayload = {
      name: name.trim(),
      client_type: "Individual",
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim() || undefined,
      address: address.trim() || undefined,
      passport: passport.trim() || undefined,
      currency,
      drivers_license_file: driversLicenseFile,
      insurance_file: insuranceFile,
      dot_file: dotFile,
      payment_terms_days: Number(paymentTermsDays) || undefined,
      notes: notes.trim() || undefined,
    }

    setSaving(true)
    try {
      await onSave(payload)
      onClose()
    } catch {
      setError("Couldn't save this client. Please check the details and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{editing ? `Edit ${editing.name}` : "Add Client"}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
                placeholder="e.g. Jane Wanjiru" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact phone *</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" placeholder="07xx xxx xxx" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as "USD" | "KES")}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm">
                <option value="USD">US Dollars (USD)</option>
                <option value="KES">Kenyan Shillings (KES)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-3 rounded-lg bg-muted/30 border border-border">
            <div>
              <label className="text-xs text-muted-foreground">Passport *</label>
              <input value={passport} onChange={(e) => setPassport(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold">Document workflow</p>
            <p className="text-xs text-muted-foreground mt-1">The admin can now send the contract and inspection report directly to the client; the client reviews, signs, or uploads the signed copies before checkout proceeds.</p>
            <div className="grid grid-cols-1 gap-3 mt-4">
              <label className="block text-xs text-muted-foreground">Driver's license</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setDriversLicenseFile(e.target.files?.[0] || null)} className="mt-1 w-full text-sm text-foreground" />
              {driversLicenseFile && <p className="text-xs text-muted-foreground">Selected: {driversLicenseFile.name}</p>}

              <label className="block text-xs text-muted-foreground">Insurance document</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)} className="mt-1 w-full text-sm text-foreground" />
              {insuranceFile && <p className="text-xs text-muted-foreground">Selected: {insuranceFile.name}</p>}

              <label className="block text-xs text-muted-foreground">DOT documentation</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setDotFile(e.target.files?.[0] || null)} className="mt-1 w-full text-sm text-foreground" />
              {dotFile && <p className="text-xs text-muted-foreground">Selected: {dotFile.name}</p>}

            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          {editing && (
            <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
              Outstanding balance and status are managed from the client list, not this form — balances update automatically as invoices and payments are recorded.
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
              placeholder="Internal notes — special arrangements, history, etc." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Add client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}