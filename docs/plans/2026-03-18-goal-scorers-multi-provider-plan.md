# Goal Scorers + Multi-Provider Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show goal scorers and minutes in match cards, and refactor the data layer into a multi-provider architecture where different football APIs can be routed per competition.

**Architecture:** Extract the existing football-data.org logic into a `providers/` directory implementing a shared `FootballProvider` interface. A registry maps competition IDs to providers and aggregates results. The existing `footballData.ts` becomes a thin wrapper over the registry so API routes need zero changes. Goal data is fetched via parallel `/matches/{id}` calls for matches with scores, then displayed in `MatchCard` as a secondary two-column section below the teams row.

**Tech Stack:** Next.js 16 API Routes, TypeScript, football-data.org v4 API, Tailwind CSS.

---

### Task 1: Update types — add Goal, goals field, remove MatchUpdatePayload

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Read the current file**

Read `src/types/index.ts` in full to understand current state before editing.

**Step 2: Apply changes**

Replace the full content of `src/types/index.ts` with:

```typescript
// Match status from football-data.org API
export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface Competition {
  id: number;
  name: string;
  code: string;
  emblem: string;
}

export interface Goal {
  scorer: string;
  minute: number;
  team: "home" | "away";
  type: "REGULAR" | "OWN_GOAL" | "PENALTY";
}

export interface Match {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition;
  utcDate: string;
  status: MatchStatus;
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  minute: number | null;
  channel?: string;
  goals?: Goal[];
}

export interface ChannelMapping {
  competitionId: number;
  competitionName: string;
  channel: string;
  notes?: string;
}

export interface UserPreferences {
  selectedLeagues: number[];
  timezone: string;
}

export type CalendarView = "day" | "week" | "month";

export interface FootballDataMatchesResponse {
  filters: Record<string, string>;
  resultSet: { count: number; competitions: string; first: string; last: string };
  matches: FootballDataMatch[];
}

export interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: MatchStatus;
  minute: number | null;
  injuryTime: number | null;
  attendance: number | null;
  venue: string | null;
  matchday: number;
  stage: string;
  group: string | null;
  lastUpdated: string;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  competition: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  area: {
    id: number;
    name: string;
    code: string;
    flag: string;
  };
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  referees: Array<{ id: number; name: string; type: string; nationality: string }>;
}

export interface FootballDataGoal {
  minute: number;
  injuryTime: number | null;
  type: "REGULAR" | "OWN_GOAL" | "PENALTY";
  team: { id: number; name: string };
  scorer: { id: number; name: string };
  assist: { id: number; name: string } | null;
}

export interface FootballDataMatchDetail extends FootballDataMatch {
  goals: FootballDataGoal[];
}
```

**Step 3: Build to verify no TypeScript errors**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```
Expected: Build passes. No type errors.

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Goal type and goals field to Match, add FootballDataGoal types"
```

---

### Task 2: Create providers/types.ts — FootballProvider interface

**Files:**
- Create: `src/services/providers/types.ts`

**Step 1: Create the file**

```typescript
import type { Match } from "@/types";

export interface FootballProvider {
  getMatchesByDate(date: string): Promise<Match[]>;
  getMatchesByDateRange(dateFrom: string, dateTo: string): Promise<Match[]>;
  getLiveMatches(): Promise<Match[]>;
}
```

**Step 2: Commit**

```bash
git add src/services/providers/types.ts
git commit -m "feat: add FootballProvider interface"
```

---

### Task 3: Create providers/football-data.ts — refactor existing logic + goal enrichment

**Files:**
- Create: `src/services/providers/football-data.ts`

**Context:** This is a refactoring + enhancement of `src/services/footballData.ts`. The existing logic is moved here intact, plus goal enrichment is added: after fetching a match list, for any match with status FINISHED, IN_PLAY, or PAUSED, call `/v4/matches/{id}` in parallel to get goal data. Use `Promise.allSettled` so a single failed detail call never crashes the whole response.

The football-data.org match detail endpoint (`/v4/matches/{id}`) returns the full match object including a `goals` array. Each goal has `{ minute, type, team: {id}, scorer: {name}, assist }`. Compare `goal.team.id` to `match.homeTeam.id` to determine `"home"` or `"away"`.

**Step 1: Create the file**

```typescript
import { cache } from "../cache";
import { getChannelForCompetition } from "../channels";
import { scrapeTvChannels, findChannel } from "../tvScraper";
import { FREE_COMPETITION_IDS } from "@/lib/constants";
import type {
  Match,
  Goal,
  FootballDataMatchesResponse,
  FootballDataMatch,
  FootballDataMatchDetail,
  Competition,
} from "@/types";
import type { FootballProvider } from "./types";

const API_BASE = "https://api.football-data.org/v4";

const FUTURE_MATCHES_TTL = 60 * 60 * 1000;
const LIVE_MATCHES_TTL = 50 * 1000;
const COMPETITIONS_TTL = 24 * 60 * 60 * 1000;

async function apiFetch<T>(endpoint: string): Promise<T> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": key || "" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `football-data.org API error: ${res.status} ${res.statusText} - ${body}`
    );
  }
  return res.json() as Promise<T>;
}

function mapGoals(
  raw: FootballDataMatchDetail,
  homeTeamId: number
): Goal[] {
  return (raw.goals ?? []).map((g) => ({
    scorer: g.scorer.name,
    minute: g.minute,
    team: g.team.id === homeTeamId ? "home" : "away",
    type: g.type,
  }));
}

function mapMatch(
  raw: FootballDataMatch,
  tvMap?: Map<string, string>,
  goals?: Goal[]
): Match {
  let channel: string | undefined;
  if (tvMap) {
    channel = findChannel(tvMap, raw.homeTeam.name, raw.awayTeam.name);
  }
  if (!channel) {
    channel = getChannelForCompetition(raw.competition.id);
  }

  return {
    id: raw.id,
    homeTeam: {
      id: raw.homeTeam.id,
      name: raw.homeTeam.name,
      shortName: raw.homeTeam.shortName,
      tla: raw.homeTeam.tla,
      crest: raw.homeTeam.crest,
    },
    awayTeam: {
      id: raw.awayTeam.id,
      name: raw.awayTeam.name,
      shortName: raw.awayTeam.shortName,
      tla: raw.awayTeam.tla,
      crest: raw.awayTeam.crest,
    },
    competition: {
      id: raw.competition.id,
      name: raw.competition.name,
      code: raw.competition.code,
      emblem: raw.competition.emblem,
    },
    utcDate: raw.utcDate,
    status: raw.status,
    score: {
      fullTime: raw.score.fullTime,
      halfTime: raw.score.halfTime,
    },
    minute: raw.minute,
    channel,
    goals,
  };
}

async function enrichWithGoals(matches: Match[], rawMatches: FootballDataMatch[]): Promise<Match[]> {
  const GOAL_STATUSES = new Set(["FINISHED", "IN_PLAY", "PAUSED"]);
  const needsGoals = rawMatches.filter((m) => GOAL_STATUSES.has(m.status));

  if (needsGoals.length === 0) return matches;

  const results = await Promise.allSettled(
    needsGoals.map((m) => apiFetch<FootballDataMatchDetail>(`/matches/${m.id}`))
  );

  const goalMap = new Map<number, Goal[]>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      const detail = result.value;
      const raw = needsGoals[i];
      goalMap.set(raw.id, mapGoals(detail, raw.homeTeam.id));
    }
  });

  return matches.map((m) =>
    goalMap.has(m.id) ? { ...m, goals: goalMap.get(m.id) } : m
  );
}

export async function getCompetitions(): Promise<Competition[]> {
  const cacheKey = "competitions";
  const cached = cache.get<Competition[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<{ competitions: Array<Competition & { id: number }> }>(
    "/competitions"
  );

  const competitions = response.competitions
    .filter((c) => FREE_COMPETITION_IDS.includes(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      emblem: c.emblem,
    }));

  cache.set(cacheKey, competitions, COMPETITIONS_TTL);
  return competitions;
}

export const footballDataProvider: FootballProvider = {
  async getMatchesByDate(date: string): Promise<Match[]> {
    const cacheKey = `matches:${date}`;
    const cached = cache.get<Match[]>(cacheKey);
    if (cached) return cached;

    const [response, tvMap] = await Promise.all([
      apiFetch<FootballDataMatchesResponse>(`/matches?date=${date}`),
      scrapeTvChannels(date),
    ]);

    const rawMatches = response.matches.filter((m) =>
      FREE_COMPETITION_IDS.includes(m.competition.id)
    );
    let matches = rawMatches.map((m) => mapMatch(m, tvMap));
    matches = await enrichWithGoals(matches, rawMatches);

    const hasLive = matches.some(
      (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
    );
    cache.set(cacheKey, matches, hasLive ? LIVE_MATCHES_TTL : FUTURE_MATCHES_TTL);

    return matches;
  },

  async getMatchesByDateRange(dateFrom: string, dateTo: string): Promise<Match[]> {
    const cacheKey = `matches:${dateFrom}:${dateTo}`;
    const cached = cache.get<Match[]>(cacheKey);
    if (cached) return cached;

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const chunks: { from: string; to: string }[] = [];
    let chunkStart = from;

    while (chunkStart <= to) {
      const chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkEnd.getDate() + 9);
      const effectiveEnd = chunkEnd > to ? to : chunkEnd;
      chunks.push({
        from: chunkStart.toISOString().split("T")[0],
        to: effectiveEnd.toISOString().split("T")[0],
      });
      chunkStart = new Date(effectiveEnd);
      chunkStart.setDate(chunkStart.getDate() + 1);
    }

    const [responses, tvMap] = await Promise.all([
      Promise.all(
        chunks.map((c) =>
          apiFetch<FootballDataMatchesResponse>(
            `/matches?dateFrom=${c.from}&dateTo=${c.to}`
          )
        )
      ),
      scrapeTvChannels(dateFrom),
    ]);

    const allRawMatches = responses
      .flatMap((r) => r.matches)
      .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id));

    const matches = allRawMatches.map((m) => mapMatch(m, tvMap));
    // Note: no goal enrichment for date ranges (too many API calls)

    cache.set(cacheKey, matches, FUTURE_MATCHES_TTL);
    return matches;
  },

  async getLiveMatches(): Promise<Match[]> {
    const cacheKey = "matches:live";
    const cached = cache.get<Match[]>(cacheKey);
    if (cached) return cached;

    const today = new Date().toISOString().split("T")[0];
    const response = await apiFetch<FootballDataMatchesResponse>(
      `/matches?date=${today}`
    );
    const tvMap = await scrapeTvChannels(today);

    const rawMatches = response.matches.filter(
      (m) =>
        FREE_COMPETITION_IDS.includes(m.competition.id) &&
        (m.status === "IN_PLAY" || m.status === "PAUSED")
    );

    let matches = rawMatches.map((m) => mapMatch(m, tvMap));
    matches = await enrichWithGoals(matches, rawMatches);

    cache.set(cacheKey, matches, LIVE_MATCHES_TTL);
    return matches;
  },
};
```

**Step 2: Build to verify**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```
Expected: Build passes. Any TypeScript errors must be fixed before committing.

**Step 3: Commit**

```bash
git add src/services/providers/football-data.ts
git commit -m "feat: extract football-data provider with goal enrichment"
```

---

### Task 4: Create providers/api-football.ts — stub provider

**Files:**
- Create: `src/services/providers/api-football.ts`

**Step 1: Create the file**

```typescript
import type { FootballProvider } from "./types";
import type { Match } from "@/types";

// TODO: Implement api-football.com provider (api-football.com, free tier: 100 req/day)
// Goals are included directly in the fixture list response — no extra calls needed.
// API docs: https://www.api-football.com/documentation-v3
// Set API_FOOTBALL_KEY env var with your key from RapidAPI or api-football.com.
export const apiFootballProvider: FootballProvider = {
  async getMatchesByDate(_date: string): Promise<Match[]> {
    console.warn("[api-football] Provider not yet implemented. Returning empty array.");
    return [];
  },

  async getMatchesByDateRange(_dateFrom: string, _dateTo: string): Promise<Match[]> {
    console.warn("[api-football] Provider not yet implemented. Returning empty array.");
    return [];
  },

  async getLiveMatches(): Promise<Match[]> {
    console.warn("[api-football] Provider not yet implemented. Returning empty array.");
    return [];
  },
};
```

**Step 2: Commit**

```bash
git add src/services/providers/api-football.ts
git commit -m "feat: add api-football stub provider"
```

---

### Task 5: Create providers/registry.ts — per-competition routing

**Files:**
- Create: `src/services/providers/registry.ts`

**Step 1: Create the file**

```typescript
import type { FootballProvider } from "./types";
import type { Match, Competition } from "@/types";
import { footballDataProvider, getCompetitions } from "./football-data";
import { apiFootballProvider } from "./api-football";

export type ProviderName = "football-data" | "api-football";

// ─── Configuration ────────────────────────────────────────────────────────────
// To route a competition to a different provider, add its ID here.
// Competition IDs: 2014 La Liga, 2001 UCL, 2021 PL, 2002 Bundesliga,
//                  2015 Ligue 1, 2019 Serie A, 2003 Eredivisie, 2017 Primeira,
//                  2016 Championship, 2013 Brasileirao, 2000 WC, 2018 Euro
const COMPETITION_PROVIDERS: Partial<Record<number, ProviderName>> = {
  // Example: route Serie A to api-football once implemented:
  // 2019: "api-football",
};
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROVIDER: ProviderName = "football-data";

const PROVIDERS: Record<ProviderName, FootballProvider> = {
  "football-data": footballDataProvider,
  "api-football": apiFootballProvider,
};

export function getProvider(competitionId?: number): FootballProvider {
  const name =
    (competitionId !== undefined && COMPETITION_PROVIDERS[competitionId]) ||
    DEFAULT_PROVIDER;
  return PROVIDERS[name];
}

// Registry acts as a meta-provider: aggregates results from all configured providers.
// For getMatchesByDate / getMatchesByDateRange / getLiveMatches, it calls each
// active provider and merges the results, deduplicating by match ID.
async function mergeProviders<T extends Match>(
  calls: Promise<T[]>[]
): Promise<T[]> {
  const results = await Promise.allSettled(calls);
  const seen = new Set<number>();
  const merged: T[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const match of result.value) {
        if (!seen.has(match.id)) {
          seen.add(match.id);
          merged.push(match);
        }
      }
    }
  }
  return merged;
}

function activeProviders(): FootballProvider[] {
  const names = new Set<ProviderName>([DEFAULT_PROVIDER]);
  for (const name of Object.values(COMPETITION_PROVIDERS)) {
    if (name) names.add(name);
  }
  return [...names].map((n) => PROVIDERS[n]);
}

export const registry: FootballProvider = {
  async getMatchesByDate(date: string): Promise<Match[]> {
    return mergeProviders(activeProviders().map((p) => p.getMatchesByDate(date)));
  },

  async getMatchesByDateRange(dateFrom: string, dateTo: string): Promise<Match[]> {
    return mergeProviders(
      activeProviders().map((p) => p.getMatchesByDateRange(dateFrom, dateTo))
    );
  },

  async getLiveMatches(): Promise<Match[]> {
    return mergeProviders(activeProviders().map((p) => p.getLiveMatches()));
  },
};

export { getCompetitions };
```

**Step 2: Build to verify**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```
Expected: Build passes.

**Step 3: Commit**

```bash
git add src/services/providers/registry.ts
git commit -m "feat: add provider registry with per-competition routing"
```

---

### Task 6: Update footballData.ts — thin wrapper over registry

**Files:**
- Modify: `src/services/footballData.ts`

**Step 1: Read the current file**

Read `src/services/footballData.ts` to understand current exports (the API routes import `getMatchesByDate`, `getMatchesByDateRange`, `getLiveMatches`, `getCompetitions` from here).

**Step 2: Replace the full content**

```typescript
// This file is a thin wrapper over the provider registry.
// Add new providers in src/services/providers/ and configure routing in registry.ts.
export {
  registry as default,
  getCompetitions,
} from "./providers/registry";

export const getMatchesByDate = (date: string) =>
  (await import("./providers/registry")).registry.getMatchesByDate(date);

export const getMatchesByDateRange = (dateFrom: string, dateTo: string) =>
  (await import("./providers/registry")).registry.getMatchesByDateRange(dateFrom, dateTo);

export const getLiveMatches = () =>
  (await import("./providers/registry")).registry.getLiveMatches();
```

Wait — dynamic imports aren't ideal here since `footballData.ts` is already server-side. Use direct re-exports instead:

```typescript
// This file is a thin wrapper over the provider registry.
// To add a new API provider or change routing, see src/services/providers/registry.ts
export { getCompetitions } from "./providers/registry";
import { registry } from "./providers/registry";

export const getMatchesByDate = (date: string) =>
  registry.getMatchesByDate(date);

export const getMatchesByDateRange = (dateFrom: string, dateTo: string) =>
  registry.getMatchesByDateRange(dateFrom, dateTo);

export const getLiveMatches = () => registry.getLiveMatches();
```

**Step 3: Build to verify**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```
Expected: Build passes. All 5 routes still compile. Zero changes needed in API routes.

**Step 4: Commit**

```bash
git add src/services/footballData.ts
git commit -m "refactor: footballData.ts now delegates to provider registry"
```

---

### Task 7: Update MatchCard — display goal scorers

**Files:**
- Modify: `src/components/MatchCard.tsx`

**Context:** The current card layout is:
1. Header row: competition name | status
2. Teams row: home crest + name | score | away name + crest
3. Channel bar

We add a new section between rows 2 and 3: a two-column goal list. Only shown when `match.goals` exists and has entries. Home goals on the left, away goals on the right. Each goal: `⚽ 23' Lewandowski`. Penalties show `(pp)` and own goals show `(en)` in a lighter color. Text is `text-xs text-gray-400` (visually secondary, not competing with the score).

**Step 1: Read the current MatchCard**

Read `src/components/MatchCard.tsx` before editing.

**Step 2: Add GoalList helper and update MatchCard**

Add this helper function before `MatchCard` (after the `getStatusDisplay` function):

```typescript
function GoalList({ goals, side }: { goals: Goal[]; side: "home" | "away" }) {
  const sideGoals = goals.filter((g) => g.team === side);
  if (sideGoals.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {sideGoals.map((g, i) => (
        <li key={i} className="text-xs text-gray-400 leading-tight">
          ⚽ {g.minute}&apos;{" "}
          <span className={side === "away" ? "text-right block" : ""}>
            {g.scorer}
            {g.type === "PENALTY" && (
              <span className="text-gray-300"> (pp)</span>
            )}
            {g.type === "OWN_GOAL" && (
              <span className="text-gray-300"> (en)</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

Add the import at the top of the file (after the existing imports):
```typescript
import type { Goal } from "@/types";
```

Then, inside `MatchCard`, add the goals section between the teams row and the channel bar. Locate the closing `</div>` of the teams row (the one with `flex items-center justify-between px-4 py-2`) and add this immediately after it:

```tsx
{match.goals && match.goals.length > 0 && (
  <div className="flex justify-between px-4 pb-2 gap-2">
    <div className="flex-1">
      <GoalList goals={match.goals} side="home" />
    </div>
    <div className="flex-1 text-right">
      <GoalList goals={match.goals} side="away" />
    </div>
  </div>
)}
```

**Step 3: Build to verify**

```bash
cd /Users/ivan/Documents/MyFutTv && npm run build
```
Expected: Build passes, no TypeScript errors.

**Step 4: Run dev and verify visually**

```bash
npm run dev
```

Open http://localhost:3000, navigate to a day with finished matches and verify:
- Goal scorers appear below the team names
- Home goals on the left, away goals on the right
- Text is small and secondary (gray, not prominent)
- Penalties show `(pp)`, own goals show `(en)`
- Cards without goals show no extra section

**Step 5: Commit**

```bash
git add src/components/MatchCard.tsx
git commit -m "feat: display goal scorers in MatchCard"
```

---

### Task 8: Deploy to Vercel

**Step 1: Push the feature branch**

```bash
git push origin feature/goal-scorers-multi-provider
```

**Step 2: Deploy to production**

```bash
vercel --prod
```
Expected: Build succeeds, deployment URL printed.

**Step 3: Verify on production URL**

Open the production URL and confirm goals display correctly on finished matches.

**Step 4: Merge to main**

```bash
git checkout main
git merge feature/goal-scorers-multi-provider
git push origin main
```
