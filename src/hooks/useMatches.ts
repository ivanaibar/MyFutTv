"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import type { Match, MatchUpdatePayload } from "@/types";

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

  useEffect(() => {
    const socket = getSocket();

    if (selectedLeagues.length > 0) {
      socket.emit("subscribe:leagues", { leagueIds: selectedLeagues });
    }

    const handleUpdate = (payload: MatchUpdatePayload) => {
      setMatches((prev) =>
        prev.map((match) =>
          match.id === payload.matchId
            ? {
                ...match,
                score: { ...match.score, fullTime: payload.score.fullTime },
                status: payload.status,
                minute: payload.minute,
              }
            : match
        )
      );
    };

    socket.on("match:update", handleUpdate);

    return () => {
      socket.off("match:update", handleUpdate);
    };
  }, [selectedLeagues]);

  const filteredMatches =
    selectedLeagues.length > 0
      ? matches.filter((m) => selectedLeagues.includes(m.competition.id))
      : matches;

  return { matches: filteredMatches, loading, error, refetch: fetchMatches };
}
