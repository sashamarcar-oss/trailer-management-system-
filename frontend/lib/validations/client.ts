import { z } from "zod";

export const paymentTermsOptions = ["Cash", "Net 7", "Net 15", "Net 30", "Net 60"] as const;

export const clientSchema = z
  .object({
    client_type: z.enum(["Individual", "Company"], { required_error: "Select a client type" }),
    name: z.string().min(2, "Name is required"),
    contact_person: z.string().min(2, "Contact person is required"),
    contact_phone: z.string().min(7, "Enter a valid phone number"),
    email: z.string().email("Enter a valid email address"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    country: z.string().min(1, "Country is required"),
    pin: z.string().optional(),
    kra_pin: z.string().optional(),
    national_id: z.string().optional(),
    passport: z.string().optional(),
    business_registration: z.string().optional(),
    credit_limit: z
      .number({ invalid_type_error: "Credit limit is required" })
      .min(0, "Credit limit cannot be negative"),
    preferred_payment_terms: z.enum(paymentTermsOptions),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.client_type === "Company") {
      if (!data.kra_pin || data.kra_pin.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["kra_pin"],
          message: "KRA PIN is required for a company client",
        });
      }
      if (!data.business_registration || data.business_registration.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["business_registration"],
          message: "Business registration number is required for a company client",
        });
      }
    }
    if (data.client_type === "Individual") {
      if (!data.national_id && !data.passport) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["national_id"],
          message: "Provide a National ID or Passport number",
        });
      }
    }
  });

export type ClientFormValues = z.infer<typeof clientSchema>;
