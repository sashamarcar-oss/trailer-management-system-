"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Truck, Users, ClipboardList, FileText, Receipt,
  Wallet, BarChart3, Menu, ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trailers", label: "Trailers", icon: Truck },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/rentals", label: "Rentals", icon: ClipboardList },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { key: "audit-logs", href: "/audit-logs", label: "Audit logs", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 bg-sidebar transition-all duration-200",
        open ? "w-60" : "w-[68px]"
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-5">
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

      <nav className="flex-1 px-2.5 mt-2 space-y-1">
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

      <div className="p-2.5">
        <button
          onClick={() => setOpen((s) => !s)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs text-white/70 bg-white/5"
        >
          <Menu size={16} />
          {open && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
