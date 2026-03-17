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
    <div className="flex items-center gap-4">
      <button
        onClick={() => onDateChange(subDays(currentDate, 1))}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Dia anterior"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center min-w-[250px]">
        <h2 className="text-lg font-semibold capitalize">{dateLabel}</h2>
        {isToday(currentDate) && (
          <p className="text-sm text-gray-500">
            {format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        )}
      </div>

      <button
        onClick={() => onDateChange(addDays(currentDate, 1))}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Dia siguiente"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isToday(currentDate) && (
        <button
          onClick={() => onDateChange(new Date())}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
