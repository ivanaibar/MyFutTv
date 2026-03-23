import { parse } from "node-html-parser";
import { cache } from "./cache";

interface ScrapedMatch {
  homeTeam: string;
  awayTeam: string;
  time: string;
  channels: string[];
}

const TV_SCRAPE_TTL = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Scrapes fichajes.com for TV channel info per match.
 * Returns a map of "normalizedHome vs normalizedAway" → channel string.
 */
export async function scrapeTvChannels(
  date: string
): Promise<Map<string, string>> {
  const cacheKey = `tv:${date}`;
  const cached = cache.get<Map<string, string>>(cacheKey);
  if (cached) {
    console.log(JSON.stringify({ level: "info", msg: "scraper_cache_hit", date }));
    return cached;
  }

  const channelMap = new Map<string, string>();
  const start = Date.now();

  try {
    const res = await fetch("https://www.fichajes.com/futbol-tele/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        Referer: "https://www.google.es/",
      },
    });

    if (!res.ok) {
      console.error(JSON.stringify({ level: "error", msg: "scraper_http_error", scraper: "fichajes", status: res.status, ms: Date.now() - start }));
      return channelMap;
    }

    const html = await res.text();
    const matches = parseMatchesFromHtml(html);

    let found = 0;
    for (const match of matches) {
      if (match.channels.length > 0) {
        const key = makeMatchKey(match.homeTeam, match.awayTeam);
        channelMap.set(key, match.channels.join(" / "));
        found++;
      }
    }

    console.log(JSON.stringify({ level: "info", msg: "scraper_done", scraper: "fichajes", date, total: matches.length, with_channels: found, ms: Date.now() - start }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "scraper_failed", scraper: "fichajes", date, error: error instanceof Error ? error.message : String(error), ms: Date.now() - start }));
  }

  cache.set(cacheKey, channelMap, TV_SCRAPE_TTL);
  return channelMap;
}

function parseMatchesFromHtml(html: string): ScrapedMatch[] {
  const root = parse(html);
  const matches: ScrapedMatch[] = [];

  const matchLinks = root.querySelectorAll('a[href^="/directo/"]');

  for (const link of matchLinks) {
    // Team names from dedicated span
    const teamSpans = link.querySelectorAll("span.matchTeam__name");
    const homeTeam = teamSpans[0]?.text.trim() ?? "";
    const awayTeam = teamSpans[1]?.text.trim() ?? "";

    // Channels from broadcast images inside the broadcasts container
    const channelImgs = link.querySelectorAll("span.matchFull__broadcasts img");
    const channels = channelImgs
      .map((img) => (img.getAttribute("alt") ?? "").replace(/^Logo\s+/, "").trim())
      .filter(Boolean);

    // Extract time (HH:MM pattern) from text
    const allText = link.text.trim();
    const timeMatch = allText.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : "";

    if (homeTeam && awayTeam) {
      matches.push({ homeTeam, awayTeam, time, channels });
    }
  }

  return matches;
}

/**
 * Normalize team name for fuzzy matching between football-data.org and fichajes.com.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o") // handle Nordic ø before NFD
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove combining diacritical marks
    .replace(/[\/\-]/g, " ") // replace / and - with space
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
 * Look up the TV channel for a specific match.
 * Tries multiple matching strategies (exact normalized, partial).
 */
export function findChannel(
  tvMap: Map<string, string>,
  homeTeam: string,
  awayTeam: string
): string | undefined {
  // Strategy 1: exact normalized match
  const key = makeMatchKey(homeTeam, awayTeam);
  if (tvMap.has(key)) return tvMap.get(key);

  // Strategy 2: partial match (one team name contains the other)
  const normHome = normalize(homeTeam);
  const normAway = normalize(awayTeam);

  for (const [mapKey, channel] of tvMap) {
    const [mapHome, mapAway] = mapKey.split("::");
    if (
      (mapHome.includes(normHome) || normHome.includes(mapHome)) &&
      (mapAway.includes(normAway) || normAway.includes(mapAway))
    ) {
      return channel;
    }
  }

  // Strategy 3: try with significant words (>3 chars) from team names
  const homeWords = normHome.split(" ").filter((w) => w.length > 3);
  const awayWords = normAway.split(" ").filter((w) => w.length > 3);

  for (const [mapKey, channel] of tvMap) {
    const [mapHome, mapAway] = mapKey.split("::");
    const homeMatch = homeWords.some((w) => mapHome.includes(w));
    const awayMatch = awayWords.some((w) => mapAway.includes(w));
    if (homeMatch && awayMatch) {
      return channel;
    }
  }

  // Strategy 4: match if ANY significant word from one side matches
  // (handles cases like "Sporting Clube de Portugal" vs "Sporting de Lisboa")
  for (const [mapKey, channel] of tvMap) {
    const [mapHome, mapAway] = mapKey.split("::");
    const mapHomeWords = mapHome.split(" ").filter((w) => w.length > 3);
    const mapAwayWords = mapAway.split(" ").filter((w) => w.length > 3);

    const homeMatch =
      homeWords.some((w) => mapHomeWords.some((mw) => mw === w)) ||
      mapHomeWords.some((w) => homeWords.some((hw) => hw === w));
    const awayMatch =
      awayWords.some((w) => mapAwayWords.some((mw) => mw === w)) ||
      mapAwayWords.some((w) => awayWords.some((hw) => hw === w));

    if (homeMatch && awayMatch) {
      return channel;
    }
  }

  return undefined;
}
