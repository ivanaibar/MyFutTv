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

export interface Goal {
  scorer: string;
  minute: number;
  team: "home" | "away";
  type: "REGULAR" | "OWN_GOAL" | "PENALTY";
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
  goals?: Goal[];
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

export interface FootballDataGoal {
  minute: number;
  injuryTime: number | null;
  type: "REGULAR" | "OWN_GOAL" | "PENALTY";
  team: { id: number; name: string };
  scorer: { id: number; name: string };
  assist: { id: number; name: string } | null;
}

export interface FootballDataMatchDetail extends FootballDataMatch {
  goals: FootballDataGoal[] | null;
}
