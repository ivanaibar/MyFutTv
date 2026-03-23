import { NextResponse } from "next/server";
import { getCompetitions } from "@/services/footballData";
import { ESPN_STATIC_COMPETITIONS } from "@/services/providers/espnProvider";

export async function GET() {
  try {
    const competitions = [
      ...(await getCompetitions()),
      ...ESPN_STATIC_COMPETITIONS,
    ];
    return NextResponse.json({ competitions });
  } catch (error) {
    console.error("Error fetching competitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 }
    );
  }
}
