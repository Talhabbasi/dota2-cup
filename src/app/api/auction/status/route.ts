import { NextResponse } from "next/server";
import { getWebAuctionView } from "@/lib/web-auction";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET() {
  try {
    return NextResponse.json(await getWebAuctionView(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Auction status unavailable", error);
    return NextResponse.json({ error: "Live auction updates are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
