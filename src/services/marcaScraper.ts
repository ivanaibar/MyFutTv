import { parse } from "node-html-parser";
import { cache } from "./cache";

export interface MarcaMatch {
  channel?: string;
}

const MARCA_TTL = 2 * 60 * 60 * 1000; // 2h

/**
 * Scrapes Spanish TV channel info for today's football matches.
 * Source: marca.com/programacion-tv.html — a structured daily sports TV schedule.
 *
 * The page lists all sports events with CSS class `li.dailyevent`, each containing:
 *   - `span.dailyday`        → sport name (e.g. "Fútbol")
 *   - `h4.dailyteams`        → "Home Team - Away Team"
 *   - `span.dailychannel`    → TV channel (contains icon <i> then text)
 *
 * Returns map of normalize(home)::normalize(away) → MarcaMatch.
 * Returns empty map on any failure.
 */
export async function getMarcaMatches(
  date: string
): Promise<Map<string, MarcaMatch>> {
  const today = new Date().toISOString().split("T")[0];
  if (date !== today) {
    return new Map();
  }

  const cacheKey = `marca:${date}`;
  const cached = cache.get<Map<string, MarcaMatch>>(cacheKey);
  if (cached) return cached;

  const map = new Map<string, MarcaMatch>();

  try {
    const res = await fetch("https://www.marca.com/programacion-tv.html", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      console.warn(`[marca] HTTP ${res.status}`);
      cache.set(cacheKey, map, MARCA_TTL);
      return map;
    }

    const html = await res.text();
    parseMatchesFromHtml(html, map);
  } catch (err) {
    console.error("[marca] Error:", err);
  }

  cache.set(cacheKey, map, MARCA_TTL);
  return map;
}

function parseMatchesFromHtml(html: string, map: Map<string, MarcaMatch>): void {
  const root = parse(html);

  // Each sport event on the page is an `li.dailyevent`
  const matchRows = root.querySelectorAll("li.dailyevent");

  for (const row of matchRows) {
    // Only process football events — exact match to avoid "fútbol sala" / "fútbol americano"
    const sport = row.querySelector("span.dailyday")?.text?.trim() ?? "";
    if (!/^f[uú]tbol$/i.test(sport)) {
      continue;
    }

    // Team names are in "Home - Away" format inside h4.dailyteams
    const teamsText = row.querySelector("h4.dailyteams")?.text?.trim() ?? "";
    if (!teamsText) continue;

    // Split on " - " (with spaces) to separate home and away
    const dashIdx = teamsText.indexOf(" - ");
    if (dashIdx === -1) continue;

    const homeTeam = teamsText.slice(0, dashIdx).trim();
    const awayTeam = teamsText.slice(dashIdx + 3).trim();
    if (!homeTeam || !awayTeam) continue;

    // Channel is in span.dailychannel — it contains an <i> icon then plain text
    // We use innerText which strips child tags
    const channelRaw = row.querySelector("span.dailychannel")?.text?.trim() ?? "";
    const channel = channelRaw || undefined;

    const entry: MarcaMatch = {};
    if (channel) entry.channel = channel;

    map.set(makeMatchKey(homeTeam, awayTeam), entry);
  }
}

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

export function findMarcaMatch(
  map: Map<string, MarcaMatch>,
  homeTeam: string,
  awayTeam: string
): MarcaMatch | undefined {
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

