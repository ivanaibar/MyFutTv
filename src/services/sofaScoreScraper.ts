import { cache } from "./cache";

export interface SofaScoreMatch {
  sofaId: number;
  minute: number; // elapsed minutes; 0 if not started
  homeScore: number;
  awayScore: number;
  status: string; // "inprogress" | "finished" | "notstarted" | "postponed" | "canceled"
  isHalftime: boolean;
}

const SOFA_LIVE_TTL = 50 * 1000; // 50s for live data
const SOFA_OTHER_TTL = 60 * 60 * 1000; // 1h for other dates

/**
 * Fetches all football events for a date from SofaScore's public API.
 * Returns a map of normalize(home)::normalize(away) → SofaScoreMatch.
 * Returns empty map on any error (graceful degradation).
 */
export async function getSofaScoreMatches(
  date: string
): Promise<Map<string, SofaScoreMatch>> {
  const cacheKey = `sofascore:${date}`;
  const cached = cache.get<Map<string, SofaScoreMatch>>(cacheKey);
  if (cached) return cached;

  const map = new Map<string, SofaScoreMatch>();

  try {
    const res = await fetch(
      `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${date}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.sofascore.com/",
          Accept: "application/json, text/plain, */*",
        },
      }
    );

    if (!res.ok) {
      console.warn(`[sofascore] HTTP ${res.status}`);
      cache.set(cacheKey, map, SOFA_OTHER_TTL);
      return map;
    }

    const json = (await res.json()) as { events?: SofaRawEvent[] };
    const events = json.events ?? [];

    const nowSeconds = Date.now() / 1000;

    for (const event of events) {
      const homeTeam = event.homeTeam?.name ?? "";
      const awayTeam = event.awayTeam?.name ?? "";
      if (!homeTeam || !awayTeam) continue;

      const key = makeMatchKey(homeTeam, awayTeam);
      const statusType = event.status?.type ?? "notstarted";
      const statusCode = event.status?.code ?? 0;
      const isLive = statusType === "inprogress";
      // Halftime = status code 31
      const isHalftime = statusCode === 31;

      let minute = 0;
      if (isLive && !isHalftime && event.time?.currentPeriodStartTimestamp) {
        const initial = event.time.initial ?? 0; // seconds into the period at kickoff
        const elapsed = nowSeconds - event.time.currentPeriodStartTimestamp;
        const rawMinute =
          Math.floor(elapsed / 60) + Math.floor(initial / 60);
        // Cap to the max period duration (max is in seconds: 2700=45min, 5400=90min)
        const maxMinute = event.time.max
          ? Math.floor(event.time.max / 60)
          : rawMinute;
        minute = Math.min(rawMinute, maxMinute);
      } else if (isHalftime) {
        minute = 45;
      }

      map.set(key, {
        sofaId: event.id,
        minute,
        homeScore: event.homeScore?.current ?? 0,
        awayScore: event.awayScore?.current ?? 0,
        status: statusType,
        isHalftime,
      });
    }
  } catch (err) {
    console.error("[sofascore] Error:", err);
  }

  const isToday = date === new Date().toISOString().split("T")[0];
  cache.set(cacheKey, map, isToday ? SOFA_LIVE_TTL : SOFA_OTHER_TTL);
  return map;
}

// Raw types matching the actual SofaScore API response
interface SofaRawEvent {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  homeScore: { current: number };
  awayScore: { current: number };
  status: { code: number; type: string; description: string };
  time?: {
    currentPeriodStartTimestamp?: number;
    initial?: number; // seconds elapsed at period start (0 for 1st half, 2700 for 2nd half)
    max?: number; // total seconds for this period (2700 = 45min, 5400 = 90min)
    extra?: number;
    injuryTime1?: number;
    injuryTime2?: number;
  };
}

/**
 * Normalize team name for fuzzy matching.
 * Mirrors the same logic used in tvScraper.ts.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/\-]/g, " ")
    .replace(/\bfc\b/g, "")
    .replace(/\bcf\b/g, "")
    .replace(/\bsc\b/g, "")
    .replace(/\bafc\b/g, "")
    .replace(/\bfk\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeMatchKey(home: string, away: string): string {
  return `${normalize(home)}::${normalize(away)}`;
}

/**
 * Fuzzy lookup: tries exact key first, then partial containment.
 */
export function findSofaMatch(
  map: Map<string, SofaScoreMatch>,
  homeTeam: string,
  awayTeam: string
): SofaScoreMatch | undefined {
  const key = makeMatchKey(homeTeam, awayTeam);
  if (map.has(key)) return map.get(key);

  const nHome = normalize(homeTeam);
  const nAway = normalize(awayTeam);

  for (const [k, v] of map) {
    const [mHome, mAway] = k.split("::");
    if (
      (mHome.includes(nHome) || nHome.includes(mHome)) &&
      (mAway.includes(nAway) || nAway.includes(mAway))
    ) {
      return v;
    }
  }

  return undefined;
}
