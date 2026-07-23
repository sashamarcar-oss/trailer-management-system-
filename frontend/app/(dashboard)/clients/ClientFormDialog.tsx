"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { api } from "@/lib/api"
import type { Client, ClientPayload } from "./types-and-api-notes"

const CLIENT_TYPES = ["Individual", "Company"]

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
  const [clientType, setClientType] = useState("Individual")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [secondaryContactName, setSecondaryContactName] = useState("")
  const [secondaryContactPhone, setSecondaryContactPhone] = useState("")
  const [address, setAddress] = useState("")
  const [kraPin, setKraPin] = useState("")
  const [businessRegistration, setBusinessRegistration] = useState("")
  const [nationalId, setNationalId] = useState("")
  const [passport, setPassport] = useState("")
  const [creditLimit, setCreditLimit] = useState(0)
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setClientType(editing.client_type || "Individual")
      setContactPhone(editing.contact_phone || "")
      setContactEmail(editing.contact_email || "")
      setSecondaryContactName(editing.secondary_contact_name || "")
      setSecondaryContactPhone(editing.secondary_contact_phone || "")
      setAddress(editing.address || "")
      setKraPin(editing.kra_pin || "")
      setBusinessRegistration(editing.business_registration || "")
      setNationalId(editing.national_id || "")
      setPassport(editing.passport || "")
      setCreditLimit(editing.credit_limit || 0)
      setPaymentTermsDays(editing.payment_terms_days ?? 30)
      setNotes(editing.notes || "")
    } else {
      setName(""); setClientType("Individual"); setContactPhone(""); setContactEmail("")
      setSecondaryContactName(""); setSecondaryContactPhone(""); setAddress("")
      setKraPin(""); setBusinessRegistration(""); setNationalId(""); setPassport("")
      setCreditLimit(0); setPaymentTermsDays(30); setNotes("")
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
    if (clientType === "Company" && (!kraPin.trim() || !businessRegistration.trim())) { setError("Company clients require a KRA PIN and business registration number."); return }
    if (clientType === "Individual" && !nationalId.trim() && !passport.trim()) { setError("Individual clients require a National ID or passport number."); return }

    const payload: ClientPayload = {
      name: name.trim(),
      client_type: clientType,
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim() || undefined,
      secondary_contact_name: clientType === "Company" ? secondaryContactName.trim() || undefined : undefined,
      secondary_contact_phone: clientType === "Company" ? secondaryContactPhone.trim() || undefined : undefined,
      address: address.trim() || undefined,
      kra_pin: clientType === "Company" ? kraPin.trim() || undefined : undefined,
      business_registration: clientType === "Company" ? businessRegistration.trim() || undefined : undefined,
      national_id: clientType === "Individual" ? nationalId.trim() || undefined : undefined,
      passport: clientType === "Individual" ? passport.trim() || undefined : undefined,
      credit_limit: Number(creditLimit) || 0,
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
                placeholder={clientType === "Company" ? "e.g. Acme Logistics Ltd" : "e.g. Jane Wanjiru"} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
              <select value={clientType} onChange={(e) => setClientType(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm">
                {CLIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact phone *</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" placeholder="07xx xxx xxx" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          {clientType === "Company" && (
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="col-span-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Day-to-day contact person</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <input value={secondaryContactName} onChange={(e) => setSecondaryContactName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <input value={secondaryContactPhone} onChange={(e) => setSecondaryContactPhone(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">KRA PIN *</label>
                <input value={kraPin} onChange={(e) => setKraPin(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Business registration *</label>
                <input value={businessRegistration} onChange={(e) => setBusinessRegistration(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
            </div>
          )}

          {clientType === "Individual" && (
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <label className="text-xs text-muted-foreground">National ID</label>
                <input value={nationalId} onChange={(e) => setNationalId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Passport</label>
                <input value={passport} onChange={(e) => setPassport(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credit limit (KES)</label>
              <input type="number" min={0} value={creditLimit} onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment terms (days)</label>
              <input type="number" min={0} value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
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
