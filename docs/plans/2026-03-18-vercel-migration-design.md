# Design: Migrate from Render to Vercel

**Date:** 2026-03-18
**Status:** Approved

## Problem

The app uses a custom Node.js server (`server.ts`) with Socket.IO for real-time live match updates. Render supports this, but Vercel (serverless) does not.

## Solution: Client-side polling (Option A)

Replace Socket.IO push with client-side polling every 60s. Since the live updater already polls every 60s server-side, the UX impact is negligible.

## Files to Delete

- `server.ts`
- `src/services/liveUpdater.ts`
- `src/lib/socket.ts`

## Files to Modify

### `package.json`
- `"dev": "next dev"` (was `tsx server.ts`)
- `"start": "next start"` (was `NODE_ENV=production tsx server.ts`)
- Remove dependencies: `socket.io`, `socket.io-client`
- Remove devDependency: `tsx`

### `src/hooks/useMatches.ts`
- Remove all Socket.IO import and subscription logic
- Add `setInterval` of 60s, active only when the queried date is today
- Polling calls the existing `fetchMatches` function

## Files to Create

### `vercel.json`
```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

## Known Trade-offs

- In-memory cache (`src/services/cache.ts`) is not shared across serverless instances. Each cold start begins with an empty cache. Acceptable given the 1h TTL for future matches.

## Environment Variables

`FOOTBALL_DATA_API_KEY` must be set in the Vercel project dashboard.
