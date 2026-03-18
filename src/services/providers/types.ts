import type { Match } from "@/types";

export interface FootballProvider {
  getMatchesByDate(date: string): Promise<Match[]>;
  getMatchesByDateRange(dateFrom: string, dateTo: string): Promise<Match[]>;
  getLiveMatches(): Promise<Match[]>;
}
