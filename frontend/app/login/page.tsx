"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck } from "lucide-react";
import { login } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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

        <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Email or username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none bg-background border border-border text-foreground focus:border-teal"
          autoComplete="username"
        />

        <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-lg text-sm outline-none bg-background border border-border text-foreground focus:border-teal"
          autoComplete="current-password"
        />

        {error && <p className="text-xs mb-4 text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-teal hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <Link href="/forgot-password" className="block text-center text-xs mt-4 text-teal hover:opacity-80">
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
