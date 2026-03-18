"use client";

import { useState, useEffect, useCallback } from "react";
import type { Match } from "@/types";

export function useMatches(date: string, selectedLeagues: number[]) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setMatches(data.matches);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const filteredMatches =
    selectedLeagues.length > 0
      ? matches.filter((m) => selectedLeagues.includes(m.competition.id))
      : matches;

  return { matches: filteredMatches, loading, error, refetch: fetchMatches, lastUpdated };
}
