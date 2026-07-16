// create-team — admin-only edge function to create a team + auto-membership.
// Pattern: join-team (user JWT, not service-role-only).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function generateCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  // Auth: extract user from JWT
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Create a user-scoped client just to verify the token
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Use service-role client for privileged writes
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Verify user is admin (has at least one admin membership, or is the first user)
  const { data: memberships } = await supa.from("memberships")
    .select("role").eq("user_id", user.id).eq("role", "admin");
  // Also allow if no teams exist yet (bootstrap)
  const { count: teamCount } = await supa.from("teams")
    .select("*", { count: "exact", head: true });
  const isAdmin = (memberships && memberships.length > 0) || (teamCount === 0);
  if (!isAdmin) {
    return Response.json({ error: "forbidden — admin role required" }, { status: 403 });
  }

  const { name, sport } = await req.json();
  if (!name || typeof name !== "string") {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  // Find or create an org for this user
  let orgId: string;
  const { data: existingOrg } = await supa.from("organizations")
    .select("id").limit(1).maybeSingle();
  if (existingOrg) {
    orgId = existingOrg.id;
  } else {
    const { data: newOrg, error: orgErr } = await supa.from("organizations")
      .insert({ name: `${name} Org` }).select("id").single();
    if (orgErr) return Response.json({ error: orgErr.message }, { status: 500 });
    orgId = newOrg.id;
  }

  const inviteCode = generateCode(6);

  const { data: team, error: teamErr } = await supa.from("teams")
    .insert({
      org_id: orgId,
      name: name.trim().slice(0, 100),
      sport: (sport || "basketball").trim().slice(0, 50),
      invite_code: inviteCode,
    })
    .select("id, name, sport, invite_code")
    .single();

  if (teamErr) {
    return Response.json({ error: teamErr.message }, { status: 500 });
  }

  // Auto-add creator as admin member
  const { error: memErr } = await supa.from("memberships")
    .insert({
      team_id: team.id,
      user_id: user.id,
      role: "admin",
      pseudonym: "P-ADMIN",
    });
  if (memErr) console.error("[create-team] membership insert error:", memErr.message);

  return Response.json({
    ok: true,
    team_id: team.id,
    name: team.name,
    sport: team.sport,
    invite_code: team.invite_code,
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
});
