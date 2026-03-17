"use client";

import { useState, useEffect } from "react";
import type { UserPreferences } from "@/types";
import { DEFAULT_SELECTED_LEAGUES } from "@/lib/constants";

const STORAGE_KEY = "myfuttv-preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  selectedLeagues: DEFAULT_SELECTED_LEAGUES,
  timezone: "Europe/Madrid",
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleLeague = (leagueId: number) => {
    setPreferences((prev) => {
      const selected = prev.selectedLeagues.includes(leagueId)
        ? prev.selectedLeagues.filter((id) => id !== leagueId)
        : [...prev.selectedLeagues, leagueId];
      const next = { ...prev, selectedLeagues: selected };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { preferences, updatePreferences, toggleLeague };
}
