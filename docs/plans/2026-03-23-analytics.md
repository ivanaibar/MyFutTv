# Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Web Analytics, Speed Insights, and structured API logging to MyFutTv on Vercel Hobby plan.

**Architecture:** Install `@vercel/analytics` + `@vercel/speed-insights` and register both in the root layout. Add structured `console.log/warn/error` calls in the matches API route and TV scraper — these appear in Vercel's runtime log viewer automatically.

**Tech Stack:** Next.js 16 App Router, `@vercel/analytics`, `@vercel/speed-insights`, TypeScript.

---

### Task 1: Install packages

**Files:**
- Modify: `package.json` (via npm)

**Step 1: Install**

```bash
npm install @vercel/analytics @vercel/speed-insights
```

**Step 2: Verify**

```bash
grep -E '"@vercel/(analytics|speed-insights)"' package.json
```

Expected: both packages appear in `dependencies`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @vercel/analytics and @vercel/speed-insights"
```

---

### Task 2: Add Analytics + SpeedInsights to layout

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Replace the file content**

Current file (`src/app/layout.tsx`) has a simple `<body>{children}</body>`. Replace with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyFutTV — Calendario de Futbol",
  description: "Partidos de futbol en directo con canales de TV para Espana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="stadium">
      <body className={inter.className}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add Vercel Analytics and Speed Insights"
```

---

### Task 3: Add structured logging to /api/matches

**Files:**
- Modify: `src/app/api/matches/route.ts`

**Step 1: Replace the file content**

Add timing + structured logs around the existing logic:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getMatchesByDate, getMatchesByDateRange } from "@/services/footballData";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const queryKey = date ?? (dateFrom && dateTo ? `${dateFrom}..${dateTo}` : "today");
  console.log(JSON.stringify({ level: "info", msg: "request_start", route: "/api/matches", query: queryKey }));

  try {
    let matches;

    if (date) {
      matches = await getMatchesByDate(date);
    } else if (dateFrom && dateTo) {
      matches = await getMatchesByDateRange(dateFrom, dateTo);
    } else {
      const today = format(new Date(), "yyyy-MM-dd");
      matches = await getMatchesByDate(today);
    }

    console.log(JSON.stringify({ level: "info", msg: "request_done", route: "/api/matches", query: queryKey, count: matches.length, ms: Date.now() - start }));
    return NextResponse.json({ matches });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "request_failed", route: "/api/matches", query: queryKey, error: error instanceof Error ? error.message : String(error), ms: Date.now() - start }));
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify**

```bash
npm run build
```

Expected: no TypeScript errors.

**Step 3: Commit**

```bash
git add src/app/api/matches/route.ts
git commit -m "feat: add structured logging to /api/matches"
```

---

### Task 4: Add structured logging to tvScraper

**Files:**
- Modify: `src/services/tvScraper.ts`

The scraper has two relevant spots:
1. `scrapeTvChannels` — HTTP fetch, cache hit, and errors (lines 27–56)
2. No per-match logging needed at `findChannel` level (it's pure in-memory)

**Step 1: Modify `scrapeTvChannels`**

Replace the function body of `scrapeTvChannels` (lines 17–57) with:

```ts
export async function scrapeTvChannels(
  date: string
): Promise<Map<string, string>> {
  const cacheKey = `tv:${date}`;
  const cached = cache.get<Map<string, string>>(cacheKey);
  if (cached) {
    console.log(JSON.stringify({ level: "info", msg: "scraper_cache_hit", date }));
    return cached;
  }

  const channelMap = new Map<string, string>();
  const start = Date.now();

  try {
    const res = await fetch("https://www.fichajes.com/futbol-tele/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        Referer: "https://www.google.es/",
      },
    });

    if (!res.ok) {
      console.error(JSON.stringify({ level: "error", msg: "scraper_http_error", scraper: "fichajes", status: res.status, ms: Date.now() - start }));
      return channelMap;
    }

    const html = await res.text();
    const matches = parseMatchesFromHtml(html);

    let found = 0;
    for (const match of matches) {
      if (match.channels.length > 0) {
        const key = makeMatchKey(match.homeTeam, match.awayTeam);
        channelMap.set(key, match.channels.join(" / "));
        found++;
      }
    }

    console.log(JSON.stringify({ level: "info", msg: "scraper_done", scraper: "fichajes", date, total: matches.length, with_channels: found, ms: Date.now() - start }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "scraper_failed", scraper: "fichajes", date, error: error instanceof Error ? error.message : String(error), ms: Date.now() - start }));
  }

  cache.set(cacheKey, channelMap, TV_SCRAPE_TTL);
  return channelMap;
}
```

**Step 2: Verify**

```bash
npm run build
```

Expected: no TypeScript errors.

**Step 3: Commit**

```bash
git add src/services/tvScraper.ts
git commit -m "feat: add structured logging to tvScraper"
```

---

### Task 5: Final verification + push

**Step 1: Run dev server and check logs in terminal**

```bash
npm run dev
```

Open `http://localhost:3000` in the browser. Check terminal output — you should see structured JSON lines appearing when the matches API is called, e.g.:

```
{"level":"info","msg":"request_start","route":"/api/matches","query":"2026-03-23"}
{"level":"info","msg":"scraper_cache_hit","date":"2026-03-23"}
{"level":"info","msg":"request_done","route":"/api/matches","query":"2026-03-23","count":5,"ms":84}
```

**Step 2: Push to origin**

```bash
git push origin main
```

**Step 3: Verify Vercel deployment**

Once deployed, go to:
- `https://vercel.com/dashboard` → your project → **Analytics** tab (pageviews visible after first visit)
- **Speed Insights** tab (CWV data appears after a few real visits)
- **Logs** tab → filter by function `/api/matches` → confirm JSON logs appear
