import { cache } from "../cache";
import { scrapeTvChannels, findChannel } from "../tvScraper";
import { FREE_COMPETITION_IDS } from "@/lib/constants";
import { getSofaScoreMatches, findSofaMatch } from "../sofaScoreScraper";
import { enrichWithEspnGoals } from "../espnGoalsScraper";
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
): string | undefined {
  if (fichajes) return fichajes;
  if (marca?.channel) return marca.channel;
  return undefined;
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

  if (sofaMin >= fdMin) {
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
  const channel = mergeChannel(fichajesChannel, marcaEntry);

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
  matches = await enrichWithEspnGoals(matches);

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
  matches = await enrichWithEspnGoals(matches);

  cache.set(cacheKey, matches, LIVE_MATCHES_TTL);
  return matches;
}

export const footballDataProvider: FootballProvider = {
  getMatchesByDate,
  getMatchesByDateRange,
  getLiveMatches,
};

// Static fallback — used when football-data.org is rate-limited or unavailable.
// Covers all FREE_COMPETITION_IDS. Emblems are empty (gracefully handled by UI).
const STATIC_COMPETITIONS: Competition[] = [
  { id: 2014, name: "La Liga",                  code: "PD",  emblem: "" },
  { id: 2001, name: "UEFA Champions League",     code: "CL",  emblem: "" },
  { id: 2021, name: "Premier League",            code: "PL",  emblem: "" },
  { id: 2002, name: "Bundesliga",                code: "BL1", emblem: "" },
  { id: 2015, name: "Ligue 1",                   code: "FL1", emblem: "" },
  { id: 2019, name: "Serie A",                   code: "SA",  emblem: "" },
  { id: 2003, name: "Eredivisie",                code: "DED", emblem: "" },
  { id: 2017, name: "Primeira Liga",             code: "PPL", emblem: "" },
  { id: 2016, name: "EFL Championship",          code: "ELC", emblem: "" },
  { id: 2013, name: "Brasileirão Série A",       code: "BSA", emblem: "" },
  { id: 2000, name: "FIFA World Cup",            code: "WC",  emblem: "" },
  { id: 2018, name: "European Championship",     code: "EC",  emblem: "" },
];

export async function getCompetitions(): Promise<Competition[]> {
  const cacheKey = "competitions";
  const cached = cache.get<Competition[]>(cacheKey);
  if (cached) return cached;

  try {
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
  } catch (err) {
    // Rate-limited or unreachable — serve static fallback and retry in 5 minutes
    console.warn(JSON.stringify({ level: "warn", msg: "competitions_fallback", error: err instanceof Error ? err.message : String(err) }));
    cache.set(cacheKey, STATIC_COMPETITIONS, 5 * 60 * 1000);
    return STATIC_COMPETITIONS;
  }
}
