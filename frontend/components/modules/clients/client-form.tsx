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
import { clientSchema, paymentTermsOptions, ClientFormValues } from "@/lib/validations/client";
import { Client, ClientType } from "@/types";
import { api } from "@/lib/api";

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: Client) => void;
}

export function ClientForm({ open, onOpenChange, onCreated }: ClientFormProps) {
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      client_type: "Company",
      country: "Kenya",
      preferred_payment_terms: "Net 30",
      credit_limit: 0,
    },
  });

  const clientType = watch("client_type");

  function normalizeClientType(value: ClientFormValues["client_type"]) {
    return value === "Company" ? "Company" : "Individual" as ClientType;
  }

  function normalizePaymentTerms(value: ClientFormValues["preferred_payment_terms"]) {
    const mapping: Record<string, Client["preferred_payment_terms"]> = {
      cash: "Cash",
      "net 7": "Net 7",
      "net 15": "Net 15",
      "net 30": "Net 30",
      "net 60": "Net 60",
    };
    return mapping[value.toLowerCase()] || "Net 30";
  }

  async function onSubmit(values: ClientFormValues) {
    try {
      const created = await api.clients.create({
        client_type: normalizeClientType(values.client_type),
        name: values.name,
        contact_person: values.contact_person,
        contact_phone: values.contact_phone,
        email: values.email,
        pin: values.pin,
        address: values.address,
        city: values.city,
        country: values.country,
        kra_pin: values.kra_pin,
        national_id: values.national_id,
        passport: values.passport,
        business_registration: values.business_registration,
        credit_limit: values.credit_limit,
        preferred_payment_terms: normalizePaymentTerms(values.preferred_payment_terms),
        notes: values.notes,
        blacklisted: false,
      });
      onCreated(created);
      toast.success(`Client ${values.name} added`);
      reset();
      onOpenChange(false);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? error?.response?.data ?? error?.message;
      const message = typeof detail === "string" ? detail : JSON.stringify(detail);
      toast.error(`Couldn't save the client. ${message || "Try again."}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a client</DialogTitle>
          <DialogDescription>Create a new individual or company client record.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Client type</Label>
            <Select
              defaultValue="Company"
              onValueChange={(v) => setValue("client_type", v as any, { shouldValidate: true })}
            >
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Company">Company</SelectItem>
                <SelectItem value="Individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">{clientType === "Individual" ? "Full name" : "Company name"}</Label>
            <Input id="name" placeholder={clientType === "Individual" ? "James Otieno" : "Zenith Freight Ltd"} {...register("name")} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact_person">Contact person</Label>
              <Input id="contact_person" placeholder="David Mwangi" {...register("contact_person")} />
              {errors.contact_person && <p className="text-xs text-red-600 mt-1">{errors.contact_person.message}</p>}
            </div>
            <div>
              <Label htmlFor="contact_phone">Phone</Label>
              <Input id="contact_phone" placeholder="+254 722 445 108" {...register("contact_phone")} />
              {errors.contact_phone && <p className="text-xs text-red-600 mt-1">{errors.contact_phone.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="ops@company.co.ke" {...register("email")} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" placeholder="Enterprise Road, Industrial Area" {...register("address")} />
            {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="Nairobi" {...register("city")} />
              {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" placeholder="Kenya" {...register("country")} />
              {errors.country && <p className="text-xs text-red-600 mt-1">{errors.country.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="pin">PIN (postal / location code, optional)</Label>
            <Input id="pin" placeholder="00100" {...register("pin")} />
          </div>

          {clientType === "Company" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kra_pin">KRA PIN</Label>
                <Input id="kra_pin" placeholder="P051234567X" {...register("kra_pin")} />
                {errors.kra_pin && <p className="text-xs text-red-600 mt-1">{errors.kra_pin.message}</p>}
              </div>
              <div>
                <Label htmlFor="business_registration">Business registration no.</Label>
                <Input id="business_registration" placeholder="CPR/2014/119876" {...register("business_registration")} />
                {errors.business_registration && <p className="text-xs text-red-600 mt-1">{errors.business_registration.message}</p>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="national_id">National ID</Label>
                <Input id="national_id" placeholder="27614432" {...register("national_id")} />
                {errors.national_id && <p className="text-xs text-red-600 mt-1">{errors.national_id.message}</p>}
              </div>
              <div>
                <Label htmlFor="passport">Passport (optional)</Label>
                <Input id="passport" placeholder="A1234567" {...register("passport")} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="credit_limit">Credit limit (KES)</Label>
              <Input id="credit_limit" type="number" placeholder="500000" {...register("credit_limit", { valueAsNumber: true })} />
              {errors.credit_limit && <p className="text-xs text-red-600 mt-1">{errors.credit_limit.message}</p>}
            </div>
            <div>
              <Label>Preferred payment terms</Label>
              <Select
                defaultValue="Net 30"
                onValueChange={(v) => setValue("preferred_payment_terms", v as any, { shouldValidate: true })}
              >
                <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
                <SelectContent>
                  {paymentTermsOptions.map((term) => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" placeholder="Any additional notes" {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
