"use client";

import { format, addDays, subDays, isToday } from "date-fns";
import { es } from "date-fns/locale";

interface DateNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function DateNavigator({ currentDate, onDateChange }: DateNavigatorProps) {
  const dateLabel = isToday(currentDate)
    ? "Hoy"
    : format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onDateChange(subDays(currentDate, 1))}
        className="btn btn-ghost btn-circle btn-sm"
        aria-label="Día anterior"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center min-w-0 sm:min-w-[250px]">
        <h2 className="text-base sm:text-lg font-bold text-base-content capitalize">
          {dateLabel}
        </h2>
        {isToday(currentDate) && (
          <p className="text-xs text-base-content/40 capitalize">
            {format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        )}
      </div>

      <button
        onClick={() => onDateChange(addDays(currentDate, 1))}
        className="btn btn-ghost btn-circle btn-sm"
        aria-label="Día siguiente"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isToday(currentDate) && (
        <button
          onClick={() => onDateChange(new Date())}
          className="btn btn-primary btn-xs"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
