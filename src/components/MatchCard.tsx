"use client";

import type { Match, Goal } from "@/types";
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
        label: <span className="badge badge-warning text-xs font-medium">Descanso</span>,
        showScore: true,
      };
    case "FINISHED":
      return {
        label: <span className="badge badge-ghost text-xs font-medium opacity-60">Finalizado</span>,
        showScore: true,
      };
    case "SCHEDULED":
    case "TIMED": {
      const matchDate = parseISO(match.utcDate);
      const distance = formatDistanceToNow(matchDate, { locale: es, addSuffix: true });
      const isFuture = matchDate > new Date();
      return {
        label: (
          <span className="text-xs text-base-content/50">
            {isFuture ? `Empieza ${distance}` : format(matchDate, "HH:mm", { locale: es })}
          </span>
        ),
        showScore: false,
      };
    }
    case "POSTPONED":
      return {
        label: <span className="badge badge-warning badge-outline text-xs">Aplazado</span>,
        showScore: false,
      };
    case "CANCELLED":
      return {
        label: <span className="badge badge-error badge-outline text-xs">Cancelado</span>,
        showScore: false,
      };
    default:
      return { label: null, showScore: false };
  }
}

function GoalList({ goals, side }: { goals: Goal[]; side: "home" | "away" }) {
  const sideGoals = goals.filter((g) => g.team === side);
  if (sideGoals.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {sideGoals.map((g) => (
        <li
          key={`${g.minute}-${g.scorer}-${g.type}`}
          className={`text-xs text-base-content/40 leading-tight${side === "away" ? " text-right" : ""}`}
        >
          ⚽ {g.minute}' {g.scorer}
          {g.type === "PENALTY" && <span className="text-base-content/30"> (pp)</span>}
          {g.type === "OWN_GOAL" && <span className="text-base-content/30"> (en)</span>}
        </li>
      ))}
    </ul>
  );
}

export function MatchCard({ match }: MatchCardProps) {
  const { label: statusLabel, showScore } = getStatusDisplay(match);
  const matchTime = format(parseISO(match.utcDate), "HH:mm");

  return (
    <div className="card bg-base-200 border border-base-300 hover:border-primary/40 hover:bg-base-300 transition-all duration-200 overflow-hidden rounded-lg">
      {/* Competition row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          {match.competition.emblem && (
            <img
              src={match.competition.emblem}
              alt={match.competition.name}
              className="w-4 h-4 opacity-80"
            />
          )}
          <span className="text-xs font-medium text-base-content/60">
            {match.competition.name}
          </span>
        </div>
        {statusLabel}
      </div>

      {/* Teams + score row */}
      <div className="flex justify-between px-4 py-2 items-center">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {match.homeTeam.crest && (
            <img
              src={match.homeTeam.crest}
              alt={match.homeTeam.tla}
              className="w-8 h-8 shrink-0"
            />
          )}
          <span className="font-bold text-base-content break-words min-w-0" style={{ fontSize: "clamp(0.7rem, 3.5vw, 1rem)" }}>
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
        </div>

        <div className="flex flex-col items-center mx-3 sm:mx-4 min-w-[60px] sm:min-w-[72px] shrink-0">
          {showScore ? (
            <span className="text-3xl font-black text-secondary tabular-nums">
              {match.score.fullTime.home ?? 0} - {match.score.fullTime.away ?? 0}
            </span>
          ) : (
            <span className="text-xl font-semibold text-base-content/70 tabular-nums">
              {matchTime}
            </span>
          )}
          {match.minute && match.status === "IN_PLAY" && (
            <span className="text-xs text-secondary font-bold">{match.minute}&apos;</span>
          )}
        </div>

        <div className="flex items-start gap-2 flex-1 justify-end min-w-0">
          <span className="font-bold text-base-content text-right break-words min-w-0" style={{ fontSize: "clamp(0.7rem, 3.5vw, 1rem)" }}>
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          {match.awayTeam.crest && (
            <img
              src={match.awayTeam.crest}
              alt={match.awayTeam.tla}
              className="w-8 h-8 shrink-0"
            />
          )}
        </div>
      </div>

      {/* Goal scorers */}
      {match.goals && match.goals.length > 0 && (
        <div className="flex justify-between px-4 pb-4 gap-2">
          <div className="flex-1 min-w-0">
            <GoalList goals={match.goals} side="home" />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <GoalList goals={match.goals} side="away" />
          </div>
        </div>
      )}

      {/* Channel footer */}
      {match.channel ? (
        <div className="mt-2 px-4 py-2.5 flex items-center gap-2 bg-primary border-t border-primary">
          <svg className="w-4 h-4 text-primary-content shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-bold text-primary-content">{match.channel}</span>
        </div>
      ) : (
        <div className="mt-2 px-4 py-1.5 flex items-center gap-2 bg-base-300/50 border-t border-base-300">
          <svg className="w-3.5 h-3.5 text-base-content/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-base-content/30">Canal no disponible</span>
        </div>
      )}
    </div>
  );
}
