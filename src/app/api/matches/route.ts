import { NextRequest, NextResponse } from "next/server";
import { getMatchesByDate, getMatchesByDateRange } from "@/services/footballData";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  try {
    let matches;

    if (date) {
      matches = await getMatchesByDate(date);
    } else if (dateFrom && dateTo) {
      matches = await getMatchesByDateRange(dateFrom, dateTo);
    } else {
      const today = format(new Date(), "yyyy-MM-dd");
      matches = await getMatchesByDate(today);
    }

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
