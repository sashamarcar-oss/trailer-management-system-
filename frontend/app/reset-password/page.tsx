"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";

const t = theme.light;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const linkValid = Boolean(uid && token);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.auth.resetPassword(uid, token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? err.response?.data ?? err.message;
      setError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  }

  return (
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

      <p className="text-sm font-semibold mb-5" style={{ color: t.text }}>Choose a new password</p>

      {!linkValid ? (
        <p className="text-xs mb-5" style={{ color: "#9C2B2B" }}>
          This reset link is invalid or incomplete. Please request a new one.
        </p>
      ) : done ? (
        <p className="text-xs mb-5" style={{ color: t.text }}>
          Your password has been reset. Redirecting you to sign in…
        </p>
      ) : (
        <>
          <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: `1px solid ${t.border}`, color: t.text }}
            autoComplete="new-password"
            required
          />

          <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: `1px solid ${t.border}`, color: t.text }}
            autoComplete="new-password"
            required
          />

          {error && <p className="text-xs mb-4" style={{ color: "#9C2B2B" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ background: t.teal }}
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </>
      )}

      <Link href="/login" className="block text-center text-xs mt-4" style={{ color: t.teal }}>
        Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: t.bg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <Suspense fallback={<p className="text-sm" style={{ color: t.textMuted }}>Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
