"use client";

import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Sun, Moon, ChevronDown, LogOut, X, Building2, CalendarDays, CircleUserRound, FileText, Truck, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getStoredUser, logout, ROLE_LABELS, type AuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Notification } from "@/types";

type SearchResult = { label: string; detail: string; href: string };

type NotificationPresentation = {
  title: string;
  detail?: string;
  Icon: LucideIcon;
};

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]] as const;
  const [name, length] = units.find(([, unitSeconds]) => seconds >= unitSeconds) ?? ["minute", 60];
  const count = Math.floor(seconds / length);
  return `${count} ${name}${count === 1 ? "" : "s"} ago`;
}

function presentNotification(item: Notification): NotificationPresentation {
  const record = item.model_name?.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ") || "record";
  const recordName = record.charAt(0).toUpperCase() + record.slice(1);
  const actor = item.user_email?.split("@")[0]?.replace(/[._-]/g, " ") || "A user";
  const Icon = /trailer/i.test(record) ? Truck : /invoice|quotation|expense|rental/i.test(record) ? FileText : /branch|office|location/i.test(record) ? Building2 : /leave|schedule|calendar/i.test(record) ? CalendarDays : /user|team|client/i.test(record) ? CircleUserRound : Bell;
  const action = item.action.toLowerCase();
  const object = item.object_id ? ` #${item.object_id}` : "";

  if (item.action === "LOGIN") return { title: `${actor} signed in.`, detail: "Account activity", Icon };
  if (item.action === "LOGOUT") return { title: `${actor} signed out.`, detail: "Account activity", Icon };
  if (item.action === "DELETE") return { title: `${recordName}${object} was deleted.`, detail: `Action by ${actor}`, Icon };
  if (item.action === "CREATE") return { title: `${recordName}${object} was added.`, detail: `Action by ${actor}`, Icon };
  if (item.action === "UPDATE") return { title: `${recordName}${object} was updated.`, detail: `Action by ${actor}`, Icon };
  return { title: `${recordName}${object} was ${action}.`, detail: `Action by ${actor}`, Icon };
}

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
  const [clearedNotificationIds, setClearedNotificationIds] = useState<number[]>([]);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

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
    const closeNotifications = (event: MouseEvent) => {
      if (!notificationPanelRef.current?.contains(event.target as Node)) setShowNotifications(false);
    };
    if (showNotifications) document.addEventListener("mousedown", closeNotifications);
    return () => document.removeEventListener("mousedown", closeNotifications);
  }, [showNotifications]);

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
  const visibleNotifications = notifications.filter((item) => !clearedNotificationIds.includes(item.id));
  const markAllNotificationsRead = () => setSeenNotificationIds((seen) => Array.from(new Set([...seen, ...notifications.map((item) => item.id)])));
  const roleLabel = user?.role_name
    ? ROLE_LABELS[user.role_name]
    : user?.is_superuser
      ? "Super Admin"
      : "No role assigned";

  return (
    <header className="relative flex items-center justify-between gap-4 px-6 py-3.5 border-b border-border bg-card sticky top-0 z-10">
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
        <button onClick={() => setShowNotifications((visible) => !visible)} aria-label="Notifications" aria-expanded={showNotifications} className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-background border border-border">
          <Bell size={16} className="text-teal" />
          {!!unreadNotificationCount && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unreadNotificationCount}</span>}
        </button>
        {showNotifications && (
          <div ref={notificationPanelRef} className="absolute right-4 sm:right-24 top-[calc(100%+0.5rem)] z-30 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button type="button" onClick={markAllNotificationsRead} className="text-sm font-medium text-teal hover:opacity-80">Mark all as read</button>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {visibleNotifications.length ? visibleNotifications.map((item) => {
                const { title, detail, Icon } = presentNotification(item);
                const unread = !seenNotificationIds.includes(item.id);
                return (
                  <button key={item.id} type="button" onClick={() => setSeenNotificationIds((seen) => Array.from(new Set([...seen, item.id])))} className={`flex w-full gap-3 border-b border-border px-5 py-4 text-left transition-colors hover:bg-background ${unread ? "bg-teal-light/50" : "bg-card"}`}>
                    <Icon size={27} className="mt-0.5 shrink-0 text-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium leading-5 text-foreground">{title}</span>
                      {detail && <span className="mt-1 block text-sm leading-5 text-muted-foreground">{detail}</span>}
                      <span className="mt-1.5 block text-sm text-muted-foreground">{timeAgo(item.created_at)}</span>
                    </span>
                    {unread && <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-teal" />}
                  </button>
                );
              }) : <p className="px-5 py-10 text-center text-sm text-muted-foreground">You have no notifications.</p>}
            </div>
            <div className="border-t border-border px-5 py-4 text-center">
              <button type="button" onClick={() => setClearedNotificationIds(notifications.map((item) => item.id))} className="text-sm font-medium text-red-500 hover:text-red-600">Clear all notifications</button>
            </div>
          </div>
        )}
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
