"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Truck, Users, ClipboardList, FileText, Receipt,
  Wallet, BarChart3, ShieldCheck, Settings, LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getStoredUser, logout, ROLE_LABELS, type AuthUser } from "@/lib/auth";
import { api } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trailers", label: "Trailers", icon: Truck },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/rentals", label: "Rentals", icon: ClipboardList },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { key: "audit-logs", href: "/audit-logs", label: "Audit logs", icon: ShieldCheck },
  { href: "/settings/admin-users", label: "Settings", icon: Settings },
];

export function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());

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

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : "User";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
  const roleLabel = user?.role_name
    ? ROLE_LABELS[user.role_name]
    : user?.is_superuser
      ? "Super Admin"
      : "No role assigned";

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 h-full bg-sidebar transition-all duration-200",
        open ? "w-60" : "w-[68px]"
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-5 shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-teal">
          <Truck size={18} className="text-white" />
        </div>
        {open && (
          <div className="leading-tight overflow-hidden">
            <p className="text-white font-semibold text-sm whitespace-nowrap">TrailerOps</p>
            <p className="text-xs whitespace-nowrap text-teal-light/80">Fleet Management</p>
          </div>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 mt-2 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive ? "bg-teal text-white" : "text-white/70 hover:bg-white/5"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {open && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-2.5">
        <div className={cn("flex items-center gap-2.5 px-1 py-2", !open && "justify-center")}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-semibold bg-blue">
            {initials}
          </div>
          {open && (
            <>
              <div className="leading-tight overflow-hidden flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{displayName}</p>
                <p className="text-xs truncate text-teal-light/80">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                aria-label="Logout"
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                type="button"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
