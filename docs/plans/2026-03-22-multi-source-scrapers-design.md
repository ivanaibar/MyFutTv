# Design: Multi-Source Scrapers + Score Freshness

**Date:** 2026-03-22
**Status:** Approved

## Overview

Four changes:
1. **Spacing** — guaranteed minimum gap between score/time column and team names in MatchCard
2. **SofaScore** — secondary source for live match results; prefer the source with the highest minute (freshest data)
3. **Marca.com** — Spanish TV channel triple-check + result/scorer validation
4. **Merge logic** — wires all sources together with graceful degradation

---

## 1. Spacing fix

In `src/components/MatchCard.tsx`, the score/time column gets `mx-4 sm:mx-6 shrink-0` (was `mx-3 sm:mx-4`). `shrink-0` prevents the column from collapsing when team names are long.

---

## 2. SofaScore scraper (Scraper A — secondary results)

**New file:** `src/services/sofaScoreScraper.ts`

**Endpoint:** `https://api.sofascore.com/api/v1/sport/football/scheduled-events/YYYY-MM-DD`

No authentication required. Returns JSON with match events including:
- `homeScore.current` / `awayScore.current`
- `status.type` (`inprogress`, `finished`, `notstarted`)
- `time.current` (elapsed minutes for live matches)
- Optional goal events via `/event/{id}/incidents`

**Output:** `Map<string, SofaScoreMatch>` keyed by `normalize(home)::normalize(away)`.

```ts
interface SofaScoreMatch {
  minute: number;             // elapsed time for live matches
  homeScore: number;
  awayScore: number;
  status: string;             // "inprogress" | "finished" | "notstarted"
  sofaId: number;             // for fetching incidents if needed
}
```

**Cache:** 50s TTL for today, 1h for other dates.

---

## 3. Marca.com scraper (Scraper B — Spanish TV + triple-check)

**New file:** `src/services/marcaScraper.ts`

**URL:** `https://www.marca.com/futbol/television.html`

Scrapes HTML to extract per match:
- Home team / away team names
- TV channel (Spanish: Movistar+, DAZN, beIN Sports, La 1, etc.)
- Current score (if available)
- Goal scorers (if shown on page)

**Output:** `Map<string, MarcaMatch>` keyed by `normalize(home)::normalize(away)`.

```ts
interface MarcaMatch {
  channel?: string;
  homeScore?: number;
  awayScore?: number;
  scorers?: string[];
}
```

**Cache:** 2h for channels, 50s for live match data.

Graceful degradation: if Marca returns non-200 or parse fails → returns empty map, logs error.

---

## 4. Merge logic (in `football-data.ts`)

### Live score freshness

For `getMatchesByDate` and `getLiveMatches`, run all sources in parallel:

```ts
const [response, tvMap, sofaMap, marcaMap] = await Promise.all([
  apiFetch(...),
  scrapeTvChannels(date),     // fichajes.com — TV channels
  sofaScoreMatches(date),     // SofaScore — results
  marcaMatches(date),          // Marca — TV channels + results
]);
```

For each `IN_PLAY` or `PAUSED` match, compare minutes across sources:
- If SofaScore minute > football-data.org minute → use SofaScore score
- If Marca score agrees with SofaScore against football-data.org → even stronger signal
- Always fall back to football-data.org if other sources fail or don't match the game

### TV channel merge

Priority: `fichajes.com` → `marca.com` → `channels.json` static fallback.

```
channel = fichajes || marca || static_fallback
```

If both fichajes and marca have a channel but they differ → log mismatch, keep fichajes.

### Goal scorer complement

After `enrichWithApiFootballGoals`:
- If a match has no goals from api-football.com AND marca has scorers → use Marca's scorers
- If both have scorers → keep api-football.com (more structured data)

---

## Files Affected

| File | Change |
|------|--------|
| `src/components/MatchCard.tsx` | Score column: `mx-4 sm:mx-6 shrink-0` |
| `src/services/sofaScoreScraper.ts` | Create — SofaScore secondary results |
| `src/services/marcaScraper.ts` | Create — Marca.com TV + triple-check |
| `src/services/providers/football-data.ts` | Wire all sources in parallel, merge logic |
