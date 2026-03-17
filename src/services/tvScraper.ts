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
  if (cached) return cached;

  const channelMap = new Map<string, string>();

  try {
    const res = await fetch("https://www.fichajes.com/futbol-tele/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      console.error(`TV scraper: HTTP ${res.status}`);
      return channelMap;
    }

    const html = await res.text();
    const matches = parseMatchesFromHtml(html);

    for (const match of matches) {
      if (match.channels.length > 0) {
        const key = makeMatchKey(match.homeTeam, match.awayTeam);
        channelMap.set(key, match.channels.join(" / "));
      }
    }
  } catch (error) {
    console.error("TV scraper error:", error);
  }

  cache.set(cacheKey, channelMap, TV_SCRAPE_TTL);
  return channelMap;
}

function parseMatchesFromHtml(html: string): ScrapedMatch[] {
  const root = parse(html);
  const matches: ScrapedMatch[] = [];

  // Match entries are <a> tags with href starting with /directo/
  const matchLinks = root.querySelectorAll('a[href^="/directo/"]');

  for (const link of matchLinks) {
    const imgs = link.querySelectorAll("img");
    const allText = link.textContent.trim();

    // Extract team names and channels from img alt attributes
    const teamLogos: string[] = [];
    const channelNames: string[] = [];

    for (const img of imgs) {
      const alt = img.getAttribute("alt") || "";

      if (alt.startsWith("Logo ")) {
        // Could be a team logo or a competition logo
        const name = alt.replace("Logo ", "");
        // Competition logos typically have keywords like "Champions", "LaLiga", "UEFA", etc.
        if (!isCompetitionName(name)) {
          teamLogos.push(name);
        }
      } else if (alt && !alt.startsWith("Logo ")) {
        // Channel name (not prefixed with "Logo ")
        channelNames.push(alt);
      }
    }

    // Extract time (HH:MM pattern) from text
    const timeMatch = allText.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : "";

    if (teamLogos.length >= 2) {
      matches.push({
        homeTeam: teamLogos[0],
        awayTeam: teamLogos[1],
        time,
        channels: channelNames,
      });
    }
  }

  return matches;
}

const COMPETITION_KEYWORDS = [
  "champions",
  "laliga",
  "la liga",
  "premier",
  "bundesliga",
  "serie a",
  "ligue 1",
  "uefa",
  "europa league",
  "conference",
  "copa del rey",
  "eredivisie",
  "world cup",
  "eurocopa",
  "championship",
];

function isCompetitionName(name: string): boolean {
  const lower = name.toLowerCase();
  return COMPETITION_KEYWORDS.some((kw) => lower.includes(kw));
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
