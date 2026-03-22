import { parse } from "node-html-parser";
import { cache } from "./cache";

const TV_SCRAPE_TTL = 2 * 60 * 60 * 1000; // 2 hours

const AS_TV_URL = "https://as.com/futbol/television/";

/**
 * Scrapes as.com/futbol/television/ for TV channel info per match.
 * Returns a map of "normalizedHome::normalizedAway" → channel string.
 *
 * NOTE: as.com uses DataDome bot protection and the /futbol/television/ path
 * currently returns a 404. Fetch attempts from a server-side Node.js context
 * are blocked. This scraper returns an empty map and logs a warning when the
 * page is unavailable. The caller (Task 4 merge logic) is designed to handle
 * an empty secondary map gracefully.
 */
export async function scrapeTvChannelsAs(
  date: string
): Promise<Map<string, string>> {
  const cacheKey = `tv:as:${date}`;
  const cached = cache.get<Map<string, string>>(cacheKey);
  if (cached) return cached;

  const channelMap = new Map<string, string>();

  try {
    const res = await fetch(AS_TV_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });

    if (!res.ok) {
      console.warn(
        `[tvScraperAs] as.com returned HTTP ${res.status} — ` +
          `the page may be protected by DataDome bot detection or the URL has changed. ` +
          `Returning empty channel map.`
      );
      cache.set(cacheKey, channelMap, TV_SCRAPE_TTL);
      return channelMap;
    }

    const html = await res.text();
    const matches = parseMatchesFromHtml(html);

    if (matches.length === 0) {
      console.warn(
        `[tvScraperAs] Fetched as.com successfully but found no parseable match data. ` +
          `The page structure may have changed. Returning empty channel map.`
      );
    }

    for (const match of matches) {
      if (match.channels.length > 0) {
        const key = makeMatchKey(match.homeTeam, match.awayTeam);
        channelMap.set(key, match.channels.join(" / "));
      }
    }
  } catch (error) {
    console.error("[tvScraperAs] Fetch error:", error);
  }

  cache.set(cacheKey, channelMap, TV_SCRAPE_TTL);
  return channelMap;
}

interface ScrapedMatch {
  homeTeam: string;
  awayTeam: string;
  channels: string[];
}

function parseMatchesFromHtml(html: string): ScrapedMatch[] {
  const root = parse(html);
  const matches: ScrapedMatch[] = [];

  // as.com structures TV listings in elements with class names containing
  // "partido" or "match". Team names appear in <span> or <p> elements,
  // channel names in similar inline elements.
  // Selector candidates observed in the wild:
  //   .partido-item, .tv-item, .match-item, article[class*="partido"]
  const candidates = [
    ...root.querySelectorAll("[class*='partido']"),
    ...root.querySelectorAll("[class*='match']"),
    ...root.querySelectorAll("[class*='tv-item']"),
    ...root.querySelectorAll("[class*='game']"),
  ];

  // Deduplicate by raw text content to avoid double-counting nested elements
  const seen = new Set<string>();

  for (const el of candidates) {
    const text = el.textContent.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);

    // Look for "TeamA - TeamB" or "TeamA vs TeamB" pattern
    const vsMatch =
      text.match(/([A-Za-zÀ-ÿ\s\.]+?)\s+[-–]\s+([A-Za-zÀ-ÿ\s\.]+?)(?:\s|$)/) ||
      text.match(/([A-Za-zÀ-ÿ\s\.]+?)\s+vs\.?\s+([A-Za-zÀ-ÿ\s\.]+?)(?:\s|$)/i);

    if (!vsMatch) continue;

    const homeTeam = vsMatch[1].trim();
    const awayTeam = vsMatch[2].trim();

    if (!homeTeam || !awayTeam) continue;

    // Channel names — as.com typically lists them after the match info
    // Look for known Spanish channel name patterns in the same element
    const channels = extractChannels(text);

    matches.push({ homeTeam, awayTeam, channels });
  }

  return matches;
}

const KNOWN_CHANNELS = [
  "DAZN",
  "Movistar",
  "LaLiga TV",
  "beIN Sports",
  "Gol",
  "Cuatro",
  "Telecinco",
  "La 1",
  "TVE",
  "ESPN",
  "TNT",
  "Prime Video",
  "Disney+",
  "Paramount+",
  "Sky",
  "BT Sport",
  "Canal+",
];

function extractChannels(text: string): string[] {
  const channels: string[] = [];
  for (const ch of KNOWN_CHANNELS) {
    if (text.toLowerCase().includes(ch.toLowerCase())) {
      channels.push(ch);
    }
  }
  return channels;
}

/**
 * Normalize team name for fuzzy matching between football-data.org and as.com.
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
