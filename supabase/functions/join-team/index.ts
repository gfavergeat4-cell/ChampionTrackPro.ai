// Adhésion à une équipe par code d'invitation.
// Service role car la RLS interdit au client de créer son membership.
// Miroir de l'ancienne CF Firebase createMembership, avec pseudonyme auto.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Identité de l'appelant depuis son JWT (jamais depuis le body)
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    const { data: userData, error: authErr } = await supa.auth.getUser(jwt);
    if (authErr || !userData?.user) {
      return Response.json({ error: "unauthenticated" }, { status: 401, headers: cors });
    }
    const user = userData.user;

    // Le champ `role` du corps est IGNORE : il etait la faille. Le role est
    // deduit du code presente (doc 11 P0-2, doc 14 P0-1).
    const { invite_code, display_name } = await req.json();
    if (!invite_code || typeof invite_code !== "string") {
      return Response.json({ error: "invite_code required" }, { status: 400, headers: cors });
    }
    const code = invite_code.trim();

    const { data: team } = await supa.from("teams")
      .select("id, name, invite_code, coach_code")
      .or(`invite_code.eq.${code},coach_code.eq.${code}`)
      .maybeSingle();
    if (!team) return Response.json({ error: "team not found" }, { status: 404, headers: cors });

    const memberRole = team.coach_code && team.coach_code === code ? "coach" : "athlete";

    // Un membre existant ne change JAMAIS de role en re-presentant un code.
    const { data: existing } = await supa.from("memberships")
      .select("role").eq("team_id", team.id).eq("user_id", user.id).maybeSingle();
    if (existing) {
      return Response.json(
        { ok: true, team_id: team.id, team_name: team.name, role: existing.role },
        { headers: cors },
      );
    }

    // Profil
    await supa.from("profiles").upsert({
      user_id: user.id,
      display_name: display_name || user.email?.split("@")[0] || "Player",
      email: user.email,
    });

    // Pseudonyme stable P-01..P-n (pour la couche LLM)
    const { count } = await supa.from("memberships")
      .select("*", { count: "exact", head: true }).eq("team_id", team.id);
    const pseudonym = `P-${String((count ?? 0) + 1).padStart(2, "0")}`;

    const { error: memErr } = await supa.from("memberships").upsert({
      team_id: team.id, user_id: user.id, role: memberRole, pseudonym,
    }, { onConflict: "team_id,user_id" });
    if (memErr) return Response.json({ error: memErr.message }, { status: 500, headers: cors });

    return Response.json({ ok: true, team_id: team.id, team_name: team.name, role: memberRole }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
