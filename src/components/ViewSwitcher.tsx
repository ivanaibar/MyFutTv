"use client";

import type { CalendarView } from "@/types";

interface ViewSwitcherProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const views: { id: CalendarView; label: string }[] = [
  { id: "day", label: "Día" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div role="tablist" className="tabs tabs-box tabs-sm bg-base-300">
      {views.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          onClick={() => onViewChange(id)}
          className={`tab font-medium transition-colors ${
            currentView === id ? "tab-active !bg-primary !text-primary-content" : "text-base-content/60"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
