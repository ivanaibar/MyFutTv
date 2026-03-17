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
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">MyFutTV</h1>
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
}
