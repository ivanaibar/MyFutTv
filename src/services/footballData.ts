import { cache } from "./cache";
import { getChannelForCompetition } from "./channels";
import { FREE_COMPETITION_IDS } from "@/lib/constants";
import type {
  Match,
  FootballDataMatchesResponse,
  FootballDataMatch,
  Competition,
} from "@/types";

const API_BASE = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

const FUTURE_MATCHES_TTL = 60 * 60 * 1000;
const LIVE_MATCHES_TTL = 50 * 1000;
const COMPETITIONS_TTL = 24 * 60 * 60 * 1000;

async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function mapMatch(raw: FootballDataMatch): Match {
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
    channel: getChannelForCompetition(raw.competition.id),
  };
}

export async function getMatchesByDate(date: string): Promise<Match[]> {
  const cacheKey = `matches:${date}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?date=${date}`
  );

  const matches = response.matches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map(mapMatch);

  const hasLive = matches.some((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
  cache.set(cacheKey, matches, hasLive ? LIVE_MATCHES_TTL : FUTURE_MATCHES_TTL);

  return matches;
}

export async function getMatchesByDateRange(
  dateFrom: string,
  dateTo: string
): Promise<Match[]> {
  const cacheKey = `matches:${dateFrom}:${dateTo}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
  );

  const matches = response.matches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map(mapMatch);

  cache.set(cacheKey, matches, FUTURE_MATCHES_TTL);
  return matches;
}

export async function getLiveMatches(): Promise<Match[]> {
  const cacheKey = "matches:live";
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?status=LIVE`
  );

  const matches = response.matches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map(mapMatch);

  cache.set(cacheKey, matches, LIVE_MATCHES_TTL);
  return matches;
}

export async function getCompetitions(): Promise<Competition[]> {
  const cacheKey = "competitions";
  const cached = cache.get<Competition[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<{ competitions: Array<Competition & { id: number }> }>(
    "/competitions"
  );

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
