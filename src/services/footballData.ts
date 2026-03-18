// This file is a thin wrapper over the provider registry.
// To add a new API provider or change per-competition routing, see src/services/providers/registry.ts
import { registry, getCompetitions } from "./providers/registry";

export { getCompetitions };

export const getMatchesByDate = (date: string) =>
  registry.getMatchesByDate(date);

export const getMatchesByDateRange = (dateFrom: string, dateTo: string) =>
  registry.getMatchesByDateRange(dateFrom, dateTo);

export const getLiveMatches = () => registry.getLiveMatches();
