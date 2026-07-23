"use client";

import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getStoredUser, logout, ROLE_LABELS, type AuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Notification } from "@/types";

type SearchResult = { label: string; detail: string; href: string };

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState<number[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      try {
        const { data } = await api.auth.me();
        if (active) {
          localStorage.setItem("auth_user", JSON.stringify(data));
          setUser(data);
        }
      } catch { /* The stored login profile remains usable offline. */ }
    }
    loadUser();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const data = await api.notifications.list();
        if (active) setNotifications(data.results);
      } catch { /* Notification polling must not block the dashboard. */ }
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term) { setResults([]); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      const [trailers, clients, invoices, rentals, expenses] = await Promise.allSettled([
        api.trailers.list({ search: term }), api.clients.list({ search: term }), api.invoices.list({ search: term }),
        api.rentals.list({ search: term }), api.expenses.list({ search: term }),
      ]);
      if (!active) return;
      const next: SearchResult[] = [];
      const addMatches = (result: PromiseSettledResult<any>, href: string, fields: string[]) => {
        if (result.status !== "fulfilled") return;
        result.value.results.forEach((item: Record<string, unknown>) => {
          const text = fields.map((field) => String(item[field] ?? "")).join(" ").toLowerCase();
          if (text.includes(term) && next.length < 8) {
            next.push({ label: String(item[fields[0]] ?? "Record"), detail: String(item[fields[1]] ?? ""), href });
          }
        });
      };
      addMatches(trailers, "/trailers", ["trailerNumber", "registrationNumber"]);
      addMatches(clients, "/clients", ["name", "email"]);
      addMatches(invoices, "/invoices", ["client", "status"]);
      addMatches(rentals, "/rentals", ["client", "trailer"]);
      addMatches(expenses, "/expenses", ["vendor", "category"]);
      setResults(next);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const label = pathname?.split("/").filter(Boolean).pop() || "dashboard";
  const unreadNotificationCount = notifications.filter((item) => !seenNotificationIds.includes(item.id)).length;
  const roleLabel = user?.role_name
    ? ROLE_LABELS[user.role_name]
    : user?.is_superuser
      ? "Super Admin"
      : "No role assigned";

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-border bg-card sticky top-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-xs text-muted-foreground">Modules</p>
        <ChevronDown size={13} className="text-muted-foreground" />
        <p className="text-sm font-medium capitalize truncate">{label}</p>
      </div>

      <div className="hidden sm:flex relative items-center gap-2 px-3 py-2 rounded-lg flex-1 max-w-sm bg-background border border-border">
        <Search size={15} className="text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setShowSearch(true); }}
          onFocus={() => setShowSearch(true)}
          placeholder="Search trailers, clients, invoices..."
          className="bg-transparent outline-none text-sm w-full"
        />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
        {showSearch && query && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-30">
            {results.length ? results.map((result) => (
              <button key={`${result.href}-${result.label}-${result.detail}`} type="button" onClick={() => { router.push(result.href); setShowSearch(false); }} className="block w-full text-left px-3 py-2 hover:bg-background">
                <p className="text-sm">{result.label}</p><p className="text-xs text-muted-foreground">{result.detail}</p>
              </button>
            )) : <p className="px-3 py-3 text-xs text-muted-foreground">No matching records</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setDark((d) => !d)}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-background border border-border"
        >
          {dark ? <Sun size={16} className="text-teal" /> : <Moon size={16} className="text-teal" />}
        </button>
        <button onClick={() => { setShowNotifications((visible) => !visible); setSeenNotificationIds(notifications.map((item) => item.id)); }} aria-label="Notifications" className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-background border border-border">
          <Bell size={16} className="text-teal" />
          {!!unreadNotificationCount && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unreadNotificationCount}</span>}
        </button>
        {showNotifications && <div className="absolute top-14 right-24 w-80 rounded-lg border border-border bg-card shadow-lg z-30 p-3"><p className="text-sm font-semibold mb-2">Recent activity</p>{notifications.slice(0, 5).map((item) => <p key={item.id} className="text-xs py-2 border-t border-border"><span className="font-medium">{item.action}</span> {item.model_name || "system"}<span className="block text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span></p>)}</div>}
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold bg-blue">
            SA
          </div>
          <div className="hidden md:block leading-tight">
            <p className="text-xs font-medium">{user ? `${user.first_name} ${user.last_name}`.trim() || user.username : "User"}</p>
            <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border hover:bg-white/10"
          type="button"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
}
