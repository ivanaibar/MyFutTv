# MyFutTV Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js web app that shows football matches in a calendar view with Spanish TV channels and live scores via WebSocket.

**Architecture:** Next.js App Router with custom Node.js server for Socket.io integration. Services layer wraps football-data.org API with in-memory caching. TV channels from static JSON config.

**Tech Stack:** Next.js 14, React 18, Socket.io 4, TypeScript, Tailwind CSS, date-fns, football-data.org API v4

---

## Reference: football-data.org API

- **Base URL:** `https://api.football-data.org/v4`
- **Auth header:** `X-Auth-Token: <API_KEY>`
- **Rate limit (free):** 10 requests/minute
- **Matches endpoint:** `GET /v4/matches?date=YYYY-MM-DD` (returns today if no date)
- **Match statuses:** SCHEDULED → TIMED → IN_PLAY → PAUSED → FINISHED (also: SUSPENDED, POSTPONED, CANCELLED)
- **"LIVE" is a pseudo-status** that combines IN_PLAY + PAUSED

### Free Tier Competition IDs

| ID | Code | Name |
|----|------|------|
| 2014 | PD | LaLiga |
| 2001 | CL | UEFA Champions League |
| 2021 | PL | Premier League |
| 2002 | BL1 | Bundesliga |
| 2015 | FL1 | Ligue 1 |
| 2019 | SA | Serie A |
| 2003 | DED | Eredivisie |
| 2017 | PPL | Primeira Liga |
| 2016 | ELC | Championship |
| 2013 | BSA | Série A (Brazil) |
| 2000 | WC | FIFA World Cup |
| 2018 | EC | European Championship |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `.env.local`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

**Step 1: Initialize Next.js project with TypeScript and Tailwind**

```bash
cd /Users/ivan/Documents/MyFutTv
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

Accept defaults. This creates the full Next.js scaffold with App Router, TypeScript, Tailwind, and ESLint.

**Step 2: Install additional dependencies**

```bash
npm install socket.io socket.io-client date-fns
npm install -D @types/node
```

**Step 3: Create environment files**

`.env.local`:
```
FOOTBALL_DATA_API_KEY=your_api_key_here
```

`.env.example`:
```
FOOTBALL_DATA_API_KEY=your_api_key_here
```

Get a free API key at https://www.football-data.org/ (register → check email → copy token).

**Step 4: Verify the app runs**

```bash
npm run dev
```

Expected: App loads at http://localhost:3000 with default Next.js page.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 2: TypeScript Types & Channel Config

**Files:**
- Create: `src/types/index.ts`
- Create: `src/data/channels.json`

**Step 1: Create shared TypeScript types**

`src/types/index.ts`:
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

// WebSocket events
export interface MatchUpdatePayload {
  matchId: number;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
  status: MatchStatus;
  minute: number | null;
}

// football-data.org API response shape
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
```

**Step 2: Create channels config**

`src/data/channels.json`:
```json
[
  {
    "competitionId": 2014,
    "competitionName": "LaLiga",
    "channel": "Movistar+ LaLiga",
    "notes": "Partidos seleccionados en LaLiga TV Bar"
  },
  {
    "competitionId": 2001,
    "competitionName": "Champions League",
    "channel": "Movistar+ Liga de Campeones"
  },
  {
    "competitionId": 2021,
    "competitionName": "Premier League",
    "channel": "DAZN"
  },
  {
    "competitionId": 2002,
    "competitionName": "Bundesliga",
    "channel": "OneFootball / LaLiga TV Bar"
  },
  {
    "competitionId": 2015,
    "competitionName": "Ligue 1",
    "channel": "DAZN"
  },
  {
    "competitionId": 2019,
    "competitionName": "Serie A",
    "channel": "DAZN"
  },
  {
    "competitionId": 2003,
    "competitionName": "Eredivisie",
    "channel": "No disponible en España"
  },
  {
    "competitionId": 2017,
    "competitionName": "Primeira Liga",
    "channel": "No disponible en España"
  },
  {
    "competitionId": 2016,
    "competitionName": "Championship",
    "channel": "DAZN"
  },
  {
    "competitionId": 2000,
    "competitionName": "FIFA World Cup",
    "channel": "TVE / Movistar+"
  },
  {
    "competitionId": 2018,
    "competitionName": "European Championship",
    "channel": "TVE / Movistar+"
  },
  {
    "competitionId": 2013,
    "competitionName": "Série A (Brazil)",
    "channel": "No disponible en España"
  }
]
```

**Step 3: Commit**

```bash
git add src/types/index.ts src/data/channels.json
git commit -m "feat: add TypeScript types and TV channel mappings"
```

---

### Task 3: Service Layer — FootballDataService

**Files:**
- Create: `src/services/footballData.ts`
- Create: `src/services/cache.ts`
- Create: `src/services/channels.ts`

**Step 1: Build the cache service**

`src/services/cache.ts`:
```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CacheService {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Singleton — survives across requests in the same server process
export const cache = new CacheService();
```

**Step 2: Build the channel service**

`src/services/channels.ts`:
```typescript
import channelsData from "@/data/channels.json";
import type { ChannelMapping } from "@/types";

const channelMap = new Map<number, ChannelMapping>();
for (const entry of channelsData as ChannelMapping[]) {
  channelMap.set(entry.competitionId, entry);
}

export function getChannelForCompetition(competitionId: number): string | undefined {
  return channelMap.get(competitionId)?.channel;
}

export function getAllChannels(): ChannelMapping[] {
  return channelsData as ChannelMapping[];
}
```

**Step 3: Build the football data service**

`src/services/footballData.ts`:
```typescript
import { cache } from "./cache";
import { getChannelForCompetition } from "./channels";
import type {
  Match,
  FootballDataMatchesResponse,
  FootballDataMatch,
  Competition,
} from "@/types";

const API_BASE = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

// Cache TTLs
const FUTURE_MATCHES_TTL = 60 * 60 * 1000; // 1 hour
const LIVE_MATCHES_TTL = 50 * 1000; // 50 seconds (poll every 60s)
const COMPETITIONS_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Free tier competition IDs
export const FREE_COMPETITION_IDS = [
  2014, 2001, 2021, 2002, 2015, 2019, 2003, 2017, 2016, 2013, 2000, 2018,
];

async function apiFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function mapMatch(raw: FootballDataMatch): Match {
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
    channel: getChannelForCompetition(raw.competition.id),
  };
}

export async function getMatchesByDate(date: string): Promise<Match[]> {
  const cacheKey = `matches:${date}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?date=${date}`
  );

  const matches = response.matches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map(mapMatch);

  // Use shorter TTL if any match is live
  const hasLive = matches.some((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
  cache.set(cacheKey, matches, hasLive ? LIVE_MATCHES_TTL : FUTURE_MATCHES_TTL);

  return matches;
}

export async function getMatchesByDateRange(
  dateFrom: string,
  dateTo: string
): Promise<Match[]> {
  const cacheKey = `matches:${dateFrom}:${dateTo}`;
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
  );

  const matches = response.matches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map(mapMatch);

  cache.set(cacheKey, matches, FUTURE_MATCHES_TTL);
  return matches;
}

export async function getLiveMatches(): Promise<Match[]> {
  const cacheKey = "matches:live";
  const cached = cache.get<Match[]>(cacheKey);
  if (cached) return cached;

  const response = await apiFetch<FootballDataMatchesResponse>(
    `/matches?status=LIVE`
  );

  const matches = response.matches
    .filter((m) => FREE_COMPETITION_IDS.includes(m.competition.id))
    .map(mapMatch);

  cache.set(cacheKey, matches, LIVE_MATCHES_TTL);
  return matches;
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
```

**Step 4: Commit**

```bash
git add src/services/
git commit -m "feat: add service layer (football API, cache, channels)"
```

---

### Task 4: API Routes

**Files:**
- Create: `src/app/api/matches/route.ts`
- Create: `src/app/api/leagues/route.ts`
- Create: `src/app/api/channels/route.ts`

**Step 1: Matches API route**

`src/app/api/matches/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getMatchesByDate, getMatchesByDateRange } from "@/services/footballData";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  try {
    let matches;

    if (date) {
      matches = await getMatchesByDate(date);
    } else if (dateFrom && dateTo) {
      matches = await getMatchesByDateRange(dateFrom, dateTo);
    } else {
      // Default: today
      const today = format(new Date(), "yyyy-MM-dd");
      matches = await getMatchesByDate(today);
    }

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
```

**Step 2: Leagues API route**

`src/app/api/leagues/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getCompetitions } from "@/services/footballData";

export async function GET() {
  try {
    const competitions = await getCompetitions();
    return NextResponse.json({ competitions });
  } catch (error) {
    console.error("Error fetching competitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 }
    );
  }
}
```

**Step 3: Channels API route**

`src/app/api/channels/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getAllChannels } from "@/services/channels";

export async function GET() {
  return NextResponse.json({ channels: getAllChannels() });
}
```

**Step 4: Verify API routes work**

```bash
npm run dev
# In another terminal:
curl http://localhost:3000/api/leagues
curl http://localhost:3000/api/channels
curl "http://localhost:3000/api/matches?date=2026-03-17"
```

Expected: JSON responses with competition data, channel mappings, and matches.

**Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat: add API routes for matches, leagues, and channels"
```

---

### Task 5: Custom Server with Socket.io

**Files:**
- Create: `server.ts`
- Create: `src/services/liveUpdater.ts`
- Modify: `package.json` (scripts)
- Modify: `tsconfig.json` (if needed for server)
- Create: `tsconfig.server.json`

**Step 1: Create the live updater service**

`src/services/liveUpdater.ts`:
```typescript
import { Server as SocketIOServer } from "socket.io";
import { getLiveMatches } from "./footballData";
import type { Match, MatchUpdatePayload } from "@/types";

let io: SocketIOServer | null = null;
let intervalId: NodeJS.Timeout | null = null;
let previousMatches = new Map<number, Match>();

export function initLiveUpdater(socketServer: SocketIOServer) {
  io = socketServer;

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("subscribe:leagues", ({ leagueIds }: { leagueIds: number[] }) => {
      // Join rooms for each league
      for (const id of leagueIds) {
        socket.join(`league:${id}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  startPolling();
}

function startPolling() {
  // Poll every 60 seconds
  intervalId = setInterval(async () => {
    try {
      await checkForUpdates();
    } catch (error) {
      console.error("Live updater error:", error);
    }
  }, 60_000);

  // Also run immediately once
  checkForUpdates().catch(console.error);
}

async function checkForUpdates() {
  if (!io) return;

  const liveMatches = await getLiveMatches();

  for (const match of liveMatches) {
    const prev = previousMatches.get(match.id);

    const hasChanged =
      !prev ||
      prev.status !== match.status ||
      prev.score.fullTime.home !== match.score.fullTime.home ||
      prev.score.fullTime.away !== match.score.fullTime.away ||
      prev.minute !== match.minute;

    if (hasChanged) {
      const payload: MatchUpdatePayload = {
        matchId: match.id,
        score: { fullTime: match.score.fullTime },
        status: match.status,
        minute: match.minute,
      };

      // Emit to the league room and also globally
      io.to(`league:${match.competition.id}`).emit("match:update", payload);
    }

    previousMatches.set(match.id, match);
  }

  // Clean up finished matches from tracking
  const liveIds = new Set(liveMatches.map((m) => m.id));
  for (const [id] of previousMatches) {
    if (!liveIds.has(id)) {
      previousMatches.delete(id);
    }
  }
}

export function stopLiveUpdater() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
```

**Step 2: Create the custom server**

`server.ts`:
```typescript
import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { initLiveUpdater } from "./src/services/liveUpdater";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : undefined,
    },
  });

  initLiveUpdater(io);

  httpServer.listen(port, () => {
    console.log(`> MyFutTV ready on http://${hostname}:${port}`);
  });
});
```

**Step 3: Create server tsconfig**

`tsconfig.server.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "./dist",
    "noEmit": false,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["server.ts", "src/services/**/*.ts", "src/types/**/*.ts", "src/data/**/*.json"]
}
```

**Step 4: Install tsx for running TypeScript server directly**

```bash
npm install -D tsx
```

**Step 5: Update package.json scripts**

Update the `scripts` in `package.json`:
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts",
    "lint": "next lint"
  }
}
```

**Step 6: Verify the custom server starts**

```bash
npm run dev
```

Expected: Console shows `> MyFutTV ready on http://localhost:3000` and the app loads normally. Check browser console for Socket.io connection.

**Step 7: Commit**

```bash
git add server.ts src/services/liveUpdater.ts tsconfig.server.json package.json
git commit -m "feat: add custom server with Socket.io and live match updater"
```

---

### Task 6: Client-Side Socket.io Setup & Hooks

**Files:**
- Create: `src/lib/socket.ts`
- Create: `src/hooks/useMatches.ts`
- Create: `src/hooks/usePreferences.ts`

**Step 1: Create socket client singleton**

`src/lib/socket.ts`:
```typescript
"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ autoConnect: true });
  }
  return socket;
}
```

**Step 2: Create the matches hook**

`src/hooks/useMatches.ts`:
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import type { Match, MatchUpdatePayload } from "@/types";

export function useMatches(date: string, selectedLeagues: number[]) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setMatches(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Fetch matches when date changes
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Subscribe to live updates
  useEffect(() => {
    const socket = getSocket();

    // Subscribe to selected leagues
    if (selectedLeagues.length > 0) {
      socket.emit("subscribe:leagues", { leagueIds: selectedLeagues });
    }

    const handleUpdate = (payload: MatchUpdatePayload) => {
      setMatches((prev) =>
        prev.map((match) =>
          match.id === payload.matchId
            ? {
                ...match,
                score: { ...match.score, fullTime: payload.score.fullTime },
                status: payload.status,
                minute: payload.minute,
              }
            : match
        )
      );
    };

    socket.on("match:update", handleUpdate);

    return () => {
      socket.off("match:update", handleUpdate);
    };
  }, [selectedLeagues]);

  // Filter by selected leagues
  const filteredMatches =
    selectedLeagues.length > 0
      ? matches.filter((m) => selectedLeagues.includes(m.competition.id))
      : matches;

  return { matches: filteredMatches, loading, error, refetch: fetchMatches };
}
```

**Step 3: Create preferences hook**

`src/hooks/usePreferences.ts`:
```typescript
"use client";

import { useState, useEffect } from "react";
import type { UserPreferences } from "@/types";
import { FREE_COMPETITION_IDS } from "@/services/footballData";

const STORAGE_KEY = "myfuttv-preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  selectedLeagues: [2014, 2001, 2021], // LaLiga, Champions, Premier by default
  timezone: "Europe/Madrid",
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleLeague = (leagueId: number) => {
    setPreferences((prev) => {
      const selected = prev.selectedLeagues.includes(leagueId)
        ? prev.selectedLeagues.filter((id) => id !== leagueId)
        : [...prev.selectedLeagues, leagueId];
      const next = { ...prev, selectedLeagues: selected };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { preferences, updatePreferences, toggleLeague };
}
```

**Step 4: Note on FREE_COMPETITION_IDS import**

The `usePreferences` hook references `FREE_COMPETITION_IDS` from the service — but since this is a client component, we can't import server code. Instead, export the IDs from a shared constants file. Create `src/lib/constants.ts`:

```typescript
export const FREE_COMPETITION_IDS = [
  2014, 2001, 2021, 2002, 2015, 2019, 2003, 2017, 2016, 2013, 2000, 2018,
];

export const DEFAULT_SELECTED_LEAGUES = [2014, 2001, 2021]; // LaLiga, Champions, Premier
```

Then update `src/services/footballData.ts` to import from `@/lib/constants` instead of defining it inline, and update `src/hooks/usePreferences.ts` to import from `@/lib/constants` too.

**Step 5: Commit**

```bash
git add src/lib/ src/hooks/
git commit -m "feat: add client-side socket, matches hook, and preferences hook"
```

---

### Task 7: MatchCard Component

**Files:**
- Create: `src/components/MatchCard.tsx`
- Create: `src/components/LiveIndicator.tsx`

**Step 1: Create LiveIndicator component**

`src/components/LiveIndicator.tsx`:
```tsx
"use client";

export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
      </span>
      EN DIRECTO
    </span>
  );
}
```

**Step 2: Create MatchCard component**

`src/components/MatchCard.tsx`:
```tsx
"use client";

import type { Match } from "@/types";
import { LiveIndicator } from "./LiveIndicator";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface MatchCardProps {
  match: Match;
}

function getStatusDisplay(match: Match) {
  switch (match.status) {
    case "IN_PLAY":
      return { label: <LiveIndicator />, showScore: true };
    case "PAUSED":
      return {
        label: <span className="text-xs font-medium text-orange-600">Descanso</span>,
        showScore: true,
      };
    case "FINISHED":
      return {
        label: <span className="text-xs font-medium text-gray-500">Finalizado</span>,
        showScore: true,
      };
    case "SCHEDULED":
    case "TIMED": {
      const matchDate = parseISO(match.utcDate);
      const timeStr = format(matchDate, "HH:mm", { locale: es });
      const distance = formatDistanceToNow(matchDate, { locale: es, addSuffix: true });
      const isFuture = matchDate > new Date();
      return {
        label: (
          <span className="text-xs text-gray-500">
            {isFuture ? `Empieza ${distance}` : timeStr}
          </span>
        ),
        showScore: false,
      };
    }
    case "POSTPONED":
      return {
        label: <span className="text-xs font-medium text-yellow-600">Aplazado</span>,
        showScore: false,
      };
    case "CANCELLED":
      return {
        label: <span className="text-xs font-medium text-red-500">Cancelado</span>,
        showScore: false,
      };
    default:
      return { label: null, showScore: false };
  }
}

export function MatchCard({ match }: MatchCardProps) {
  const { label: statusLabel, showScore } = getStatusDisplay(match);
  const matchTime = format(parseISO(match.utcDate), "HH:mm");

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header: competition + channel */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {match.competition.emblem && (
            <img
              src={match.competition.emblem}
              alt={match.competition.name}
              className="w-4 h-4"
            />
          )}
          <span className="text-xs font-medium text-gray-600">
            {match.competition.name}
          </span>
        </div>
        {match.channel && (
          <span className="text-xs text-gray-400">{match.channel}</span>
        )}
      </div>

      {/* Teams and score */}
      <div className="flex items-center justify-between">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1">
          {match.homeTeam.crest && (
            <img
              src={match.homeTeam.crest}
              alt={match.homeTeam.tla}
              className="w-6 h-6"
            />
          )}
          <span className="font-medium text-sm truncate">
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
        </div>

        {/* Score or time */}
        <div className="flex flex-col items-center mx-4 min-w-[60px]">
          {showScore ? (
            <span className="text-lg font-bold">
              {match.score.fullTime.home ?? 0} - {match.score.fullTime.away ?? 0}
            </span>
          ) : (
            <span className="text-lg font-semibold text-gray-700">{matchTime}</span>
          )}
          {match.minute && match.status === "IN_PLAY" && (
            <span className="text-xs text-red-500 font-medium">{match.minute}&apos;</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="font-medium text-sm truncate text-right">
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          {match.awayTeam.crest && (
            <img
              src={match.awayTeam.crest}
              alt={match.awayTeam.tla}
              className="w-6 h-6"
            />
          )}
        </div>
      </div>

      {/* Status footer */}
      <div className="mt-2 flex justify-center">{statusLabel}</div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/
git commit -m "feat: add MatchCard and LiveIndicator components"
```

---

### Task 8: LeagueFilter & DateNavigator Components

**Files:**
- Create: `src/components/LeagueFilter.tsx`
- Create: `src/components/DateNavigator.tsx`

**Step 1: Create LeagueFilter**

`src/components/LeagueFilter.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import type { Competition } from "@/types";

interface LeagueFilterProps {
  selectedLeagues: number[];
  onToggle: (leagueId: number) => void;
}

export function LeagueFilter({ selectedLeagues, onToggle }: LeagueFilterProps) {
  const [leagues, setLeagues] = useState<Competition[]>([]);

  useEffect(() => {
    fetch("/api/leagues")
      .then((res) => res.json())
      .then((data) => setLeagues(data.competitions))
      .catch(console.error);
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      {leagues.map((league) => {
        const isSelected = selectedLeagues.includes(league.id);
        return (
          <button
            key={league.id}
            onClick={() => onToggle(league.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isSelected
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {league.emblem && (
              <img src={league.emblem} alt="" className="w-4 h-4" />
            )}
            {league.name}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Create DateNavigator**

`src/components/DateNavigator.tsx`:
```tsx
"use client";

import { format, addDays, subDays, isToday } from "date-fns";
import { es } from "date-fns/locale";

interface DateNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function DateNavigator({ currentDate, onDateChange }: DateNavigatorProps) {
  const dateLabel = isToday(currentDate)
    ? "Hoy"
    : format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onDateChange(subDays(currentDate, 1))}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Día anterior"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center min-w-[250px]">
        <h2 className="text-lg font-semibold capitalize">{dateLabel}</h2>
        {isToday(currentDate) && (
          <p className="text-sm text-gray-500">
            {format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        )}
      </div>

      <button
        onClick={() => onDateChange(addDays(currentDate, 1))}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Día siguiente"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isToday(currentDate) && (
        <button
          onClick={() => onDateChange(new Date())}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/LeagueFilter.tsx src/components/DateNavigator.tsx
git commit -m "feat: add LeagueFilter and DateNavigator components"
```

---

### Task 9: DayView Component

**Files:**
- Create: `src/components/DayView.tsx`

**Step 1: Create DayView — groups matches by kick-off time**

`src/components/DayView.tsx`:
```tsx
"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MatchCard } from "./MatchCard";
import type { Match } from "@/types";

interface DayViewProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

export function DayView({ matches, loading, error }: DayViewProps) {
  // Group matches by hour
  const groupedMatches = useMemo(() => {
    const groups = new Map<string, Match[]>();

    const sorted = [...matches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );

    for (const match of sorted) {
      const time = format(parseISO(match.utcDate), "HH:mm", { locale: es });
      const group = groups.get(time) || [];
      group.push(match);
      groups.set(time, group);
    }

    return groups;
  }, [matches]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error al cargar los partidos: {error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No hay partidos programados para este día</p>
        <p className="text-sm mt-1">Prueba a seleccionar más ligas o cambia de fecha</p>
      </div>
    );
  }

  const liveCount = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  ).length;

  return (
    <div>
      {liveCount > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
          </span>
          <span className="text-red-600 font-medium">
            {liveCount} {liveCount === 1 ? "partido en directo" : "partidos en directo"}
          </span>
        </div>
      )}

      <div className="space-y-6">
        {Array.from(groupedMatches.entries()).map(([time, timeMatches]) => (
          <div key={time}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-gray-400">{time}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3">
              {timeMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/DayView.tsx
git commit -m "feat: add DayView component with time-grouped matches"
```

---

### Task 10: Main Page — Wire Everything Together

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Update globals.css**

Keep Tailwind directives and add minimal custom styles:

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #f8f9fa;
}
```

**Step 2: Update layout.tsx**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyFutTV — Calendario de Fútbol",
  description: "Partidos de fútbol en directo con canales de TV para España",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Step 3: Build the main page**

`src/app/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DateNavigator } from "@/components/DateNavigator";
import { LeagueFilter } from "@/components/LeagueFilter";
import { DayView } from "@/components/DayView";
import { useMatches } from "@/hooks/useMatches";
import { usePreferences } from "@/hooks/usePreferences";

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { preferences, toggleLeague } = usePreferences();
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const { matches, loading, error } = useMatches(dateStr, preferences.selectedLeagues);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">MyFutTV</h1>
          </div>

          <div className="flex justify-center mb-4">
            <DateNavigator currentDate={currentDate} onDateChange={setCurrentDate} />
          </div>

          <LeagueFilter
            selectedLeagues={preferences.selectedLeagues}
            onToggle={toggleLeague}
          />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <DayView matches={matches} loading={loading} error={error} />
      </div>
    </main>
  );
}
```

**Step 4: Verify the full app works end-to-end**

```bash
npm run dev
```

Open http://localhost:3000. Expected:
- Header with "MyFutTV", date navigator, and league filter chips
- Match cards grouped by time for today's date
- Navigating dates fetches new matches
- Toggling leagues filters the visible matches

**Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: wire up main page with day view, league filter, and date navigation"
```

---

### Task 11: WeekView & MonthView Components

**Files:**
- Create: `src/components/WeekView.tsx`
- Create: `src/components/MonthView.tsx`
- Create: `src/hooks/useMatchesRange.ts`

**Step 1: Create a hook for date ranges**

`src/hooks/useMatchesRange.ts`:
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Match } from "@/types";

export function useMatchesRange(dateFrom: string, dateTo: string, selectedLeagues: number[]) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMatches(data.matches);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const filtered =
    selectedLeagues.length > 0
      ? matches.filter((m) => selectedLeagues.includes(m.competition.id))
      : matches;

  return { matches: filtered, loading };
}
```

**Step 2: Create WeekView**

`src/components/WeekView.tsx`:
```tsx
"use client";

import { useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { useMatchesRange } from "@/hooks/useMatchesRange";
import type { Match } from "@/types";

interface WeekViewProps {
  currentDate: Date;
  selectedLeagues: number[];
  onDayClick: (date: Date) => void;
}

export function WeekView({ currentDate, selectedLeagues, onDayClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = addDays(weekStart, 6);

  const { matches, loading } = useMatchesRange(
    format(weekStart, "yyyy-MM-dd"),
    format(weekEnd, "yyyy-MM-dd"),
    selectedLeagues
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const dayMatches = matches.filter((m) =>
        isSameDay(parseISO(m.utcDate), date)
      );
      return { date, matches: dayMatches };
    });
  }, [weekStart, matches]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ date, matches: dayMatches }) => {
        const isToday = isSameDay(date, new Date());
        const liveCount = dayMatches.filter(
          (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
        ).length;

        return (
          <button
            key={date.toISOString()}
            onClick={() => onDayClick(date)}
            className={`p-3 rounded-lg border text-left transition-colors hover:bg-gray-50 ${
              isToday ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"
            }`}
          >
            <div className="text-xs text-gray-500 capitalize">
              {format(date, "EEE", { locale: es })}
            </div>
            <div className="text-lg font-semibold">{format(date, "d")}</div>
            {dayMatches.length > 0 && (
              <div className="mt-1 text-xs text-gray-600">
                {dayMatches.length} {dayMatches.length === 1 ? "partido" : "partidos"}
              </div>
            )}
            {liveCount > 0 && (
              <div className="mt-0.5 text-xs text-red-500 font-medium">
                {liveCount} en directo
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 3: Create MonthView**

`src/components/MonthView.tsx`:
```tsx
"use client";

import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { useMatchesRange } from "@/hooks/useMatchesRange";

interface MonthViewProps {
  currentDate: Date;
  selectedLeagues: number[];
  onDayClick: (date: Date) => void;
}

export function MonthView({ currentDate, selectedLeagues, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { matches, loading } = useMatchesRange(
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd"),
    selectedLeagues
  );

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [calStart, calEnd]);

  const dayHeaders = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div>
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-gray-500 py-2">
            {h}
          </div>
        ))}

        {weeks.flat().map((date) => {
          const inMonth = isSameMonth(date, currentDate);
          const isToday = isSameDay(date, new Date());
          const dayMatches = matches.filter((m) =>
            isSameDay(parseISO(m.utcDate), date)
          );

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDayClick(date)}
              className={`p-2 rounded-lg text-center transition-colors min-h-[60px] ${
                !inMonth ? "text-gray-300" : "hover:bg-gray-50"
              } ${isToday ? "bg-green-50 border border-green-400" : ""}`}
            >
              <div className="text-sm">{format(date, "d")}</div>
              {dayMatches.length > 0 && inMonth && (
                <div className="mt-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                    {dayMatches.length}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/WeekView.tsx src/components/MonthView.tsx src/hooks/useMatchesRange.ts
git commit -m "feat: add WeekView and MonthView calendar components"
```

---

### Task 12: Integrate View Switcher into Main Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/ViewSwitcher.tsx`

**Step 1: Create ViewSwitcher component**

`src/components/ViewSwitcher.tsx`:
```tsx
"use client";

import type { CalendarView } from "@/types";

interface ViewSwitcherProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const views: { id: CalendarView; label: string }[] = [
  { id: "day", label: "Día" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
      {views.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            currentView === id
              ? "bg-green-600 text-white"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Update main page to support all views**

Replace `src/app/page.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DateNavigator } from "@/components/DateNavigator";
import { LeagueFilter } from "@/components/LeagueFilter";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { DayView } from "@/components/DayView";
import { WeekView } from "@/components/WeekView";
import { MonthView } from "@/components/MonthView";
import { useMatches } from "@/hooks/useMatches";
import { usePreferences } from "@/hooks/usePreferences";
import type { CalendarView } from "@/types";

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("day");
  const { preferences, toggleLeague } = usePreferences();
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const { matches, loading, error } = useMatches(dateStr, preferences.selectedLeagues);

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">MyFutTV</h1>
            <ViewSwitcher currentView={view} onViewChange={setView} />
          </div>

          <div className="flex justify-center mb-4">
            <DateNavigator currentDate={currentDate} onDateChange={setCurrentDate} />
          </div>

          <LeagueFilter
            selectedLeagues={preferences.selectedLeagues}
            onToggle={toggleLeague}
          />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {view === "day" && (
          <DayView matches={matches} loading={loading} error={error} />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            selectedLeagues={preferences.selectedLeagues}
            onDayClick={handleDayClick}
          />
        )}
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            selectedLeagues={preferences.selectedLeagues}
            onDayClick={handleDayClick}
          />
        )}
      </div>
    </main>
  );
}
```

**Step 3: Verify all three views work**

```bash
npm run dev
```

Test switching between Day, Week, and Month views. Click a day in Week/Month to drill into Day view.

**Step 4: Commit**

```bash
git add src/components/ViewSwitcher.tsx src/app/page.tsx
git commit -m "feat: add view switcher with day, week, and month calendar views"
```

---

### Task 13: Next.js Image Configuration & Polish

**Files:**
- Modify: `next.config.js`

**Step 1: Configure remote images**

The team crests and competition emblems come from football-data.org. Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "crests.football-data.org",
      },
    ],
  },
};

module.exports = nextConfig;
```

Note: Since we're using `<img>` tags (not Next.js `<Image>`), this is optional. If you later switch to `<Image>`, this config is needed.

**Step 2: Commit**

```bash
git add next.config.js
git commit -m "feat: configure Next.js for remote football crest images"
```

---

### Task 14: End-to-End Manual Testing & Bug Fixes

**Step 1: Get a football-data.org API key**

1. Go to https://www.football-data.org/
2. Register for a free account
3. Copy the API token from your profile
4. Paste it in `.env.local` as `FOOTBALL_DATA_API_KEY=your_token`

**Step 2: Start the app and test**

```bash
npm run dev
```

Test checklist:
- [ ] App loads at http://localhost:3000
- [ ] League chips appear and can be toggled
- [ ] Day view shows matches grouped by time
- [ ] Date navigation (forward/back) loads new matches
- [ ] "Hoy" button returns to today
- [ ] Week view shows 7-day grid with match counts
- [ ] Month view shows calendar with match indicators
- [ ] Clicking a day in Week/Month switches to Day view
- [ ] Match cards show team names, crests, score/time, competition, and TV channel
- [ ] Live matches (if any) show pulsing red indicator
- [ ] WebSocket connection established (check browser console for Socket.io)

**Step 3: Fix any issues found during testing**

Address bugs as they come up. Common issues to watch for:
- CORS errors with football-data.org API (should work since requests go through our API routes)
- Missing crests (some teams may not have crest URLs)
- Timezone display issues (dates should display in local time)

**Step 4: Commit fixes**

```bash
git add .
git commit -m "fix: address issues found during end-to-end testing"
```

---

### Task 15: Dockerfile for Deployment

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: Create Dockerfile**

`Dockerfile`:
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/next.config.js ./
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["npx", "tsx", "server.ts"]
```

**Step 2: Create .dockerignore**

`.dockerignore`:
```
node_modules
.next
.git
.env.local
```

**Step 3: Verify Docker build**

```bash
docker build -t myfuttv .
docker run -p 3000:3000 -e FOOTBALL_DATA_API_KEY=your_key myfuttv
```

Expected: App runs in container at http://localhost:3000.

**Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add Dockerfile for production deployment"
```

---

## Summary of Tasks

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Project scaffolding (Next.js + deps) | 5 |
| 2 | TypeScript types & channel config | 3 |
| 3 | Service layer (API, cache, channels) | 4 |
| 4 | API routes (matches, leagues, channels) | 5 |
| 5 | Custom server with Socket.io | 7 |
| 6 | Client socket + hooks | 5 |
| 7 | MatchCard & LiveIndicator | 3 |
| 8 | LeagueFilter & DateNavigator | 3 |
| 9 | DayView component | 2 |
| 10 | Main page integration | 5 |
| 11 | WeekView & MonthView | 4 |
| 12 | View switcher integration | 4 |
| 13 | Image config & polish | 2 |
| 14 | End-to-end testing | 4 |
| 15 | Dockerfile for deployment | 4 |

**Total: 15 tasks, ~60 steps**
