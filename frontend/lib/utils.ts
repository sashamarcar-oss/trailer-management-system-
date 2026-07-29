import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const err = error as { response?: any; message?: string }
    const data = err.response?.data
    if (data) {
      if (typeof data === "string") return data
      if (data.detail) return String(data.detail)
      if (data.message) return String(data.message)
      if (data.error) return String(data.error)
      if (Array.isArray(data)) return data.join(" ")
      return JSON.stringify(data)
    }
    if (err.message) return String(err.message)
  }
  return fallback
}