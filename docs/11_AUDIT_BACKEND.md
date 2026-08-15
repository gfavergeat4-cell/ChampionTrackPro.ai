# 11 — AUDIT BACKEND · Pré-production multi-tenant

> **Date : 15 août 2026.** Audit réalisé par lecture intégrale du code source, sans accès à la base de production.
> **Périmètre lu ligne à ligne :** `supabase/migrations/001` à `011`, les 7 edge functions + `_shared/llm.ts` + `_shared/webpush.ts`, `src/lib/ctpApi.ts`, `CONSTITUTION.md`, `CLAUDE.md`, `docs/08`, `docs/09`.
> **Cible de charge évaluée :** 10 à 50 équipes · 15 athlètes + 2-4 staff par équipe · séances quotidiennes · 1 brief LLM par équipe et par jour · cron à la minute sur toutes les équipes.
>
> **Convention de preuve.** Tout ce qui est écrit sous « Constat » a été lu dans le fichier et à la ligne cités. Tout ce qui est une déduction, une estimation ou une hypothèse est préfixé **[HYPOTHÈSE]** ou **[ESTIMATION]** et accompagné du moyen de la vérifier. Les mesures qui exigent la base de production sont renvoyées au §6 (requêtes) et §7 (protocole de charge).
>
> **Ce document ne modifie aucun fichier.** Aucune règle d'interprétation n'a été écrite, proposée ni activée (Constitution art. 2). Les seuils du moteur (±15 %, MIN 3 points, `min_data_days`) sont signalés là où ils interagissent avec un bug technique, jamais discutés sur le fond.

---

## 1. Verdict en cinq lignes

Le socle est structurellement bon — schéma normalisé, RLS réelle, calcul serveur non falsifiable, chaîne événementielle propre — mais **il n'est pas déployable en l'état** : sept défauts bloquants coexistent, dont une erreur de nom de colonne qui rend la création d'équipe impossible, une escalade de privilèges qui permet à un athlète de se déclarer coach et de lire les données de santé de ses coéquipiers, et trois edge functions sans aucun contrôle d'appelant.
La couche RLS elle-même est solide sur le chemin de lecture ; ses trous sont sur le chemin d'écriture, où **trois fonctions clientes signalent un succès alors que la base n'a rien changé** — exactement la famille de bug de `push_subscriptions`, corrigée en 011 mais non généralisée.
À l'échelle, le point de rupture unique et certain est `v_ema_baseline` : une CTE récursive dans une vue non paramétrable, recalculée intégralement pour **tous les athlètes de tous les clients** à chaque réponse insérée. C'est un coût en O(jours × athlètes) par écriture ; il est indolore aujourd'hui et devient rédhibitoire vers la fin de la première saison.
La chaîne de notification a deux défauts qui se composent : une fenêtre de détection de 2 minutes sans rattrapage, et une relance à +6 h qui pointe vers un formulaire que la RLS ferme à +5 h.
Le coût n'est pas un risque : le LLM coûte quelques dollars par mois à 50 équipes ; le risque financier est l'endpoint `morning-brief` ouvert, pas le modèle.

---

## 2. Matrice d'accès

### 2.1 Méthode

Les rôles PostgreSQL réels sont trois : `anon`, `authenticated`, `service_role`. « athlete / coach / admin » ne sont **pas** des rôles Postgres : ce sont des valeurs de `memberships.role` (001:49) discriminées à l'intérieur des policies via `my_role_in()` (002:29-32). La matrice ci-dessous les distingue quand même, parce que c'est ce qui compte fonctionnellement.

Lecture : `S` = select, `I` = insert, `U` = update, `D` = delete. `—` = refusé (aucune policy applicable, RLS activée). `✔` = autorisé. `(soi)` = restreint à ses propres lignes. `(équipe)` = restreint aux équipes dont on est membre.

`service_role` dispose de l'attribut `BYPASSRLS` sur Supabase : il traverse toutes les policies. **[HYPOTHÈSE vérifiable]** — requête V7 au §6. Si cette hypothèse était fausse, le moteur ne fonctionnerait pas du tout (les vues sont en `security_invoker = true`, 005:3-8), donc le fait que la chaîne tourne en dev la confirme indirectement.

### 2.2 La matrice

| Table | anon | athlete | coach | admin | service_role | Conforme ? |
|---|---|---|---|---|---|---|
| `organizations` | — | — | — | — | SIUD | ✔ RLS activée (002:7), zéro policy = deny-all. Voulu. |
| `teams` | — | S (équipe) | S (équipe) | S (équipe) | SIUD | ⚠ **U manquant** → `ctpApi.updateTeamInfo` (ctpApi:281-286) échoue en silence. Voir P0-7. |
| `seasons` | — | S (équipe) | S (équipe) | S (équipe) | SIUD | ✔ Aucun code n'écrit jamais dans `seasons` : table vide, `sessions.season_id` toujours NULL. Dette, pas faille. |
| `profiles` | — | SIUD (soi) + S (staff de son équipe le lit) | SIUD (soi) + S (équipe) | idem | SIUD | ⚠ `profiles_self` est `FOR ALL` (002:35) → un athlète peut **supprimer** son profil et **modifier son `email`** sans que `auth.users` change. Impact faible, écart réel. |
| `memberships` | — | S (équipe) | S (équipe) | S (équipe) | SIUD | ⚠ **D manquant** → `ctpApi.removeMember` (ctpApi:289-294) échoue en silence. Voir P0-7. I refusé côté client = voulu (join-team en service role). |
| `sessions` | — | S (équipe) | S (équipe) | S (équipe) | SIUD | ✔ Écriture réservée à `ics-sync`. Conséquence : pas de création de séance in-app (lot L5 non fait), cohérent. |
| `questionnaires` | — | S (**tous**) | S (**tous**) | S (**tous**) | SIUD | ⚠ `using (auth.uid() is not null)` (002:56-57) : tout compte authentifié lit **tous** les questionnaires, y compris ceux d'un autre client. Sans effet aujourd'hui (1 seul template global), fuite le jour d'un questionnaire personnalisé. P2-1. |
| `team_questionnaires` | — | S (équipe) | S (équipe) | S (équipe) | SIUD | ✔ |
| `responses` | — | I (soi, fenêtre +0/+5 h) · S (soi) | S (équipe) | S (équipe) | SIUD | ⚠ U/D refusés : aucune correction possible après envoi. Volontaire ? À trancher. La fenêtre d'insertion est incohérente avec la relance +6 h → **P0-5**. |
| `daily_metrics` | — | S (soi) | S (équipe) | S (équipe) | SIUD | ✔ Écriture serveur uniquement. Correct. |
| `rules` | — | — | — | — | SIUD | ✔ **Conforme Constitution art. 2.** Aucune policy = invisible et inaccessible aux clients. Ne pas toucher. |
| `flags` | — | — | S (équipe) | S (équipe) | SIUD | ⚠ L'athlète ne voit **pas** ses propres flags. Cohérent avec « le coach décide », mais c'est une décision produit à assumer explicitement, pas un oubli technique. |
| `briefs` | — | — | S (équipe) | S (équipe) | SIUD | ✔ `briefs.payload` contient les textes `rules.recommendation` — exposés au staff seulement. Correct. |
| `coach_feedback` | — | — | **SIUD** (équipe) | **SIUD** (équipe) | SIUD | ⚠ `FOR ALL` (002:88-90) → un coach peut **UPDATE et DELETE** des lignes de feedback de son équipe. Contredit CLAUDE.md §6 « `coach_feedback` est sacré — ne jamais le purger ». **P1-13**. |
| `llm_logs` | — | — | — | S (équipe, 010:10-11) | SIUD | ✔ Correctement restreint à l'admin. |
| `cycles` | — | S (équipe) | S (équipe) | S (équipe) | SIUD | ✔ Aucune écriture nulle part : table morte (008:8-19). Dette. |
| `push_subscriptions` | — | SIUD (soi) | SIUD (soi) | SIUD (soi) | SIUD | ✔ **Complet depuis 011.** C'est la seule table où les 4 verbes clients sont couverts. |
| `pending_reminders` | — | — | — | S (équipe, 010:14-15) | SIUD | ✔ |

### 2.3 Vues du moteur

| Vue | anon / authenticated | service_role | État |
|---|---|---|---|
| `v_daily_scores`, `v_ema_baseline`, `v_zones`, `v_acwr`, `v_ai_dataset` | REVOKE SELECT (005:9) + `security_invoker = true` (005:3-8) | ✔ | Double verrou correct. |
| `v_engine` | REVOKE SELECT (008:46) + `security_invoker = true` (008:45) | ✔ | 008 a bien re-verrouillé après `create or replace`. Bon réflexe. |

⚠ **Fragilité opératoire.** `create or replace view` réapplique les GRANT par défaut de Supabase sur `public`. Les vues de 003 ne sont re-verrouillées que par 005, qui est une migration **séparée**. Si un jour quelqu'un rejoue ou modifie 003 sans rejouer 005, `authenticated` récupère le SELECT sur `v_ema_baseline` — donc sur les readiness de **tous les clients**, sans filtre RLS pertinent (la vue n'a pas de policy, seule la RLS des tables sous-jacentes joue via `security_invoker`, ce qui limite les dégâts mais pas la surface). Requête V6 au §6 pour contrôler l'état réel. Correctif préventif : mettre le `revoke` dans la même migration que le `create or replace`, systématiquement.

### 2.4 Le trou « INSERT sans UPDATE » — recherche systématique

La consigne était de chercher partout le pattern qui a cassé `push_subscriptions`. Voici l'inventaire complet des écritures clientes et leur couverture :

| Appel client | Fichier:ligne | Verbe SQL réel | Policy requise | Existe ? |
|---|---|---|---|---|
| `submitResponse` | ctpApi:88 | INSERT | `responses` INSERT | ✔ 002:63 |
| `sendCoachFeedback` | ctpApi:139 | INSERT | `coach_feedback` INSERT | ✔ 002:88 (`FOR ALL`) |
| `savePushSubscription` | ctpApi:153-157 | INSERT … ON CONFLICT DO UPDATE | INSERT **+ UPDATE** | ✔ depuis 011 |
| `removePushSubscription` | ctpApi:163-164 | DELETE | `push_subscriptions` DELETE | ✔ 009:24 |
| `updateMyProfile` | ctpApi:425-426 | INSERT … ON CONFLICT DO UPDATE | INSERT + UPDATE | ✔ 002:35 (`FOR ALL`) — mais **colonnes inexistantes**, voir P1-11 |
| `updateTeamInfo` | ctpApi:282-283 | UPDATE | `teams` UPDATE | ❌ **ABSENTE** |
| `removeMember` | ctpApi:290-291 | DELETE | `memberships` DELETE | ❌ **ABSENTE** |
| `setTeamCalendar` | ctpApi:31 | RPC `security definer` | — (contrôle interne 007:6-8) | ✔ |

**Deux trous restants, tous deux silencieux.** Un UPDATE ou un DELETE qui ne matche aucune policy ne lève **pas** d'erreur : PostgreSQL filtre simplement les lignes, PostgREST renvoie 204, et `ctpApi` renvoie `{ ok: true }`. L'écran affiche un succès. C'est pire qu'un 403 : le 403 de `push_subscriptions` a fini par être trouvé ; ces deux-là ne se signaleront jamais.

---

## 3. Anomalies

### P0 — bloque la mise en production

---

#### P0-1 · `create-team` référence une colonne qui n'existe pas → aucune équipe ne peut être créée

**Constat.** `supabase/functions/create-team/index.ts:75` insère `org_id: orgId`. La colonne s'appelle `organization_id` (`001_schema.sql:19`), elle est `not null`, et aucune migration ne la renomme (vérifié sur 001→011 ; seul `006_seed_initial.sql:8` l'utilise, correctement).

**Conséquence.** PostgREST rejette l'insert (`column "org_id" of relation "teams" does not exist`), la fonction renvoie 500 (`:84`), `ctpApi.createTeam` lève (`ctpApi:311`), `AdminHomeScreen:55` affiche une erreur. **La seule voie de création d'équipe du produit est morte.** Toute démonstration client qui commence par « je vous crée votre équipe » échoue à la première seconde. Corollaire : aucune organisation n'est jamais créée non plus, donc le multi-org n'a jamais été exercé.

**Correctif.**
```ts
// supabase/functions/create-team/index.ts:73-82
const { data: team, error: teamErr } = await supa.from("teams")
  .insert({
    organization_id: orgId,          // ← était org_id
    name: name.trim().slice(0, 100),
    sport: (sport || "basketball").trim().slice(0, 50),
    invite_code: inviteCode,
  })
  .select("id, name, sport, invite_code")
  .single();
```
Ajouter dans la foulée la gestion de collision du code d'invitation (`teams.invite_code` est `unique`, 001:23 ; `generateCode` ne vérifie rien) :
```ts
let team = null, teamErr = null;
for (let attempt = 0; attempt < 5 && !team; attempt++) {
  const r = await supa.from("teams").insert({
    organization_id: orgId, name: name.trim().slice(0,100),
    sport: (sport||"basketball").trim().slice(0,50), invite_code: generateCode(6),
  }).select("id, name, sport, invite_code").single();
  team = r.data; teamErr = r.error;
  if (teamErr && !teamErr.message.includes("invite_code")) break;
}
```

**Effort : 15 min** (+ redéploiement `supabase functions deploy create-team`).

---

#### P0-2 · Escalade de privilèges : n'importe qui possédant le code d'invitation devient coach

**Constat.** `join-team/index.ts:31` : `const memberRole = role === "coach" ? "coach" : "athlete";` — le rôle vient du **corps de la requête**, fourni par le client. `:49-51` fait un `upsert` avec `onConflict: "team_id,user_id"`, donc **il met à jour le rôle d'un membre existant**.

**Conséquence.** Le code d'invitation est un secret **partagé aux 15 athlètes** de l'équipe. N'importe lequel d'entre eux — ou n'importe qui à qui il l'a transmis — peut appeler l'endpoint avec `{"invite_code":"...","role":"coach"}` et :
1. obtenir immédiatement le rôle coach ;
2. déclencher `responses_staff_read` (002:74-75), `metrics_staff_read` (002:80-81), `flags_staff_read`, `briefs_staff_read` → **lecture de toutes les données de santé de tous ses coéquipiers**, nominativement (jointure `profiles_staff_read`, 002:37-41) ;
3. s'il était déjà athlète, se **promouvoir** via l'upsert sans même quitter l'équipe.

C'est la violation frontale de « RLS multi-tenant non négociable » (Constitution art. 8) et de FERPA by design. Ce n'est pas une faille de RLS : la RLS fait exactement ce qu'on lui demande. La faille est que **le rôle est déclaratif**.

**Correctif.** Deux codes distincts, et pas d'upgrade par upsert.
```sql
-- migration 012
alter table teams add column if not exists staff_invite_code text unique;
-- Régénérer pour les équipes existantes, puis :
-- (le code athlète reste teams.invite_code, distribué au groupe ;
--  le code staff est remis en main propre au coach par le fondateur)
```
```ts
// join-team/index.ts — remplace :31 et :49-51
const { data: team } = await supa.from("teams")
  .select("id, name, invite_code, staff_invite_code")
  .or(`invite_code.eq.${code},staff_invite_code.eq.${code}`).single();
if (!team) return Response.json({ error: "team not found" }, { status: 404, headers: cors });
const memberRole = (code === team.staff_invite_code) ? "coach" : "athlete";

// Ne JAMAIS écraser un rôle existant :
const { data: existing } = await supa.from("memberships")
  .select("role").eq("team_id", team.id).eq("user_id", user.id).maybeSingle();
if (existing) {
  return Response.json({ ok: true, team_id: team.id, team_name: team.name,
                         role: existing.role, note: "already_member" }, { headers: cors });
}
const { error: memErr } = await supa.from("memberships")
  .insert({ team_id: team.id, user_id: user.id, role: memberRole, pseudonym });
```
Ajouter un rate-limit sur l'endpoint (le code athlète à 9 caractères type `CTP-PILOT` est devinable ; `generateCode(6)` sur alphabet 32 donne 2³⁰ ≈ 10⁹ combinaisons, acceptable, mais le seed `CTP-PILOT` ne l'est pas et doit être supprimé avant production).

**Effort : 1 h 30** (migration + fonction + un écran de saisie qui ne propose plus le choix du rôle).

---

#### P0-3 · `compute-metrics` et `morning-brief` n'ont aucun contrôle d'appelant

**Constat.**
- `compute-metrics/index.ts:10-12` : `Deno.serve(async (req) => { const { record } = await req.json(); const { user_id, team_id } = record; ...})`. Aucune vérification de rôle, aucune validation. `notify/index.ts:18-33` et `session-watcher/index.ts:70-82` implémentent un guard `role === "service_role"` — **ces deux-là ne l'ont pas**.
- `morning-brief/index.ts:74-80` : idem, aucun guard.

**[HYPOTHÈSE]** Le dépôt ne contient aucun `supabase/config.toml` (vérifié : `supabase/` ne contient que `functions/`, `migrations/`, `.temp/`). Le réglage `verify_jwt` est donc celui du dashboard, non versionné. Par défaut Supabase exige un JWT valide — **et la clé anon publique en est un**. Elle est embarquée dans le bundle web (`EXPO_PUBLIC_SUPABASE_ANON_KEY`, doc 08 §15). Ces endpoints sont donc, en pratique, publics. À confirmer dans Dashboard → Edge Functions → chaque fonction → « Verify JWT ».

**Conséquence 1 — fuite de données de santé inter-tenant.** `compute-metrics` lit `v_engine` pour le `user_id` fourni (`:15-19`, en **service role**, donc sans RLS) puis écrit `daily_metrics` avec le `team_id` **fourni par l'appelant** (`:25-31`). Un attaquant qui connaît l'UUID d'un athlète d'un autre client poste :
```json
{"record":{"user_id":"<uuid-victime>","team_id":"<son-propre-team-id>"}}
```
La ligne créée est ensuite lisible par lui via `metrics_staff_read` (002:80-81) : readiness, EMA, déviation, zone, z-score de la victime, dans son propre tableau de bord. Aucune policy ne s'y oppose — la RLS a été contournée en amont, par la fonction.

**Conséquence 2 — amplification de coût.** `morning-brief` accepte `{"team_id":"<uuid>"}` et déclenche un appel Anthropic par requête. À 0,3 ¢ l'appel **[ESTIMATION, §5]**, 10 req/s coûtent ~110 $/h. Aucun rate-limit, aucune idempotence en amont de l'appel (l'`upsert` idempotent est **après** le paiement du token).

**Conséquence 3 — falsification.** Un athlète peut réécrire ses propres `daily_metrics` en rejouant l'endpoint, et forcer le recalcul du jour de son choix.

**Correctif.** Le guard existe déjà dans le dépôt, il suffit de le factoriser et de l'appliquer.
```ts
// supabase/functions/_shared/guard.ts  (nouveau)
export function requireServiceRole(req: Request): Response | null {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  let role = "";
  try {
    const p = token.split(".");
    if (p.length >= 2) role = JSON.parse(atob(p[1].replace(/-/g,"+").replace(/_/g,"/"))).role ?? "";
  } catch (_) { /* */ }
  return role === "service_role" ? null : Response.json({ error: "forbidden" }, { status: 403 });
}
```
```ts
// compute-metrics/index.ts — en tête du handler
Deno.serve(async (req) => {
  const denied = requireServiceRole(req); if (denied) return denied;
  let body: any; try { body = await req.json(); } catch { return new Response("bad payload", { status: 400 }); }
  const record = body?.record;
  if (!record?.user_id || !record?.team_id) return new Response("bad payload", { status: 400 });
  // ... et surtout : NE PAS faire confiance au team_id fourni
  const { data: mem } = await supa.from("memberships")
    .select("team_id").eq("user_id", record.user_id).eq("team_id", record.team_id).maybeSingle();
  if (!mem) return new Response("membership mismatch", { status: 400 });
```
Même guard en tête de `morning-brief` et de `ics-sync` (voir P0-4). Vérifier ensuite que le webhook DB `on-response-submitted` envoie bien la clé service_role dans l'en-tête `Authorization` (Dashboard → Database → Webhooks → HTTP Headers).

**Effort : 1 h** (fichier partagé + 3 fonctions + redéploiement + vérification du webhook).

---

#### P0-4 · `ics-sync` : sans guard, déclenchable par un client, et fuite l'identité de tous les tenants

**Constat.** `ics-sync/index.ts:228` : aucun contrôle d'appelant. `:232-233` : la fonction itère sur **toutes** les équipes de la base. `:302-304` : elle renvoie `diag`, un tableau qui contient pour **chaque équipe** son `team_id`, le statut HTTP de son calendrier, le `content-type`, la taille en octets, le nombre de VEVENT. En mode `dry_run=1` (`:237-245`) elle renvoie en plus le **nom** de chaque équipe et l'**hôte** de son URL de calendrier.

`ctpApi.triggerIcsSync()` (ctpApi:36-43) appelle cet endpoint **avec le JWT de l'utilisateur courant**, depuis trois écrans coach/admin (`CoachHomeSupabase:151`, `AdminTeamScreen:114`, `AdminTeamDetailScreen:192`).

**Conséquence 1 — fuite inter-tenant.** Un coach du client A qui clique « Sync calendar » reçoit dans la réponse HTTP la liste des UUID et des noms de **toutes les équipes clientes**, ainsi que l'état de santé de leur intégration calendrier. C'est une rupture d'isolation multi-tenant, même si les données de santé ne fuient pas. Devant un acheteur, c'est disqualifiant.

**Conséquence 2 — effet de bord.** Un clic d'un coach déclenche le fetch des 50 calendriers de tous les clients, en série, avec 15 s de timeout chacun (`:256-262`) → jusqu'à 750 s. Voir P1-3.

**Conséquence 3 — SSRF aveugle avec oracle.** `set_team_ics` (007:9-11) ne valide que `^https?://`. Un coach peut pointer `ics_url` sur une adresse interne ; le corps n'est pas renvoyé, mais `http_status`, `content_type` et `bytes` le sont — c'est un oracle suffisant pour cartographier. Impact réel limité (l'egress est celui de Deno Deploy), mais à fermer.

**Correctif.**
```ts
// ics-sync/index.ts:228 — nouveau handler
Deno.serve(async (req: Request) => {
  const denied = requireServiceRole(req);
  const reqUrl = new URL(req.url);
  let scopeTeam: string | null = null;
  if (denied) {
    // Appel client : autorisé, mais UNIQUEMENT sur ses propres équipes
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await supa.auth.getUser(jwt);
    if (!u?.user) return denied;
    const body = await req.json().catch(() => ({}));
    if (!body.team_id) return Response.json({ error: "team_id required" }, { status: 400 });
    const { data: role } = await supa.from("memberships").select("role")
      .eq("user_id", u.user.id).eq("team_id", body.team_id).maybeSingle();
    if (!role || !["coach","admin"].includes(role.role))
      return Response.json({ error: "forbidden" }, { status: 403 });
    scopeTeam = body.team_id;
  }
  let q = supa.from("teams").select("id, name, ics_url").not("ics_url", "is", null);
  if (scopeTeam) q = q.eq("id", scopeTeam);
  const { data: teams, error: dbErr } = await q;
  ...
  // et en fin de handler : ne renvoyer `diag` QUE si scopeTeam !== null ou service_role
  return Response.json(scopeTeam
    ? { ok: true, upserted: total, errors, diag }
    : { ok: true, upserted: total, errors, teams_found: teams?.length ?? 0 });  // pas de diag global
});
```
Et durcir `set_team_ics` (007) — **nouvelle migration, ne pas éditer 007** :
```sql
-- migration 012
create or replace function set_team_ics(p_team uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if my_role_in(p_team) not in ('coach','admin') then raise exception 'not allowed'; end if;
  if p_url is not null and nullif(trim(p_url),'') is not null then
    if p_url !~* '^https://' then raise exception 'https required'; end if;
    h := lower(split_part(split_part(regexp_replace(p_url,'^https://',''),'/',1),':',1));
    if h ~ '^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
       or h like '%.internal' or h like '%.local' then
      raise exception 'private host not allowed';
    end if;
  end if;
  update teams set ics_url = nullif(trim(p_url), '') where id = p_team;
end $$;
```
Mettre à jour `ctpApi.triggerIcsSync()` pour passer `{ team_id }`.

**Effort : 2 h.**

---

#### P0-5 · La relance +6 h envoie l'athlète vers un formulaire que la RLS a déjà fermé à +5 h

**Constat.** La policy d'insertion des réponses impose `now() <= s.end_utc + interval '5 hours'` (`002_rls.sql:63-71`). Le `session-watcher` planifie deux relances à `+3h` et `+6h` : `REMINDER_OFFSETS_MS = [3*60*60*1000, 6*60*60*1000]` (`session-watcher/index.ts:125`), avec le copy « Final reminder 🔒 — Don't let your session go untracked » (`:61`).

**Conséquence.** Le deuxième rappel est structurellement un piège. L'athlète le reçoit, ouvre le deep link (`:171`), remplit les 6 curseurs — contrat de 60 s de l'article 9 — puis reçoit un 403 `new row violates row-level security policy` à l'envoi. Sur une équipe de 15, ce sont les athlètes les moins compliants (donc ceux qu'on essaie précisément de récupérer) qui vivent cette expérience. **C'est le mode de panne qui détruit la compliance en la poursuivant.** Et il est invisible en test : il faut attendre 6 h réelles après une vraie séance pour le rencontrer.

**Correctif — choisir, ne pas bricoler.** Deux options, toutes deux d'une ligne, et la décision appartient au fondateur parce qu'elle touche la validité méthodologique de la donnée (un ressenti déclaré 7 h après la séance vaut-il celui déclaré à +30 min ?) :

*Option A — aligner la relance sur la fenêtre (aucune migration) :*
```ts
// session-watcher/index.ts:125
const REMINDER_OFFSETS_MS = [90 * 60 * 1000, 3.5 * 60 * 60 * 1000]; // +1 h 30, +3 h 30
```
*Option B — élargir la fenêtre (migration, à trancher par Gabin) :*
```sql
-- migration 012 — NE PAS appliquer sans arbitrage du fondateur sur la validité de la mesure
drop policy responses_self_insert on responses;
create policy responses_self_insert on responses for insert with check (
  user_id = auth.uid() and team_id in (select my_teams())
  and exists (select 1 from sessions s
              where s.id = session_id and s.team_id = responses.team_id
                and now() >= s.end_utc and now() <= s.end_utc + interval '8 hours'));
```
Dans les deux cas, ajouter la garde `s.team_id = responses.team_id` (aujourd'hui absente, cf. P2-8) et faire en sorte que le front affiche un message explicite quand la fenêtre est close plutôt qu'une erreur brute.

**Effort : 20 min (option A) / 45 min (option B) + décision.**

---

#### P0-6 · `session-watcher` : fenêtre de détection de 2 minutes, sans rattrapage ni verrou

**Constat.** `session-watcher/index.ts:87-95` :
```ts
const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);
.gte("end_utc", twoMinAgo.toISOString()).lte("end_utc", now.toISOString()).is("notified_at", null)
```
Le cron tourne toutes les minutes (doc 08 §11).

**Conséquence 1 — silence définitif.** Si le cron rate deux ticks — cold start, redéploiement, incident Supabase, exécution précédente encore en cours — les séances dont `end_utc` est tombé dans l'intervalle manqué ne sont **jamais** notifiées. `notified_at` reste NULL, mais la requête ne regarde jamais plus de 2 minutes en arrière. Une équipe entière rate son check-in du jour, et rien dans le système ne le signale. Le garde-fou `notified_at is null` rend pourtant le rattrapage totalement sûr.

**Conséquence 2 — double envoi.** Aucun verrou. Si une exécution dépasse 60 s (ce qui est probable à 50 équipes, cf. P1-4), pg_cron en lance une seconde. Les deux voient les mêmes séances avec `notified_at` encore NULL (le marquage est fait **après** l'envoi, `:119-121`), et les mêmes `pending_reminders` en `pending` (le passage à `sent` est fait après l'envoi, `:180-182`). Résultat : notifications en double. Le `tag: questionnaire-<id>` (`:113`) fusionne l'affichage côté navigateur, ce qui masque le symptôme sans supprimer la cause.

**Correctif — élargir la fenêtre et réclamer atomiquement.**
```ts
// Phase A — remplace :87-95
const lookback = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 h de rattrapage
const { data: endedSessions } = await supa.rpc("claim_ended_sessions", {
  p_from: lookback.toISOString(), p_to: now.toISOString(), p_limit: 100,
});
```
```sql
-- migration 012 : claim atomique, un seul worker peut prendre une séance
create or replace function claim_ended_sessions(p_from timestamptz, p_to timestamptz, p_limit int default 100)
returns table (id uuid, team_id uuid, title text)
language sql security definer set search_path = public as $$
  with c as (
    select s.id from sessions s
    where s.end_utc >= p_from and s.end_utc <= p_to
      and s.notified_at is null and s.cancelled = false
    order by s.end_utc
    for update skip locked
    limit p_limit
  )
  update sessions s set notified_at = now()
  from c where s.id = c.id
  returning s.id, s.team_id, s.title;
$$;
revoke execute on function claim_ended_sessions(timestamptz, timestamptz, int) from anon, authenticated;
```
Puis supprimer le `update notified_at` de `:119-121` (devenu redondant). Faire le même claim en Phase B :
```sql
create or replace function claim_due_reminders(p_now timestamptz, p_limit int default 300)
returns table (id uuid, team_id uuid, session_id uuid, user_id uuid, attempt int)
language sql security definer set search_path = public as $$
  with c as (
    select r.id from pending_reminders r
    where r.status = 'pending' and r.remind_at <= p_now
    order by r.remind_at
    for update skip locked
    limit p_limit
  )
  update pending_reminders r set status = 'sent'
  from c where r.id = c.id
  returning r.id, r.team_id, r.session_id, r.user_id, r.attempt;
$$;
revoke execute on function claim_due_reminders(timestamptz, int) from anon, authenticated;
```
Note : le claim marque `sent` **avant** l'envoi. C'est le bon arbitrage ici — un rappel perdu vaut mieux qu'un rappel doublé, et le rappel suivant rattrape.

**Effort : 2 h.**

---

#### P0-7 · Deux fonctions d'administration renvoient « succès » sans rien écrire

**Constat.** `ctpApi.updateTeamInfo` (ctpApi:281-286) fait `UPDATE teams`. `ctpApi.removeMember` (ctpApi:289-294) fait `DELETE memberships`. Or `002_rls.sql` ne crée que `teams_member_read` (`:44`, SELECT) et `memberships_team_read` (`:52`, SELECT). Aucune policy UPDATE sur `teams`, aucune policy DELETE sur `memberships`, et 008/009/010/011 n'en ajoutent pas (vérifié).

**Conséquence.** PostgreSQL n'échoue pas : il filtre. Zéro ligne affectée, aucune erreur, `error` est `null`, `ctpApi` renvoie `{ ok: true }`. `AdminTeamDetailScreen:175` affiche « équipe renommée », `:210` affiche « membre retiré » — et la base est intacte. Un athlète qui quitte le programme reste membre, continue de recevoir des notifications, continue d'apparaître dans le roster et dans le payload LLM. C'est **exactement la même famille de bug que `push_subscriptions`** : la seule différence est que celui-là ne produit même pas de 403 pour attirer l'attention.

**Correctif.** Ne pas ouvrir l'UPDATE/DELETE direct au client — passer par des RPC `security definer` qui vérifient le rôle, comme `set_team_ics`.
```sql
-- migration 012
create or replace function admin_update_team(p_team uuid, p_name text default null, p_timezone text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role_in(p_team) not in ('coach','admin') then raise exception 'not allowed'; end if;
  update teams set
    name     = coalesce(nullif(trim(p_name), ''), name),
    timezone = coalesce(nullif(trim(p_timezone), ''), timezone)
  where id = p_team;
end $$;

create or replace function admin_remove_member(p_team uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role_in(p_team) <> 'admin' then raise exception 'not allowed'; end if;
  if p_user = auth.uid() then raise exception 'cannot remove yourself'; end if;
  -- NE PAS supprimer : archiver. Voir P1-14 (préservation de l'historique).
  update memberships set role = role, left_at = now() where team_id = p_team and user_id = p_user;
end $$;
```
(La colonne `left_at` est introduite en P1-14 ; si on choisit de ne pas archiver, remplacer par un `delete` — mais alors lire P1-14 avant de décider.)
Côté client :
```ts
export async function updateTeamInfo(teamId: string, u: { name?: string; timezone?: string }) {
  const { error } = await db().rpc("admin_update_team",
    { p_team: teamId, p_name: u.name ?? null, p_timezone: u.timezone ?? null });
  if (error) throw error;           // ← désormais une vraie erreur remonte
  return { ok: true };
}
```

**Effort : 1 h 30.**

---

### P1 — casse à l'échelle ou corrompt la donnée

---

#### P1-1 · `v_ema_baseline` : recalcul intégral de tous les clients à chaque réponse insérée

**Le point de rupture principal du système.**

**Constat.** `003_engine.sql:47-76` définit `v_ema_baseline` avec une `WITH RECURSIVE`. `bounds` (`:48-51`) agrège **toutes** les lignes de `v_daily_scores`, donc **toutes** les réponses de **tous** les clients. `cal` (`:52-55`) génère un calendrier continu par athlète depuis sa première réponse. `rec` (`:62-71`) itère jour par jour.

`compute-metrics/index.ts:15-19` interroge `v_engine` avec `.eq("user_id", user_id).order("day", desc).limit(1)` — une seule ligne demandée. Mais **PostgreSQL ne pousse jamais un prédicat à l'intérieur d'une CTE récursive** : `WITH RECURSIVE` n'est pas inlinable (contrairement aux CTE simples depuis PG 12) et constitue une barrière d'optimisation. Le filtre `user_id = X` ne peut être appliqué qu'**après** matérialisation complète de `rec`.

**Conséquence — ordre de grandeur. [ESTIMATION à valider par le protocole §7]**

| Volume | Lignes dans `rec` | Itérations récursives | Ordre de grandeur du travail |
|---|---|---|---|
| 1 équipe, 15 athlètes, 60 j | ~900 | 60 | négligeable (< 100 ms) |
| 10 équipes, 150 athlètes, 1 saison (240 j) | ~36 000 | 240 | ~8,6 M touches de ligne |
| 50 équipes, 750 athlètes, 2 saisons (730 j) | ~547 000 | 730 | **~400 M touches de ligne** |

Le terme récursif joint la table de travail (N athlètes) contre `serie` (N_total lignes) à **chaque** itération. Le coût est en O(jours × athlètes × jours), soit quadratique en durée d'exploitation. Et cette requête est déclenchée **à chaque INSERT sur `responses`** par le webhook — soit, à 50 équipes, ~1 100 fois par jour, avec des rafales de 15 exécutions **simultanées** dans la minute qui suit chaque séance.

Autrement dit : le produit fonctionne parfaitement pendant le pilote, ralentit vers le milieu de la première saison, et devient inutilisable au moment précis où il y a des clients à conserver. C'est le pire profil de panne possible.

**Correctif — paramétrer la récursion.** Remplacer l'usage de la vue globale par une fonction qui reçoit l'athlète et ne calcule que sa série. La formule EMA, le carry-forward et les seuils restent **strictement identiques** (aucune règle d'interprétation n'est touchée) : seul le périmètre du calcul change.

```sql
-- migration 013 — moteur paramétré. La vue v_engine est CONSERVÉE telle quelle
-- (elle reste utile pour les recalculs de masse et les vérifications).
create or replace function f_engine_user(p_user uuid, p_since date default null)
returns table (user_id uuid, team_id uuid, day date, readiness numeric, ema_28 numeric,
               deviation_pct numeric, zone text, data_days bigint, acwr numeric,
               workload_au numeric, mean_28 numeric, sd_28 numeric, z_score numeric)
language sql stable security definer set search_path = public as $$
  with recursive ds as (
    select r.user_id, r.team_id, (r.submitted_at at time zone 'UTC')::date as day,
           avg(r.readiness_score) as readiness, sum(r.workload_au) as workload_au
    from responses r
    where r.user_id = p_user and r.is_test = false and r.readiness_score is not null
      and (p_since is null or r.submitted_at >= p_since)
    group by r.user_id, r.team_id, (r.submitted_at at time zone 'UTC')::date
  ),
  bounds as (select min(day) d0, max(day) d1 from ds),
  cal as (select g.day::date as day from bounds b cross join lateral generate_series(b.d0, b.d1, interval '1 day') g(day)),
  serie as (
    select c.day, s.readiness, s.workload_au, s.team_id,
           row_number() over (order by c.day) as rn
    from cal c left join ds s on s.day = c.day
  ),
  rec as (
    select day, readiness, workload_au, team_id, rn, coalesce(readiness,50)::numeric as ema
    from serie where rn = 1
    union all
    select s.day, s.readiness, s.workload_au, coalesce(s.team_id, r.team_id), s.rn,
           case when s.readiness is null then r.ema
                else round(s.readiness * 0.0690 + r.ema * 0.9310, 2) end
    from serie s join rec r on s.rn = r.rn + 1
  ),
  z as (
    select p_user as user_id, team_id, day, readiness, ema,
      case when readiness is null or ema = 0 then null
           else round((readiness - ema) / ema * 100, 1) end as deviation_pct,
      count(readiness) over (order by day) as data_days,
      workload_au,
      avg(workload_au)  over (order by day rows between  6 preceding and current row) as a7,
      avg(workload_au)  over (order by day rows between 27 preceding and current row) as c28,
      avg(readiness)    over (order by day rows between 27 preceding and current row) as m28,
      stddev_samp(readiness) over (order by day rows between 27 preceding and current row) as s28
    from rec
  )
  select user_id, team_id, day, readiness, ema,
         deviation_pct,
         case when readiness is null or data_days < 3 then 'INSUFFICIENT_DATA'
              when deviation_pct >  15 then 'YELLOW'
              when deviation_pct < -15 then 'BLUE'
              else 'GREEN' end,
         data_days,
         case when c28 > 0 then round(a7 / c28, 2) end,
         workload_au, round(m28,1), round(s28,2),
         case when s28 > 0 then round((readiness - m28) / s28, 2) end
  from z;
$$;
revoke execute on function f_engine_user(uuid, date) from anon, authenticated;
```
```ts
// compute-metrics/index.ts:15-19
const { data: engine, error } = await supa
  .rpc("f_engine_user", { p_user: user_id, p_since: null })
  .order("day", { ascending: false }).limit(1);
```
> **Les seuils recopiés ci-dessus (`±15`, `data_days < 3`, `alpha = 0.0690`) sont ceux de 003:69, 003:83-86 et 008:36-39, transcrits à l'identique. Aucune valeur n'a été inventée ni modifiée. Ils restent la propriété du fondateur.**

Vérification obligatoire avant bascule : la requête V15 du §6 compare ligne à ligne la sortie de `f_engine_user` et celle de `v_engine` sur la base réelle. **Zéro écart** est le critère de sortie.

**Optimisation complémentaire** (à faire seulement si la mesure §7 le justifie) : `p_since = current_date - 400` borne la récursion à ~400 itérations quel que soit l'âge du compte, au prix d'un réamorçage de l'EMA. À ne pas appliquer sans l'accord du fondateur — cela change la valeur de la baseline.

**Effort : 4 h** (fonction + bascule + test de non-régression V15).

---

#### P1-2 · `morning-brief` en multi-équipes : 50 appels LLM en série dans une seule invocation

**Constat.** `morning-brief/index.ts:82-87` : `for (const t of teams ?? []) { await generateBrief(t.id); }`. `generateBrief` fait 3 requêtes DB, **1 appel Anthropic bloquant** (`:41`), 2 écritures, puis les push staff en série (`:62-69`).

**[ESTIMATION]** Un appel Haiku avec `max_tokens: 1200` (llm.ts:21) rend en 3 à 8 s. À 50 équipes : **150 à 400 s** rien que pour le LLM, plus ~10 s de DB, plus les push staff. Les limites d'exécution des edge functions Supabase (wall clock ~150 s en Free, ~400 s en Pro) **[HYPOTHÈSE — vérifier le plan]** sont atteintes entre 20 et 50 équipes.

**Conséquence.** L'invocation est tuée en cours de route. Les équipes déjà traitées ont leur brief ; les suivantes n'en ont pas. Comme `select id from teams` (`:82`) sans `order by` renvoie un ordre stable en pratique (ordre physique), **ce sont toujours les mêmes équipes qui n'ont jamais de brief**. Le cron est quotidien : aucun rattrapage. Le client concerné ne reçoit jamais rien et ne sait pas pourquoi.

Aggravant : `:82` sélectionne **toutes** les équipes, y compris celles sans athlète ni réponse. Le commentaire `:81` dit « toutes les équipes ayant au moins un membre » — le code ne filtre rien. Un brief est généré et payé pour une équipe vide, avec `athletes: []` dans le payload.

**Correctif.**
```ts
// morning-brief/index.ts — remplace :81-88
const { data: teams } = await supa
  .from("daily_metrics").select("team_id").eq("day", new Date().toISOString().slice(0,10));
const ids = [...new Set((teams ?? []).map(t => t.team_id))];   // équipes ayant des données du jour

const CONCURRENCY = 5;
let done = 0, failed = 0;
for (let i = 0; i < ids.length; i += CONCURRENCY) {
  const batch = ids.slice(i, i + CONCURRENCY);
  const res = await Promise.allSettled(batch.map(id => generateBrief(id)));
  for (const r of res) {
    if (r.status === "fulfilled") done++;
    else { failed++; console.error("[BRIEF]", r.reason); }
  }
}
return Response.json({ ok: true, briefs: done, failed, considered: ids.length });
```
Ajouter dans `generateBrief`, avant l'appel LLM :
```ts
if (!metrics?.length) {                 // aucune donnée du jour : pas d'appel payant
  console.log("[BRIEF] skip", team_id, "no metrics");
  return;
}
```
Et un garde-fou d'idempotence côté coût :
```ts
const { data: already } = await supa.from("briefs").select("id")
  .eq("team_id", team_id).eq("brief_date", today).maybeSingle();
if (already) return;                    // rejeu du cron = zéro token
```
Au-delà de ~100 équipes, passer à un déclenchement par équipe (pg_cron générant N invocations, ou une file `pgmq`) plutôt qu'une invocation balayeuse. Non nécessaire à 50.

Enfin, `morning-brief` n'enregistre **rien** dans `llm_logs` en cas d'échec : la colonne `llm_logs.ok` (001:199) et `llm_logs.error` (001:200) existent et ne sont jamais alimentées à `false`. Un `narrate()` qui lève (llm.ts:27) fait remonter l'exception sans trace. Conséquence : `getAdminSystemHealth.llmErrors` (ctpApi:395) vaut structurellement 0. Correctif :
```ts
try {
  const { text, tokensIn, tokensOut } = await narrate(BRIEF_SYSTEM, payload, MODELS.daily);
  ...
} catch (e) {
  await supa.from("llm_logs").insert({ team_id, purpose: "morning_brief",
    model: MODELS.daily, ok: false, error: String(e).slice(0, 500) });
  throw e;
}
```

**Effort : 2 h.**

---

#### P1-3 · `ics-sync` : tous les calendriers de tous les clients, en série, sur un clic

**Constat.** `ics-sync/index.ts:253-303` : boucle `for` séquentielle sur toutes les équipes. Chaque itération fait un `fetch` distant avec `AbortController` à 15 000 ms (`:256-257`), puis les upserts par lots de 200 (`:290-296`), eux aussi séquentiels.

**Conséquence.** À 50 équipes dont 3 avec un calendrier lent ou mort : 3 × 15 s de timeout + 47 × ~1 s = ~92 s dans le meilleur cas, jusqu'à **750 s** si tous les calendriers expirent. Le cron aux 15 min (doc 08 §11) chevauchera ses propres exécutions. Et comme un coach déclenche la même chose depuis l'app (P0-4), l'utilisateur attend le sync de 49 équipes qui ne le concernent pas.

Sur le volume : le fenêtrage `now-30 j → now+180 j` (`:249-250`) borne l'expansion RRULE. **[ESTIMATION]** une équipe NCAA basketball produit ~1,5 séance/jour sur 210 jours = ~315 occurrences, soit 2 lots de 200. À 50 équipes : ~16 000 lignes upsertées par cycle, 100 requêtes de lot. Ce n'est pas le volume qui pose problème, c'est la sérialisation.

**Correctif.**
```ts
// ics-sync/index.ts:253 — paralléliser à 8, avec isolation d'erreur
const CONC = 8;
for (let i = 0; i < (teams ?? []).length; i += CONC) {
  const slice = teams!.slice(i, i + CONC);
  const results = await Promise.allSettled(slice.map(t => syncOneTeam(t)));  // corps de boucle extrait
  for (const r of results) if (r.status === "rejected") errors++;
}
```
Réduire le timeout à 8 s, et ajouter un court-circuit sur les calendriers qui échouent en série :
```sql
-- migration 012
alter table teams add column if not exists ics_last_sync_at timestamptz;
alter table teams add column if not exists ics_fail_count int not null default 0;
alter table teams add column if not exists ics_last_error text;
```
```ts
// sauter une équipe qui a échoué 5 fois de suite, sauf 1 tentative par heure
if (t.ics_fail_count >= 5 &&
    t.ics_last_sync_at && Date.now() - Date.parse(t.ics_last_sync_at) < 3600_000) continue;
```
Ces trois colonnes rendent aussi la console santé (`AdminSystemHealthScreen`) réellement informative : aujourd'hui `icsConfigured` (ctpApi:396) dit seulement qu'une URL existe, pas qu'elle fonctionne.

**Effort : 2 h 30.**

---

#### P1-4 · Envois push strictement séquentiels : le watcher dépasse sa minute

**Constat.** Trois boucles séquentielles avec un `await fetch` distant par itération :
- `session-watcher/index.ts:37-50` (`pushToUsers`)
- `notify/index.ts:68-87`
- `morning-brief/index.ts:62-69`

`sendPush` (webpush.ts:148-179) fait par appel : une signature ECDSA, une génération de paire ECDH, 3 HKDF, un chiffrement AES-GCM, puis un POST vers FCM/Mozilla/Apple.

**[ESTIMATION]** ~150 à 400 ms par push (dominé par le réseau). Une séance de 15 athlètes × 1,3 appareil ≈ 20 push = **3 à 8 s**. Si 10 équipes terminent leur séance dans la même minute (18 h heure locale, et les fuseaux US ne décalent que de 3 h), on est à **30-80 s**, plus 10 requêtes `memberships`, 10 `push_subscriptions`, 10 upserts de 30 relances. La Phase B ajoute jusqu'à 200 rappels avec, **pour chacun**, une requête `responses` (`:153-158`) + une requête `push_subscriptions` (`:28-30`) + un ou plusieurs push + un UPDATE : **au moins 800 aller-retours séquentiels**.

Une exécution de plus de 60 s déclenche le recouvrement décrit en P0-6.

**Correctif.**
```ts
// session-watcher/index.ts — pushToUsers, remplace la boucle :37-50
const CONC = 20;
const results: SendResult[] = [];
for (let i = 0; i < subs.length; i += CONC) {
  const r = await Promise.allSettled(subs.slice(i, i + CONC).map(s =>
    sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, authKey: s.auth_key }, payload)
      .then(res => ({ res, id: s.id }))));
  for (const x of r) {
    if (x.status === "rejected") { failed++; continue; }
    if (x.value.res.ok) sent++;
    else if (x.value.res.gone) { toDelete.push(x.value.id); cleaned++; }
    else failed++;
  }
}
```
Et supprimer le N+1 de la Phase B en préchargeant en deux requêtes au lieu de 2 par rappel :
```ts
const sessionIds = [...new Set(dueReminders.map(r => r.session_id))];
const { data: answered } = await supa.from("responses")
  .select("session_id, user_id").in("session_id", sessionIds);
const answeredSet = new Set((answered ?? []).map(a => `${a.session_id}|${a.user_id}`));
const { data: allSubs } = await supa.from("push_subscriptions")
  .select("id, user_id, endpoint, p256dh, auth_key")
  .in("user_id", [...new Set(dueReminders.map(r => r.user_id))]);
// puis regrouper en mémoire ; 2 requêtes au lieu de 400
```
Mettre également en cache les clés VAPID importées — c'est déjà fait (`webpush.ts:133-142`, variable `_keys`), bon point, mais l'instance Deno est recyclée à chaque cold start.

**Effort : 3 h.**

---

#### P1-5 · Index manquants sur les chemins les plus chauds

**Constat.** Index existants, exhaustivement : `idx_sessions_team_end (team_id, end_utc)` (001:74), `idx_responses_team_date (team_id, submitted_at)` (001:116), `idx_responses_user_date (user_id, submitted_at)` (001:117), `idx_pending_reminders_due (status, remind_at) where status='pending'` (009:45-47), plus les index implicites des PK et contraintes UNIQUE.

Manquants, par ordre de gravité :

| Manque | Requête impactée | Effet |
|---|---|---|
| `memberships (user_id)` | `my_teams()` (002:26) et `my_role_in()` (002:31) | **La plus chaude de la base** : appelée à chaque évaluation de policy, sur chaque requête de chaque écran. La PK est `(team_id, user_id)` (001:55) — son index ne sert pas un filtre sur `user_id` seul. Seq scan systématique. Coûteux en absolu même sur 1 000 lignes, car multiplié par le nombre de vérifications RLS. |
| `daily_metrics (team_id, day)` | `getTeamMetrics` (ctpApi:119-121), `getTeamMetricsRange` (ctpApi:403-406) | PK = `(user_id, day)` (001:133). Le tableau de bord coach fait un seq scan sur une table qui atteint 274 k lignes/an à 50 équipes. |
| `sessions (end_utc) where notified_at is null and cancelled = false` | `session-watcher` Phase A (`:90-95`) | L'index existant commence par `team_id`, inutilisable pour un balayage global sur `end_utc`. Seq scan **toutes les minutes**, 1 440 fois par jour. |
| `pending_reminders (team_id, created_at)` | `getAdminSystemHealth` (ctpApi:365-366) | Table à ~820 k lignes/an à 50 équipes (P2-11), jamais purgée. |
| `llm_logs (team_id, created_at)` | `getAdminSystemHealth` (ctpApi:363-364) | Volume faible, mais gratuit à corriger. |
| `flags (team_id, day)` | usages futurs du roster | `unique (user_id, rule_id, day)` (001:164) ne couvre pas un filtre par équipe. |
| `responses (session_id)` | `getResponsesForSessions` (ctpApi:213-217) | Couvert par `unique (session_id, user_id)` (001:114) — **pas de manque**, vérifié. |

**Correctif.**
```sql
-- migration 012
create index concurrently if not exists idx_memberships_user      on memberships (user_id);
create index concurrently if not exists idx_daily_metrics_team_day on daily_metrics (team_id, day);
create index concurrently if not exists idx_sessions_pending_notify
  on sessions (end_utc) where notified_at is null and cancelled = false;
create index concurrently if not exists idx_pending_reminders_team on pending_reminders (team_id, created_at);
create index concurrently if not exists idx_llm_logs_team_created  on llm_logs (team_id, created_at);
create index concurrently if not exists idx_flags_team_day         on flags (team_id, day);
```
(`concurrently` ne peut pas s'exécuter dans une transaction : lancer ces lignes une par une dans le SQL editor, pas via `supabase db push` groupé.)

**Effort : 30 min.**

---

#### P1-6 · `getAdminSystemHealth` : 8N+1 requêtes pour un écran de lecture

**Constat.** `getAdminTeams` (ctpApi:245-270) fait 1 requête `memberships` puis **une requête `count` par équipe** (`:257-259`) dans un `Promise.all` — soit N+1. `getAdminSystemHealth` (ctpApi:346-398) appelle `getAdminTeams` puis lance **7 requêtes par équipe** (`:355-368`).

Total : **8N + 1**. À 50 équipes : **401 requêtes HTTP** depuis le navigateur pour afficher un tableau. Chacune traverse PostgREST et évalue les policies (donc rappelle `my_role_in`, donc seq-scanne `memberships`, cf. P1-5). **[ESTIMATION]** 400 requêtes × 40 ms, même parallélisées par lots de 6 connexions HTTP/1.1 (le navigateur limite), donne 3 à 10 s d'attente et un pic de charge DB à chaque ouverture de l'écran.

Aggravant : `safe()` (ctpApi:335-338) **avale toutes les erreurs** et renvoie le fallback. Une policy manquante, un timeout, une table absente : l'écran affiche 0 et paraît normal. La console de santé peut donc mentir sur la santé.

**Correctif.** Une seule RPC agrégée côté serveur.
```sql
-- migration 012
create or replace function admin_system_health(p_days int default 7)
returns table (team_id uuid, team_name text, athletes bigint, staff bigint,
               last_brief date, briefs_count bigint, sessions_ended bigint,
               sessions_upcoming bigint, responses bigint, reminders_pending bigint,
               reminders_sent bigint, cost_30d numeric, llm_errors bigint, ics_configured boolean)
language sql stable security definer set search_path = public as $$
  with my as (
    select m.team_id from memberships m
    where m.user_id = auth.uid() and m.role in ('coach','admin')
  )
  select t.id, t.name,
    (select count(*) from memberships x where x.team_id=t.id and x.role='athlete'),
    (select count(*) from memberships x where x.team_id=t.id and x.role<>'athlete'),
    (select max(b.brief_date) from briefs b where b.team_id=t.id),
    (select count(*) from briefs b where b.team_id=t.id and b.brief_date >= current_date - p_days),
    (select count(*) from sessions s where s.team_id=t.id and s.cancelled=false
       and s.end_utc between now() - make_interval(days => p_days) and now()),
    (select count(*) from sessions s where s.team_id=t.id and s.cancelled=false and s.end_utc > now()),
    (select count(*) from responses r where r.team_id=t.id
       and r.submitted_at >= now() - make_interval(days => p_days)),
    (select count(*) from pending_reminders p where p.team_id=t.id and p.status='pending'),
    (select count(*) from pending_reminders p where p.team_id=t.id and p.status='sent'
       and p.created_at >= now() - make_interval(days => p_days)),
    (select coalesce(sum(l.cost_usd),0) from llm_logs l where l.team_id=t.id
       and l.created_at >= now() - interval '30 days'),
    (select count(*) from llm_logs l where l.team_id=t.id and l.ok=false
       and l.created_at >= now() - interval '30 days'),
    (t.ics_url is not null)
  from teams t join my on my.team_id = t.id;
$$;
```
Côté client : `const { data, error } = await db().rpc("admin_system_health", { p_days: days }); if (error) throw error;` — **et supprimer `safe()`**, qui transforme une panne en zéro.

Corriger aussi `getAdminTeams` : le count de membres est déjà dans la RPC, ou se fait en une requête groupée.

**Effort : 2 h.**

`getTeamMembers` (ctpApi:168-181) fait 2 requêtes (memberships puis profiles par `in`) : **c'est correct**, ce n'est pas un N+1. Ne pas y toucher.

---

#### P1-7 · Le bucket journalier est en UTC alors que `teams.timezone` existe et n'est jamais lu

**Constat.** `003_engine.sql:38` et `:43` : `(submitted_at at time zone 'UTC')::date as day`. La colonne `teams.timezone` (001:24, défaut `America/New_York`) n'est lue **nulle part** — vérifié par recherche sur `src/`, `screens/`, `supabase/` : elle n'apparaît que comme champ typé décoratif dans `AdminTeamScreen.tsx:25`. `morning-brief/index.ts:14` calcule `today` en UTC lui aussi.

**Conséquence.** Le jour de rattachement d'une réponse est le jour **UTC** de son envoi.
- Équipe Est (UTC−4/−5) : une séance qui se termine à 20 h 30 locales est envoyée à 00 h 30 UTC → la réponse est comptée **le lendemain**.
- Équipe Californie (UTC−7/−8) : le basculement se fait à 17 h locales. **Toute séance de fin d'après-midi ou de soirée est datée du lendemain.** Or c'est l'horaire majoritaire d'une pratique NCAA.

Trois effets en cascade :
1. La série journalière de `v_daily_scores` est décalée d'un jour pour ces réponses. Si l'équipe a une séance le matin et une le soir, elles atterrissent sur **deux jours différents** alors que c'est la même journée d'entraînement — et si elles atterrissent sur le même jour, elles sont moyennées (`avg`, 003:39), ce qui est un autre choix de méthode.
2. Le brief de 11 h UTC (doc 08 §11 = 4 h en Californie, 7 h à New York) interroge `daily_metrics.day = today` (morning-brief:14, 24) : pour une équipe californienne, les réponses de la veille au soir sont bien sur `today` — **par accident**, pas par conception. Le jour où le cron est déplacé, tout casse silencieusement.
3. L'EMA et le z-score sont calculés sur une grille de jours qui ne correspond pas aux journées d'entraînement réelles.

Ce n'est pas une erreur d'arrondi : c'est la grille temporelle de tout le moteur.

**Correctif.** Rattacher la réponse au fuseau de son équipe.
```sql
-- migration 013 — grille temporelle locale à l'équipe
create or replace view v_daily_scores as
select r.user_id, r.team_id,
       (r.submitted_at at time zone t.timezone)::date as day,
       avg(r.readiness_score) as readiness,
       sum(r.workload_au)     as workload_au
from responses r
join teams t on t.id = r.team_id
where r.is_test = false and r.readiness_score is not null
group by r.user_id, r.team_id, (r.submitted_at at time zone t.timezone)::date;
alter view v_daily_scores set (security_invoker = true);
revoke select on v_daily_scores from anon, authenticated;
```
Et côté brief :
```ts
// morning-brief/index.ts:14 — le "today" de l'équipe, pas celui de Greenwich
const { data: tz } = await supa.from("teams").select("timezone").eq("id", team_id).single();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz?.timezone ?? "UTC" }).format(new Date());
```
**Attention — décision du fondateur.** Appliquer ce correctif **rebattit tout l'historique** : des réponses actuellement datées du jour J basculeront sur J−1. Les `daily_metrics` déjà écrites devront être recalculées (`select f_engine_user(...)` sur tous les athlètes) ou purgées. À faire **avant** le premier client, jamais après. C'est précisément pour cette raison que ce point est P1 et non P2 : la fenêtre pour le corriger sans douleur se referme le jour de la première signature.

**Effort : 2 h + 1 recalcul complet.**

---

#### P1-8 · `ics-sync` ne supprime ni n'annule jamais une séance retirée du calendrier

**Constat.** `ics-sync/index.ts:281-296` ne fait que des `upsert`. Aucun `delete`, aucun marquage `cancelled = true` pour les séances présentes en base et absentes du flux. Le champ `ics_hash` (001:68) n'est jamais écrit — recherche exhaustive : il n'apparaît que dans la déclaration du schéma.

**Conséquence.** Un coach déplace une pratique de 16 h à 17 h : la clé de conflit est `(team_id, ics_uid, start_utc)` (001:72) → `start_utc` a changé → **une deuxième ligne est créée**, l'ancienne reste. Les deux séances « se terminent », les deux déclenchent une notification, les deux créent des `pending_reminders`. L'athlète reçoit deux demandes de check-in pour une seule séance ; la fenêtre RLS n'en ouvre qu'une (celle qui vient de finir), l'autre échoue.

Un coach supprime une séance : la ligne reste, la notification part quand même. **On demande à l'athlète de noter une séance qui n'a pas eu lieu.** Et le dénominateur de compliance (`ctpApi:374`, `expected = ended.length * athletes`) est faussé à la hausse — l'équipe paraît moins compliante qu'elle ne l'est.

**Correctif.** Réconciliation par fenêtre : ce qui n'est plus dans le flux est marqué annulé.
```ts
// ics-sync — après les upserts d'une équipe
const seenUids = rows.map(r => r.ics_uid).filter(Boolean) as string[];
const wStartISO = new Date(wStart).toISOString(), wEndISO = new Date(wEnd).toISOString();
// Annuler les séances futures de la fenêtre qui viennent de l'ICS et ne sont plus dans le flux.
// Sécurité : jamais de séance passée (l'historique de réponses doit rester lisible),
// jamais une séance créée à la main (ics_uid is null).
await supa.from("sessions").update({ cancelled: true })
  .eq("team_id", t.id).eq("cancelled", false)
  .not("ics_uid", "is", null)
  .gt("start_utc", new Date().toISOString())
  .lte("start_utc", wEndISO)
  .not("ics_uid", "in", `(${seenUids.map(u => `"${u}"`).join(",")})`);
```
(Si `seenUids` est vide, ne rien faire — un flux vide est plus probablement une panne de fetch qu'une saison annulée.)

Et purger les relances devenues sans objet :
```sql
-- migration 012 : quand une séance est annulée, ses relances meurent avec elle
create or replace function trg_session_cancelled() returns trigger
language plpgsql as $$
begin
  if new.cancelled = true and coalesce(old.cancelled,false) = false then
    update pending_reminders set status = 'expired'
    where session_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
create trigger sessions_cancel_reminders after update of cancelled on sessions
  for each row execute function trg_session_cancelled();
```

**Effort : 3 h.**

---

#### P1-9 · `sessions.ics_uid` nullable dans une contrainte UNIQUE : doublons illimités

**Constat.** `001_schema.sql:72` : `unique (team_id, ics_uid, start_utc)`, avec `ics_uid text` nullable (`:67`). En PostgreSQL, deux NULL ne sont **jamais** égaux dans un index unique (comportement par défaut, `NULLS DISTINCT`). `ics-sync/index.ts:287` écrit `ics_uid: ev.uid || null`.

**Conséquence.** Tout VEVENT sans propriété `UID` — certains exports Outlook, certains calendriers partagés, tout ICS malformé — produit une ligne **nouvelle à chaque sync**. Le cron tourne toutes les 15 minutes : 96 doublons par jour et par événement. La table `sessions` gonfle, le watcher notifie chaque doublon, l'athlète reçoit des dizaines de demandes de check-in.

**Correctif.**
```sql
-- migration 012 — PG 15+ : rendre les NULL non distincts
alter table sessions drop constraint sessions_team_id_ics_uid_start_utc_key;
alter table sessions add constraint sessions_ics_key
  unique nulls not distinct (team_id, ics_uid, start_utc);
```
**[HYPOTHÈSE]** `NULLS NOT DISTINCT` exige PostgreSQL ≥ 15 ; Supabase sert du 15 par défaut depuis 2023. Vérifier via `select version();`. Repli si PG 14 :
```sql
create unique index sessions_ics_key on sessions (team_id, coalesce(ics_uid,''), start_utc);
```
Et côté fonction, ne jamais laisser un UID vide :
```ts
ics_uid: ev.uid || `gen_${await sha256(`${t.id}|${ev.title}|${ev.start.toISOString()}`)}`,
```

**Effort : 45 min.**

---

#### P1-10 · Les pseudonymes ne sont pas stables : collisions garanties après un départ

**Constat.** `join-team/index.ts:45-47` :
```ts
const { count } = await supa.from("memberships").select("*", { count:"exact", head:true }).eq("team_id", team.id);
const pseudonym = `P-${String((count ?? 0) + 1).padStart(2, "0")}`;
```
Le pseudonyme dérive du **nombre courant** de membres, sans contrainte d'unicité (`memberships` n'a aucun unique sur `(team_id, pseudonym)`, 001:46-56).

**Conséquence.** Un membre part (ou est retiré) : le compteur redescend. Le suivant reçoit un pseudonyme **déjà attribué**. Deux athlètes deviennent `P-07`. Or le pseudonyme est le seul identifiant transmis au LLM (001:53, morning-brief:30-37) et la seule clé de lecture du brief pour le coach. Le brief dit « P-07 est à −22 % de sa baseline » et **le coach ne sait pas de qui il parle**. C'est l'article 4 de la Constitution (« chaque phrase rattachable à un chiffre ») qui perd son ancrage.

Aggravant, l'upsert de `:49-51` recalcule le pseudonyme même pour un membre existant : re-rejoindre l'équipe change son identifiant, et les briefs archivés deviennent illisibles rétroactivement.

**Correctif.**
```sql
-- migration 012
alter table memberships add constraint memberships_pseudonym_unique unique (team_id, pseudonym);
```
```ts
// join-team — pseudonyme = premier entier libre, calculé en base, jamais réattribué
const { data: taken } = await supa.from("memberships").select("pseudonym").eq("team_id", team.id);
const used = new Set((taken ?? []).map(t => t.pseudonym));
let n = 1; while (used.has(`P-${String(n).padStart(2,"0")}`)) n++;
const pseudonym = `P-${String(n).padStart(2,"0")}`;
```
Combiné à P1-14 (archivage au lieu de suppression), le pseudonyme d'un partant reste occupé et ne sera jamais recyclé — c'est la propriété qu'on veut.

**Effort : 45 min.** À faire **avant** le premier client : la requête V10 du §6 détecte les collisions déjà présentes.

---

#### P1-11 · `updateMyProfile` écrit dans des colonnes qui n'existent pas

**Constat.** `ctpApi.updateMyProfile` (ctpApi:422-427) fait un upsert sur `profiles` avec `{ display_name, jersey_number, position }`. La table `profiles` (001:38-44) contient : `user_id`, `display_name`, `email`, `fcm_tokens`, `created_at`. `jersey_number` et `position` appartiennent à `memberships` (001:50-51).

`ProfileScreenSupabase.tsx:194-198` envoie systématiquement les trois champs.

**Conséquence.** PostgREST rejette (`column "jersey_number" of relation "profiles" does not exist`), `ctpApi` lève (`:428`), l'écran affiche une erreur. **L'édition de profil ne fonctionne pour personne**, sauf si l'athlète laisse les champs numéro et poste vides (`undefined` — mais `undefined` est sérialisé par `supabase-js` ? à vérifier ; l'objet contient bien les clés). C'est un bug de premier écran, visible à la minute 2 d'une démo.

**Correctif.** Deux écritures, chacune dans sa table.
```ts
export async function updateMyProfile(u: { display_name?: string; jersey_number?: number; position?: string }) {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error("not signed in");
  if (u.display_name !== undefined) {
    const { error } = await db().from("profiles")
      .upsert({ user_id: user.id, display_name: u.display_name }, { onConflict: "user_id" });
    if (error) throw error;
  }
  if (u.jersey_number !== undefined || u.position !== undefined) {
    const { error } = await db().rpc("update_my_membership_profile",
      { p_jersey: u.jersey_number ?? null, p_position: u.position ?? null });
    if (error) throw error;
  }
  return { ok: true };
}
```
```sql
-- migration 012 : memberships n'a pas de policy UPDATE, et ne doit pas en avoir
-- (sinon un athlète pourrait modifier son propre `role` — cf. P0-2).
create or replace function update_my_membership_profile(p_jersey int, p_position text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update memberships set
    jersey_number = coalesce(p_jersey, jersey_number),
    position      = coalesce(nullif(trim(p_position),''), position)
  where user_id = auth.uid();       -- jamais `role`, jamais `pseudonym`
end $$;
```
> Point important : **ne pas** « corriger » ce bug en ajoutant une policy UPDATE sur `memberships`. Ce serait rouvrir P0-2 par une autre porte, en permettant à un athlète de modifier son propre `role`.

**Effort : 1 h.**

---

#### P1-12 · Un athlète qui change d'équipe corrompt sa propre baseline

**Constat.** Trois points structurels se contredisent :
1. `daily_metrics` a pour clé primaire `(user_id, day)` (001:133) — **pas** `(user_id, team_id, day)`. Une seule ligne par athlète et par jour, quel que soit le nombre d'équipes.
2. `v_ema_baseline` : `bounds` groupe par `(user_id, team_id)` (003:49-51) donc produit **deux lignes** pour un athlète bi-équipe, `cal` génère deux calendriers qui se recouvrent, mais `serie` numérote avec `row_number() over (partition by c.user_id order by c.day)` (003:58) — **partition sur `user_id` seul**. Les jours des deux équipes sont donc entrelacés dans une chaîne unique, et `rec` (003:70) applique l'EMA **deux fois par jour civil**.
3. `flags` : `unique (user_id, rule_id, day)` (001:164) — même collision.

**Conséquence.** Pour un athlète appartenant à deux équipes (transfert en cours de saison, athlète bi-sport, ou simplement un compte de test resté membre de l'équipe pilote), la baseline EMA est calculée sur une série dupliquée : le lissage est effectivement deux fois plus rapide, la déviation est fausse, la zone est fausse. Le `team_id` retenu dans `daily_metrics` est celui de la dernière écriture, donc arbitraire. Le coach de l'équipe A peut voir une ligne calculée avec des données de l'équipe B.

**[HYPOTHÈSE]** Aucune ligne du produit n'interdit l'appartenance multiple : `memberships` a pour PK `(team_id, user_id)` (001:55), ce qui autorise explicitement plusieurs équipes par utilisateur. `getMyMembership` (ctpApi:24-27) fait `.limit(1).maybeSingle()` **sans `order by`** : l'écran affiche une équipe arbitraire.

**Correctif — trancher la question, puis l'imposer en base.** Deux positions cohérentes :

*A — un athlète, une équipe (recommandé pour la V2) :*
```sql
-- migration 012
create unique index memberships_one_team_per_athlete
  on memberships (user_id) where role = 'athlete';
```
Une ligne, une vérité, zéro ambiguïté. Le transfert devient une opération explicite (archivage + nouvelle adhésion, cf. P1-14).

*B — multi-équipes assumé :* il faut alors reprendre la PK de `daily_metrics` en `(user_id, team_id, day)`, l'unique de `flags` en `(user_id, team_id, rule_id, day)`, et partitionner **toutes** les fenêtres du moteur sur `(user_id, team_id)` — 003:58, 003:70, 003:75, 003:100-101, 008:41. C'est une refonte du moteur pour un besoin qui n'existe pas encore.

**Recommandation : A**, et la requête V9 du §6 pour vérifier qu'aucun compte n'est déjà dans cette situation.

**Effort : 30 min (A) / 1 journée (B).**

---

#### P1-13 · Un coach peut modifier et supprimer `coach_feedback`

**Constat.** `002_rls.sql:88-90` : `create policy feedback_staff_all on coach_feedback for all using (my_role_in(team_id) in ('coach','admin')) with check (coach_id = auth.uid() and ...)`. `FOR ALL` couvre SELECT, INSERT, UPDATE **et DELETE**. Le `with check` ne s'applique pas au DELETE (qui n'a que `using`).

**Conséquence.** Un coach peut supprimer n'importe quelle ligne de feedback de son équipe, y compris celles d'un autre coach. Or CLAUDE.md §6 pose : « `coach_feedback` est sacré (futur dataset) — ne jamais le purger », et la Constitution art. 1 en fait l'actif différenciant à 10 ans (« le seul dataset au monde reliant ressenti athlète et décisions d'entraînement réelles »). Un `for all` négligent expose l'actif stratégique à un clic.

Accessoirement, le `with check` autorise un coach à faire un UPDATE d'une ligne d'un collègue **à condition d'y mettre son propre `coach_id`** — donc à s'approprier un feedback.

**Correctif.**
```sql
-- migration 012
drop policy feedback_staff_all on coach_feedback;
create policy feedback_staff_read on coach_feedback for select
  using (my_role_in(team_id) in ('coach','admin'));
create policy feedback_staff_insert on coach_feedback for insert
  with check (coach_id = auth.uid() and my_role_in(team_id) in ('coach','admin'));
-- Pas d'UPDATE, pas de DELETE. Un avis donné est un fait daté ; on en ajoute un nouveau,
-- on ne réécrit pas l'ancien. (Si un « annuler » produit est voulu, ajouter une colonne
-- `revoked_at` et une policy UPDATE restreinte à cette seule colonne.)
```

**Effort : 20 min.**

---

#### P1-14 · Suppressions en cascade : l'historique d'un athlète parti disparaît, celui d'une équipe supprimée aussi

**Constat.** Chaîne de cascades vérifiée dans 001 :
- `teams` supprimée → `seasons`(:30), `sessions`(:60), `responses`(:99), `daily_metrics`(:122), `flags`(:157), `briefs`(:169), `coach_feedback`(:183), `memberships`(:47), `team_questionnaires`(:91), `cycles`(008:10), `pending_reminders`(009:30) : **tout disparaît**, y compris `coach_feedback`.
- `auth.users` supprimé → `profiles`(:39), `memberships`(:48), `responses`(:101), `daily_metrics`(:121), `flags`(:158), `push_subscriptions`(009:9), `pending_reminders`(009:31).
- `memberships` supprimée (le cas courant : `removeMember`) → **aucune cascade**. Les `responses` et `daily_metrics` survivent. Mais `v_ai_dataset` (003:112-120) fait `join memberships` : les données d'un athlète parti **sortent du dataset d'entraînement** alors qu'elles restent en base. Et `morning-brief:17-19` ne le liste plus, donc son pseudonyme n'est plus résolu.
- `coach_feedback.coach_id references auth.users(id)` (001:183) **sans clause ON DELETE** → `NO ACTION`. Supprimer un compte coach qui a laissé un feedback **échoue** avec une violation de clé étrangère. Une demande d'effacement FERPA/RGPD se heurte donc à une erreur Postgres.
- `sessions.season_id references seasons(id)` (001:62) sans ON DELETE : idem.
- `flags.rule_id references rules(id)` (001:159) sans ON DELETE : supprimer une règle échoue s'il existe des flags. **C'est le bon comportement** — la traçabilité prime. Ne pas toucher.

**Conséquence.** Deux risques opposés et tous deux réels : (a) une suppression d'équipe (résiliation, erreur de manipulation admin) détruit irréversiblement l'actif dataset ; (b) une demande légitime de suppression de compte est bloquée par une FK.

**Correctif.** Sortir du modèle « supprimer » et adopter « archiver ».
```sql
-- migration 012
alter table memberships add column if not exists left_at timestamptz;
alter table teams       add column if not exists archived_at timestamptz;

-- Le staff ne voit que les membres actifs ; l'historique reste en base.
drop policy memberships_team_read on memberships;
create policy memberships_team_read on memberships for select
  using (team_id in (select my_teams()));   -- inchangé : le filtre `left_at is null`
                                            -- se fait dans les requêtes, pas dans la policy
-- my_teams() ne doit plus renvoyer les équipes quittées :
create or replace function my_teams() returns setof uuid
language sql stable security definer set search_path = public as $$
  select team_id from memberships where user_id = auth.uid() and left_at is null
$$;

-- Le feedback survit à la suppression de son auteur.
alter table coach_feedback drop constraint coach_feedback_coach_id_fkey;
alter table coach_feedback add constraint coach_feedback_coach_id_fkey
  foreign key (coach_id) references auth.users(id) on delete set null;
alter table coach_feedback alter column coach_id drop not null;
```
Et `v_ai_dataset` doit cesser de perdre les partants :
```sql
-- 003:118 : le join devient un left join, sinon le dataset se vide de ses partants
create or replace view v_ai_dataset as
select m.pseudonym, m.position, m.birth_year, dm.day, dm.readiness, dm.ema_28,
       dm.deviation_pct, dm.zone, dm.workload_au, dm.acwr, f.rule_id, cf.action as coach_action
from daily_metrics dm
left join memberships m on m.user_id = dm.user_id and m.team_id = dm.team_id
left join flags f  on f.user_id = dm.user_id and f.day = dm.day
left join coach_feedback cf on cf.flag_id = f.id;
alter view v_ai_dataset set (security_invoker = true);
revoke select on v_ai_dataset from anon, authenticated;
```
Enfin, retirer aux admins tout chemin de suppression d'équipe depuis l'app (il n'y en a pas aujourd'hui — **ne pas en créer**). Une résiliation se traite par `archived_at`, jamais par `delete from teams`.

**Effort : 3 h.**

---

### P2 — dette, à traiter par opportunité

| # | Constat (fichier:ligne) | Conséquence | Correctif | Effort |
|---|---|---|---|---|
| **P2-1** | `questionnaires_read` : `using (auth.uid() is not null)` (002:56-57) | Tout compte lit tous les questionnaires. Sans effet aujourd'hui (1 template), fuite dès le premier questionnaire personnalisé. | `using (id in (select questionnaire_id from team_questionnaires where team_id in (select my_teams())) or is_default)` | 15 min |
| **P2-2** | `compute-metrics:25-31` : le résultat de l'upsert `daily_metrics` n'est jamais lu ; `:39-47` : `eval_rule` n'est pas protégé par un try/catch | Un échec d'écriture renvoie « ok ». Une erreur de syntaxe dans un `rules.condition_sql` fait planter la fonction pour **tous** les athlètes. | Vérifier `error` sur chaque écriture ; envelopper chaque `eval_rule` dans un `try/catch` qui logue et continue. | 45 min |
| **P2-3** | `session-watcher:188-192` : `const { count: expired } = await supa...update(...)` | `supabase-js` ne renvoie `count` sur un UPDATE que si `{ count: "exact" }` est passé. `reminders_expired` vaut **toujours 0**. Statistique fausse. | `.update({...}, { count: "exact" })` | 5 min |
| **P2-4** | `create-team:46-48` : bootstrap `teamCount === 0` | Le seed 006 crée « Pilot Team », donc `teamCount ≥ 1` **dès la première migration** : la branche bootstrap est morte. Or `join-team` ne délivre jamais le rôle `admin` (join-team:31). **Aucun chemin logiciel ne crée le premier admin** — seul un INSERT manuel le peut. | Remplacer par une liste d'e-mails fondateurs en secret, ou assumer la création manuelle et le documenter. | 30 min |
| **P2-5** | `create-team` : les réponses 401/403/500 (`:36, :50, :67, :84`) n'ont pas d'en-tête CORS ; seule la 200 (`:104-106`) en a | Le navigateur transforme toute erreur métier en « Failed to fetch ». L'admin ne voit jamais le vrai message — ce qui a probablement masqué P0-1 pendant des semaines. | Extraire les en-têtes CORS dans une constante et les appliquer à **toutes** les réponses. | 20 min |
| **P2-6** | `notify/index.ts` (95 l.) n'a aucun appelant | `session-watcher` et `morning-brief` appellent `sendPush` directement. Fonction morte, mais correctement gardée (`:28-33`) donc inoffensive. | Supprimer, ou l'adopter comme point d'entrée unique des envois (préférable : un seul endroit pour la logique de nettoyage des endpoints `gone`). | 1 h |
| **P2-7** | Colonnes/tables mortes : `sessions.ics_hash` (001:68), `sessions.planned_load/objective/group_label` (008:4-6), `teams.timezone` (001:24), table `cycles` (008:8), `profiles.fcm_tokens` (001:42), `responses.session_load/workload_au` (001:106-107) | `workload_au` toujours NULL → `acwr` toujours NULL → `v_acwr` (003:92-101) calcule des NULL sur toute la base à chaque exécution du moteur, pour rien. | Ne rien supprimer (ce sont des amorces assumées, lot L5), mais court-circuiter `v_acwr` tant que `workload_au` est NULL partout : c'est du travail gratuit dans la boucle la plus chaude. | 30 min |
| **P2-8** | `responses_self_insert` (002:63-71) ne vérifie pas `s.team_id = responses.team_id` | Un athlète membre de deux équipes peut rattacher une réponse à l'équipe A avec une séance de l'équipe B. **Non exploitable en inter-tenant** : la sous-requête `exists (select 1 from sessions ...)` est elle-même soumise à `sessions_member_read` (002:48-49), donc l'athlète ne peut référencer que des séances de ses propres équipes. Vérification faite, risque limité au cas multi-équipes de P1-12. | Ajouter `and s.team_id = responses.team_id` dans le `with check`. | 10 min |
| **P2-9** | `getMyMembership` (ctpApi:24-27) : `.limit(1).maybeSingle()` sans `order by` | Équipe affichée arbitraire pour un compte multi-équipes. Se résout avec P1-12 option A. | `.order("joined_at").limit(1)` en attendant. | 5 min |
| **P2-10** | EMA : `round(..., 2)` à chaque pas (003:69) | Erreur d'arrondi ré-injectée dans la récurrence. Borne théorique de la dérive : 0,005 / (1 − 0,931) ≈ **0,07 point**. Négligeable, mais autant ne pas arrondir en cours de récurrence. | Arrondir seulement à la projection finale. **Modifie les valeurs produites — décision du fondateur.** | 15 min + décision |
| **P2-11** | Aucune rétention sur `pending_reminders` (009:28) ni `llm_logs` (001:193) | **[ESTIMATION]** `pending_reminders` : 750 athlètes × 1,5 séance/j × 2 tentatives × 365 ≈ **820 k lignes/an** à 50 équipes, jamais purgées, scannées par la console santé. | `delete from pending_reminders where created_at < now() - interval '90 days'` en cron mensuel. Ne **jamais** purger `coach_feedback`, `briefs`, `responses`, `daily_metrics`. | 30 min |
| **P2-12** | Pas de `supabase/config.toml` dans le dépôt | Les réglages `verify_jwt` par fonction, les crons pg_cron et le webhook DB ne sont **nulle part dans le code**. Doc 08 §11 les décrit, mais rien ne les impose ni ne les vérifie. Un projet Supabase recréé from scratch ne reproduit pas la prod. | Versionner `config.toml` et une migration qui crée les jobs pg_cron (`cron.schedule(...)`). | 2 h |
| **P2-13** | `v_zones` (003:83) : zone active dès `data_days >= 3` | À J+3, l'EMA vaut encore ~81 % de la première mesure : la « déviation par rapport à la baseline » est en réalité une déviation par rapport au premier jour. La Constitution art. 6 pose un défaut moteur de **10 jours** avant tout flag, et `rules.min_data_days` vaut bien 10 (001:146) — mais la **zone**, elle, s'affiche à 3 et c'est elle que le coach lit dans le brief et sur le halo. | **Aucun correctif proposé : ce seuil appartient au fondateur** (003:78-79 le dit explicitement). Point porté à son arbitrage, rien de plus. | décision |
| **P2-14** | `006_seed_initial.sql:11` : code d'invitation `CTP-PILOT` en clair dans le dépôt | Code devinable sur une base de production. Combiné à P0-2, il ouvre l'équipe pilote à quiconque lit ce répertoire. | Supprimer la ligne du seed avant production, ou régénérer le code de l'équipe pilote. | 10 min |

---

## 4. Ce qui est solide — à ne pas toucher

| Élément | Fichier | Pourquoi c'est un actif, et pourquoi y toucher serait une régression |
|---|---|---|
| **`readiness_score` calculé par trigger** | 003:25-34 | `before insert or update of metrics` : le client ne peut pas mentir sur son score, même en appelant l'API directement. La formule (inversion `101 − val`, somme pondérée, clamp 1-100, 003:10-23) est le port fidèle de `calcReadinessFromQuestionnaire`. C'est la garantie que les mêmes données donnent le même score pour tout le monde. **Ne jamais recalculer côté client.** |
| **`rules` sans aucune policy** | 002:92-93 | Zéro policy = deny-all pour `anon` et `authenticated`. Le contenu de la table est structurellement invisible du client. C'est l'implémentation littérale de l'article 2 de la Constitution. Ajouter une policy de lecture « pour l'admin » serait une erreur : le brief expose déjà les textes nécessaires via `briefs.payload`. |
| **`eval_rule` révoquée aux clients** | 003:135 | La fonction exécute du SQL arbitraire issu de `rules.condition_sql`. Le `revoke execute ... from anon, authenticated` est ce qui rend ce design acceptable. Toute évolution qui l'exposerait, même indirectement (RPC intermédiaire, vue), rouvrirait une injection SQL avec les droits du propriétaire. |
| **Double verrou sur les vues du moteur** | 005:3-9, 008:45-46 | `security_invoker = true` **plus** `revoke select`. Les deux ensemble : même si un GRANT réapparaît, l'invoker limite la casse ; même si l'invoker saute, le revoke tient. 008 a pensé à re-verrouiller après un `create or replace` — c'est le réflexe correct, à garder. |
| **Fenêtre d'écriture du check-in appliquée en base** | 002:63-71 | La contrainte temporelle n'est pas dans l'UI, elle est dans la policy. Un athlète ne peut pas antidater un ressenti, ni le remplir trois jours plus tard. C'est ce qui rend la donnée défendable scientifiquement. La borne (5 h) doit bouger (P0-5), **le principe ne doit pas**. |
| **Payload LLM pseudonymisé et archivé** | morning-brief:30-39, 44-47 | Le LLM ne reçoit que `P-xx` + dérivés numériques ; `briefs.payload` stocke l'octet exact envoyé. C'est simultanément la conformité (jamais nom + santé ensemble) et la traçabilité (on peut rejouer n'importe quel brief). Cette combinaison est rare et c'est l'argument de due diligence. |
| **`my_teams()` / `my_role_in()` en `security definer` avec `search_path` figé** | 002:24-32 | Le `set search_path = public` empêche le détournement par un schéma utilisateur. Les deux fonctions sont `stable`, donc mises en cache dans une même requête. Le motif `in (select my_teams())` évite la ré-évaluation ligne à ligne. C'est la bonne façon d'écrire de la RLS multi-tenant. Il manque juste l'index (P1-5). |
| **`_shared/webpush.ts`** | webpush.ts entier | VAPID ES256 + ECE aes128gcm en WebCrypto pur, zéro dépendance, avec cache des clés (`:133-142`) et détection propre des endpoints morts (`:177`, 404/410). C'est du code de bibliothèque écrit correctement, dont la maintenance est nulle. **Ne pas le remplacer par un paquet npm.** |
| **`_shared/llm.ts` comme point d'appel unique** | llm.ts entier | Un seul endroit qui parle à Anthropic, `temperature: 0.2`, un système prompt qui interdit explicitement d'inventer un chiffre ou une recommandation (`:38-45`). Toute la gouvernance du LLM tient dans 45 lignes lisibles. |
| **`ctpApi.ts` comme couche d'accès unique** | ctpApi.ts | Toutes les corrections de cet audit côté client tiennent dans un seul fichier. C'est exactement ce que cette contrainte devait acheter. **Aucun écran ne doit rappeler `supabase` en direct** — la discipline vaut plus que l'élégance. |
| **Idempotence des écritures serveur** | morning-brief:47, compute-metrics:25, session-watcher:139 | `upsert` avec `onConflict` explicite partout, adossé à de vraies contraintes UNIQUE (`briefs` 001:177, `flags` 001:164, `pending_reminders` 009:38). Un rejeu de cron ne duplique rien. C'est la bonne fondation ; il ne manque que le claim atomique (P0-6). |
| **`getTeamMembers`** | ctpApi:168-181 | Deux requêtes, jointure faite en mémoire pour contourner l'absence de FK `profiles ↔ memberships` exploitable par PostgREST. Ce **n'est pas** un N+1 : c'est O(1) en nombre de requêtes. Contrairement à `getAdminSystemHealth`, il n'y a rien à corriger ici. |

---

## 5. Coût

### 5.1 Ce qui est vérifié dans le code

- **1 appel LLM par équipe et par jour**, et un seul (morning-brief:41, appelé une fois par `generateBrief`).
- **Modèle** : `MODELS.daily = "claude-haiku-4-5-20251001"` (llm.ts:7), `max_tokens: 1200`, `temperature: 0.2` (llm.ts:21-22).
- **Formule de coût inscrite en dur** : `tokensIn * 1e-6 + tokensOut * 5e-6` (morning-brief:42), soit 1 $/MTok en entrée et 5 $/MTok en sortie.
- Le coût est journalisé dans `briefs.cost_usd` et `llm_logs.cost_usd` (morning-brief:46, 50) — donc **mesurable en production** : requête V13 au §6.

### 5.2 Estimation, en attendant la mesure

**[ESTIMATION]** — méthode : comptage de la taille du prompt système (llm.ts:36-45, ~300 tokens) et du payload (morning-brief:31-39 : 7 champs numériques + flags par athlète, ~45 tokens sérialisés par athlète).

| Poste | 15 athlètes, 0 règle active | 15 athlètes, 5 règles actives |
|---|---|---|
| Tokens entrée | ~1 000 | ~1 800 (les textes `recommendation` gonflent le payload) |
| Tokens sortie | ~350 | ~700 |
| **Coût / brief** | **~0,28 ¢** | **~0,53 ¢** |

| Échelle | Briefs / mois | **Coût LLM / mois** | Coût LLM / an |
|---|---|---|---|
| 10 équipes | 300 | **0,85 – 1,60 $** | 10 – 19 $ |
| 50 équipes | 1 500 | **4,20 – 8,00 $** | 50 – 96 $ |

> **Écart avec la documentation.** CLAUDE.md §4 annonce « ~0,05 ¢/brief ». L'estimation ci-dessus est **6 à 10 fois plus élevée**. La conclusion ne change pas — c'est du bruit face à un prix de 8 500 $ par équipe — mais le chiffre du document doit être corrigé par la mesure réelle (V13) plutôt que par une nouvelle estimation.

### 5.3 Supabase

| Poste | 10 équipes | 50 équipes | Base |
|---|---|---|---|
| Plan | Pro 25 $/mois | Pro 25 $/mois | — |
| Stockage DB / an | **[ESTIMATION]** ~100 Mo | **[ESTIMATION]** ~500 Mo | `responses` ~500 o/ligne × 410 k/an, `daily_metrics` ~150 o × 274 k/an, `pending_reminders` ~100 o × 820 k/an. Inclus dans les 8 Go du plan Pro. |
| Invocations edge / mois | ~55 k | ~80 k | watcher 43 k + ics 2,9 k + compute-metrics ~34 k + brief 30. Quota Pro : 2 M. **Non contraignant.** |
| **Compute DB** | **le poste qui décide** | **le poste qui décide** | Voir ci-dessous. |

**Le seul poste de coût qui compte est le compute de la base, et il est intégralement gouverné par P1-1.** Tant que `v_ema_baseline` est recalculée globalement à chaque réponse, la charge CPU croît en O(jours²) et la seule réponse possible est de payer un plus gros instance (Micro → Small → Medium → Large : de +0 $ à +110 $/mois, sans jamais résoudre la cause). Avec `f_engine_user`, la même charge redevient linéaire et l'instance Micro suffit largement à 50 équipes.

**Coût total attendu, correctifs appliqués :**
- 10 équipes : **~26 $/mois** (Pro + ~1 $ de LLM).
- 50 équipes : **~33 $/mois** (Pro + ~6 $ de LLM), éventuellement +15 $ d'add-on compute si la mesure §7 le justifie.

Le coût d'infrastructure n'est pas un risque de ce produit. Le risque financier réel est l'endpoint `morning-brief` non gardé (P0-3), qui transforme un coût fixe négligeable en une facture variable non plafonnée.

---

## 6. Requêtes de vérification — à coller dans le SQL editor Supabase

> À exécuter en tant que propriétaire du projet, sur la base **de production**. Chacune répond à une question de cet audit par un fait. Le résultat attendu est indiqué à chaque fois.

```sql
-- ═══════════════════════════════════════════════════════════════════
-- V1 · Toute table publique a-t-elle bien la RLS activée ?
-- Attendu : 0 ligne.
-- ═══════════════════════════════════════════════════════════════════
select c.relname as table_sans_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
order by 1;

-- ═══════════════════════════════════════════════════════════════════
-- V2 · Matrice d'accès RÉELLE (à confronter au §2 de ce document)
-- ═══════════════════════════════════════════════════════════════════
select tablename, policyname, cmd, roles::text,
       coalesce(qual, '—')       as using_expr,
       coalesce(with_check, '—') as check_expr
from pg_policies where schemaname = 'public'
order by tablename, cmd, policyname;

-- ═══════════════════════════════════════════════════════════════════
-- V3 · LE BUG push_subscriptions, généralisé : tables où le client peut
--      INSERT mais pas UPDATE (donc où tout upsert cassera en 403),
--      et tables où il peut INSERT mais pas DELETE.
-- Attendu : uniquement des lignes que vous savez justifier
--           (responses = volontaire ; coach_feedback = volontaire après P1-13).
-- ═══════════════════════════════════════════════════════════════════
with p as (
  select tablename, cmd from pg_policies
  where schemaname='public' and (roles::text like '%authenticated%' or roles::text = '{public}')
)
select t.tablename,
       bool_or(cmd in ('INSERT','ALL')) as peut_insert,
       bool_or(cmd in ('UPDATE','ALL')) as peut_update,
       bool_or(cmd in ('DELETE','ALL')) as peut_delete,
       bool_or(cmd in ('SELECT','ALL')) as peut_select
from p t group by t.tablename
having bool_or(cmd in ('INSERT','ALL')) and not bool_or(cmd in ('UPDATE','ALL'))
order by 1;

-- ═══════════════════════════════════════════════════════════════════
-- V4 · Tables SANS AUCUNE policy alors que la RLS est active
--      (deny-all : voulu pour rules/organizations, suspect ailleurs)
-- ═══════════════════════════════════════════════════════════════════
select c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
order by 1;

-- ═══════════════════════════════════════════════════════════════════
-- V5 · Fonctions SECURITY DEFINER : search_path figé ? droits révoqués ?
-- Attendu : proconfig non nul partout ; eval_rule non exécutable par authenticated.
-- ═══════════════════════════════════════════════════════════════════
select p.proname, p.prosecdef as security_definer, p.proconfig::text as config,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_peut_executer,
       has_function_privilege('anon',          p.oid, 'execute') as anon_peut_executer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.prosecdef desc, p.proname;

-- ═══════════════════════════════════════════════════════════════════
-- V6 · Les vues du moteur sont-elles TOUJOURS verrouillées ?
-- Attendu : security_invoker = true ET les deux colonnes de droits à false.
-- ═══════════════════════════════════════════════════════════════════
select c.relname,
       (select option_value from pg_options_to_table(c.reloptions)
        where option_name = 'security_invoker')                 as security_invoker,
       has_table_privilege('authenticated', c.oid, 'select')    as authenticated_lit,
       has_table_privilege('anon',          c.oid, 'select')    as anon_lit
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v' order by 1;

-- ═══════════════════════════════════════════════════════════════════
-- V7 · service_role a-t-il bien BYPASSRLS ? (hypothèse du §2.1)
-- Attendu : rolbypassrls = true.
-- ═══════════════════════════════════════════════════════════════════
select rolname, rolbypassrls, rolsuper from pg_roles
where rolname in ('service_role','authenticated','anon','postgres');

-- ═══════════════════════════════════════════════════════════════════
-- V8 · Volumétrie réelle, table par table (pour calibrer le §5 et le §7)
-- ═══════════════════════════════════════════════════════════════════
select relname,
       to_char(n_live_tup, 'FM999G999G999')            as lignes,
       pg_size_pretty(pg_total_relation_size(relid))   as taille_totale,
       seq_scan, idx_scan,
       case when seq_scan+idx_scan > 0
            then round(100.0*seq_scan/(seq_scan+idx_scan),1) end as pct_seq_scan
from pg_stat_user_tables where schemaname='public'
order by pg_total_relation_size(relid) desc;
-- Un pct_seq_scan élevé sur memberships ou daily_metrics confirme P1-5.

-- ═══════════════════════════════════════════════════════════════════
-- V9 · Athlètes appartenant à PLUSIEURS équipes (corruption EMA, P1-12)
-- Attendu : 0 ligne.
-- ═══════════════════════════════════════════════════════════════════
select user_id, count(*) as nb_equipes, array_agg(team_id) as equipes
from memberships where role='athlete' group by user_id having count(*) > 1;

-- ═══════════════════════════════════════════════════════════════════
-- V10 · Pseudonymes en collision dans une même équipe (P1-10)
-- Attendu : 0 ligne. Toute ligne = un brief illisible pour le coach.
-- ═══════════════════════════════════════════════════════════════════
select team_id, pseudonym, count(*) as nb, array_agg(user_id) as utilisateurs
from memberships where pseudonym is not null
group by team_id, pseudonym having count(*) > 1;

-- ═══════════════════════════════════════════════════════════════════
-- V11 · Séances terminées et JAMAIS notifiées (P0-6)
-- Attendu : 0 ligne au-delà des 2 dernières minutes.
--           Toute ligne = une équipe qui n'a pas été sollicitée.
-- ═══════════════════════════════════════════════════════════════════
select s.id, t.name as equipe, s.title, s.end_utc,
       round(extract(epoch from (now() - s.end_utc))/3600, 1) as heures_depuis_fin
from sessions s join teams t on t.id = s.team_id
where s.notified_at is null and s.cancelled = false
  and s.end_utc between now() - interval '30 days' and now() - interval '5 minutes'
order by s.end_utc desc limit 100;

-- ═══════════════════════════════════════════════════════════════════
-- V12 · Séances en doublon (même équipe, même créneau) — P1-8 / P1-9
-- Attendu : 0 ligne.
-- ═══════════════════════════════════════════════════════════════════
select team_id, start_utc, count(*) as nb,
       array_agg(distinct coalesce(ics_uid,'<null>')) as uids
from sessions where cancelled = false
group by team_id, start_utc having count(*) > 1
order by start_utc desc limit 50;

-- ═══════════════════════════════════════════════════════════════════
-- V13 · COÛT LLM RÉEL par équipe et par mois (remplace l'estimation §5)
-- ═══════════════════════════════════════════════════════════════════
select date_trunc('month', l.created_at)::date       as mois,
       t.name                                        as equipe,
       count(*)                                      as appels,
       count(*) filter (where l.ok = false)          as echecs,
       round(avg(l.tokens_in))                       as tokens_in_moyen,
       round(avg(l.tokens_out))                      as tokens_out_moyen,
       round(sum(l.cost_usd)::numeric, 4)            as cout_usd,
       round((sum(l.cost_usd)/nullif(count(*),0))::numeric, 5) as cout_par_brief
from llm_logs l left join teams t on t.id = l.team_id
group by 1,2 order by 1 desc, 7 desc;

-- ═══════════════════════════════════════════════════════════════════
-- V14 · Équipes SANS brief hier (le cron a-t-il fini son tour ? P1-2)
-- Attendu : 0 ligne, hors équipes sans données.
-- ═══════════════════════════════════════════════════════════════════
select t.id, t.name,
       (select max(brief_date) from briefs b where b.team_id = t.id) as dernier_brief,
       (select count(*) from memberships m where m.team_id=t.id and m.role='athlete') as athletes,
       (select count(*) from daily_metrics d
        where d.team_id=t.id and d.day = current_date - 1)           as metriques_hier
from teams t
where not exists (select 1 from briefs b where b.team_id=t.id and b.brief_date = current_date - 1)
order by athletes desc;

-- ═══════════════════════════════════════════════════════════════════
-- V15 · NON-RÉGRESSION DU MOTEUR — obligatoire avant la bascule P1-1.
--       Compare f_engine_user() à v_engine, athlète par athlète, jour par jour.
-- Attendu : 0 ligne. Toute ligne = un écart de calcul, donc pas de bascule.
-- ═══════════════════════════════════════════════════════════════════
with users as (select distinct user_id from daily_metrics),
     nouveau as (select f.* from users u cross join lateral f_engine_user(u.user_id, null) f),
     ancien  as (select * from v_engine)
select coalesce(n.user_id, a.user_id) as user_id,
       coalesce(n.day, a.day)         as jour,
       n.ema_28 as ema_nouveau, a.ema_28 as ema_ancien,
       n.zone   as zone_nouvelle, a.zone as zone_ancienne,
       n.z_score as z_nouveau,   a.z_score as z_ancien
from nouveau n full outer join ancien a on a.user_id=n.user_id and a.day=n.day
where n.user_id is null or a.user_id is null
   or coalesce(n.ema_28,-1)  is distinct from coalesce(a.ema_28,-1)
   or coalesce(n.zone,'x')   is distinct from coalesce(a.zone,'x')
   or coalesce(n.z_score,-99) is distinct from coalesce(a.z_score,-99)
limit 200;

-- ═══════════════════════════════════════════════════════════════════
-- V16 · Le coût du moteur, mesuré. C'est LE chiffre de l'audit.
--       Relancer après chaque palier de croissance des données.
-- ═══════════════════════════════════════════════════════════════════
explain (analyze, buffers, timing)
select * from v_engine
where user_id = (select user_id from daily_metrics order by day desc limit 1)
order by day desc limit 1;
-- Lire : "Execution Time". Seuil d'alerte : > 500 ms. Seuil de blocage : > 2 s.
-- Comparer ensuite avec :
-- explain (analyze, buffers) select * from f_engine_user(
--   (select user_id from daily_metrics order by day desc limit 1), null)
--   order by day desc limit 1;

-- ═══════════════════════════════════════════════════════════════════
-- V17 · Compliance réelle par équipe sur 14 jours (le KPI de survie, art. 9)
-- ═══════════════════════════════════════════════════════════════════
with s as (
  select team_id, count(*) as seances from sessions
  where cancelled=false and end_utc between now()-interval '14 days' and now()
  group by team_id),
a as (select team_id, count(*) as athletes from memberships where role='athlete' group by team_id),
r as (select team_id, count(*) as reponses from responses
      where is_test=false and submitted_at >= now()-interval '14 days' group by team_id)
select t.name, coalesce(a.athletes,0) as athletes, coalesce(s.seances,0) as seances,
       coalesce(r.reponses,0) as reponses,
       coalesce(s.seances,0)*coalesce(a.athletes,0) as attendu,
       case when coalesce(s.seances,0)*coalesce(a.athletes,0) > 0
            then round(100.0*coalesce(r.reponses,0)/(s.seances*a.athletes),1) end as compliance_pct
from teams t left join s on s.team_id=t.id left join a on a.team_id=t.id left join r on r.team_id=t.id
order by compliance_pct nulls last;

-- ═══════════════════════════════════════════════════════════════════
-- V18 · Relances bloquées ou incohérentes (santé du watcher)
-- ═══════════════════════════════════════════════════════════════════
select status, count(*),
       min(remind_at) as plus_ancienne, max(remind_at) as plus_recente,
       count(*) filter (where status='pending' and remind_at < now()-interval '1 hour') as en_retard
from pending_reminders group by status order by 2 desc;
```

---

## 7. Protocole de test de charge reproductible

> **Objectif :** transformer les estimations du §3 et du §5 en mesures. Le seul point qui exige impérativement cette mesure est **P1-1** ; le reste est du confort.
>
> ⚠️ **À exécuter sur un projet Supabase de préproduction, jamais sur la base de production.** Le script insère directement dans `auth.users`, ce qui n'est légitime que sur une base jetable. Un bloc de nettoyage complet est fourni au §7.4.

### 7.1 Mesure de référence (avant génération)

```sql
\timing on
select count(*) from responses;
select count(*) from daily_metrics;
explain (analyze, buffers) select * from v_engine
  where user_id = (select user_id from daily_metrics order by day desc limit 1)
  order by day desc limit 1;
```
Noter **Execution Time**. C'est le point 0.

### 7.2 Génération : 10 équipes × 15 athlètes × 60 jours

```sql
-- ═══════════════════════════════════════════════════════════════════
-- JEU DE DONNÉES DE CHARGE — préproduction uniquement.
-- Produit : 1 org, 10 équipes, 150 athlètes, 600 séances,
--           ~7 650 réponses (85 % de compliance simulée).
-- Durée attendue : 1 à 4 min (le trigger de readiness s'exécute par ligne).
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  v_org uuid; v_team uuid; v_user uuid; v_sess uuid;
  v_q text := 'tpl-basketball-any';
  d date; i int; j int; k int;
begin
  insert into organizations(name, plan) values ('LOADTEST Org','pilot') returning id into v_org;

  for i in 1..10 loop
    insert into teams(organization_id, name, sport, invite_code, timezone)
    values (v_org, 'LT Team '||i, 'basketball', 'LT-'||lpad(i::text,4,'0'), 'America/New_York')
    returning id into v_team;

    insert into team_questionnaires(team_id, questionnaire_id) values (v_team, v_q);

    -- 15 athlètes
    for j in 1..15 loop
      v_user := gen_random_uuid();
      insert into auth.users
        (id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      values
        (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'lt'||i||'-'||j||'@loadtest.invalid', '!disabled!',
         now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);
      insert into profiles(user_id, display_name, email)
        values (v_user, 'LT '||i||'-'||j, 'lt'||i||'-'||j||'@loadtest.invalid');
      insert into memberships(team_id, user_id, role, pseudonym, jersey_number)
        values (v_team, v_user, 'athlete', 'P-'||lpad(j::text,2,'0'), j);
    end loop;

    -- 60 jours d'historique, 1 séance/jour
    for k in 0..59 loop
      d := current_date - k;
      insert into sessions(team_id, title, session_type, start_utc, end_utc, ics_uid, cancelled, notified_at)
      values (v_team, 'LT practice', 'practice',
              (d + time '16:00') at time zone 'America/New_York',
              (d + time '18:00') at time zone 'America/New_York',
              'LT-'||v_team||'-'||k, false, now())
      returning id into v_sess;

      -- Réponses : 85 % de compliance, valeurs plausibles avec un athlète
      -- volontairement dégradé (index 3) pour créer une vraie dispersion.
      insert into responses(team_id, session_id, user_id, questionnaire_id, metrics, submitted_at, is_test)
      select v_team, v_sess, m.user_id, v_q,
        jsonb_build_object(
          'tankLevel',         greatest(1, least(100, 60 + (random()*30-15)::int - (case when m.jersey_number=3 then k/4 else 0 end))),
          'cardioLoad',        greatest(1, least(100, 45 + (random()*30-15)::int)),
          'legBounce',         greatest(1, least(100, 60 + (random()*30-15)::int)),
          'motorControl',      greatest(1, least(100, 65 + (random()*25-12)::int)),
          'tacticalSharpness', greatest(1, least(100, 65 + (random()*25-12)::int)),
          'teamChemistry',     greatest(1, least(100, 70 + (random()*20-10)::int)))
        , (d + time '18:30') at time zone 'America/New_York', false
      from memberships m
      where m.team_id = v_team and m.role='athlete' and random() < 0.85;
    end loop;
  end loop;
end $$;

analyze;
```

> **Si l'insert dans `auth.users` échoue** sur une contrainte NOT NULL (le schéma d'auth varie selon la version de Supabase) : lire la colonne signalée par l'erreur et l'ajouter à la liste. Alternative propre : créer les 150 comptes via `supabase.auth.admin.createUser()` dans un script Node, puis ne garder du bloc ci-dessus que les parties `profiles` / `memberships` / `sessions` / `responses`.

### 7.3 Mesures à faire, dans cet ordre

**M1 — Coût unitaire du moteur (le chiffre décisif).**
```sql
\timing on
explain (analyze, buffers) select * from v_engine
  where user_id = (select user_id from memberships where role='athlete' limit 1)
  order by day desc limit 1;
```
Relever : *Execution Time*, la présence d'un nœud `Recursive Union`, et le nombre de lignes qu'il produit.
**Seuils :** < 200 ms = tenable · 200 ms – 1 s = corriger avant le 5ᵉ client · > 1 s = P1-1 est bloquant, corriger avant le 1ᵉʳ.

**M2 — Loi de croissance.** Rejouer M1 après avoir étendu l'historique à 120, puis 240 jours (changer `0..59` en `0..119` puis `0..239` et relancer sur de nouvelles équipes). Tracer Execution Time = f(jours). Si la courbe est **super-linéaire**, P1-1 est confirmé quantitativement et l'extrapolation à 730 jours × 750 athlètes se calcule directement.

**M3 — Rafale d'écriture (le scénario réel de fin de séance).**
```sql
-- Simule les 15 check-ins qui arrivent dans la même minute.
do $$
declare t0 timestamptz := clock_timestamp(); v_sess uuid; v_team uuid;
begin
  select id, team_id into v_sess, v_team from sessions
    where title='LT practice' order by end_utc desc limit 1;
  perform (select count(*) from v_engine where user_id = m.user_id)
  from memberships m where m.team_id = v_team and m.role='athlete';
  raise notice 'Moteur pour 15 athlètes : %', clock_timestamp() - t0;
end $$;
```
Multiplier par le nombre d'équipes dont la séance se termine dans la même minute pour obtenir la charge de pointe.

**M4 — Chemins clients.**
```sql
explain (analyze) select * from daily_metrics where team_id = (select id from teams where name like 'LT %' limit 1) and day = current_date;
explain (analyze) select team_id from memberships where user_id = (select user_id from memberships limit 1);
explain (analyze) select * from sessions where end_utc between now()-interval '2 minutes' and now()
                  and notified_at is null and cancelled=false;
```
Chercher les `Seq Scan` : chacun est une ligne du tableau P1-5.

**M5 — `session-watcher` de bout en bout.** Positionner `notified_at = null` et `end_utc = now()` sur les 10 séances les plus récentes, puis :
```bash
curl.exe -i -X POST "https://<projet>.supabase.co/functions/v1/session-watcher" ^
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" -d "{}"
```
Chronométrer. **Seuil : > 45 s = P0-6 et P1-4 sont bloquants** (marge insuffisante avant le tick suivant).

**M6 — `morning-brief` multi-équipes.** Même appel sur `morning-brief` avec un corps vide, 10 équipes peuplées. Mesurer la durée totale et diviser par 10 pour obtenir le coût unitaire ; extrapoler à 50. **Seuil : durée unitaire × 50 > 120 s = P1-2 est bloquant.**

**M7 — Coût réel.** Après M6, exécuter V13 : elle donne le coût observé par brief, qui remplace toute estimation.

**M8 — Console admin.** Ouvrir `AdminSystemHealthScreen` avec les 10 équipes, onglet Réseau du navigateur ouvert. Compter les requêtes (attendu aujourd'hui : **81**) et le temps jusqu'à l'affichage. Après le correctif P1-6 : **1 requête**.

### 7.4 Nettoyage

```sql
-- ═══════════════════════════════════════════════════════════════════
-- PURGE COMPLÈTE du jeu de charge. Les cascades font l'essentiel.
-- ═══════════════════════════════════════════════════════════════════
delete from auth.users where email like '%@loadtest.invalid';   -- cascade profiles/memberships/responses/daily_metrics
delete from teams where name like 'LT Team %';                  -- cascade sessions/briefs/flags/reminders
delete from organizations where name = 'LOADTEST Org';
vacuum analyze;

-- Contrôle : les trois requêtes doivent renvoyer 0.
select count(*) from auth.users where email like '%@loadtest.invalid';
select count(*) from teams where name like 'LT Team %';
select count(*) from responses r
  where not exists (select 1 from teams t where t.id = r.team_id);
```

### 7.5 Grille de décision

| Mesure | Vert | Orange | Rouge → ne pas mettre en production |
|---|---|---|---|
| M1 moteur | < 200 ms | 200 ms – 1 s | **> 1 s** |
| M2 croissance | linéaire | légèrement convexe | **quadratique** |
| M5 watcher (10 équipes) | < 15 s | 15 – 45 s | **> 45 s** |
| M6 brief (unitaire × 50) | < 60 s | 60 – 120 s | **> 120 s** |
| M8 console admin | 1 requête | < 20 | **> 50** |
| V3 (trous de policy) | 0 ligne inattendue | — | **toute ligne non justifiée** |
| V9 / V10 / V11 / V12 | 0 ligne | — | **toute ligne** |
| V15 non-régression | 0 ligne | — | **toute ligne** |

---

## 8. Synthèse

**Les trois risques qui me feraient refuser la mise en production.**
1. **L'escalade de privilèges de `join-team` (P0-2).** Le rôle est déclaré par le client : n'importe quel détenteur du code d'invitation — c'est-à-dire les 15 athlètes de l'équipe — se déclare coach et lit les données de santé nominatives de ses coéquipiers. Ce n'est pas une faille de RLS, c'est un défaut de conception en amont d'elle, et il contredit frontalement l'article 8 de la Constitution.
2. **Les trois edge functions sans contrôle d'appelant (P0-3, P0-4).** `compute-metrics` accepte un `team_id` arbitraire et écrit `daily_metrics` avec, ce qui permet de rapatrier les métriques d'un athlète d'un autre client dans son propre tableau de bord ; `ics-sync` renvoie l'identité et l'état d'intégration de **tous** les tenants à n'importe quel appelant ; `morning-brief` déclenche un appel LLM facturé sans limite. Le guard nécessaire existe déjà dans le dépôt (`notify:18-33`) — il n'a simplement pas été appliqué partout.
3. **`v_ema_baseline` (P1-1).** Une CTE récursive dans une vue non paramétrable, recalculée sur l'intégralité des athlètes de tous les clients à chaque réponse insérée. Le produit paraîtra irréprochable pendant tout le pilote et deviendra inutilisable en fin de première saison — exactement au moment où il faut renouveler. C'est le seul défaut de cet audit qui ne se manifestera pas en test.

**Les trois correctifs prioritaires.**
1. **Verrouiller les frontières** — deux codes d'invitation distincts et interdiction d'écraser un rôle par upsert (P0-2) ; `requireServiceRole` sur `compute-metrics`, `morning-brief` et `ics-sync`, avec cadrage de `ics-sync` à l'équipe de l'appelant (P0-3, P0-4). **≈ 4 h, aucune migration de données.**
2. **Paramétrer le moteur** — `f_engine_user(p_user)` en remplacement de la lecture de `v_engine` dans `compute-metrics`, à formules et seuils rigoureusement identiques, validé par la requête V15 à zéro écart. **≈ 4 h.**
3. **Réparer la chaîne de notification** — claim atomique et fenêtre de rattrapage de 6 h dans `session-watcher` (P0-6), envois push parallélisés (P1-4), et alignement de la relance +6 h sur la fenêtre RLS +5 h (P0-5), qui envoie aujourd'hui les athlètes les moins compliants vers un formulaire qui refusera leur réponse. **≈ 5 h.**

**Et une correction d'une ligne, à faire d'abord parce qu'elle coûte quinze minutes :** `org_id` → `organization_id` dans `create-team/index.ts:75`. En l'état, aucune équipe ne peut être créée par le produit.
