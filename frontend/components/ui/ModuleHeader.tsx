"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ModuleHeader({ title, subtitle, actionLabel, onAction }: ModuleHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actionLabel && (
        <Button onClick={onAction}>
          <Plus size={16} /> {actionLabel}
        </Button>
      )}
    </div>
  );
}
