import { NextResponse } from "next/server";
import { requireCaptainBidder } from "@/lib/auth";
import { placeWebBid, tickWebAuction } from "@/lib/web-auction";
import { BID_INCREMENT } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { teamId } = await requireCaptainBidder();
    await tickWebAuction();
    const body = (await request.json().catch(() => ({}))) as {
      bump?: number;
      amount?: number;
    };
    const view = await placeWebBid({
      teamId,
      bump: body.bump ?? BID_INCREMENT,
      amount: body.amount,
    });
    return NextResponse.json({ ok: true, view });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bid failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
