# Match Card Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Four targeted UI/UX improvements: collapsible finished matches in DayView, multiline team names in MatchCard, extra spacing before channel footer, and a second TV channel scraper (as.com) to cross-verify channel info.

**Architecture:** Changes are isolated to two components (DayView, MatchCard) and one new service file (tvScraperAs.ts). The dual-scraper merge is wired in the existing football-data provider. No new state management or API routes needed.

**Tech Stack:** Next.js 16, React 19, DaisyUI v5, Tailwind CSS v4, node-html-parser, date-fns

> **Note:** No test framework is configured in this project. TDD steps are replaced with manual verification via `npm run dev`.

---

### Task 1: MatchCard — multiline team names + channel footer spacing

**Files:**
- Modify: `src/components/MatchCard.tsx`

**Step 1: Fix team name spans — remove truncation, allow wrapping**

In the home team `<span>` (line ~107), replace:
```tsx
<span className="font-bold text-base-content whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: "clamp(0.7rem, 3.5vw, 1rem)" }}>
```
with:
```tsx
<span className="font-bold text-base-content break-words min-w-0" style={{ fontSize: "clamp(0.7rem, 3.5vw, 1rem)" }}>
```

Same change for the away team `<span>` (line ~128).

**Step 2: Top-align team containers so crests don't float to middle**

Home team container (line ~99), change `items-center` to `items-start`:
```tsx
<div className="flex items-start gap-2 flex-1 min-w-0">
```

Away team container (line ~127), change `items-center` to `items-start`:
```tsx
<div className="flex items-start gap-2 flex-1 justify-end min-w-0">
```

Score column keeps `items-center` — no change needed there.

**Step 3: Add spacing before channel footer**

Both channel footer divs (line ~154 and ~162) — add `mt-2` to each:

Green channel variant:
```tsx
<div className="mt-2 px-4 py-2.5 flex items-center gap-2 bg-primary border-t border-primary">
```

Empty "Canal no disponible" variant:
```tsx
<div className="mt-2 px-4 py-1.5 flex items-center gap-2 bg-base-300/50 border-t border-base-300">
```

**Step 4: Verify visually**

```bash
npm run dev
```
Open http://localhost:3000. Check that:
- Long team names wrap instead of truncating
- Crests stay top-aligned with multiline names
- Visible gap between goals/score area and channel banner

**Step 5: Commit**

```bash
git add src/components/MatchCard.tsx
git commit -m "fix: multiline team names, top-align crests, add spacing before channel footer"
```

---

### Task 2: DayView — collapsible finished match groups

**Files:**
- Modify: `src/components/DayView.tsx`

**Step 1: Add expanded groups state**

After the existing imports, add `useState` to the import (it's not currently imported — `useMemo` is):
```tsx
import { useState, useMemo } from "react";
```

Inside the `DayView` function, before `groupedMatches`, add:
```tsx
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

const toggleGroup = (time: string) => {
  setExpandedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(time)) {
      next.delete(time);
    } else {
      next.add(time);
    }
    return next;
  });
};
```

**Step 2: Add helper to check if a group is all-finished**

Above the return statement:
```tsx
const isAllFinished = (groupMatches: Match[]) =>
  groupMatches.every((m) => m.status === "FINISHED");
```

**Step 3: Replace the time group render block**

Find the `Array.from(groupedMatches.entries()).map(...)` block and replace the inner content with:

```tsx
{Array.from(groupedMatches.entries()).map(([time, timeMatches]) => {
  const allFinished = isAllFinished(timeMatches);
  const isExpanded = expandedGroups.has(time);

  return (
    <div key={time}>
      {allFinished ? (
        <button
          type="button"
          onClick={() => toggleGroup(time)}
          className="w-full flex items-center gap-2 text-left mb-3 group"
          aria-expanded={isExpanded}
        >
          <svg
            className={`w-3 h-3 text-base-content/30 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5l8 7-8 7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span className="text-xs text-base-content/30 font-mono">{time}</span>
          <span className="text-xs text-base-content/30">
            · {timeMatches.length} {timeMatches.length === 1 ? "partido finalizado" : "partidos finalizados"}
          </span>
        </button>
      ) : (
        <div className="divider divider-start text-xs text-base-content/40 font-mono mb-3">
          {time}
        </div>
      )}

      {(!allFinished || isExpanded) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {timeMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
})}
```

**Step 4: Verify visually**

```bash
npm run dev
```
Navigate to a day with finished matches. Check:
- Finished groups show the collapsed header (arrow + time + count)
- Clicking expands and shows cards
- Arrow rotates on expand
- Groups with live or pending matches render normally with the divider

**Step 5: Commit**

```bash
git add src/components/DayView.tsx
git commit -m "feat: collapse finished match groups by default in DayView"
```

---

### Task 3: New as.com TV channel scraper

**Files:**
- Create: `src/services/tvScraperAs.ts`

**Step 1: Inspect as.com page structure**

Before writing the parser, open `https://as.com/futbol/television/` in a browser and inspect the HTML of the match list. You need to identify:
- The CSS selector for each match row
- Where team names appear (text or `alt` attributes)
- Where channel names appear

Then write `tvScraperAs.ts` following this template (adjust selectors to match what you find):

```ts
import { parse } from "node-html-parser";
import { cache } from "./cache";

const AS_TV_TTL = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Scrapes as.com/futbol/television/ for TV channel info.
 * Returns a map of "normalizedHome::normalizedAway" → channel string.
 */
export async function scrapeTvChannelsAs(
  _date: string
): Promise<Map<string, string>> {
  const cacheKey = `tv-as:${_date}`;
  const cached = cache.get<Map<string, string>>(cacheKey);
  if (cached) return cached;

  const channelMap = new Map<string, string>();

  try {
    const res = await fetch("https://as.com/futbol/television/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      console.error(`[tvScraperAs] HTTP ${res.status}`);
      cache.set(cacheKey, channelMap, AS_TV_TTL);
      return channelMap;
    }

    const html = await res.text();
    const root = parse(html);

    // ── Adjust these selectors after inspecting the page HTML ──
    const matchRows = root.querySelectorAll("SELECTOR_FOR_MATCH_ROW");

    for (const row of matchRows) {
      const homeTeam = row.querySelector("SELECTOR_HOME")?.text?.trim() ?? "";
      const awayTeam = row.querySelector("SELECTOR_AWAY")?.text?.trim() ?? "";
      const channel = row.querySelector("SELECTOR_CHANNEL")?.text?.trim() ?? "";

      if (homeTeam && awayTeam && channel) {
        const key = makeMatchKey(homeTeam, awayTeam);
        channelMap.set(key, channel);
      }
    }
  } catch (err) {
    console.error("[tvScraperAs] Error:", err);
  }

  cache.set(cacheKey, channelMap, AS_TV_TTL);
  return channelMap;
}

// ── Same normalize/makeMatchKey as tvScraper.ts ──
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
```

**Step 2: Verify the scraper returns data**

Add a temporary log in `getMatchesByDate` (next task) or test the URL manually with curl:
```bash
curl -s "https://as.com/futbol/television/" | grep -i "canal\|cadena\|channel" | head -20
```
This helps validate the page has the data you expect before committing.

**Step 3: Commit**

```bash
git add src/services/tvScraperAs.ts
git commit -m "feat: add as.com TV channel scraper as secondary source"
```

---

### Task 4: Wire dual scrapers + merge in football-data provider

**Files:**
- Modify: `src/services/providers/football-data.ts`

**Step 1: Add the merge utility and import**

At the top of `football-data.ts`, add the import:
```ts
import { scrapeTvChannelsAs } from "../tvScraperAs";
```

Add the merge function (place it above `getMatchesByDate`):
```ts
function mergeChannelMaps(
  primary: Map<string, string>,
  secondary: Map<string, string>
): Map<string, string> {
  const merged = new Map(primary);
  for (const [key, channel] of secondary) {
    if (!merged.has(key)) {
      merged.set(key, channel);
    } else if (merged.get(key) !== channel) {
      console.warn(
        `[channel-merge] Mismatch for "${key}": primary="${merged.get(key)}" secondary="${channel}"`
      );
    }
  }
  return merged;
}
```

**Step 2: Update `getMatchesByDate` to use both scrapers**

Find the existing `Promise.all` call in `getMatchesByDate` and extend it:

Before:
```ts
const [response, tvMap] = await Promise.all([
  apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
  scrapeTvChannels(date),
]);
```

After:
```ts
const [response, primaryTvMap, secondaryTvMap] = await Promise.all([
  apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
  scrapeTvChannels(date),
  scrapeTvChannelsAs(date),
]);
const tvMap = mergeChannelMaps(primaryTvMap, secondaryTvMap);
```

**Step 3: Same update in `getLiveMatches`**

Find the equivalent block in `getLiveMatches`:

Before:
```ts
const tvMap = await scrapeTvChannels(today);
```

After:
```ts
const [primaryTvMap, secondaryTvMap] = await Promise.all([
  scrapeTvChannels(today),
  scrapeTvChannelsAs(today),
]);
const tvMap = mergeChannelMaps(primaryTvMap, secondaryTvMap);
```

> `getMatchesByDateRange` is intentionally left with only the primary scraper — it covers multiple days and the extra requests aren't worth it for the overview views.

**Step 4: Verify in dev**

```bash
npm run dev
```
Check the server console for any `[channel-merge] Mismatch` warnings — these indicate where the two sources disagree and the primary (fichajes.com) value is being used.

**Step 5: Commit**

```bash
git add src/services/providers/football-data.ts
git commit -m "feat: dual TV channel scrapers with merge and mismatch logging"
```

---

## Done

After all 4 tasks, run:
```bash
npm run build
```
to confirm no TypeScript errors before deploying.
