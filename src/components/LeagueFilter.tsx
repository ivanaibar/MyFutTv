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

  const selectedCount = leagues.filter((l) =>
    selectedLeagues.includes(l.id)
  ).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full justify-between"
      >
        <span>
          Competiciones
          {selectedCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs">
              {selectedCount}
            </span>
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {league.emblem && (
                  <img src={league.emblem} alt="" className="w-4 h-4" />
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
