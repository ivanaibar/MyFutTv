import channelsData from "@/data/channels.json";
import type { ChannelMapping } from "@/types";

const channelMap = new Map<number, ChannelMapping>();
for (const entry of channelsData as ChannelMapping[]) {
  channelMap.set(entry.competitionId, entry);
}

export function getChannelForCompetition(competitionId: number): string | undefined {
  return channelMap.get(competitionId)?.channel;
}

export function getAllChannels(): ChannelMapping[] {
  return channelsData as ChannelMapping[];
}
