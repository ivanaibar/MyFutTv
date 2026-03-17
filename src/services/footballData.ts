import { cache } from "./cache";
import { getChannelForCompetition } from "./channels";
import { scrapeTvChannels, findChannel } from "./tvScraper";
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

function mapMatch(
  raw: FootballDataMatch,
  tvMap?: Map<string, string>
): Match {
  // Try scraped channel first, fall back to static mapping
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

export async function getMatchesByDate(date: string): Promise<Match[]> {
  const cacheKey = `matches:${date}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  // Fetch matches and TV channels in parallel
  const [response, tvMap] = await Promise.all([
    apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
    scrapeTvChannels(date),
  ]);

  const matches = response.matches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map((m) => mapMatch(m, tvMap));

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

  cache.set(cacheKey, matches, FUTURE_MATCHES_TTL);
  return matches;
}

export async function getLiveMatches(): Promise<Match[]> {
  const cacheKey = "matches:live";
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  // Fetch today's matches and filter for live ones
  // (the ?status=LIVE filter is not available on the free tier)
  const today = new Date().toISOString().split("T")[0];
  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?date=${today}`
  );

  const tvMap = await scrapeTvChannels(today);

  const matches = response.matches
    .filter(
      (m) =>
        FREE_COMPETITION_IDS.includes(m.competition.id) &&
        (m.status === "IN_PLAY" || m.status === "PAUSED")
    )
    .map((m) => mapMatch(m, tvMap));

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
