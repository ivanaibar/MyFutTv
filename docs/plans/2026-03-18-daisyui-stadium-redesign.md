# DaisyUI Stadium Night Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign MyFutTV with a dark "stadium at night" aesthetic using daisyUI v5 on Tailwind v4.

**Architecture:** Install daisyUI v5 (CSS-based, no JS config), define a custom `stadium` dark theme with green/amber/blue tokens, then restyle all components from the outside in: global theme → structural components → MatchCard → views.

**Tech Stack:** daisyUI v5, Tailwind v4, Next.js 16 App Router, TypeScript

---

## Task 1: Install daisyUI v5 and configure the stadium theme

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Step 1: Install daisyUI v5**

```bash
npm install daisyui@latest
```

Expected: daisyUI v5.x installed. Verify with `npm ls daisyui`.

**Step 2: Replace `src/app/globals.css` entirely**

```css
@import "tailwindcss";
@plugin "daisyui";

@plugin "daisyui/theme" {
  name: "stadium";
  default: true;
  color-scheme: dark;

  --color-base-100: oklch(16% 0.03 240);
  --color-base-200: oklch(20% 0.04 240);
  --color-base-300: oklch(24% 0.04 240);
  --color-base-content: oklch(90% 0.01 240);

  --color-primary: oklch(50% 0.15 145);
  --color-primary-content: oklch(97% 0.02 145);

  --color-secondary: oklch(72% 0.17 70);
  --color-secondary-content: oklch(15% 0.03 70);

  --color-accent: oklch(72% 0.14 210);
  --color-accent-content: oklch(15% 0.03 210);

  --color-neutral: oklch(24% 0.04 240);
  --color-neutral-content: oklch(90% 0.01 240);

  --color-info: oklch(72% 0.14 210);
  --color-success: oklch(50% 0.15 145);
  --color-warning: oklch(72% 0.17 70);
  --color-error: oklch(55% 0.22 25);
  --color-error-content: oklch(97% 0.01 25);

  --radius-box: 0.5rem;
  --radius-btn: 0.375rem;
}

body {
  background: linear-gradient(160deg, oklch(16% 0.03 240) 0%, oklch(13% 0.03 240) 100%);
  min-height: 100vh;
}
```

**Step 3: Add `data-theme` to `src/app/layout.tsx`**

Change:
```tsx
<html lang="es">
```
To:
```tsx
<html lang="es" data-theme="stadium">
```

**Step 4: Verify dev server starts without errors**

```bash
npm run dev
```

Open `http://localhost:3000`. The page should now have a dark background. No compilation errors in terminal.

**Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx package.json package-lock.json
git commit -m "feat: install daisyui v5 and configure stadium dark theme"
```

---

## Task 2: Restyle MatchCard

**Files:**
- Modify: `src/components/MatchCard.tsx`
- Modify: `src/components/LiveIndicator.tsx`

**Step 1: Replace `src/components/LiveIndicator.tsx`**

```tsx
"use client";

export function LiveIndicator() {
  return (
    <span className="badge badge-error gap-1.5 text-xs font-bold animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-error-content" />
      EN DIRECTO
    </span>
  );
}
```

**Step 2: Replace `src/components/MatchCard.tsx` entirely**

```tsx
"use client";

import type { Match, Goal } from "@/types";
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
        label: <span className="badge badge-warning text-xs font-medium">Descanso</span>,
        showScore: true,
      };
    case "FINISHED":
      return {
        label: <span className="badge badge-ghost text-xs font-medium opacity-60">Finalizado</span>,
        showScore: true,
      };
    case "SCHEDULED":
    case "TIMED": {
      const matchDate = parseISO(match.utcDate);
      const distance = formatDistanceToNow(matchDate, { locale: es, addSuffix: true });
      const isFuture = matchDate > new Date();
      return {
        label: (
          <span className="text-xs text-base-content/50">
            {isFuture ? `Empieza ${distance}` : format(matchDate, "HH:mm", { locale: es })}
          </span>
        ),
        showScore: false,
      };
    }
    case "POSTPONED":
      return {
        label: <span className="badge badge-warning badge-outline text-xs">Aplazado</span>,
        showScore: false,
      };
    case "CANCELLED":
      return {
        label: <span className="badge badge-error badge-outline text-xs">Cancelado</span>,
        showScore: false,
      };
    default:
      return { label: null, showScore: false };
  }
}

function GoalList({ goals, side }: { goals: Goal[]; side: "home" | "away" }) {
  const sideGoals = goals.filter((g) => g.team === side);
  if (sideGoals.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {sideGoals.map((g) => (
        <li
          key={`${g.minute}-${g.scorer}-${g.type}`}
          className={`text-xs text-base-content/40 leading-tight${side === "away" ? " text-right" : ""}`}
        >
          ⚽ {g.minute}' {g.scorer}
          {g.type === "PENALTY" && <span className="text-base-content/30"> (pp)</span>}
          {g.type === "OWN_GOAL" && <span className="text-base-content/30"> (en)</span>}
        </li>
      ))}
    </ul>
  );
}

export function MatchCard({ match }: MatchCardProps) {
  const { label: statusLabel, showScore } = getStatusDisplay(match);
  const matchTime = format(parseISO(match.utcDate), "HH:mm");

  return (
    <div className="card bg-base-200 border border-base-300 hover:border-primary/40 hover:bg-base-300 transition-all duration-200 overflow-hidden rounded-lg">
      {/* Competition row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          {match.competition.emblem && (
            <img
              src={match.competition.emblem}
              alt={match.competition.name}
              className="w-4 h-4 opacity-80"
            />
          )}
          <span className="text-xs font-medium text-base-content/60">
            {match.competition.name}
          </span>
        </div>
        {statusLabel}
      </div>

      {/* Teams + score row */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.homeTeam.crest && (
            <img
              src={match.homeTeam.crest}
              alt={match.homeTeam.tla}
              className="w-8 h-8 shrink-0"
            />
          )}
          <span className="font-bold text-base text-base-content truncate">
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
        </div>

        <div className="flex flex-col items-center mx-3 sm:mx-4 min-w-[60px] sm:min-w-[72px]">
          {showScore ? (
            <span className="text-3xl font-black text-secondary tabular-nums">
              {match.score.fullTime.home ?? 0} - {match.score.fullTime.away ?? 0}
            </span>
          ) : (
            <span className="text-xl font-semibold text-base-content/70 tabular-nums">
              {matchTime}
            </span>
          )}
          {match.minute && match.status === "IN_PLAY" && (
            <span className="text-xs text-secondary font-bold">{match.minute}&apos;</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span className="font-bold text-base text-base-content truncate text-right">
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          {match.awayTeam.crest && (
            <img
              src={match.awayTeam.crest}
              alt={match.awayTeam.tla}
              className="w-8 h-8 shrink-0"
            />
          )}
        </div>
      </div>

      {/* Goal scorers */}
      {match.goals && match.goals.length > 0 && (
        <div className="flex justify-between px-4 pb-2 gap-2">
          <div className="flex-1 min-w-0">
            <GoalList goals={match.goals} side="home" />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <GoalList goals={match.goals} side="away" />
          </div>
        </div>
      )}

      {/* Channel footer */}
      {match.channel ? (
        <div className="px-4 py-2 flex items-center gap-2 bg-primary/10 border-t border-primary/20">
          <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-primary">{match.channel}</span>
        </div>
      ) : (
        <div className="px-4 py-1.5 flex items-center gap-2 bg-base-300/50 border-t border-base-300">
          <svg className="w-3.5 h-3.5 text-base-content/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-base-content/30">Canal no disponible</span>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify in browser**

Open `http://localhost:3000`. Match cards should:
- Have dark `bg-base-200` background
- Show score in large amber/gold numbers
- Show "EN DIRECTO" as a red pulsing badge
- Show TV channel bar with green tint
- Show goal scorers in subtle `text-base-content/40`

**Step 4: Commit**

```bash
git add src/components/MatchCard.tsx src/components/LiveIndicator.tsx
git commit -m "feat: restyle MatchCard and LiveIndicator with stadium theme"
```

---

## Task 3: Restyle DayView

**Files:**
- Modify: `src/components/DayView.tsx`

**Step 1: Replace `src/components/DayView.tsx` entirely**

Read the current file first, then replace with this version. The logic (groupedMatches, liveCount) is unchanged — only the JSX/classes change.

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
      <div className="flex justify-center py-16">
        <span className="loading loading-ring loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error max-w-lg mx-auto mt-8">
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
        </svg>
        <span>Error al cargar los partidos: {error}</span>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">⚽</div>
        <p className="text-lg text-base-content/60">No hay partidos programados para este día</p>
        <p className="text-sm text-base-content/40 mt-1">Prueba a seleccionar más ligas o cambia de fecha</p>
      </div>
    );
  }

  const liveCount = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  ).length;

  return (
    <div className="space-y-6">
      {liveCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-error animate-ping" />
          <span className="text-sm font-semibold text-error">
            {liveCount} {liveCount === 1 ? "partido en directo" : "partidos en directo"}
          </span>
        </div>
      )}

      {Array.from(groupedMatches.entries()).map(([time, timeMatches]) => (
        <div key={time}>
          <div className="divider divider-start text-xs text-base-content/40 font-mono mb-3">
            {time}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {timeMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Verify in browser**

- Loading state: green ring spinner centered
- Error state: daisyUI alert-error styled card
- Empty state: football emoji + muted text
- Matches: grouped by time with daisyUI `divider`, 2-column grid on sm+

**Step 3: Commit**

```bash
git add src/components/DayView.tsx
git commit -m "feat: restyle DayView with daisyUI dividers and dark states"
```

---

## Task 4: Restyle page.tsx header

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace only the `<header>` JSX block in `src/app/page.tsx`**

The state, hooks, and handlers are unchanged. Only the return JSX changes:

```tsx
  return (
    <main className="min-h-screen">
      <header className="bg-base-200 border-b border-base-300 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-base-content tracking-tight">
                MyFutTV
              </h1>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            <ViewSwitcher currentView={view} onViewChange={setView} />
          </div>

          <div className="flex justify-center mb-3 sm:mb-4">
            <DateNavigator currentDate={currentDate} onDateChange={setCurrentDate} />
          </div>

          <LeagueFilter
            selectedLeagues={preferences.selectedLeagues}
            onToggle={toggleLeague}
          />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
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
```

**Step 2: Verify in browser**

Header should show:
- Dark `bg-base-200` background
- "MyFutTV" in bold white with small green pulsing dot to the right
- Sticky and backdrop-blurred

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: restyle header with dark bg and green pulse branding"
```

---

## Task 5: Restyle ViewSwitcher

**Files:**
- Modify: `src/components/ViewSwitcher.tsx`

**Step 1: Replace `src/components/ViewSwitcher.tsx` entirely**

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
    <div role="tablist" className="tabs tabs-box tabs-sm bg-base-300">
      {views.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          onClick={() => onViewChange(id)}
          className={`tab font-medium transition-colors ${
            currentView === id ? "tab-active !bg-primary !text-primary-content" : "text-base-content/60"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify in browser**

Tabs should show dark bg with green active tab.

**Step 3: Commit**

```bash
git add src/components/ViewSwitcher.tsx
git commit -m "feat: restyle ViewSwitcher as daisyUI tabs"
```

---

## Task 6: Restyle DateNavigator

**Files:**
- Modify: `src/components/DateNavigator.tsx`

**Step 1: Replace `src/components/DateNavigator.tsx` entirely**

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
    <div className="flex items-center gap-3">
      <button
        onClick={() => onDateChange(subDays(currentDate, 1))}
        className="btn btn-ghost btn-circle btn-sm"
        aria-label="Día anterior"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="text-center min-w-0 sm:min-w-[250px]">
        <h2 className="text-base sm:text-lg font-bold text-base-content capitalize">
          {dateLabel}
        </h2>
        {isToday(currentDate) && (
          <p className="text-xs text-base-content/40 capitalize">
            {format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        )}
      </div>

      <button
        onClick={() => onDateChange(addDays(currentDate, 1))}
        className="btn btn-ghost btn-circle btn-sm"
        aria-label="Día siguiente"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isToday(currentDate) && (
        <button
          onClick={() => onDateChange(new Date())}
          className="btn btn-primary btn-xs"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
```

**Step 2: Verify in browser**

Arrow buttons should be circular ghost buttons. "Hoy" button shows as green pill when not on today.

**Step 3: Commit**

```bash
git add src/components/DateNavigator.tsx
git commit -m "feat: restyle DateNavigator with daisyUI btn-ghost-circle"
```

---

## Task 7: Restyle LeagueFilter

**Files:**
- Modify: `src/components/LeagueFilter.tsx`

**Step 1: Replace `src/components/LeagueFilter.tsx` entirely**

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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/leagues")
      .then((res) => res.json())
      .then((data) => setLeagues(data.competitions))
      .catch(console.error);
  }, []);

  const selectedCount = leagues.filter((l) => selectedLeagues.includes(l.id)).length;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-sm w-full justify-between border border-base-300 text-base-content/70"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M9 16h6" />
          </svg>
          Competiciones
          {selectedCount > 0 && (
            <span className="badge badge-primary badge-sm">{selectedCount}</span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-2 flex flex-wrap gap-2">
          {leagues.map((league) => {
            const isSelected = selectedLeagues.includes(league.id);
            return (
              <button
                key={league.id}
                onClick={() => onToggle(league.id)}
                className={`btn btn-xs gap-1.5 ${
                  isSelected ? "btn-primary" : "btn-ghost border border-base-300 text-base-content/60"
                }`}
              >
                {league.emblem && (
                  <img src={league.emblem} alt="" className="w-3.5 h-3.5" />
                )}
                {league.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify in browser**

- Toggle button: dark ghost with border, shows green badge with count
- League chips: green `btn-primary` when selected, ghost with border when not

**Step 3: Commit**

```bash
git add src/components/LeagueFilter.tsx
git commit -m "feat: restyle LeagueFilter with daisyUI btn toggles"
```

---

## Task 8: Restyle WeekView

**Files:**
- Modify: `src/components/WeekView.tsx`

**Step 1: Read `src/components/WeekView.tsx` fully first, then replace only the JSX classes**

The logic (weekStart, days calculation, liveCount, channels) is unchanged. Replace only class names and loading state. The full new file:

```tsx
"use client";

import { useMemo } from "react";
import { format, startOfWeek, addDays, parseISO, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { useMatchesRange } from "@/hooks/useMatchesRange";
import type { Match } from "@/types";

interface WeekViewProps {
  currentDate: Date;
  selectedLeagues: number[];
  onDayClick: (date: Date) => void;
}

export function WeekView({ currentDate, selectedLeagues, onDayClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
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
      <div className="flex justify-center py-16">
        <span className="loading loading-ring loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
      {days.map(({ date, matches: dayMatches }) => {
        const isCurrentDay = isToday(date);
        const liveCount = dayMatches.filter(
          (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
        ).length;
        const channels = [
          ...new Set(dayMatches.map((m: Match) => m.channel).filter(Boolean)),
        ];

        return (
          <button
            key={date.toISOString()}
            onClick={() => onDayClick(date)}
            className={`card p-3 text-left transition-all duration-200 border ${
              isCurrentDay
                ? "bg-primary/10 border-primary/40 hover:bg-primary/20"
                : "bg-base-200 border-base-300 hover:bg-base-300 hover:border-primary/30"
            }`}
          >
            <div className="flex items-baseline gap-1.5 sm:block">
              <div className="text-xs text-base-content/50 capitalize">
                {format(date, "EEE", { locale: es })}
              </div>
              <div className={`text-lg font-bold ${isCurrentDay ? "text-primary" : "text-base-content"}`}>
                {format(date, "d")}
              </div>
            </div>
            {dayMatches.length > 0 && (
              <div className="mt-1 text-xs text-base-content/50">
                {dayMatches.length} {dayMatches.length === 1 ? "partido" : "partidos"}
              </div>
            )}
            {liveCount > 0 && (
              <div className="mt-0.5 text-xs text-error font-semibold animate-pulse">
                {liveCount} en directo
              </div>
            )}
            {channels.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {(channels as string[]).slice(0, 2).map((ch) => (
                  <div key={ch} className="text-xs text-primary/70 truncate">
                    {ch}
                  </div>
                ))}
                {channels.length > 2 && (
                  <div className="text-xs text-base-content/30">+{channels.length - 2} más</div>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Verify in browser**

Switch to week view. Day cards should be dark with green highlight for today.

**Step 3: Commit**

```bash
git add src/components/WeekView.tsx
git commit -m "feat: restyle WeekView with dark day cards"
```

---

## Task 9: Restyle MonthView

**Files:**
- Modify: `src/components/MonthView.tsx`

**Step 1: Read `src/components/MonthView.tsx` fully, then replace JSX classes only**

Logic (weeks, dayHeaders, inMonth, dayMatches) unchanged. Full new file:

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
  isToday,
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
          <span className="loading loading-ring loading-md text-primary" />
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((h) => (
          <div key={h} className="text-center text-xs font-semibold text-base-content/40 py-2">
            {h}
          </div>
        ))}

        {weeks.flat().map((date) => {
          const inMonth = isSameMonth(date, currentDate);
          const isCurrentDay = isToday(date);
          const dayMatches = matches.filter((m) =>
            isSameDay(parseISO(m.utcDate), date)
          );
          const hasLive = dayMatches.some(
            (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
          );

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDayClick(date)}
              className={`p-1 sm:p-2 rounded-lg text-center transition-all duration-150 min-h-[44px] sm:min-h-[60px] border ${
                !inMonth
                  ? "text-base-content/20 bg-transparent border-transparent"
                  : isCurrentDay
                  ? "bg-primary/10 border-primary/40 hover:bg-primary/20"
                  : "bg-base-200 border-base-300 hover:bg-base-300 hover:border-primary/30"
              }`}
            >
              <div className={`text-sm font-bold ${
                isCurrentDay ? "text-primary" : inMonth ? "text-base-content" : "text-base-content/20"
              }`}>
                {format(date, "d")}
              </div>
              {dayMatches.length > 0 && inMonth && (
                <div className={`text-xs mt-0.5 ${hasLive ? "text-error font-semibold animate-pulse" : "text-base-content/40"}`}>
                  {dayMatches.length}
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

**Step 2: Verify in browser**

Switch to month view. Calendar should be dark, today highlighted in green, match count dots visible.

**Step 3: Commit**

```bash
git add src/components/MonthView.tsx
git commit -m "feat: restyle MonthView with dark calendar grid"
```

---

## Task 10: Final verification and deploy

**Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 2: Full visual check in browser**

Navigate through all views and verify:
- [ ] Dark stadium background throughout
- [ ] Header: dark bg, "MyFutTV" + green pulse dot, dark tabs, ghost date nav
- [ ] Day view: match cards dark with amber scores, green channel bars, pulsing live badge
- [ ] Week view: dark day cards, today in green
- [ ] Month view: dark grid, today in green, match counts
- [ ] LeagueFilter: dark toggle button, green badges when selected
- [ ] Loading: green ring spinner
- [ ] Empty state: football emoji + muted text
- [ ] Error state: daisyUI alert card

**Step 3: Deploy to Vercel**

```bash
git push origin main
vercel --prod
```

**Step 4: Verify production**

Open `https://my-fut-tv.vercel.app` and spot-check the dark theme renders correctly (no flash of white, theme token resolved).
