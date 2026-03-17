"use client";

import { useEffect, useState } from "react";
import type { Competition } from "@/types";

interface LeagueFilterProps {
  selectedLeagues: number[];
  onToggle: (leagueId: number) => void;
}

export function LeagueFilter({ selectedLeagues, onToggle }: LeagueFilterProps) {
  const [leagues, setLeagues] = useState<Competition[]>([]);

  useEffect(() => {
    fetch("/api/leagues")
      .then((res) => res.json())
      .then((data) => setLeagues(data.competitions))
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
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
  );
}
