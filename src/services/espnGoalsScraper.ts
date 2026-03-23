import { cache } from "./cache";
import type { Goal, Match } from "@/types";

// football-data.org competition ID → ESPN league slug
const ESPN_SLUG: Record<number, string> = {
  2014: "esp.1",       // La Liga
  2021: "eng.1",       // Premier League
  2002: "ger.1",       // Bundesliga
  2015: "fra.1",       // Ligue 1
  2019: "ita.1",       // Serie A
  2001: "uefa.champions", // UEFA Champions League
  2003: "ned.1",       // Eredivisie
  2017: "por.1",       // Primeira Liga
  2016: "eng.2",       // Championship
  2013: "bra.1",       // Brasileirao
};

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const GOALS_TTL = 60 * 60 * 1000; // 1h — finished match data
const LIVE_TTL = 50 * 1000;        // 50s — live match data

interface EspnDetail {
  type?: { text?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  scoringPlay?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  athletesInvolved?: Array<{ displayName?: string; team?: { id?: string } }>;
}

interface EspnCompetitor {
  id?: string;
  score?: string;
  homeAway?: string;
  team?: { id?: string; displayName?: string };
}

interface EspnCompetition {
  competitors?: EspnCompetitor[];
  details?: EspnDetail[];
  status?: { type?: { completed?: boolean; state?: string } };
}

interface EspnEvent {
  name?: string;
  competitions?: EspnCompetition[];
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[/\-]/g, " ")
    .replace(/\bfc\b|\bcf\b|\bsc\b|\bafc\b|\bfk\b|\bac\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeKey(home: string, away: string): string {
  return `${normalize(home)}::${normalize(away)}`;
}

function parseMinute(display: string | undefined): number {
  if (!display) return 0;
  // Handle "45+3'" (added time) → 45 + 3 = 48
  const plusMatch = display.match(/(\d+)\+(\d+)/);
  if (plusMatch) return parseInt(plusMatch[1], 10) + parseInt(plusMatch[2], 10);
  return parseInt(display.replace(/[^0-9]/g, ""), 10) || 0;
}

function extractGoals(comp: EspnCompetition): Goal[] {
  const details = comp.details ?? [];
  const homeCompetitor = comp.competitors?.find((c) => c.homeAway === "home");
  const homeTeamId = homeCompetitor?.team?.id ?? homeCompetitor?.id;

  return details
    .filter((d) => d.scoringPlay === true)
    .map((d): Goal => {
      const athlete = d.athletesInvolved?.[0];
      const scorer = athlete?.displayName ?? "Desconocido";
      const minute = parseMinute(d.clock?.displayValue);
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

/**
 * Fetches all scoring details from ESPN for a given date and set of competition IDs.
 * Returns a Map keyed by normalize(home)::normalize(away) → Goal[].
 * Calls one ESPN endpoint per competition (in parallel). Gracefully degrades per league.
 */
export async function getEspnGoals(
  date: string,
  competitionIds: number[]
): Promise<Map<string, Goal[]>> {
  const cacheKey = `espn:goals:${date}`;
  const cached = cache.get<Map<string, Goal[]>>(cacheKey);
  if (cached) return cached;

  const map = new Map<string, Goal[]>();
  const espnDate = date.replace(/-/g, ""); // YYYYMMDD

  // Determine unique ESPN slugs for the competitions in play
  const slugs = [...new Set(
    competitionIds
      .map((id) => ESPN_SLUG[id])
      .filter((s): s is string => !!s)
  )];

  if (slugs.length === 0) {
    cache.set(cacheKey, map, GOALS_TTL);
    return map;
  }

  const results = await Promise.allSettled(
    slugs.map((slug) =>
      fetch(`${ESPN_BASE}/${slug}/scoreboard?dates=${espnDate}&limit=50`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`ESPN ${r.status}`))))
        .then((json: { events?: EspnEvent[] }) => json.events ?? [])
    )
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[espn:goals] Fetch error:", result.reason);
      continue;
    }

    for (const event of result.value) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const competitors = comp.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home")?.team?.displayName ?? "";
      const away = competitors.find((c) => c.homeAway === "away")?.team?.displayName ?? "";
      if (!home || !away) continue;

      const goals = extractGoals(comp);
      if (goals.length > 0) {
        map.set(makeKey(home, away), goals);
      }
    }
  }

  const isToday = date === new Date().toISOString().split("T")[0];
  cache.set(cacheKey, map, isToday ? LIVE_TTL : GOALS_TTL);
  return map;
}

const ENRICHABLE_STATUSES = new Set(["FINISHED", "IN_PLAY", "PAUSED"]);

/**
 * Enriches matches with goal scorer data from ESPN.
 * Falls back gracefully — matches without ESPN data are returned unchanged.
 */
export async function enrichWithEspnGoals(matches: Match[]): Promise<Match[]> {
  const enrichable = matches.filter((m) => ENRICHABLE_STATUSES.has(m.status));
  if (enrichable.length === 0) return matches;

  // Collect the date from the first enrichable match
  const date = enrichable[0].utcDate.split("T")[0];
  const competitionIds = [...new Set(enrichable.map((m) => m.competition.id))];

  const goalsMap = await getEspnGoals(date, competitionIds);
  if (goalsMap.size === 0) return matches;

  const enriched = [...matches];

  for (const match of enrichable) {
    const key = makeKey(match.homeTeam.name, match.awayTeam.name);
    let goals = goalsMap.get(key);

    // Fuzzy fallback: partial name containment or shared keywords
    if (!goals) {
      const nHome = normalize(match.homeTeam.name);
      const nAway = normalize(match.awayTeam.name);
      const homeWords = nHome.split(" ").filter((w) => w.length > 3);
      const awayWords = nAway.split(" ").filter((w) => w.length > 3);
      for (const [k, v] of goalsMap) {
        const [mHome, mAway] = k.split("::");
        const mHomeWords = mHome.split(" ").filter((w) => w.length > 3);
        const mAwayWords = mAway.split(" ").filter((w) => w.length > 3);
        const homeMatch =
          mHome.includes(nHome) ||
          nHome.includes(mHome) ||
          (homeWords.length > 0 && homeWords.every((w) => mHome.includes(w))) ||
          (mHomeWords.length > 0 && mHomeWords.every((w) => nHome.includes(w)));
        const awayMatch =
          mAway.includes(nAway) ||
          nAway.includes(mAway) ||
          (awayWords.length > 0 && awayWords.every((w) => mAway.includes(w))) ||
          (mAwayWords.length > 0 && mAwayWords.every((w) => nAway.includes(w)));
        if (homeMatch && awayMatch) {
          goals = v;
          break;
        }
      }
    }

    if (!goals || goals.length === 0) continue;

    const idx = enriched.findIndex((m) => m.id === match.id);
    if (idx !== -1) enriched[idx] = { ...enriched[idx], goals };
  }

  return enriched;
}
