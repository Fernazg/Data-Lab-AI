import { getOffice, systemInfo } from "@/lib/server/office";
import type { ServerEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Flujo de eventos en tiempo real (Server-Sent Events). */
export async function GET(request: Request) {
  const { store, ready } = getOffice();
  await ready;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ServerEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      send({ type: "snapshot", data: store.snapshot(systemInfo(store)) });
      const unsubscribe = store.subscribe(send);
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 20_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
