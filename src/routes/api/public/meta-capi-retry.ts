import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Scheduled resend of pending Meta conversion reports. Requires the retry secret header.
export const Route = createFileRoute("/api/public/meta-capi-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["META_CAPI_RETRY_SECRET"];
        const got = request.headers.get("x-retry-secret") ?? "";
        if (!expected || !safeEq(got, expected)) return new Response("Unauthorized", { status: 401 });
        const { processMetaEvents } = await import("@/lib/meta-capi.server");
        return Response.json(await processMetaEvents(undefined, 50));
      },
    },
  },
});
