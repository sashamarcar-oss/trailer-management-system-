import { z } from "zod";

export const trailerTypes = [
  "Flatbed", "Low Loader", "Fuel Tanker", "Container Trailer", "Side Tipper",
  "Box Trailer", "Curtain Trailer", "Refrigerated Trailer", "Skeletal Trailer",
  "Extendable Trailer", "Livestock Trailer", "Other",
] as const;

export const trailerStatuses = [
  "Available", "Reserved", "Rented", "Under Maintenance", "Damaged", "Retired",
] as const;

export const trailerSchema = z.object({
  trailerNumber: z.string().min(2, "Trailer number is required"),
  registrationNumber: z.string().min(3, "Registration number is required"),
  vin: z.string().min(5, "VIN / chassis number is required"),
  type: z.enum(trailerTypes, { required_error: "Select a trailer type" }),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  year: z
    .number({ invalid_type_error: "Year is required" })
    .min(1980, "Enter a valid year")
    .max(new Date().getFullYear() + 1, "Enter a valid year"),
  capacity: z.string().min(1, "Capacity is required"),
  status: z.enum(trailerStatuses),
  location: z.string().min(1, "Location / yard is required"),
  nextInspection: z.string().min(1, "Next inspection date is required"),
  insuranceExpiry: z.string().min(1, "Insurance expiry date is required"),
});

export type TrailerFormValues = z.infer<typeof trailerSchema>;
