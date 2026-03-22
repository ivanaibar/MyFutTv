# Design: Match Card Improvements

**Date:** 2026-03-22
**Status:** Approved

## Overview

Four targeted improvements to the DayView and MatchCard components: collapsible finished matches, multiline team names, channel footer spacing, and a second TV channel source for verification.

---

## 1. Collapsible finished match groups

**Where:** `src/components/DayView.tsx`

`DayView` tracks expanded groups with `useState<Set<string>>` (keyed by time string, e.g. `"21:00"`).

**Rule:**
- If **all** matches in a time group are `FINISHED` → group is collapsed by default
- Mixed groups (any non-FINISHED match) → always expanded, no toggle rendered

**Collapsed state:** A single clickable row replacing the card grid:
```
▶  21:00  ·  3 partidos finalizados
```
Clicking adds the key to the expanded set and rotates the chevron. The cards render below with a CSS transition.

---

## 2. Multiline team names

**Where:** `src/components/MatchCard.tsx`

Remove `whitespace-nowrap overflow-hidden text-ellipsis` from both team name `<span>` elements.
Add `break-words` to allow wrapping.
Change team container divs from `items-center` to `items-start` so crests align to the top of multiline names.
Score column keeps `items-center` alignment.
The existing `clamp(0.7rem, 3.5vw, 1rem)` font size is retained.

---

## 3. Channel footer spacing

**Where:** `src/components/MatchCard.tsx`

Add `mt-2` to the channel footer `<div>` (both the green channel variant and the empty "Canal no disponible" variant). This adds visual separation between the goals/score area and the banner.

---

## 4. Second TV channel source (as.com)

**New file:** `src/services/tvScraperAs.ts`
Scrapes `as.com/futbol/television/` for today's match TV listings. Same interface as `tvScraper.ts`: returns `Map<string, string>` of normalized match key → channel string.

**Merge utility:** `mergeChannelMaps(primary, secondary): Map<string, string>`
- For each entry in secondary: if primary doesn't have it → add it
- If both have the same match but different channels → keep primary, `console.warn` the mismatch
- Returns the merged map

**Integration in** `src/services/providers/football-data.ts`:
```ts
const [response, primaryTvMap, secondaryTvMap] = await Promise.all([
  apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
  scrapeTvChannels(date),       // fichajes.com (primary)
  scrapeTvChannelsAs(date),     // as.com (secondary)
]);
const tvMap = mergeChannelMaps(primaryTvMap, secondaryTvMap);
```
Applied to both `getMatchesByDate` and `getLiveMatches`. `getMatchesByDateRange` keeps only the primary scraper (avoids extra requests for multi-day ranges).

---

## Files affected

| File | Change |
|------|--------|
| `src/components/DayView.tsx` | Add collapsible logic for finished groups |
| `src/components/MatchCard.tsx` | Multiline names + channel footer spacing |
| `src/services/tvScraperAs.ts` | New — as.com scraper |
| `src/services/providers/football-data.ts` | Parallel scrapers + mergeChannelMaps |
