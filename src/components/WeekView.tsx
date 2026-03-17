"use client";

import { useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { useMatchesRange } from "@/hooks/useMatchesRange";
import type { Match } from "@/types";

interface WeekViewProps {
  currentDate: Date;
  selectedLeagues: number[];
  onDayClick: (date: Date) => void;
}

export function WeekView({ currentDate, selectedLeagues, onDayClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  const { matches, loading } = useMatchesRange(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
    selectedLeagues
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const dayMatches = matches.filter((m) =>
        isSameDay(parseISO(m.utcDate), date)
      );
      return { date, matches: dayMatches };
    });
  }, [weekStart, matches]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ date, matches: dayMatches }) => {
        const isCurrentDay = isSameDay(date, new Date());
        const liveCount = dayMatches.filter(
          (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
        ).length;

        return (
          <button
            key={date.toISOString()}
            onClick={() => onDayClick(date)}
            className={`p-3 rounded-lg border text-left transition-colors hover:bg-gray-50 ${
              isCurrentDay ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"
            }`}
          >
            <div className="text-xs text-gray-500 capitalize">
              {format(date, "EEE", { locale: es })}
            </div>
            <div className="text-lg font-semibold">{format(date, "d")}</div>
            {dayMatches.length > 0 && (
              <div className="mt-1 text-xs text-gray-600">
                {dayMatches.length} {dayMatches.length === 1 ? "partido" : "partidos"}
              </div>
            )}
            {liveCount > 0 && (
              <div className="mt-0.5 text-xs text-red-500 font-medium">
                {liveCount} en directo
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
