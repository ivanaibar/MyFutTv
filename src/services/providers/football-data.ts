import { cache } from "../cache";
import { getChannelForCompetition } from "../channels";
import { scrapeTvChannels, findChannel } from "../tvScraper";
import { FREE_COMPETITION_IDS } from "@/lib/constants";
import { enrichWithApiFootballGoals } from "./api-football";
import { getSofaScoreMatches, findSofaMatch } from "../sofaScoreScraper";
import { getMarcaMatches, findMarcaMatch } from "../marcaScraper";
import type {
  Match,
  Competition,
  FootballDataMatchesResponse,
  FootballDataMatch,
} from "@/types";
import type { FootballProvider } from "./types";
import type { SofaScoreMatch } from "../sofaScoreScraper";
import type { MarcaMatch } from "../marcaScraper";

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

function mergeChannel(
  fichajes: string | undefined,
  marca: MarcaMatch | undefined,
  competitionId: number
): string | undefined {
  if (fichajes) return fichajes;
  if (marca?.channel) return marca.channel;
  return getChannelForCompetition(competitionId);
}

interface ScoreOverride {
  home: number;
  away: number;
}

function pickFresherScore(
  fdMinute: number | undefined,
  sofa: SofaScoreMatch | undefined
): ScoreOverride | undefined {
  if (!sofa) return undefined;
  if (sofa.status !== "inprogress" && sofa.status !== "finished") return undefined;

  const fdMin = fdMinute ?? 0;
  const sofaMin = sofa.minute ?? 0;

  if (sofaMin > fdMin) {
    return { home: sofa.homeScore, away: sofa.awayScore };
  }

  return undefined;
}

function mapMatch(
  raw: FootballDataMatch,
  tvMap?: Map<string, string>,
  marcaMap?: Map<string, MarcaMatch>,
  scoreOverride?: ScoreOverride
): Match {
  const fichajesChannel = tvMap
    ? findChannel(tvMap, raw.homeTeam.name, raw.awayTeam.name)
    : undefined;
  const marcaEntry = marcaMap
    ? findMarcaMatch(marcaMap, raw.homeTeam.name, raw.awayTeam.name)
    : undefined;
  const channel = mergeChannel(fichajesChannel, marcaEntry, raw.competition.id);

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
      fullTime: scoreOverride
        ? { home: scoreOverride.home, away: scoreOverride.away }
        : raw.score.fullTime,
      halfTime: raw.score.halfTime,
    },
    minute: raw.minute,
    channel,
  };
}


async function getMatchesByDate(date: string): Promise<Match[]> {
  const cacheKey = `matches:${date}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const [response, tvMap, sofaMap, marcaMap] = await Promise.all([
    apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
    scrapeTvChannels(date),
    getSofaScoreMatches(date),
    getMarcaMatches(date),
  ]);

  const rawFiltered = response.matches.filter((m) =>
    FREE_COMPETITION_IDS.includes(m.competition.id)
  );

  let matches = rawFiltered.map((m) => {
    const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
    const sofa = isLive
      ? findSofaMatch(sofaMap, m.homeTeam.name, m.awayTeam.name)
      : undefined;
    const override = pickFresherScore(m.minute ?? undefined, sofa);
    return mapMatch(m, tvMap, marcaMap, override);
  });
  matches = await enrichWithApiFootballGoals(matches, date);

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
  const [response, tvMap, sofaMap, marcaMap] = await Promise.all([
    apiFetch<FootballDataMatchesResponse>(`/matches?date=${today}`),
    scrapeTvChannels(today),
    getSofaScoreMatches(today),
    getMarcaMatches(today),
  ]);

  const rawFiltered = response.matches.filter(
    (m) =>
      FREE_COMPETITION_IDS.includes(m.competition.id) &&
      (m.status === "IN_PLAY" || m.status === "PAUSED")
  );

  let matches = rawFiltered.map((m) => {
    const sofa = findSofaMatch(sofaMap, m.homeTeam.name, m.awayTeam.name);
    const override = pickFresherScore(m.minute ?? undefined, sofa);
    return mapMatch(m, tvMap, marcaMap, override);
  });
  matches = await enrichWithApiFootballGoals(matches, today);

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
