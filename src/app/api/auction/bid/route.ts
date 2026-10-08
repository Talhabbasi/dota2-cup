import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { placeWebBid } from "@/lib/web-auction";
import { AuctionError } from "@/lib/auction-lock";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new AuctionError("Invalid request origin.", 403);
    const session = await authSession();
    const discordId = session?.user?.discordId;
    const passcodeCaptain = Boolean(
      session?.user?.isCaptainBidder && session.user.captainTeamId,
    );
    if (!passcodeCaptain && !discordId) {
      throw new AuctionError("Sign in with Discord as a captain to bid.", 401);
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AuctionError("JSON required.", 400);
    let body;
    try { body = await request.json(); }
    catch { throw new AuctionError("Invalid bid request.", 400); }
    if (!body || typeof body !== "object" || typeof body.lotId !== "string" || body.lotId.length > 100 || typeof body.requestId !== "string" || typeof body.amount !== "number" || body.bump !== undefined) {
      throw new AuctionError("A player, request identifier, and exact bid amount are required.", 400);
    }
    const view = await placeWebBid({
      teamId: passcodeCaptain ? session?.user?.captainTeamId : undefined,
      accountId: passcodeCaptain ? session?.user?.captainAccountId : undefined,
      accountToken: passcodeCaptain ? session?.user?.captainAccountToken : undefined,
      discordId: passcodeCaptain ? undefined : discordId,
      lotId: body.lotId,
      requestId: body.requestId,
      amount: body.amount,
    });
    return NextResponse.json({ ok: true, view }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuctionError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Auction bid failed", error);
    return NextResponse.json({ ok: false, error: "Could not confirm the bid. Retry the same request to check its result." }, { status: 503 });
  }
}
