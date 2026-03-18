# Vercel Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the app from Render (custom server) to Vercel (serverless) by removing Socket.IO and replacing live updates with client-side polling.

**Architecture:** Delete the custom Node.js server and Socket.IO infrastructure. The Next.js API routes already work as serverless functions. Live match updates switch from server-push (Socket.IO) to client-pull (setInterval every 60s, only when viewing today's matches).

**Tech Stack:** Next.js 16, Vercel CLI, Tailwind CSS, football-data.org API.

---

### Task 1: Delete Socket.IO infrastructure files

**Files:**
- Delete: `server.ts`
- Delete: `src/services/liveUpdater.ts`
- Delete: `src/lib/socket.ts`

**Step 1: Delete the three files**

```bash
rm server.ts src/services/liveUpdater.ts src/lib/socket.ts
```

**Step 2: Verify they're gone**

```bash
ls server.ts src/services/liveUpdater.ts src/lib/socket.ts
```
Expected: `No such file or directory` for all three.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Socket.IO server and live updater"
```

---

### Task 2: Update package.json scripts and dependencies

**Files:**
- Modify: `package.json`

**Step 1: Replace the scripts block**

In `package.json`, change the `"scripts"` section from:
```json
"scripts": {
  "dev": "tsx server.ts",
  "build": "next build",
  "start": "NODE_ENV=production tsx server.ts",
  "lint": "eslint"
}
```
To:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

**Step 2: Remove socket.io packages and tsx from package.json**

Remove from `"dependencies"`:
- `"socket.io": "^4.8.3"`
- `"socket.io-client": "^4.8.3"`

Remove from `"devDependencies"`:
- `"tsx": "^4.21.0"`

Also remove the `"engines"` block (not needed for Vercel):
```json
"engines": {
  "node": ">=20"
}
```

**Step 3: Run npm install to update package-lock.json**

```bash
npm install
```

**Step 4: Verify the app starts with next dev**

```bash
npm run dev
```
Expected: Server starts on http://localhost:3000 without errors. Visit the page and verify matches load.
Stop with Ctrl+C.

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: switch to standard next dev/start, remove socket.io deps"
```

---

### Task 3: Replace Socket.IO polling with setInterval in useMatches

**Files:**
- Modify: `src/hooks/useMatches.ts`

**Step 1: Rewrite the hook**

Replace the full content of `src/hooks/useMatches.ts` with:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Match } from "@/types";

const POLL_INTERVAL = 60_000;

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

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

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Poll every 60s when viewing today's matches (live scores may change)
  useEffect(() => {
    if (!isToday(date)) return;
    const id = setInterval(fetchMatches, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [date, fetchMatches]);

  const filteredMatches =
    selectedLeagues.length > 0
      ? matches.filter((m) => selectedLeagues.includes(m.competition.id))
      : matches;

  return { matches: filteredMatches, loading, error, refetch: fetchMatches };
}
```

**Step 2: Verify no import errors**

```bash
npm run build
```
Expected: Build completes with no TypeScript or import errors.

**Step 3: Commit**

```bash
git add src/hooks/useMatches.ts
git commit -m "feat: replace Socket.IO with client-side polling in useMatches"
```

---

### Task 4: Create vercel.json

**Files:**
- Create: `vercel.json`

**Step 1: Create the file**

```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

The `maxDuration: 30` gives API routes 30 seconds to respond — needed because TV channel scraping from fichajes.com can be slow.

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json with 30s max duration for API routes"
```

---

### Task 5: Deploy to Vercel

**Step 1: Install Vercel CLI if not present**

```bash
vercel --version
```
If not found: `npm install -g vercel`

**Step 2: Login to Vercel**

```bash
vercel login
```
Follow the browser prompt to authenticate.

**Step 3: Link the project to Vercel**

From the project root:
```bash
vercel link
```
- Choose your existing Vercel account
- Create a new project named `myfuttv` (or similar)

**Step 4: Set the environment variable**

```bash
vercel env add FOOTBALL_DATA_API_KEY production
```
Paste your API key when prompted.

Also add it for preview and development:
```bash
vercel env add FOOTBALL_DATA_API_KEY preview
vercel env add FOOTBALL_DATA_API_KEY development
```

**Step 5: Deploy to production**

```bash
vercel --prod
```
Expected: Build succeeds, deployment URL printed (e.g. `https://myfuttv.vercel.app`).

**Step 6: Verify the deployed app**

Open the deployment URL in the browser and confirm:
- Matches load for today
- League filter works
- Week/month views load
- No console errors related to socket.io

---

### Task 6: Push final state to GitHub

**Step 1: Push all commits**

```bash
git push origin main
```

Vercel will auto-deploy on every future push to `main` via the GitHub integration.
