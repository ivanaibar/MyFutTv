"use client";

import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MatchCard } from "./MatchCard";
import type { Match } from "@/types";

interface DayViewProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
  date: string;
}

export function DayView({ matches, loading, error, date }: DayViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const isToday = date === format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [date]);

  const toggleGroup = (time: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(time)) {
        next.delete(time);
      } else {
        next.add(time);
      }
      return next;
    });
  };

  const isAllFinished = (groupMatches: Match[]) =>
    groupMatches.every((m) => m.status === "FINISHED");

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, Match[]>();
    const sorted = [...matches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
    for (const match of sorted) {
      const time = format(parseISO(match.utcDate), "HH:mm", { locale: es });
      const group = groups.get(time) || [];
      group.push(match);
      groups.set(time, group);
    }
    return groups;
  }, [matches]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-ring loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error max-w-lg mx-auto mt-8">
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
        </svg>
        <span>Error al cargar los partidos: {error}</span>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">⚽</div>
        <p className="text-lg text-base-content/60">No hay partidos programados para este día</p>
        <p className="text-sm text-base-content/40 mt-1">Prueba a seleccionar más ligas o cambia de fecha</p>
      </div>
    );
  }

  const liveCount = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  ).length;

  return (
    <div className="space-y-6">
      {liveCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-error animate-ping" />
          <span className="text-sm font-semibold text-error">
            {liveCount} {liveCount === 1 ? "partido en directo" : "partidos en directo"}
          </span>
        </div>
      )}

      {Array.from(groupedMatches.entries()).map(([time, timeMatches]) => {
        const allFinished = isAllFinished(timeMatches);
        const isExpanded = isToday ? expandedGroups.has(time) : !expandedGroups.has(time);

        return (
          <div key={time}>
            {allFinished ? (
              <button
                type="button"
                onClick={() => toggleGroup(time)}
                className="w-full flex items-center gap-2 text-left mb-3"
                aria-expanded={isExpanded ? "true" : "false"}
                aria-controls={`group-${time}`}
              >
                <svg
                  aria-hidden="true"
                  className={`w-3 h-3 text-base-content/30 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span className="text-xs text-base-content/30 font-mono">{time}</span>
                <span className="text-xs text-base-content/30">
                  · {timeMatches.length}{" "}
                  {timeMatches.length === 1 ? "partido finalizado" : "partidos finalizados"}
                </span>
              </button>
            ) : (
              <div className="divider divider-start text-xs text-base-content/40 font-mono mb-3">
                {time}
              </div>
            )}

            {(!allFinished || isExpanded) && (
              <div id={`group-${time}`} className="grid gap-3 sm:grid-cols-2">
                {timeMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
