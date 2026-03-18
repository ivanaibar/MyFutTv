import { cache } from "../cache";
import { getChannelForCompetition } from "../channels";
import { scrapeTvChannels, findChannel } from "../tvScraper";
import { FREE_COMPETITION_IDS } from "@/lib/constants";
import type {
  Match,
  Goal,
  Competition,
  FootballDataMatchesResponse,
  FootballDataMatch,
  FootballDataMatchDetail,
  FootballDataGoal,
} from "@/types";
import type { FootballProvider } from "./types";

const API_BASE = "https://api.football-data.org/v4";

const FUTURE_MATCHES_TTL = 60 * 60 * 1000;
const LIVE_MATCHES_TTL = 50 * 1000;
const COMPETITIONS_TTL = 24 * 60 * 60 * 1000;

async function apiFetch<T>(endpoint: string): Promise<T> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": key || "" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `football-data.org API error: ${res.status} ${res.statusText} - ${body}`
    );
  }
  return res.json() as Promise<T>;
}

function mapMatch(raw: FootballDataMatch, tvMap?: Map<string, string>): Match {
  let channel: string | undefined;
  if (tvMap) {
    channel = findChannel(tvMap, raw.homeTeam.name, raw.awayTeam.name);
  }
  if (!channel) {
    channel = getChannelForCompetition(raw.competition.id);
  }

  return {
    id: raw.id,
    homeTeam: {
      id: raw.homeTeam.id,
      name: raw.homeTeam.name,
      shortName: raw.homeTeam.shortName,
      tla: raw.homeTeam.tla,
      crest: raw.homeTeam.crest,
    },
    awayTeam: {
      id: raw.awayTeam.id,
      name: raw.awayTeam.name,
      shortName: raw.awayTeam.shortName,
      tla: raw.awayTeam.tla,
      crest: raw.awayTeam.crest,
    },
    competition: {
      id: raw.competition.id,
      name: raw.competition.name,
      code: raw.competition.code,
      emblem: raw.competition.emblem,
    },
    utcDate: raw.utcDate,
    status: raw.status,
    score: {
      fullTime: raw.score.fullTime,
      halfTime: raw.score.halfTime,
    },
    minute: raw.minute,
    channel,
  };
}

function mapGoals(goals: FootballDataGoal[], homeTeamId: number): Goal[] {
  return goals.map((g) => ({
    scorer: g.scorer.name,
    minute: g.minute,
    team: g.team.id === homeTeamId ? "home" : "away",
    type: g.type,
  }));
}

const ENRICHABLE_STATUSES = new Set(["FINISHED", "IN_PLAY", "PAUSED"]);

async function enrichWithGoals(
  matches: Match[],
  rawMatches: FootballDataMatch[]
): Promise<Match[]> {
  const enrichableRaw = rawMatches.filter((m) =>
    ENRICHABLE_STATUSES.has(m.status)
  );

  if (enrichableRaw.length === 0) return matches;

  const results = await Promise.allSettled(
    enrichableRaw.map((m) =>
      apiFetch<FootballDataMatchDetail>(`/matches/${m.id}`)
    )
  );

  // Build a map from match id -> goals
  const goalsById = new Map<number, Goal[]>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const detail = result.value;
      if (detail.goals) {
        const homeTeamId = enrichableRaw[index].homeTeam.id;
        goalsById.set(detail.id, mapGoals(detail.goals, homeTeamId));
      }
    }
  });

  return matches.map((match) => {
    const goals = goalsById.get(match.id);
    if (goals !== undefined) {
      return { ...match, goals };
    }
    return match;
  });
}

async function getMatchesByDate(date: string): Promise<Match[]> {
  const cacheKey = `matches:${date}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const [response, tvMap] = await Promise.all([
    apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
    scrapeTvChannels(date),
  ]);

  const rawFiltered = response.matches.filter((m) =>
    FREE_COMPETITION_IDS.includes(m.competition.id)
  );

  let matches = rawFiltered.map((m) => mapMatch(m, tvMap));
  matches = await enrichWithGoals(matches, rawFiltered);

  const hasLive = matches.some(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  );
  cache.set(cacheKey, matches, hasLive ? LIVE_MATCHES_TTL : FUTURE_MATCHES_TTL);

  return matches;
}

async function getMatchesByDateRange(
  dateFrom: string,
  dateTo: string
): Promise<Match[]> {
  const cacheKey = `matches:${dateFrom}:${dateTo}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  // API limit: max 10 days per request. Split into chunks if needed.
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const chunks: { from: string; to: string }[] = [];
  let chunkStart = from;

  while (chunkStart <= to) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + 9); // max 10 days
    const effectiveEnd = chunkEnd > to ? to : chunkEnd;
    chunks.push({
      from: chunkStart.toISOString().split("T")[0],
      to: effectiveEnd.toISOString().split("T")[0],
    });
    chunkStart = new Date(effectiveEnd);
    chunkStart.setDate(chunkStart.getDate() + 1);
  }

  const [responses, tvMap] = await Promise.all([
    Promise.all(
      chunks.map((c) =>
        apiFetch<FootballDataMatchesResponse>(
          `/matches?dateFrom=${c.from}&dateTo=${c.to}`
        )
      )
    ),
    scrapeTvChannels(dateFrom),
  ]);

  const allRawMatches = responses.flatMap((r) => r.matches);
  const matches = allRawMatches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map((m) => mapMatch(m, tvMap));

  // No goal enrichment for date ranges (too many API calls)
  cache.set(cacheKey, matches, FUTURE_MATCHES_TTL);
  return matches;
}

async function getLiveMatches(): Promise<Match[]> {
  const cacheKey = "matches:live";
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const today = new Date().toISOString().split("T")[0];
  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?date=${today}`
  );

  const tvMap = await scrapeTvChannels(today);

  const rawFiltered = response.matches.filter(
    (m) =>
      FREE_COMPETITION_IDS.includes(m.competition.id) &&
      (m.status === "IN_PLAY" || m.status === "PAUSED")
  );

  let matches = rawFiltered.map((m) => mapMatch(m, tvMap));
  matches = await enrichWithGoals(matches, rawFiltered);

  cache.set(cacheKey, matches, LIVE_MATCHES_TTL);
  return matches;
}

export const footballDataProvider: FootballProvider = {
  getMatchesByDate,
  getMatchesByDateRange,
  getLiveMatches,
};

export async function getCompetitions(): Promise<Competition[]> {
  const cacheKey = "competitions";
  const cached = cache.get<Competition[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<{
    competitions: Array<Competition & { id: number }>;
  }>("/competitions");

  const competitions = response.competitions
    .filter((c) => FREE_COMPETITION_IDS.includes(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      emblem: c.emblem,
    }));

  cache.set(cacheKey, competitions, COMPETITIONS_TTL);
  return competitions;
}
