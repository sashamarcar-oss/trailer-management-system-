"use client";

import { useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";

const t = theme.light;

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
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: t.bg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border p-6"
        style={{ background: t.surface, borderColor: t.border }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: t.teal }}>
            <Truck size={18} color="#fff" />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: t.text }}>TrailerOps</p>
            <p className="text-xs" style={{ color: t.textMuted }}>Fleet Management</p>
          </div>
        </div>

        <p className="text-sm font-semibold mb-1" style={{ color: t.text }}>Forgot your password?</p>
        <p className="text-xs mb-5" style={{ color: t.textMuted }}>
          Enter your email and we&apos;ll send you a link to reset it.
        </p>

        {sent ? (
          <p className="text-xs mb-5" style={{ color: t.text }}>
            If that email exists, a reset link has been sent. Check your inbox and follow the link to
            choose a new password.
          </p>
        ) : (
          <>
            <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${t.border}`, color: t.text }}
              autoComplete="email"
              required
            />

            {error && <p className="text-xs mb-4" style={{ color: "#9C2B2B" }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ background: t.teal }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <Link href="/login" className="block text-center text-xs mt-4" style={{ color: t.teal }}>
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
