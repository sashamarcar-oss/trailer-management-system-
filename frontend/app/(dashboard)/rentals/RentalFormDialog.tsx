"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react"
import type {
  AvailabilityCheckResult, ClientLite, DriverLite, Rental, RentalPayload, TrailerLite,
} from "./types-and-api-notes"
import { rentalApi, rentalLookups } from "./rental-api"
import { computeRentalTotal, kes, lineTotal } from "./rental-utils"

type DraftLine = {
  key: string
  trailerId: string
  trailerName: string
  rate: number
  rateUnit: "day" | "week" | "month" | "flat"
  quantity: number
}

function emptyLine(): DraftLine {
  return { key: crypto.randomUUID(), trailerId: "", trailerName: "", rate: 0, rateUnit: "day", quantity: 1 }
}
function todayISO() { return new Date().toISOString().slice(0, 10) }
function in7DaysISO() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10) }

export function RentalFormDialog({
  open,
  onClose,
  onSave,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSave: (payload: RentalPayload) => Promise<void>
  editing: Rental | null
}) {
  const [clientId, setClientId] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [pickupDate, setPickupDate] = useState(todayISO())
  const [scheduledReturnDate, setScheduledReturnDate] = useState(in7DaysISO())
  const [pickupLocation, setPickupLocation] = useState("")
  const [returnLocation, setReturnLocation] = useState("")
  const [deliveryRequired, setDeliveryRequired] = useState(false)
  const [driverId, setDriverId] = useState("")
  const [depositAmount, setDepositAmount] = useState(0)
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("Trailer(s) to be returned in the same condition as at pickup, ordinary wear excepted. Deposit refunded within 3 business days of a clean return.")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [clients, setClients] = useState<ClientLite[]>([])
  const [trailers, setTrailers] = useState<TrailerLite[]>([])
  const [drivers, setDrivers] = useState<DriverLite[]>([])

  const [availability, setAvailability] = useState<AvailabilityCheckResult[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  useEffect(() => {
    if (!open) return
    rentalLookups.clients().then(setClients).catch(() => setClients([]))
    rentalLookups.trailers().then(setTrailers).catch(() => setTrailers([]))
    rentalLookups.drivers().then(setDrivers).catch(() => setDrivers([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setClientId(editing.clientId || "")
      setClientName(editing.clientName)
      setClientEmail(editing.clientEmail || "")
      setClientPhone(editing.clientPhone || "")
      setPickupDate(editing.pickupDate?.slice(0, 10) || todayISO())
      setScheduledReturnDate(editing.scheduledReturnDate?.slice(0, 10) || in7DaysISO())
      setPickupLocation(editing.pickupLocation || "")
      setReturnLocation(editing.returnLocation || "")
      setDeliveryRequired(editing.deliveryRequired)
      setDriverId(editing.driverId || "")
      setDepositAmount(editing.depositAmount || 0)
      setLines(
        editing.trailers.length
          ? editing.trailers.map((t) => ({
              key: t.id || crypto.randomUUID(), trailerId: t.trailerId, trailerName: t.trailerName,
              rate: t.rate, rateUnit: t.rateUnit, quantity: t.quantity,
            }))
          : [emptyLine()],
      )
      setNotes(editing.notes || "")
      setTerms(editing.terms || "")
    } else {
      setClientId(""); setClientName(""); setClientEmail(""); setClientPhone("")
      setPickupDate(todayISO()); setScheduledReturnDate(in7DaysISO())
      setPickupLocation(""); setReturnLocation("")
      setDeliveryRequired(false); setDriverId("")
      setDepositAmount(0)
      setLines([emptyLine()])
      setNotes("")
      setTerms("Trailer(s) to be returned in the same condition as at pickup, ordinary wear excepted. Deposit refunded within 3 business days of a clean return.")
    }
    setError(""); setAvailability([])
  }, [open, editing])

  const total = useMemo(() => computeRentalTotal(lines, pickupDate, scheduledReturnDate), [lines, pickupDate, scheduledReturnDate])

  // Debounced availability check whenever trailers or dates change.
  useEffect(() => {
    if (!open) return
    const trailerIds = lines.map((l) => l.trailerId).filter(Boolean)
    if (trailerIds.length === 0 || !pickupDate || !scheduledReturnDate) { setAvailability([]); return }

    const handle = setTimeout(async () => {
      setCheckingAvailability(true)
      try {
        const results = await rentalApi.checkAvailability({
          trailerIds, pickupDate, returnDate: scheduledReturnDate, excludeRentalId: editing?.id,
        })
        setAvailability(results)
      } catch {
        setAvailability([]) // degrade quietly if the endpoint isn't built yet
      } finally {
        setCheckingAvailability(false)
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [open, lines, pickupDate, scheduledReturnDate, editing?.id])

  const conflicts = availability.filter((a) => !a.available)

  if (!open) return null

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }
  function addLine() { setLines((prev) => [...prev, emptyLine()]) }
  function pickTrailer(key: string, trailerId: string) {
    const t = trailers.find((tr) => tr.id === trailerId)
    updateLine(key, { trailerId, trailerName: t?.name || "", rate: t?.defaultRate ?? 0, rateUnit: t?.defaultRateUnit ?? "day" })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!clientName.trim()) { setError("Client name is required."); return }
    if (lines.some((l) => !l.trailerId)) { setError("Select a trailer for every line."); return }
    if (new Date(scheduledReturnDate) < new Date(pickupDate)) { setError("Return date can't be before the pickup date."); return }
    if (conflicts.length > 0) {
      setError(`${conflicts.length} trailer(s) are already booked for these dates. Remove or reschedule them before saving.`)
      return
    }

    const payload: RentalPayload = {
      clientId: clientId || null,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      quotationId: editing?.quotationId ?? null,
      trailers: lines.map((l) => ({ trailerId: l.trailerId, trailerName: l.trailerName, rate: l.rate, rateUnit: l.rateUnit, quantity: l.quantity })),
      pickupDate, scheduledReturnDate,
      pickupLocation: pickupLocation.trim() || undefined,
      returnLocation: returnLocation.trim() || undefined,
      deliveryRequired,
      driverId: deliveryRequired ? driverId : null,
      depositAmount: Number(depositAmount) || 0,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
    }

    setSaving(true)
    try {
      await onSave(payload)
      onClose()
    } catch {
      setError("Couldn't save this rental. Please check the details and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? `Edit ${editing.rentalNumber}` : "New Rental"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

          {editing?.quotationId && (
            <div className="px-4 py-2.5 rounded-lg bg-blue-50 text-blue-700 text-xs border border-blue-200">
              Created from quotation #{editing.quotationId}.
            </div>
          )}

          {/* Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</label>
              <select
                value={clientId}
                onChange={(e) => {
                  const id = e.target.value; setClientId(id)
                  const c = clients.find((cl) => cl.id === id)
                  if (c) { setClientName(c.name); setClientEmail(c.email || ""); setClientPhone(c.phone || "") }
                }}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
              >
                <option value="">Type client details manually…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client name *</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client email</label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client phone</label>
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          {/* Dates & locations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup date</label>
              <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled return date</label>
              <input type="date" value={scheduledReturnDate} onChange={(e) => setScheduledReturnDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup location</label>
              <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g. Main Depot, Industrial Area"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Return location</label>
              <input value={returnLocation} onChange={(e) => setReturnLocation(e.target.value)}
                placeholder="Defaults to pickup location if left blank"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          </div>

          {/* Delivery / driver */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deliveryRequired} onChange={(e) => setDeliveryRequired(e.target.checked)} />
              Company delivers / collects (assign a driver)
            </label>
            {deliveryRequired && (
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-input bg-card text-sm">
                <option value="">Select driver…</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {!deliveryRequired && <span className="text-xs text-muted-foreground">Client will self-collect and self-return.</span>}
          </div>

          {/* Trailers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trailers</label>
              <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800">
                <Plus className="w-3.5 h-3.5" /> Add trailer
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l) => {
                const conflict = availability.find((a) => a.trailerId === l.trailerId && !a.available)
                return (
                  <div key={l.key} className={`rounded-lg border p-2 ${conflict ? "border-red-300 bg-red-50" : "border-border"}`}>
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <select value={l.trailerId} onChange={(e) => pickTrailer(l.key, e.target.value)}
                        className="col-span-4 px-2 py-2 rounded-lg border border-input bg-card text-xs">
                        <option value="">Select trailer…</option>
                        {trailers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input type="number" min={1} value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) })}
                        className="col-span-1 px-2 py-2 rounded-lg border border-input bg-card text-xs" title="Quantity" />
                      <input type="number" min={0} value={l.rate} onChange={(e) => updateLine(l.key, { rate: Number(e.target.value) })}
                        className="col-span-2 px-2 py-2 rounded-lg border border-input bg-card text-xs" />
                      <select value={l.rateUnit} onChange={(e) => updateLine(l.key, { rateUnit: e.target.value as DraftLine["rateUnit"] })}
                        className="col-span-2 px-2 py-2 rounded-lg border border-input bg-card text-xs">
                        <option value="day">per day</option>
                        <option value="week">per week</option>
                        <option value="month">per month</option>
                        <option value="flat">flat</option>
                      </select>
                      <div className="col-span-2 flex items-center justify-end pt-2">
                        <span className="text-xs font-semibold whitespace-nowrap">{kes(lineTotal(l, pickupDate, scheduledReturnDate))}</span>
                      </div>
                      <button type="button" onClick={() => removeLine(l.key)}
                        className="col-span-1 justify-self-end p-1.5 rounded hover:bg-red-100 text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {conflict && (
                      <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Already booked on {conflict.conflict?.rentalNumber} ({conflict.conflict?.pickupDate} – {conflict.conflict?.scheduledReturnDate})
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {checkingAvailability && <p className="text-xs text-muted-foreground mt-2">Checking availability…</p>}
            {!checkingAvailability && lines.some((l) => l.trailerId) && conflicts.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-green-600 mt-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> All selected trailers are available for these dates.
              </p>
            )}
          </div>

          {/* Deposit + total */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Security deposit</label>
              <input type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rental total (excl. deposit)</label>
              <p className="mt-1 px-3 py-2 rounded-lg bg-muted/40 border border-border text-sm font-bold text-teal-700">{kes(total)}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Terms & conditions</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving || conflicts.length > 0}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Create rental"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
