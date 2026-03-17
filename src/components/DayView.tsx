"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MatchCard } from "./MatchCard";
import type { Match } from "@/types";

interface DayViewProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

export function DayView({ matches, loading, error }: DayViewProps) {
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
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error al cargar los partidos: {error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No hay partidos programados para este dia</p>
        <p className="text-sm mt-1">Prueba a seleccionar mas ligas o cambia de fecha</p>
      </div>
    );
  }

  const liveCount = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  ).length;

  return (
    <div>
      {liveCount > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
          </span>
          <span className="text-red-600 font-medium">
            {liveCount} {liveCount === 1 ? "partido en directo" : "partidos en directo"}
          </span>
        </div>
      )}

      <div className="space-y-6">
        {Array.from(groupedMatches.entries()).map(([time, timeMatches]) => (
          <div key={time}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-gray-400">{time}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3">
              {timeMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
