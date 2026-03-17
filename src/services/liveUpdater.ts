import { Server as SocketIOServer } from "socket.io";
import { getLiveMatches } from "./footballData";
import type { Match, MatchUpdatePayload } from "@/types";

let io: SocketIOServer | null = null;
let intervalId: NodeJS.Timeout | null = null;
let previousMatches = new Map<number, Match>();

export function initLiveUpdater(socketServer: SocketIOServer) {
  io = socketServer;

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("subscribe:leagues", ({ leagueIds }: { leagueIds: number[] }) => {
      for (const id of leagueIds) {
        socket.join(`league:${id}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  startPolling();
}

function startPolling() {
  intervalId = setInterval(async () => {
    try {
      await checkForUpdates();
    } catch (error) {
      console.error("Live updater error:", error);
    }
  }, 60_000);

  checkForUpdates().catch(console.error);
}

async function checkForUpdates() {
  if (!io) return;

  const liveMatches = await getLiveMatches();

  for (const match of liveMatches) {
    const prev = previousMatches.get(match.id);

    const hasChanged =
      !prev ||
      prev.status !== match.status ||
      prev.score.fullTime.home !== match.score.fullTime.home ||
      prev.score.fullTime.away !== match.score.fullTime.away ||
      prev.minute !== match.minute;

    if (hasChanged) {
      const payload: MatchUpdatePayload = {
        matchId: match.id,
        score: { fullTime: match.score.fullTime },
        status: match.status,
        minute: match.minute,
      };

      io.to(`league:${match.competition.id}`).emit("match:update", payload);
    }

    previousMatches.set(match.id, match);
  }

  const liveIds = new Set(liveMatches.map((m) => m.id));
  for (const [id] of previousMatches) {
    if (!liveIds.has(id)) {
      previousMatches.delete(id);
    }
  }
}

export function stopLiveUpdater() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
