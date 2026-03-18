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
  isToday,
  parseISO,
} from "date-fns";
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

  const dayHeaders = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div>
      {loading && (
        <div className="flex justify-center py-4">
          <span className="loading loading-ring loading-md text-primary" />
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((h) => (
          <div key={h} className="text-center text-xs font-semibold text-base-content/40 py-2">
            {h}
          </div>
        ))}

        {weeks.flat().map((date) => {
          const inMonth = isSameMonth(date, currentDate);
          const isCurrentDay = isToday(date);
          const dayMatches = matches.filter((m) =>
            isSameDay(parseISO(m.utcDate), date)
          );
          const hasLive = dayMatches.some(
            (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
          );

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDayClick(date)}
              className={`p-1 sm:p-2 rounded-lg text-center transition-all duration-150 min-h-[44px] sm:min-h-[60px] border ${
                !inMonth
                  ? "text-base-content/20 bg-transparent border-transparent"
                  : isCurrentDay
                  ? "bg-primary/10 border-primary/40 hover:bg-primary/20"
                  : "bg-base-200 border-base-300 hover:bg-base-300 hover:border-primary/30"
              }`}
            >
              <div className={`text-sm font-bold ${
                isCurrentDay ? "text-primary" : inMonth ? "text-base-content" : "text-base-content/20"
              }`}>
                {format(date, "d")}
              </div>
              {dayMatches.length > 0 && inMonth && (
                <div className={`text-xs mt-0.5 ${hasLive ? "text-error font-semibold animate-pulse" : "text-base-content/40"}`}>
                  {dayMatches.length}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
