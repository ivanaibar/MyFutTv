"use client";

import { useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay, isToday } from "date-fns";
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
      <div className="flex justify-center py-16">
        <span className="loading loading-ring loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
      {days.map(({ date, matches: dayMatches }) => {
        const isCurrentDay = isToday(date);
        const liveCount = dayMatches.filter(
          (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
        ).length;
        const channels = [
          ...new Set(dayMatches.map((m: Match) => m.channel).filter(Boolean)),
        ];

        return (
          <button
            key={date.toISOString()}
            onClick={() => onDayClick(date)}
            className={`card p-3 text-left transition-all duration-200 border ${
              isCurrentDay
                ? "bg-primary/10 border-primary/40 hover:bg-primary/20"
                : "bg-base-200 border-base-300 hover:bg-base-300 hover:border-primary/30"
            }`}
          >
            <div className="flex items-baseline gap-1.5 sm:block">
              <div className="text-xs text-base-content/50 capitalize">
                {format(date, "EEE", { locale: es })}
              </div>
              <div className={`text-lg font-bold ${isCurrentDay ? "text-primary" : "text-base-content"}`}>
                {format(date, "d")}
              </div>
            </div>
            {dayMatches.length > 0 && (
              <div className="mt-1 text-xs text-base-content/50">
                {dayMatches.length} {dayMatches.length === 1 ? "partido" : "partidos"}
              </div>
            )}
            {liveCount > 0 && (
              <div className="mt-0.5 text-xs text-error font-semibold animate-pulse">
                {liveCount} en directo
              </div>
            )}
            {channels.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {(channels as string[]).slice(0, 2).map((ch) => (
                  <div key={ch} className="text-xs text-primary/70 truncate">
                    {ch}
                  </div>
                ))}
                {channels.length > 2 && (
                  <div className="text-xs text-base-content/30">+{channels.length - 2} más</div>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
