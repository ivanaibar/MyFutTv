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
import { Logo } from "@/components/Logo";
import type { CalendarView } from "@/types";

function isToday(date: Date): boolean {
  return format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
}

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("day");
  const { preferences, toggleLeague } = usePreferences();
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const { matches, loading, error, refetch, lastUpdated } = useMatches(dateStr, preferences.selectedLeagues);

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  return (
    <main className="min-h-screen">
      <header className="bg-base-200 border-b border-base-300 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Logo />
            <ViewSwitcher currentView={view} onViewChange={setView} />
          </div>

          <div className="flex justify-center mb-3 sm:mb-4">
            <DateNavigator currentDate={currentDate} onDateChange={setCurrentDate} />
          </div>

          <LeagueFilter
            selectedLeagues={preferences.selectedLeagues}
            onToggle={toggleLeague}
          />

          {view === "day" && isToday(currentDate) && (
            <div className="flex items-center justify-end gap-3 mt-2">
              {error ? (
                <span className="text-xs text-error/70">Error al actualizar</span>
              ) : lastUpdated ? (
                <span className="text-xs text-base-content/40">
                  Actualizado a las {format(lastUpdated, "HH:mm")}
                </span>
              ) : null}
              <button
                type="button"
                className="btn btn-xs btn-ghost gap-1"
                onClick={refetch}
                disabled={loading}
              >
                <svg
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Actualizar
              </button>
            </div>
          )}
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
}
