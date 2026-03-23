import { NextRequest, NextResponse } from "next/server";
import { getMatchesByDate, getMatchesByDateRange } from "@/services/footballData";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const queryKey = date ?? (dateFrom && dateTo ? `${dateFrom}..${dateTo}` : "today");
  console.log(JSON.stringify({ level: "info", msg: "request_start", route: "/api/matches", query: queryKey }));

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

    console.log(JSON.stringify({ level: "info", msg: "request_done", route: "/api/matches", query: queryKey, count: matches.length, ms: Date.now() - start }));
    return NextResponse.json({ matches });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "request_failed", route: "/api/matches", query: queryKey, error: error instanceof Error ? error.message : String(error), ms: Date.now() - start }));
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
