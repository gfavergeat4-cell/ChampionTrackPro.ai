// admin-purge — suppression et export des données d'un athlète ou d'une équipe.
//
// Accessible UNIQUEMENT à un admin de l'équipe concernée. Les fonctions SQL
// sous-jacentes sont revoked pour anon/authenticated : ce point d'entrée est
// le seul chemin, et il vérifie le rôle avant d'agir.
//
// Actions : purge_athlete | purge_team | export_athlete
import { createClient } from "jsr:@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await supa.auth.getUser(jwt);
    if (!userData?.user) {
      return Response.json({ error: "unauthenticated" }, { status: 401, headers: cors });
    }
    const caller = userData.user;

    const { action, team_id, user_id } = await req.json();
    if (!action || !team_id) {
      return Response.json({ error: "action and team_id required" }, { status: 400, headers: cors });
    }

    // Le rôle est verifie cote serveur, sur l'equipe visee. Pas de confiance
    // dans ce que le client declare.
    const { data: membership } = await supa.from("memberships")
      .select("role").eq("team_id", team_id).eq("user_id", caller.id).maybeSingle();
    if (membership?.role !== "admin") {
      return Response.json({ error: "admin role required on this team" }, { status: 403, headers: cors });
    }

    if (action === "export_athlete" || action === "purge_athlete") {
      if (!user_id) {
        return Response.json({ error: "user_id required" }, { status: 400, headers: cors });
      }
      // Un admin ne peut pas se purger lui-meme par megarde.
      if (action === "purge_athlete" && user_id === caller.id) {
        return Response.json({ error: "cannot purge yourself" }, { status: 400, headers: cors });
      }
    }

    let rpc: string;
    let args: Record<string, unknown>;
    switch (action) {
      case "purge_athlete":  rpc = "purge_athlete";  args = { p_team: team_id, p_user: user_id }; break;
      case "export_athlete": rpc = "export_athlete"; args = { p_team: team_id, p_user: user_id }; break;
      case "purge_team":     rpc = "purge_team";     args = { p_team: team_id }; break;
      default:
        return Response.json({ error: "unknown action" }, { status: 400, headers: cors });
    }

    const { data, error } = await supa.rpc(rpc, args);
    if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });

    // Trace minimale : qui, quoi, quand. Aucune donnee de sante dans le log.
    console.log(JSON.stringify({
      evt: action, by: caller.id, team: team_id,
      target: user_id ?? null, at: new Date().toISOString(),
    }));

    return Response.json({ ok: true, action, result: data }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 500, headers: cors });
  }
});
