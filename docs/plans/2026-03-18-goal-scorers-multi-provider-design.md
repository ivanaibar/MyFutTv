# Design: Goal Scorers + Multi-Provider Architecture

**Date:** 2026-03-18
**Branch:** feature/goal-scorers-multi-provider
**Status:** Approved

---

## Feature 1: Goal Scorers in MatchCard

### Data Model

Add to `src/types/index.ts`:

```typescript
export interface Goal {
  scorer: string;
  minute: number;
  team: 'home' | 'away';
  type: 'REGULAR' | 'OWN_GOAL' | 'PENALTY';
}
```

Add `goals?: Goal[]` to the `Match` interface.

Remove `MatchUpdatePayload` (no longer used after Socket.IO removal).

### UI

Displayed in `MatchCard`, below the team row, only when:
- `match.goals` exists and has length > 0
- Match status is IN_PLAY, PAUSED, or FINISHED

Two columns layout (home goals | away goals), small secondary text.
Each goal: `⚽ 23' Lewandowski` — with `(pp)` for penalties and `(en)` for own goals in lighter gray.

---

## Feature 2: Multi-Provider Architecture

### Directory Structure

```
src/services/providers/
  types.ts          ← FootballProvider interface + shared normalisation helpers
  football-data.ts  ← existing logic refactored into a class/object implementing FootballProvider
  api-football.ts   ← new provider stub implementing FootballProvider (ready for real implementation)
  registry.ts       ← COMPETITION_PROVIDERS map + getProvider(competitionId) factory
src/services/footballData.ts  ← thin wrapper, delegates to registry
```

### FootballProvider Interface

```typescript
interface FootballProvider {
  getMatchesByDate(date: string): Promise<Match[]>;
  getMatchesByDateRange(dateFrom: string, dateTo: string): Promise<Match[]>;
  getLiveMatches(): Promise<Match[]>;
}
```

### Registry

`registry.ts` exports a `COMPETITION_PROVIDERS` config object mapping competitionId → provider name, and a `getProvider(id)` function that returns the correct provider instance.

Default: all competitions use `football-data`. Switching a competition to `api-football` is a one-line config change.

### Goal Data — football-data.org

The `/matches` list endpoint does NOT return goals on the free tier. After fetching the match list, for any match with status IN_PLAY, PAUSED, or FINISHED, call `/matches/{id}` in parallel to enrich with goal data. The free tier allows 10 req/min — manageable for typical daily match counts.

### Goal Data — api-football.com

Returns goals directly in the fixture list response — zero extra calls needed. Free tier: 100 req/day. Implemented as a functional stub with TODO comments marking where real API calls go.

---

## Decisions

- `MatchUpdatePayload` removed from types (was only used by the now-deleted Socket.IO live updater)
- Both providers normalise to the same internal `Match` type — UI is completely provider-agnostic
- `api-football.ts` stub returns an empty array with a console.warn until properly implemented — safe to deploy
