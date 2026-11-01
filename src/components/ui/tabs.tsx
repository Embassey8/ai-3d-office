"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { id: string; label: string }[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
}

/** Accessible tab list (role=tablist); panels are rendered by the caller with role=tabpanel. */
export function TabList({ tabs, value, onValueChange, className }: TabsProps) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    if (e.key === "ArrowRight") onValueChange(tabs[(i + 1) % tabs.length].id);
    if (e.key === "ArrowLeft") onValueChange(tabs[(i - 1 + tabs.length) % tabs.length].id);
  };
  return (
    <div role="tablist" onKeyDown={onKeyDown} className={cn("flex gap-1 border-b border-white/10", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onValueChange(t.id)}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            value === t.id
              ? "border-amber-400 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
