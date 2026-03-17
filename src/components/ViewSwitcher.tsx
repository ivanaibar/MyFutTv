"use client";

import type { CalendarView } from "@/types";

interface ViewSwitcherProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const views: { id: CalendarView; label: string }[] = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
      {views.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            currentView === id
              ? "bg-green-600 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
