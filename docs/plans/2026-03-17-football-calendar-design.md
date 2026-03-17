# MyFutTV — Football Calendar App Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

Web application that displays professional football matches in a calendar format, showing TV channels for Spain and live scores with real-time updates via WebSockets.

**Audience:** Small group of friends (no auth required).

## Architecture

**Stack:** Next.js (App Router) + Custom Server + Socket.io + football-data.org API

```
Client (Browser)
  Next.js React App + Socket.io Client
  ├── Calendar views (day/week/month)
  ├── League filter (user-selectable)
  └── Live score updates
        │ HTTP (REST)        │ WebSocket
        ▼                    ▼
Server (Node.js)
  Next.js Custom Server + Socket.io
  ├── API Routes (/api/matches, /api/leagues, /api/channels)
  ├── WebSocket Manager (Socket.io)
  ├── Cron Polling (every 60s for live matches)
  └── Service Layer
      ├── FootballDataService (external API)
      ├── ChannelService (JSON config)
      └── CacheService (in-memory)
              │
              ▼
      football-data.org API (Free: 10 req/min)
```

### Key decisions

- **Custom Server** for Next.js to integrate Socket.io in the same process
- **In-memory cache** to respect API rate limits (10 req/min free tier)
- **Cron job** polls only when matches are live; sleeps otherwise
- **channels.json** for TV channel mappings (edited manually per season)
- **localStorage** for user preferences (selected leagues, timezone)

## Data Model

```typescript
interface Match {
  id: number;
  homeTeam: { name: string; crest: string };
  awayTeam: { name: string; crest: string };
  competition: { id: number; name: string; emblem: string };
  utcDate: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED';
  score: { home: number | null; away: number | null };
  minute?: number;
  channel?: string;
}

interface ChannelMapping {
  competitionId: number;
  competitionName: string;
  channel: string;
  notes?: string;
}

interface UserPreferences {
  selectedLeagues: number[];
  timezone: string; // Default: "Europe/Madrid"
}
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/matches?date=YYYY-MM-DD` | GET | Matches for a specific day (with TV channel) |
| `/api/matches?dateFrom=...&dateTo=...` | GET | Matches in date range |
| `/api/leagues` | GET | Available leagues |
| `/api/channels` | GET | Competition → TV channel mapping |

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `match:update` | Server → Client | `{ matchId, score, status, minute }` |
| `subscribe:leagues` | Client → Server | `{ leagueIds: number[] }` |

## UI Components

| Component | Responsibility |
|-----------|---------------|
| `CalendarView` | Main container, date & view mode management |
| `DayView` | Match list grouped by kick-off time |
| `WeekView` | 7-day grid with match summaries |
| `MonthView` | Monthly calendar with match count indicators |
| `MatchCard` | Individual match card (teams, score, channel, status) |
| `LeagueFilter` | League selector (checkbox chips) |
| `LiveIndicator` | Pulsing red "LIVE" badge |
| `DateNavigator` | Date navigation (arrows + picker) |

### Match card visual states

- **Scheduled:** Time + "Starts in Xh"
- **In play:** Score + minute + red pulsing "LIVE" indicator
- **Half-time:** Score + "Half-time"
- **Finished:** Final score + "Finished"

## Real-time Update Flow

1. Cron job (every 60s) queries football-data.org for LIVE/IN_PLAY matches
2. Compares with cached state — emits `match:update` via Socket.io on changes
3. Client updates only affected MatchCard (no full re-render)
4. Cron sleeps when no matches are live

## Rate Limiting Strategy

- Free tier: 10 requests/min
- Future matches cached for 1 hour
- Live matches polled every 60 seconds
- Batch requests where possible

## TV Channels (channels.json)

Manually maintained JSON mapping competitions to Spanish TV channels. Updated per season when broadcasting rights change. Example entries:

- LaLiga → Movistar+ LaLiga
- Champions League → Movistar+ Liga de Campeones
- Premier League → DAZN

## Deployment

- **Railway** or **Fly.io** (needs persistent process for Socket.io)
- Alternative: Hetzner VPS (~4€/month) with Docker
