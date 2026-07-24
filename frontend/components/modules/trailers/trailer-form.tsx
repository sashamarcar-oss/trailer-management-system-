"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { trailerSchema, trailerTypes, trailerStatuses, TrailerFormValues } from "@/lib/validations/trailer";
import { Trailer } from "@/types";
import { api } from "@/lib/api";

interface TrailerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (trailer: Trailer) => void;
}

export function TrailerForm({ open, onOpenChange, onCreated }: TrailerFormProps) {
  const {
    register, handleSubmit, reset, setValue,
    formState: { errors, isSubmitting },
  } = useForm<TrailerFormValues>({
    resolver: zodResolver(trailerSchema),
    defaultValues: { status: "Available", year: new Date().getFullYear() },
  });

  async function onSubmit(values: TrailerFormValues) {
    try {
      const created = await api.trailers.create({
        trailerNumber: values.trailerNumber,
        registrationNumber: values.registrationNumber,
        vin: values.vin,
        type: values.type,
        brand: values.brand,
        model: values.model,
        year: values.year,
        capacity: values.capacity,
        status: values.status,
        location: values.location,
        nextInspection: values.nextInspection,
        insuranceExpiry: values.insuranceExpiry,
      });
      onCreated(created);
      toast.success(`Trailer ${values.trailerNumber} added`);
      reset();
      onOpenChange(false);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.response?.data ?? error?.message;
      const message = typeof detail === "string" ? detail : JSON.stringify(detail);
      toast.error(`Couldn't save the trailer. ${message || "Try again."}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a trailer</DialogTitle>
          <DialogDescription>Register a new trailer to the fleet.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="trailerNumber">Trailer number</Label>
              <Input id="trailerNumber" placeholder="TR-070" {...register("trailerNumber")} />
              {errors.trailerNumber && <p className="text-xs text-red-600 mt-1">{errors.trailerNumber.message}</p>}
            </div>
            <div>
              <Label htmlFor="registrationNumber">Registration number</Label>
              <Input id="registrationNumber" placeholder="KDA 000A" {...register("registrationNumber")} />
              {errors.registrationNumber && <p className="text-xs text-red-600 mt-1">{errors.registrationNumber.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="vin">VIN / chassis number</Label>
            <Input id="vin" placeholder="1FUJA6CV05LM00000" {...register("vin")} />
            {errors.vin && <p className="text-xs text-red-600 mt-1">{errors.vin.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Trailer type</Label>
              <Select onValueChange={(v) => setValue("type", v as any, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {trailerTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-red-600 mt-1">{errors.type.message}</p>}
            </div>
            <div>
              <Label>Status</Label>
              <Select
                defaultValue="Available"
                onValueChange={(v) => setValue("status", v as any, { shouldValidate: true })}
              >
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {trailerStatuses.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" placeholder="Schmitz" {...register("brand")} />
              {errors.brand && <p className="text-xs text-red-600 mt-1">{errors.brand.message}</p>}
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="S.KO" {...register("model")} />
              {errors.model && <p className="text-xs text-red-600 mt-1">{errors.model.message}</p>}
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input id="year" type="number" placeholder="2024" {...register("year", { valueAsNumber: true })} />
              {errors.year && <p className="text-xs text-red-600 mt-1">{errors.year.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" placeholder="40T / 45,000L" {...register("capacity")} />
              {errors.capacity && <p className="text-xs text-red-600 mt-1">{errors.capacity.message}</p>}
            </div>
            <div>
              <Label htmlFor="location">Yard / location</Label>
              <Input id="location" placeholder="Nairobi Yard" {...register("location")} />
              {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nextInspection">Next inspection date</Label>
              <Input id="nextInspection" type="date" {...register("nextInspection")} />
              {errors.nextInspection && <p className="text-xs text-red-600 mt-1">{errors.nextInspection.message}</p>}
            </div>
            <div>
              <Label htmlFor="insuranceExpiry">Insurance expiry date</Label>
              <Input id="insuranceExpiry" type="date" {...register("insuranceExpiry")} />
              {errors.insuranceExpiry && <p className="text-xs text-red-600 mt-1">{errors.insuranceExpiry.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save trailer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
