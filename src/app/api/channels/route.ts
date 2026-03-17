import { NextResponse } from "next/server";
import { getAllChannels } from "@/services/channels";

export async function GET() {
  return NextResponse.json({ channels: getAllChannels() });
}
