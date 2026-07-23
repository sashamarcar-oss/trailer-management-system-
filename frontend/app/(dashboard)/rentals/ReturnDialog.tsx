"use client"

import { useEffect, useMemo, useState } from "react"
import { X, AlertTriangle } from "lucide-react"
import type { Rental } from "./types-and-api-notes"
import { rentalApi } from "./rental-api"
import { kes } from "./rental-utils"

const FUEL_LEVELS = ["Empty", "1/4", "1/2", "3/4", "Full"] as const
function todayISO() { return new Date().toISOString().slice(0, 10) }

export function ReturnDialog({
  rental,
  onClose,
  onDone,
}: {
  rental: Rental | null
  onClose: () => void
  onDone: () => Promise<void> | void
}) {
  const [actualReturnDate, setActualReturnDate] = useState(todayISO())
  const [odometerOrHours, setOdometerOrHours] = useState<number | "">("")
  const [fuelLevel, setFuelLevel] = useState<typeof FUEL_LEVELS[number]>("Full")
  const [conditionNotes, setConditionNotes] = useState("")
  const [damageNoted, setDamageNoted] = useState(false)
  const [damageNotes, setDamageNotes] = useState("")
  const [depositReturned, setDepositReturned] = useState(0)
  const [depositForfeited, setDepositForfeited] = useState(0)
  const [depositNotes, setDepositNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (rental) {
      setActualReturnDate(todayISO())
      setOdometerOrHours(""); setFuelLevel("Full"); setConditionNotes("")
      setDamageNoted(false); setDamageNotes("")
      setDepositReturned(rental.depositAmount); setDepositForfeited(0); setDepositNotes("")
      setError("")
    }
  }, [rental])

  const depositTotal = useMemo(
    () => (rental ? Number(depositReturned || 0) + Number(depositForfeited || 0) : 0),
    [depositReturned, depositForfeited, rental],
  )

  if (!rental) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!conditionNotes.trim()) { setError("Add return condition notes — compare against the checkout record."); return }
    if (damageNoted && !damageNotes.trim()) { setError("Describe the damage before forfeiting any deposit."); return }
    if (depositTotal > rental!.depositAmount + 0.01) {
      setError(`Returned + forfeited (${kes(depositTotal)}) can't exceed the deposit held (${kes(rental!.depositAmount)}).`)
      return
    }
    if (damageNoted && depositForfeited === 0) {
      setError("Damage was flagged but no deposit amount was forfeited — confirm this is intentional, or adjust the forfeited amount.")
      return
    }

    setSaving(true)
    try {
      await rentalApi.markReturned(rental!.id, {
        actualReturnDate,
        depositReturned: Number(depositReturned) || 0,
        depositForfeited: Number(depositForfeited) || 0,
        depositNotes: depositNotes.trim() || undefined,
        returnInspection: {
          odometerOrHours: odometerOrHours === "" ? undefined : Number(odometerOrHours),
          fuelLevel,
          conditionNotes: conditionNotes.trim(),
          damageNoted,
          damageNotes: damageNoted ? damageNotes.trim() : undefined,
        },
      })
      await onDone()
      onClose()
    } catch {
      setError("Couldn't process the return. Please check the details and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Process Return</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rental.rentalNumber} · {rental.clientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

          {rental.checkoutInspection && (
            <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs">
              <p className="font-semibold text-foreground mb-1">Checkout record for comparison</p>
              <p className="text-muted-foreground">{rental.checkoutInspection.conditionNotes}</p>
              {rental.checkoutInspection.damageNoted && (
                <p className="text-amber-600 mt-1">Pre-existing damage noted: {rental.checkoutInspection.damageNotes}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actual return date</label>
            <input type="date" value={actualReturnDate} onChange={(e) => setActualReturnDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
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
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={damageNoted} onChange={(e) => setDamageNoted(e.target.checked)} />
            New damage found at return
          </label>
          {damageNoted && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Damage details *</label>
              <textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
            </div>
          )}

          <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deposit held: {kes(rental.depositAmount)}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Return to client</label>
                <input type="number" min={0} value={depositReturned} onChange={(e) => setDepositReturned(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Forfeit (damage/fees)</label>
                <input type="number" min={0} value={depositForfeited} onChange={(e) => setDepositForfeited(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
            </div>
            {depositForfeited > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Reason for forfeiture</label>
                <textarea value={depositNotes} onChange={(e) => setDepositNotes(e.target.value)} rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm" />
              </div>
            )}
            {depositTotal > rental.depositAmount && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Total exceeds the deposit held.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Processing…" : "Confirm Return"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
