"use client";

import type { Match } from "@/types";
import { LiveIndicator } from "./LiveIndicator";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface MatchCardProps {
  match: Match;
}

function getStatusDisplay(match: Match) {
  switch (match.status) {
    case "IN_PLAY":
      return { label: <LiveIndicator />, showScore: true };
    case "PAUSED":
      return {
        label: <span className="text-xs font-medium text-orange-600">Descanso</span>,
        showScore: true,
      };
    case "FINISHED":
      return {
        label: <span className="text-xs font-medium text-gray-500">Finalizado</span>,
        showScore: true,
      };
    case "SCHEDULED":
    case "TIMED": {
      const matchDate = parseISO(match.utcDate);
      const timeStr = format(matchDate, "HH:mm", { locale: es });
      const distance = formatDistanceToNow(matchDate, { locale: es, addSuffix: true });
      const isFuture = matchDate > new Date();
      return {
        label: (
          <span className="text-xs text-gray-500">
            {isFuture ? `Empieza ${distance}` : timeStr}
          </span>
        ),
        showScore: false,
      };
    }
    case "POSTPONED":
      return {
        label: <span className="text-xs font-medium text-yellow-600">Aplazado</span>,
        showScore: false,
      };
    case "CANCELLED":
      return {
        label: <span className="text-xs font-medium text-red-500">Cancelado</span>,
        showScore: false,
      };
    default:
      return { label: null, showScore: false };
  }
}

export function MatchCard({ match }: MatchCardProps) {
  const { label: statusLabel, showScore } = getStatusDisplay(match);
  const matchTime = format(parseISO(match.utcDate), "HH:mm");

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          {match.competition.emblem && (
            <img
              src={match.competition.emblem}
              alt={match.competition.name}
              className="w-4 h-4"
            />
          )}
          <span className="text-xs font-medium text-gray-600">
            {match.competition.name}
          </span>
        </div>
        {statusLabel}
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.homeTeam.crest && (
            <img
              src={match.homeTeam.crest}
              alt={match.homeTeam.tla}
              className="w-6 h-6 shrink-0"
            />
          )}
          <span className="font-medium text-sm truncate">
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
        </div>

        <div className="flex flex-col items-center mx-3 sm:mx-4 min-w-[50px] sm:min-w-[60px]">
          {showScore ? (
            <span className="text-lg font-bold">
              {match.score.fullTime.home ?? 0} - {match.score.fullTime.away ?? 0}
            </span>
          ) : (
            <span className="text-lg font-semibold text-gray-700">{matchTime}</span>
          )}
          {match.minute && match.status === "IN_PLAY" && (
            <span className="text-xs text-red-500 font-medium">{match.minute}&apos;</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="font-medium text-sm truncate text-right">
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          {match.awayTeam.crest && (
            <img
              src={match.awayTeam.crest}
              alt={match.awayTeam.tla}
              className="w-6 h-6 shrink-0"
            />
          )}
        </div>
      </div>

      {match.channel ? (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-white">{match.channel}</span>
        </div>
      ) : (
        <div className="bg-gray-50 px-4 py-1.5 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-gray-400">Canal no disponible</span>
        </div>
      )}
    </div>
  );
}
