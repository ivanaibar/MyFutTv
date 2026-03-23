import { NextResponse } from "next/server";
import { getCompetitions } from "@/services/footballData";
import { ESPN_STATIC_COMPETITIONS } from "@/services/providers/espnProvider";

export async function GET() {
  const fdCompetitions = await getCompetitions().catch((err) => {
    console.error("Error fetching competitions:", err);
    return [];
  });

  const competitions = [...fdCompetitions, ...ESPN_STATIC_COMPETITIONS];
  return NextResponse.json({ competitions });
}
