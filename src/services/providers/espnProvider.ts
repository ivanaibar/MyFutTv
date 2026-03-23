import { cache } from "../cache";
import { scrapeTvChannels, findChannel } from "../tvScraper";
import type { Match, MatchStatus, Team, Competition, Goal } from "@/types";
import type { FootballProvider } from "./types";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const LIVE_TTL = 50 * 1000;
const MATCHES_TTL = 60 * 60 * 1000;

// Custom competition IDs (not in football-data.org, non-conflicting range)
const ESPN_SLUG_CONFIG: Record<string, { id: number; name: string; code: string }> = {
  "esp.copa_del_rey": { id: 5001, name: "Copa del Rey", code: "CDR" },
  "esp.2": { id: 5002, name: "Segunda División", code: "SD2" },
  "fifa.friendly": { id: 5003, name: "Amistosos", code: "AMI" },
};

// ─── ESPN API types ────────────────────────────────────────────────────────────

interface EspnTeam {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logo?: string;
}

interface EspnCompetitor {
  homeAway?: "home" | "away";
  score?: string;
  team?: EspnTeam;
}

interface EspnDetail {
  scoringPlay?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  clock?: { displayValue?: string };
  team?: { id?: string };
  athletesInvolved?: Array<{ displayName?: string; team?: { id?: string } }>;
}

interface EspnCompetition {
  competitors?: EspnCompetitor[];
  details?: EspnDetail[];
  status?: {
    type?: { name?: string; state?: string; completed?: boolean };
    period?: number;
    displayClock?: string;
  };
}

interface EspnEvent {
  id?: string;
  date?: string;
  competitions?: EspnCompetition[];
}

interface EspnLeague {
  slug?: string;
  logos?: Array<{ href?: string }>;
}

interface EspnScoreboard {
  events?: EspnEvent[];
  leagues?: EspnLeague[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mapStatus(
  state: string,
  statusName: string,
  isHalftime: boolean
): MatchStatus {
  if (state === "post") return "FINISHED";
  if (state === "in") return isHalftime ? "PAUSED" : "IN_PLAY";
  if (statusName.includes("POSTPONED")) return "POSTPONED";
  if (statusName.includes("CANCELED") || statusName.includes("CANCELLED"))
    return "CANCELLED";
  return "SCHEDULED";
}

function parseClockMinute(clock: string | undefined): number | null {
  if (!clock) return null;
  // "45+2:00" → 47
  const addedMatch = clock.match(/(\d+)\+(\d+)/);
  if (addedMatch)
    return parseInt(addedMatch[1], 10) + parseInt(addedMatch[2], 10);
  // "87:23" → 87
  const m = clock.match(/^(\d+):/);
  return m ? parseInt(m[1], 10) : null;
}

function parseGoalMinute(display: string | undefined): number {
  if (!display) return 0;
  const addedMatch = display.match(/(\d+)\+(\d+)/);
  if (addedMatch)
    return parseInt(addedMatch[1], 10) + parseInt(addedMatch[2], 10);
  return parseInt(display.replace(/[^0-9]/g, ""), 10) || 0;
}

function extractGoals(comp: EspnCompetition): Goal[] {
  const details = comp.details ?? [];
  const homeComp = comp.competitors?.find((c) => c.homeAway === "home");
  const homeTeamId = homeComp?.team?.id;

  return details
    .filter((d) => d.scoringPlay === true)
    .map((d): Goal => {
      const athlete = d.athletesInvolved?.[0];
      const scorer = athlete?.displayName ?? "Desconocido";
      const minute = parseGoalMinute(d.clock?.displayValue);
      const isHome = (athlete?.team?.id ?? d.team?.id) === homeTeamId;
      const team: "home" | "away" = isHome ? "home" : "away";
      const type: Goal["type"] = d.ownGoal
        ? "OWN_GOAL"
        : d.penaltyKick
        ? "PENALTY"
        : "REGULAR";
      return { scorer, minute, team, type };
    });
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchEspnScoreboard(
  slug: string,
  date: string
): Promise<EspnScoreboard> {
  const espnDate = date.replace(/-/g, "");
  const res = await fetch(
    `${ESPN_BASE}/${slug}/scoreboard?dates=${espnDate}&limit=50`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }
  );
  if (!res.ok) throw new Error(`ESPN ${slug}: HTTP ${res.status}`);
  return res.json() as Promise<EspnScoreboard>;
}

// ─── Mapping ───────────────────────────────────────────────────────────────────

function mapEvent(
  event: EspnEvent,
  competition: Competition,
  tvMap: Map<string, string>
): Match | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const competitors = comp.competitors ?? [];
  const homeComp = competitors.find((c) => c.homeAway === "home");
  const awayComp = competitors.find((c) => c.homeAway === "away");
  if (!homeComp?.team?.displayName || !awayComp?.team?.displayName) return null;

  const status = comp.status;
  const state = status?.type?.state ?? "pre";
  const statusName = status?.type?.name ?? "";
  const isHalftime = statusName.includes("HALFTIME");
  const matchStatus = mapStatus(state, statusName, isHalftime);

  const minute: number | null = isHalftime
    ? 45
    : state === "in"
    ? parseClockMinute(status?.displayClock)
    : null;

  const homeTeam: Team = {
    id: parseInt(homeComp.team!.id ?? "0"),
    name: homeComp.team!.displayName!,
    shortName:
      homeComp.team!.shortDisplayName ?? homeComp.team!.displayName!,
    tla:
      homeComp.team!.abbreviation ??
      homeComp.team!.displayName!.slice(0, 3).toUpperCase(),
    crest: homeComp.team!.logo ?? "",
  };

  const awayTeam: Team = {
    id: parseInt(awayComp.team!.id ?? "0"),
    name: awayComp.team!.displayName!,
    shortName:
      awayComp.team!.shortDisplayName ?? awayComp.team!.displayName!,
    tla:
      awayComp.team!.abbreviation ??
      awayComp.team!.displayName!.slice(0, 3).toUpperCase(),
    crest: awayComp.team!.logo ?? "",
  };

  const homeScore =
    homeComp.score !== undefined ? parseInt(homeComp.score) : null;
  const awayScore =
    awayComp.score !== undefined ? parseInt(awayComp.score) : null;

  const channel = findChannel(tvMap, homeTeam.name, awayTeam.name);

  const goals = extractGoals(comp);

  // ESPN event IDs are 9-digit numbers (400000000+), safe from football-data.org collision
  const id = parseInt(event.id ?? "0");

  return {
    id,
    homeTeam,
    awayTeam,
    competition,
    utcDate: event.date ?? "",
    status: matchStatus,
    score: {
      fullTime: { home: homeScore, away: awayScore },
      halfTime: { home: null, away: null },
    },
    minute,
    channel,
    ...(goals.length > 0 ? { goals } : {}),
  };
}

// ─── Provider implementation ───────────────────────────────────────────────────

async function getMatchesByDate(date: string): Promise<Match[]> {
  const cacheKey = `espn-provider:${date}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const slugEntries = Object.entries(ESPN_SLUG_CONFIG);

  const [tvMap, ...scoreboardResults] = await Promise.all([
    scrapeTvChannels(date),
    ...slugEntries.map(([slug]) =>
      fetchEspnScoreboard(slug, date).catch((err) => {
        console.warn(`[espn-provider] ${slug}:`, err);
        return { events: [], leagues: [] } as EspnScoreboard;
      })
    ),
  ]);

  const matches: Match[] = [];

  for (let i = 0; i < slugEntries.length; i++) {
    const [slug, config] = slugEntries[i];
    const scoreboard = scoreboardResults[i] as EspnScoreboard;

    // Extract emblem from leagues array if available
    const leagueLogo =
      scoreboard.leagues?.find((l) => l.slug === slug)?.logos?.[0]?.href ?? "";

    const competition: Competition = {
      id: config.id,
      name: config.name,
      code: config.code,
      emblem: leagueLogo,
    };

    for (const event of scoreboard.events ?? []) {
      const match = mapEvent(event, competition, tvMap as Map<string, string>);
      if (match) matches.push(match);
    }
  }

  const hasLive = matches.some(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  );
  cache.set(cacheKey, matches, hasLive ? LIVE_TTL : MATCHES_TTL);
  return matches;
}

async function getMatchesByDateRange(
  dateFrom: string,
  dateTo: string
): Promise<Match[]> {
  const dates: string[] = [];
  const end = new Date(dateTo);
  for (
    const d = new Date(dateFrom);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    dates.push(d.toISOString().split("T")[0]);
  }

  const results = await Promise.allSettled(
    dates.map((d) => getMatchesByDate(d))
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<Match[]> => r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}

async function getLiveMatches(): Promise<Match[]> {
  const today = new Date().toISOString().split("T")[0];
  const matches = await getMatchesByDate(today);
  return matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  );
}

export const espnProvider: FootballProvider = {
  getMatchesByDate,
  getMatchesByDateRange,
  getLiveMatches,
};

// Competition IDs exported for use in constants.ts
export const ESPN_COMPETITION_IDS = Object.values(ESPN_SLUG_CONFIG).map(
  (c) => c.id
);

// Static competition list for the league filter (emblem resolved at runtime via ESPN leagues array)
export const ESPN_STATIC_COMPETITIONS: Competition[] = Object.values(
  ESPN_SLUG_CONFIG
).map((c) => ({ id: c.id, name: c.name, code: c.code, emblem: "" }));
