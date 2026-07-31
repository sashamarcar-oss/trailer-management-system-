"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onToggleSidebar={() => setSidebarOpen((s) => !s)} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
