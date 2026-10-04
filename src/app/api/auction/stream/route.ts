import { getWebAuctionView } from "@/lib/web-auction";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

/** Compatibility for an already-open older tab. New clients use /status.
 * A finite response lets EventSource reconnect without leaking server timers.
 */
export async function GET() {
  try {
    const view = await getWebAuctionView();
    return new Response(`retry: 2000\nevent: auction\ndata: ${JSON.stringify(view)}\n\n`, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
    });
  } catch (error) {
    console.error("Auction stream unavailable", error);
    return new Response("Auction unavailable. Refresh to retry.", { status: 503 });
  }
}
