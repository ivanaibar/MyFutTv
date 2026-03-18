import type { FootballProvider } from "./types";
import type { Match } from "@/types";

// TODO: Implement api-football.com provider (api-football.com, free tier: 100 req/day)
// Goals are included directly in the fixture list response — no extra calls needed.
// API docs: https://www.api-football.com/documentation-v3
// Set API_FOOTBALL_KEY env var with your key from RapidAPI or api-football.com.
export const apiFootballProvider: FootballProvider = {
  async getMatchesByDate(_date: string): Promise<Match[]> {
    console.warn("[api-football] Provider not yet implemented. Returning empty array.");
    return [];
  },

  async getMatchesByDateRange(_dateFrom: string, _dateTo: string): Promise<Match[]> {
    console.warn("[api-football] Provider not yet implemented. Returning empty array.");
    return [];
  },

  async getLiveMatches(): Promise<Match[]> {
    console.warn("[api-football] Provider not yet implemented. Returning empty array.");
    return [];
  },
};
