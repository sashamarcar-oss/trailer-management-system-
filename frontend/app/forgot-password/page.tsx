"use client";

import { useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? err.response?.data ?? err.message;
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal">
            <Truck size={18} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm">TrailerOps</p>
            <p className="text-xs text-muted-foreground">Fleet Management</p>
          </div>
        </div>

        <p className="text-sm font-semibold mb-1">Forgot your password?</p>
        <p className="text-xs mb-5 text-muted-foreground">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>

        {sent ? (
          <p className="text-xs mb-5">
            If that email exists, a reset link has been sent. Check your inbox and follow the link to
            choose a new password.
          </p>
        ) : (
          <>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none bg-background border border-border text-foreground focus:border-teal"
              autoComplete="email"
              required
            />

            {error && <p className="text-xs mb-4 text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-teal hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <Link href="/login" className="block text-center text-xs mt-4 text-teal hover:opacity-80">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
