"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import type { Trailer, TrailerPayload } from "./types-and-api-notes"
import { TRAILER_STATUSES, TRAILER_TYPES } from "./types-and-api-notes"
import { apiErrorMessage } from "./trailer-utils"

const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide"
const FIELD = "mt-1 w-full px-3 py-2 rounded-lg border border-input bg-card text-sm"
const SECTION = "text-sm font-semibold text-foreground"

type FormState = {
  trailer_number: string
  registration_number: string
  vin: string
  trailer_type: string
  status: string
  brand: string
  manufacturer: string
  model: string
  year: string
  capacity: string
  weight: string
  dimensions: string
  purchase_date: string
  purchase_cost: string
  current_value: string
  yard_location: string
  gps_lat: string
  gps_lng: string
  next_inspection_date: string
}

const EMPTY: FormState = {
  trailer_number: "",
  registration_number: "",
  vin: "",
  trailer_type: "flatbed",
  status: "available",
  brand: "",
  manufacturer: "",
  model: "",
  year: "",
  capacity: "",
  weight: "",
  dimensions: "",
  purchase_date: "",
  purchase_cost: "",
  current_value: "",
  yard_location: "",
  gps_lat: "",
  gps_lng: "",
  next_inspection_date: "",
}

function fromTrailer(t: Trailer): FormState {
  return {
    trailer_number: t.trailer_number ?? "",
    registration_number: t.registration_number ?? "",
    vin: t.vin ?? "",
    trailer_type: t.trailer_type ?? "flatbed",
    status: t.status ?? "available",
    brand: t.brand ?? "",
    manufacturer: t.manufacturer ?? "",
    model: t.model ?? "",
    year: t.year != null ? String(t.year) : "",
    capacity: t.capacity ?? "",
    weight: t.weight ?? "",
    dimensions: t.dimensions ?? "",
    purchase_date: t.purchase_date ?? "",
    purchase_cost: t.purchase_cost ?? "",
    current_value: t.current_value ?? "",
    yard_location: t.yard_location ?? "",
    gps_lat: t.gps_lat ?? "",
    gps_lng: t.gps_lng ?? "",
    next_inspection_date: t.next_inspection_date ?? "",
  }
}

export function TrailerFormDialog({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean
  editing: Trailer | null // null = creating
  onClose: () => void
  onSave: (payload: TrailerPayload) => Promise<void>
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editing ? fromTrailer(editing) : EMPTY)
  }, [open, editing])

  if (!open) return null

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.trailer_number.trim()) return toast.error("Trailer number is required.")
    if (!form.registration_number.trim()) return toast.error("Registration number is required.")
    if (!form.vin.trim()) return toast.error("VIN / chassis number is required.")
    if (!form.trailer_type) return toast.error("Select a trailer type.")

    const yearNum = form.year.trim() ? Number(form.year) : null
    if (yearNum !== null && (Number.isNaN(yearNum) || yearNum < 1980 || yearNum > new Date().getFullYear() + 1)) {
      return toast.error("Enter a valid year.")
    }

    const payload: TrailerPayload = {
      trailer_number: form.trailer_number.trim(),
      registration_number: form.registration_number.trim(),
      vin: form.vin.trim(),
      trailer_type: form.trailer_type,
      status: form.status,
      brand: form.brand.trim(),
      manufacturer: form.manufacturer.trim(),
      model: form.model.trim(),
      year: yearNum,
      capacity: form.capacity.trim(),
      weight: form.weight.trim(),
      dimensions: form.dimensions.trim(),
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost.trim() || null,
      current_value: form.current_value.trim() || null,
      yard_location: form.yard_location.trim(),
      gps_lat: form.gps_lat.trim() || null,
      gps_lng: form.gps_lng.trim() || null,
      next_inspection_date: form.next_inspection_date || null,
    }

    setSaving(true)
    try {
      await onSave(payload)
      toast.success(editing ? `Trailer ${payload.trailer_number} updated` : `Trailer ${payload.trailer_number} added`)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save this trailer. Please check the details and try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-2xl rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? `Edit ${editing.trailer_number}` : "Add trailer"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Identity */}
          <div className="space-y-3">
            <p className={SECTION}>Identity</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Trailer number *</label>
                <input value={form.trailer_number} onChange={set("trailer_number")} required className={FIELD} placeholder="TR-070" />
              </div>
              <div>
                <label className={LABEL}>Registration number *</label>
                <input value={form.registration_number} onChange={set("registration_number")} required className={FIELD} placeholder="REG-070" />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>VIN / chassis number *</label>
                <input value={form.vin} onChange={set("vin")} required className={FIELD} placeholder="1FUJA6CV05LM00000" />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-3">
            <p className={SECTION}>Classification</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Trailer type *</label>
                <select value={form.trailer_type} onChange={set("trailer_type")} className={FIELD}>
                  {TRAILER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select value={form.status} onChange={set("status")} className={FIELD}>
                  {TRAILER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Brand</label>
                <input value={form.brand} onChange={set("brand")} className={FIELD} placeholder="Schmitz" />
              </div>
              <div>
                <label className={LABEL}>Manufacturer</label>
                <input value={form.manufacturer} onChange={set("manufacturer")} className={FIELD} placeholder="Schmitz Cargobull" />
              </div>
              <div>
                <label className={LABEL}>Model</label>
                <input value={form.model} onChange={set("model")} className={FIELD} placeholder="S.KO" />
              </div>
              <div>
                <label className={LABEL}>Year</label>
                <input type="number" value={form.year} onChange={set("year")} className={FIELD} placeholder="2024" />
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-3">
            <p className={SECTION}>Specifications</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Capacity</label>
                <input value={form.capacity} onChange={set("capacity")} className={FIELD} placeholder="40T" />
              </div>
              <div>
                <label className={LABEL}>Weight</label>
                <input value={form.weight} onChange={set("weight")} className={FIELD} placeholder="7000kg" />
              </div>
              <div>
                <label className={LABEL}>Dimensions</label>
                <input value={form.dimensions} onChange={set("dimensions")} className={FIELD} placeholder="13.6m x 2.5m" />
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="space-y-3">
            <p className={SECTION}>Financial</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Purchase date</label>
                <input type="date" value={form.purchase_date} onChange={set("purchase_date")} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Purchase cost</label>
                <input type="number" step="0.01" value={form.purchase_cost} onChange={set("purchase_cost")} className={FIELD} placeholder="1500000" />
              </div>
              <div>
                <label className={LABEL}>Current value</label>
                <input type="number" step="0.01" value={form.current_value} onChange={set("current_value")} className={FIELD} placeholder="1200000" />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <p className={SECTION}>Location</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Yard / location</label>
                <input value={form.yard_location} onChange={set("yard_location")} className={FIELD} placeholder="Nairobi Yard" />
              </div>
              {/* <div>
                <label className={LABEL}>GPS latitude</label>
                <input type="number" step="0.000001" value={form.gps_lat} onChange={set("gps_lat")} className={FIELD} placeholder="-1.286389" />
              </div>
              <div>
                <label className={LABEL}>GPS longitude</label>
                <input type="number" step="0.000001" value={form.gps_lng} onChange={set("gps_lng")} className={FIELD} placeholder="36.817223" />
              </div> */}
            </div>
          </div>

          {/* Compliance */}
          <div className="space-y-3">
            <p className={SECTION}>Compliance</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Next inspection</label>
                <input type="date" value={form.next_inspection_date} onChange={set("next_inspection_date")} className={FIELD} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-accent">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Add trailer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
