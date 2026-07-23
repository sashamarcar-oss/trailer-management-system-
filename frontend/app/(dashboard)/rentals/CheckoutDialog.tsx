"use client"

import { useEffect, useState } from "react"
import { X, AlertTriangle } from "lucide-react"
import type { Rental } from "./types-and-api-notes"
import { rentalApi } from "./rental-api"

const FUEL_LEVELS = ["Empty", "1/4", "1/2", "3/4", "Full"] as const

export function CheckoutDialog({
  rental,
  onClose,
  onDone,
}: {
  rental: Rental | null // null = closed
  onClose: () => void
  onDone: () => Promise<void> | void
}) {
  const [odometerOrHours, setOdometerOrHours] = useState<number | "">("")
  const [fuelLevel, setFuelLevel] = useState<typeof FUEL_LEVELS[number]>("Full")
  const [conditionNotes, setConditionNotes] = useState("")
  const [damageNoted, setDamageNoted] = useState(false)
  const [damageNotes, setDamageNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (rental) {
      setOdometerOrHours(""); setFuelLevel("Full"); setConditionNotes("")
      setDamageNoted(false); setDamageNotes(""); setError("")
    }
  }, [rental])

  if (!rental) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!conditionNotes.trim()) { setError("Add a brief condition note before checkout — this is your record if a dispute comes up at return."); return }

    setSaving(true)
    try {
      await rentalApi.activate(rental!.id, {
        checkoutInspection: {
          odometerOrHours: odometerOrHours === "" ? undefined : Number(odometerOrHours),
          fuelLevel,
          conditionNotes: conditionNotes.trim(),
          damageNoted,
          damageNotes: damageNoted ? damageNotes.trim() || undefined : undefined,
        },
      })
      await onDone()
      onClose()
    } catch {
      setError("Couldn't check out this rental. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Checkout Inspection</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rental.rentalNumber} · {rental.clientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

          <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
            {rental.trailers.map((t) => t.trailerName).join(", ")}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Odometer / hours</label>
              <input type="number" value={odometerOrHours} onChange={(e) => setOdometerOrHours(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fuel level</label>
              <select value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value as typeof FUEL_LEVELS[number])}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm">
                {FUEL_LEVELS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condition notes *</label>
            <textarea value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} rows={3} required
              placeholder="Tyres, lights, coupling, tarp/canopy condition, existing scratches or dents…"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={damageNoted} onChange={(e) => setDamageNoted(e.target.checked)} />
            Pre-existing damage to flag
          </label>
          {damageNoted && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Damage details</label>
              <textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            This record is compared against the return inspection to resolve any deposit disputes.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Checking out…" : "Confirm Checkout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
