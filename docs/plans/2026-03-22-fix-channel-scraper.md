# Fix Channel Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the fichajes.com scraper so it correctly extracts TV channel names using CSS class selectors, and remove the now-unnecessary dual-scraper architecture.

**Architecture:** The bug is in `parseMatchesFromHtml` — it uses alt-text prefix logic to distinguish team logos from channel logos, but both use the same `"Logo "` prefix. The fix is to use CSS classes: `span.matchTeam__name` for team names, `img.matchFull__broadcastImage` for channel logos. Then clean up the secondary scraper and its wiring.

**Tech Stack:** Next.js 16, node-html-parser, TypeScript

> **No test framework configured.** Manual verification: `npm run build` for type safety, `npm run dev` + browser for runtime.

---

### Task 1: Fix `parseMatchesFromHtml` in tvScraper.ts

**Files:**
- Modify: `src/services/tvScraper.ts`

**Background:**
The page structure on fichajes.com is:
```html
<a href="/directo/..." class="matchFull__link">
  <span class="matchTeam__name">Mainz</span>     <!-- home team -->
  <span class="matchTeam__name">Eintracht</span> <!-- away team -->
  <span class="matchFull__broadcasts">
    <img alt="Logo DAZN" class="matchFull__broadcastImage" />
  </span>
</a>
```

The current parser reads ALL `<img>` alt attributes and tries to split teams from channels by whether the alt starts with `"Logo "`. This fails because channel images also start with `"Logo "`. The correct approach is class-based selection.

**Step 1: Read the current file**

Read `src/services/tvScraper.ts` in full before making any changes.

**Step 2: Replace `parseMatchesFromHtml` with the fixed version**

Find the entire `parseMatchesFromHtml` function and replace it with:

```ts
function parseMatchesFromHtml(html: string): ScrapedMatch[] {
  const root = parse(html);
  const matches: ScrapedMatch[] = [];

  const matchLinks = root.querySelectorAll('a[href^="/directo/"]');

  for (const link of matchLinks) {
    // Team names from dedicated span (cleaner than alt parsing)
    const teamSpans = link.querySelectorAll("span.matchTeam__name");
    const homeTeam = teamSpans[0]?.text?.trim() ?? "";
    const awayTeam = teamSpans[1]?.text?.trim() ?? "";

    // Channel logos are specifically class="matchFull__broadcastImage"
    const channelImgs = link.querySelectorAll("img.matchFull__broadcastImage");
    const channels = channelImgs
      .map((img) => (img.getAttribute("alt") ?? "").replace(/^Logo\s+/, "").trim())
      .filter(Boolean);

    // Extract time (HH:MM pattern) from text
    const allText = link.textContent.trim();
    const timeMatch = allText.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : "";

    if (homeTeam && awayTeam) {
      matches.push({ homeTeam, awayTeam, time, channels });
    }
  }

  return matches;
}
```

Also delete the `isCompetitionName` function and `COMPETITION_KEYWORDS` constant — they are no longer needed with this approach.

**Step 3: Verify TypeScript**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```

Expected: build completes with no errors.

**Step 4: Commit**

```bash
git add src/services/tvScraper.ts
git commit -m "fix: rewrite fichajes.com parser to use CSS class selectors for channels"
```

---

### Task 2: Delete `tvScraperAs.ts`

**Files:**
- Delete: `src/services/tvScraperAs.ts`

**Step 1: Delete the file**

```bash
rm /Users/ivan/Documents/MyFutTv/src/services/tvScraperAs.ts
```

**Step 2: Verify build still passes**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```

Expected: build fails with "Cannot find module '../tvScraperAs'" — this is expected and will be fixed in Task 3.

**Step 3: Do NOT commit yet** — Task 3 must fix the import first.

---

### Task 3: Remove dual-scraper logic from football-data.ts

**Files:**
- Modify: `src/services/providers/football-data.ts`

**Step 1: Read the current file**

Read `src/services/providers/football-data.ts` in full.

**Step 2: Remove `scrapeTvChannelsAs` import**

Find and delete the line:
```ts
import { scrapeTvChannelsAs } from "../tvScraperAs";
```

**Step 3: Remove `mergeChannelMaps` function**

Find and delete the entire `mergeChannelMaps` function (it was added in the previous implementation session).

**Step 4: Revert `getMatchesByDate` to single scraper**

Find the current 3-way `Promise.all` in `getMatchesByDate`:
```ts
const [response, primaryTvMap, secondaryTvMap] = await Promise.all([
  apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
  scrapeTvChannels(date),
  scrapeTvChannelsAs(date),
]);
const tvMap = mergeChannelMaps(primaryTvMap, secondaryTvMap);
```

Replace with the original 2-way form:
```ts
const [response, tvMap] = await Promise.all([
  apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
  scrapeTvChannels(date),
]);
```

**Step 5: Revert `getLiveMatches` to single scraper**

Find the current parallel scraper block in `getLiveMatches`:
```ts
const [response, primaryTvMap, secondaryTvMap] = await Promise.all([
  apiFetch<FootballDataMatchesResponse>(`/matches?date=${today}`),
  scrapeTvChannels(today),
  scrapeTvChannelsAs(today),
]);
const tvMap = mergeChannelMaps(primaryTvMap, secondaryTvMap);
```

Replace with:
```ts
const [response, tvMap] = await Promise.all([
  apiFetch<FootballDataMatchesResponse>(`/matches?date=${today}`),
  scrapeTvChannels(today),
]);
```

**Step 6: Verify build passes**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```

Expected: clean build with no TypeScript errors, no missing module errors.

**Step 7: Commit both Task 2 and Task 3 together**

```bash
git add src/services/providers/football-data.ts
git rm src/services/tvScraperAs.ts
git commit -m "refactor: remove dual-scraper architecture, revert to single fichajes.com source"
```

---

## Done

After all tasks, the channel scraper correctly extracts TV channels from fichajes.com using CSS class selectors. The dual-scraper architecture is removed. The static `channels.json` still serves as fallback for any match not found by the scraper.
