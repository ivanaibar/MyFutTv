"use client";

import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { useMatchesRange } from "@/hooks/useMatchesRange";

interface MonthViewProps {
  currentDate: Date;
  selectedLeagues: number[];
  onDayClick: (date: Date) => void;
}

export function MonthView({ currentDate, selectedLeagues, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { matches, loading } = useMatchesRange(
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd"),
    selectedLeagues
  );

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [calStart, calEnd]);

  const dayHeaders = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  return (
    <div>
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-gray-500 py-2">
            {h}
          </div>
        ))}

        {weeks.flat().map((date) => {
          const inMonth = isSameMonth(date, currentDate);
          const isCurrentDay = isSameDay(date, new Date());
          const dayMatches = matches.filter((m) =>
            isSameDay(parseISO(m.utcDate), date)
          );

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDayClick(date)}
              className={`p-1 sm:p-2 rounded-lg text-center transition-colors min-h-[44px] sm:min-h-[60px] ${
                !inMonth ? "text-gray-300" : "hover:bg-gray-50"
              } ${isCurrentDay ? "bg-green-50 border border-green-400" : ""}`}
            >
              <div className="text-xs sm:text-sm">{format(date, "d")}</div>
              {dayMatches.length > 0 && inMonth && (
                <div className="mt-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                    {dayMatches.length}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
