# Analytics Design — MyFutTv

**Date:** 2026-03-23
**Plan:** Hobby (no custom events)
**Option selected:** B — Web Analytics + Speed Insights + Structured API Logging

---

## Goal

Add observability to MyFutTv with zero cost on Hobby plan:
1. Automatic pageviews + Core Web Vitals via Vercel first-party packages
2. Structured JSON logging in `/api/matches` for scraper health monitoring

---

## Components

### 1. Web Analytics + Speed Insights

**Packages:** `@vercel/analytics`, `@vercel/speed-insights`

**Change:** Add both components to `src/app/layout.tsx` inside `<body>`.

```tsx
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Inside RootLayout, at end of <body>:
<Analytics />
<SpeedInsights />
```

**What this gives us:**
- Pageviews, countries, devices, referrers (Vercel dashboard → Analytics tab)
- Core Web Vitals per route: LCP, INP, CLS, FCP, TTFB (Speed Insights tab)

---

### 2. Structured Logging in `/api/matches`

Add structured `console.log` / `console.error` calls at key points in the matches API route.

#### Log shapes

**Successful fetch:**
```json
{ "level": "info", "msg": "matches_fetch", "date": "2026-03-23", "cached": true, "count": 7, "ms": 84 }
```

**Channel scraper — found:**
```json
{ "level": "info", "msg": "channels_scraped", "match": "Real Madrid vs Barça", "found": true, "ms": 340 }
```

**Channel scraper — not found (warning):**
```json
{ "level": "warn", "msg": "channels_scraped", "match": "Atlético vs Sevilla", "found": false, "ms": 890 }
```

**Scraper error (e.g. selector changed):**
```json
{ "level": "error", "msg": "scraper_failed", "scraper": "fichajes", "error": "selector not found", "ms": 1200 }
```

**API request summary (start + end):**
```json
{ "level": "info", "msg": "request_start", "route": "/api/matches", "date": "2026-03-23" }
{ "level": "info", "msg": "request_done", "route": "/api/matches", "ms": 430 }
```

#### Where to add logs

- `src/app/api/matches/route.ts` — request start/end + overall timing
- `src/services/tvScraper.ts` — per-match channel found/not-found + errors

---

## Out of Scope

- Custom events (Pro only)
- Drains / external log forwarding
- Logging in `/api/leagues` or `/api/channels` (low value, rarely called)

---

## Files to Change

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add `<Analytics />` + `<SpeedInsights />` |
| `src/app/api/matches/route.ts` | Add structured request logging |
| `src/services/tvScraper.ts` | Add per-scrape structured logging |
| `package.json` | Add `@vercel/analytics` + `@vercel/speed-insights` |
