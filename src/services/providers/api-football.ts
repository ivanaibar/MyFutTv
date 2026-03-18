import type { FootballProvider } from "./types";
import type { Match, Goal } from "@/types";
import { cache } from "../cache";

// API docs: https://www.api-football.com/documentation-v3
// Set API_FOOTBALL_KEY env var with your key from dashboard.api-football.com
const API_BASE = "https://v3.football.api-sports.io";

// Mapping: football-data.org competition ID → api-football.com league ID
export const COMPETITION_TO_LEAGUE: Record<number, number> = {
  2014: 140, // La Liga
  2001: 2,   // UEFA Champions League
  2021: 39,  // Premier League
  2002: 78,  // Bundesliga
  2015: 61,  // Ligue 1
  2019: 135, // Serie A
  2003: 88,  // Eredivisie
  2017: 94,  // Primeira Liga
  2016: 40,  // Championship
  2013: 71,  // Brasileirao Série A
  2000: 1,   // FIFA World Cup
  2018: 4,   // UEFA European Championship
};

const SUPPORTED_LEAGUE_IDS = new Set(Object.values(COMPETITION_TO_LEAGUE));
const ENRICHABLE_STATUSES = new Set(["FINISHED", "IN_PLAY", "PAUSED"]);
const LIVE_TTL = 50_000;           // 50s for live matches
const FINISHED_TTL = 60 * 60_000;  // 1h for finished matches
const LIST_TTL = 5 * 60_000;       // 5 min for the fixture list

// api-football.com free plan only covers today ±1 day
function isInFreeWindow(date: string): boolean {
  const target = new Date(date + "T12:00:00Z");
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const diffDays = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= 1;
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`api-football error ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    response: T;
    errors: Record<string, string>;
  };
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`api-football API error: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}

// Normalize team name for fuzzy matching
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/\-]/g, " ")
    .replace(/\bfc\b|\baf\b|\bsc\b|\bafc\b|\bfk\b|\bcf\b|\bac\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface ApiFixtureItem {
  fixture: { id: number; status: { short: string } };
  league: { id: number };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

interface ApiFixtureEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number };
  player: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

interface ApiFixtureDetail extends ApiFixtureItem {
  events: ApiFixtureEvent[];
}

function findFixture(
  map: Map<string, ApiFixtureItem>,
  homeTeam: string,
  awayTeam: string
): ApiFixtureItem | undefined {
  const nHome = normalize(homeTeam);
  const nAway = normalize(awayTeam);

  // Strategy 1: exact normalized match
  const exact = map.get(`${nHome}::${nAway}`);
  if (exact) return exact;

  // Strategy 2: one name contains the other
  for (const [key, fixture] of map) {
    const [mHome, mAway] = key.split("::");
    if (
      (mHome.includes(nHome) || nHome.includes(mHome)) &&
      (mAway.includes(nAway) || nAway.includes(mAway))
    ) {
      return fixture;
    }
  }

  // Strategy 3: significant words (>3 chars)
  const homeWords = nHome.split(" ").filter((w) => w.length > 3);
  const awayWords = nAway.split(" ").filter((w) => w.length > 3);
  for (const [key, fixture] of map) {
    const [mHome, mAway] = key.split("::");
    if (
      homeWords.some((w) => mHome.includes(w)) &&
      awayWords.some((w) => mAway.includes(w))
    ) {
      return fixture;
    }
  }

  return undefined;
}

function mapGoalType(detail: string): Goal["type"] {
  if (detail === "Own Goal") return "OWN_GOAL";
  if (detail === "Penalty") return "PENALTY";
  return "REGULAR";
}

function mapEvents(events: ApiFixtureEvent[], homeTeamId: number): Goal[] {
  return events
    .filter(
      (e) =>
        e.type === "Goal" &&
        e.detail !== "Goal cancelled" &&
        e.player.name !== null
    )
    .map((e) => ({
      scorer: e.player.name as string,
      minute: e.time.elapsed,
      team: e.team.id === homeTeamId ? ("home" as const) : ("away" as const),
      type: mapGoalType(e.detail),
    }));
}

/**
 * Enriches matches with goal scorer data from api-football.com.
 * Only operates for dates within today ±1 day (free plan limitation).
 * Returns matches unchanged if the date is outside the window or the API key is missing.
 * Uses 1 list call + 1 detail call per enrichable match (all cached).
 */
export async function enrichWithApiFootballGoals(
  matches: Match[],
  date: string
): Promise<Match[]> {
  if (!process.env.API_FOOTBALL_KEY) return matches;
  if (!isInFreeWindow(date)) return matches;

  const enrichable = matches.filter((m) => ENRICHABLE_STATUSES.has(m.status));
  if (enrichable.length === 0) return matches;

  // Step 1: fetch fixture list for the day (1 API call, cached)
  const listCacheKey = `api-football:list:${date}`;
  let fixtures = cache.get<ApiFixtureItem[]>(listCacheKey);
  if (!fixtures) {
    try {
      const all = await apiGet<ApiFixtureItem[]>(`/fixtures?date=${date}`);
      fixtures = all.filter((f) => SUPPORTED_LEAGUE_IDS.has(f.league.id));
      cache.set(listCacheKey, fixtures, LIST_TTL);
    } catch (err) {
      console.error("[api-football] Failed to fetch fixture list:", err);
      return matches;
    }
  }

  // Step 2: build lookup map normalized(home)::normalized(away) → fixture
  const fixtureMap = new Map<string, ApiFixtureItem>();
  for (const f of fixtures) {
    const key = `${normalize(f.teams.home.name)}::${normalize(f.teams.away.name)}`;
    fixtureMap.set(key, f);
  }

  // Step 3: for each enrichable match, fetch detail and extract goals
  const enriched = [...matches];

  await Promise.allSettled(
    enrichable.map(async (match) => {
      const idx = enriched.findIndex((m) => m.id === match.id);
      if (idx === -1) return;

      const fixture = findFixture(
        fixtureMap,
        match.homeTeam.name,
        match.awayTeam.name
      );
      if (!fixture) return;

      const detailCacheKey = `api-football:detail:${fixture.fixture.id}`;
      let detail = cache.get<ApiFixtureDetail>(detailCacheKey);

      if (!detail) {
        try {
          const details = await apiGet<ApiFixtureDetail[]>(
            `/fixtures?id=${fixture.fixture.id}`
          );
          detail = details[0];
          if (!detail) return;
          const isLive =
            match.status === "IN_PLAY" || match.status === "PAUSED";
          cache.set(detailCacheKey, detail, isLive ? LIVE_TTL : FINISHED_TTL);
        } catch (err) {
          console.error(
            `[api-football] Failed to fetch fixture ${fixture.fixture.id}:`,
            err
          );
          return;
        }
      }

      const goals = mapEvents(detail.events ?? [], detail.teams.home.id);
      enriched[idx] = { ...enriched[idx], goals };
    })
  );

  return enriched;
}

// Stub full provider — ready for future implementation
export const apiFootballProvider: FootballProvider = {
  async getMatchesByDate(_date: string): Promise<Match[]> {
    return [];
  },
  async getMatchesByDateRange(_dateFrom: string, _dateTo: string): Promise<Match[]> {
    return [];
  },
  async getLiveMatches(): Promise<Match[]> {
    return [];
  },
};
