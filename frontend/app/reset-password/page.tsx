"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

      <p className="text-sm font-semibold mb-5">Choose a new password</p>

      {!linkValid ? (
        <p className="text-xs mb-5 text-red-500">
          This reset link is invalid or incomplete. Please request a new one.
        </p>
      ) : done ? (
        <p className="text-xs mb-5">
          Your password has been reset. Redirecting you to sign in…
        </p>
      ) : (
        <>
          <label className="block text-xs font-medium mb-1.5 text-muted-foreground">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none bg-background border border-border text-foreground focus:border-teal"
            autoComplete="new-password"
            required
          />

          <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none bg-background border border-border text-foreground focus:border-teal"
            autoComplete="new-password"
            required
          />

          {error && <p className="text-xs mb-4 text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-teal hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </>
      )}

      <Link href="/login" className="block text-center text-xs mt-4 text-teal hover:opacity-80">
        Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
