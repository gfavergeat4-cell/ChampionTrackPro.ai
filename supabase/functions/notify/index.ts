// E2 — Send Web Push notifications to a list of users.
// SERVICE-ROLE ONLY: rejects any Bearer that is not the service_role key.
// Called internally by session-watcher cron and morning-brief.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendPush } from "../_shared/webpush.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  SERVICE_ROLE_KEY,
);

Deno.serve(async (req) => {
  // ── Auth guard: service-role only ──────────────────────────
  // Supabase relay (verify_jwt=true) has already validated the JWT.
  // We extract the role from the JWT payload to ensure only service_role calls pass.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let role = "";
  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      role = payload.role ?? "";
    }
  } catch (_) { /* malformed token */ }
  if (role !== "service_role") {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const { user_ids, title, body, data } = await req.json() as {
    user_ids: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  };

  if (!user_ids?.length) {
    return Response.json({ ok: true, sent: 0, failed: 0, cleaned: 0 });
  }

  // Fetch all push subscriptions for the given users
  const { data: subs, error } = await supa.from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", user_ids);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!subs?.length) {
    return Response.json({ ok: true, sent: 0, failed: 0, cleaned: 0, note: "no_subscriptions" });
  }

  const payload: Record<string, unknown> = {
    title: title || "ChampionTrackPro",
    body: body || "",
    ...data,
  };

  let sent = 0, failed = 0, cleaned = 0;
  const toDelete: string[] = [];

  for (const sub of subs) {
    try {
      const result = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, authKey: sub.auth_key },
        payload,
      );
      if (result.ok) {
        sent++;
      } else if (result.gone) {
        toDelete.push(sub.id);
        cleaned++;
      } else {
        console.error(`[NOTIFY] push failed: ${sub.endpoint} → ${result.status}`);
        failed++;
      }
    } catch (e) {
      console.error(`[NOTIFY] push error: ${sub.endpoint}`, String(e));
      failed++;
    }
  }

  // Clean up gone subscriptions
  if (toDelete.length) {
    await supa.from("push_subscriptions").delete().in("id", toDelete);
  }

  return Response.json({ ok: true, sent, failed, cleaned });
});
