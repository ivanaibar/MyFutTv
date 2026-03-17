import { NextResponse } from "next/server";
import { getCompetitions } from "@/services/footballData";

export async function GET() {
  try {
    const competitions = await getCompetitions();
    return NextResponse.json({ competitions });
  } catch (error) {
    console.error("Error fetching competitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 }
    );
  }
}
