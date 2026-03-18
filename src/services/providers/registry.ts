import type { FootballProvider } from "./types";
import type { Match } from "@/types";
import { footballDataProvider, getCompetitions } from "./football-data";
import { apiFootballProvider } from "./api-football";

export type ProviderName = "football-data" | "api-football";

// ─── Configuration ────────────────────────────────────────────────────────────
// To route a competition to a different provider, add its ID here.
// Competition IDs: 2014 La Liga, 2001 UCL, 2021 PL, 2002 Bundesliga,
//                  2015 Ligue 1, 2019 Serie A, 2003 Eredivisie, 2017 Primeira,
//                  2016 Championship, 2013 Brasileirao, 2000 WC, 2018 Euro
const COMPETITION_PROVIDERS: Partial<Record<number, ProviderName>> = {
  // Example: route Serie A to api-football once implemented:
  // 2019: "api-football",
};
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROVIDER: ProviderName = "football-data";

const PROVIDERS: Record<ProviderName, FootballProvider> = {
  "football-data": footballDataProvider,
  "api-football": apiFootballProvider,
};

export function getProvider(competitionId?: number): FootballProvider {
  const name =
    (competitionId !== undefined && COMPETITION_PROVIDERS[competitionId]) ||
    DEFAULT_PROVIDER;
  return PROVIDERS[name];
}

async function mergeProviders(calls: Promise<Match[]>[]): Promise<Match[]> {
  const results = await Promise.allSettled(calls);
  const seen = new Set<number>();
  const merged: Match[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const match of result.value) {
        if (!seen.has(match.id)) {
          seen.add(match.id);
          merged.push(match);
        }
      }
    }
  }
  return merged;
}

function activeProviders(): FootballProvider[] {
  const names = new Set<ProviderName>([DEFAULT_PROVIDER]);
  for (const name of Object.values(COMPETITION_PROVIDERS)) {
    if (name) names.add(name);
  }
  return [...names].map((n) => PROVIDERS[n]);
}

export const registry: FootballProvider = {
  async getMatchesByDate(date: string): Promise<Match[]> {
    return mergeProviders(activeProviders().map((p) => p.getMatchesByDate(date)));
  },

  async getMatchesByDateRange(dateFrom: string, dateTo: string): Promise<Match[]> {
    return mergeProviders(
      activeProviders().map((p) => p.getMatchesByDateRange(dateFrom, dateTo))
    );
  },

  async getLiveMatches(): Promise<Match[]> {
    return mergeProviders(activeProviders().map((p) => p.getLiveMatches()));
  },
};

export { getCompetitions };
