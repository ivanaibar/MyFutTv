"use client";

import { useEffect, useState } from "react";
import type { Competition } from "@/types";

interface LeagueFilterProps {
  selectedLeagues: number[];
  onToggle: (leagueId: number) => void;
}

export function LeagueFilter({ selectedLeagues, onToggle }: LeagueFilterProps) {
  const [leagues, setLeagues] = useState<Competition[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/leagues")
      .then((res) => res.json())
      .then((data) => setLeagues(data.competitions))
      .catch(console.error);
  }, []);

  const selectedCount = leagues.filter((l) => selectedLeagues.includes(l.id)).length;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-sm w-full justify-between border border-base-300 text-base-content/70"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M9 16h6" />
          </svg>
          Competiciones
          {selectedCount > 0 && (
            <span className="badge badge-primary badge-sm">{selectedCount}</span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-wrap gap-2">
          {leagues.map((league) => {
            const isSelected = selectedLeagues.includes(league.id);
            return (
              <button
                key={league.id}
                onClick={() => onToggle(league.id)}
                className={`btn btn-xs gap-1.5 ${
                  isSelected ? "btn-primary" : "btn-ghost border border-base-300 text-base-content/60"
                }`}
              >
                {league.emblem && (
                  <img src={league.emblem} alt="" className="w-3.5 h-3.5" />
                )}
                {league.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
