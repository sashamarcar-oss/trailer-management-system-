"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { login } from "@/lib/auth";
import { theme } from "@/lib/theme";

const t = theme.light;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      router.push("/dashboard");
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

        <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>Email or username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: `1px solid ${t.border}`, color: t.text }}
          autoComplete="username"
        />

        <label className="block text-xs font-medium mb-1.5" style={{ color: t.textMuted }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: `1px solid ${t.border}`, color: t.text }}
          autoComplete="current-password"
        />

        {error && <p className="text-xs mb-4" style={{ color: "#9C2B2B" }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
          style={{ background: t.teal }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
