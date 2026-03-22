# Design: Fix fichajes.com Channel Scraper

**Date:** 2026-03-22
**Status:** Approved

## Problem

The primary scraper (`tvScraper.ts`) has never correctly extracted TV channels from fichajes.com. The current logic distinguishes team logos from channel logos by checking if the `alt` attribute starts with `"Logo "` — but ALL images on the page (teams AND channels) use that prefix. As a result, `channelNames` is always empty and the app falls back to the static `channels.json` for every match.

## Root Cause

```
Current logic:
  alt starts with "Logo " → team logo candidate
  alt does NOT start with "Logo " → channel name

Reality:
  Team logo:    alt="Logo Mainz 05"         class="matchTeam__logo"
  Channel logo: alt="Logo DAZN"             class="matchFull__broadcastImage"
```

Both use `"Logo "` prefix. The correct discriminator is the **CSS class**, not the alt text pattern.

## Solution

Rewrite the HTML parser in `tvScraper.ts` to use class-based selectors:

- **Team names:** `span.matchTeam__name` text content (cleaner than alt parsing)
- **Channel names:** `img.matchFull__broadcastImage` → strip `"Logo "` from alt attribute

## Changes

### `src/services/tvScraper.ts`
Rewrite `parseMatchesFromHtml` using the correct selectors. Keep all other logic unchanged (normalize, makeMatchKey, cache, findChannel).

### `src/services/tvScraperAs.ts`
**Delete.** The secondary scraper was added as a workaround; with the primary fixed it is no longer needed.

### `src/services/providers/football-data.ts`
- Remove `scrapeTvChannelsAs` import
- Remove `mergeChannelMaps` function
- Revert `getMatchesByDate` and `getLiveMatches` back to single-scraper calls (`scrapeTvChannels` only)
- `getMatchesByDateRange` already only used the primary — no change needed

## Files Affected

| File | Change |
|------|--------|
| `src/services/tvScraper.ts` | Rewrite `parseMatchesFromHtml` |
| `src/services/tvScraperAs.ts` | Delete |
| `src/services/providers/football-data.ts` | Remove dual-scraper logic |
