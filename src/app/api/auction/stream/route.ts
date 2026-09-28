import { getWebAuctionView, tickWebAuction } from "@/lib/web-auction";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        try {
          await tickWebAuction();
          const view = await getWebAuctionView();
          controller.enqueue(
            encoder.encode(`event: auction\ndata: ${JSON.stringify(view)}\n\n`),
          );
        } catch {
          /* keep stream alive */
        }
      };

      await send();
      const timer = setInterval(send, 1000);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Client disconnect is handled by cancel below.
      (stream as unknown as { _close?: () => void })._close = close;
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
