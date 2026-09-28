import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/account-deletions")({
  server: { handlers: { POST: async ({ request }) => {
    const expected = process.env["ACCOUNT_DELETION_CRON_SECRET"]!;
    const received = request.headers.get("x-cron-secret") ?? "";
    if (!expected || !safeEqual(received, expected)) return new Response("Unauthorized", { status: 401 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: due, error } = await supabaseAdmin.from("account_deletion_requests").select("user_id").is("canceled_at", null).is("completed_at", null).lte("scheduled_for", new Date().toISOString()).limit(50);
    if (error) return Response.json({ error: "Não foi possível consultar as solicitações" }, { status: 500 });
    let deleted = 0;
    for (const item of due ?? []) {
      const { error: libraryError } = await supabaseAdmin.from("libraries").delete().eq("owner_id", item.user_id);
      if (libraryError) continue;
      const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(item.user_id);
      if (!userError) deleted += 1;
    }
    return Response.json({ processed: deleted });
  } } },
});