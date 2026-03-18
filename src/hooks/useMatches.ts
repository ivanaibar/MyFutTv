"use client";

import { useState, useEffect, useCallback } from "react";
import type { Match } from "@/types";

const POLL_INTERVAL = 60_000;

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

export function useMatches(date: string, selectedLeagues: number[]) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setMatches(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Poll every 60s when viewing today's matches (live scores may change)
  useEffect(() => {
    if (!isToday(date)) return;
    const id = setInterval(fetchMatches, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [date, fetchMatches]);

  const filteredMatches =
    selectedLeagues.length > 0
      ? matches.filter((m) => selectedLeagues.includes(m.competition.id))
      : matches;

  return { matches: filteredMatches, loading, error, refetch: fetchMatches };
}
