# Design: Card Spacing + Manual Refresh

**Date**: 2026-03-18

## Context

The app uses two football APIs:
- **football-data.org** — primary source (match list, scores, status)
- **api-football.com** — enrichment source (goal scorers); free plan = 100 requests/day

The auto-poll every 60s was burning the free quota fast on match days. Manual refresh gives the user control and makes the 100 req/day limit viable.

## Changes

### 1. Card spacing (`MatchCard.tsx`)

Increase bottom padding of the goal scorers section from `pb-2` to `pb-4` to add breathing room between goals and the channel footer.

### 2. Manual refresh (`useMatches.ts` + `DayView.tsx`)

**`useMatches.ts`**:
- Remove `setInterval` auto-poll (60s interval)
- Add `lastUpdated: Date | null` state, set on every successful fetch
- Expose `lastUpdated` alongside `refetch`

**`DayView.tsx`**:
- Add "Actualizar" button in the header, only visible when date === today
- Show last updated time next to the button ("Actualizado a las HH:mm")
- On click, call `refetch`

## Quota impact

No automatic polling = user-controlled requests. Server-side cache (50s TTL for live data) means rapid re-clicks cost 0 additional api-football calls.
