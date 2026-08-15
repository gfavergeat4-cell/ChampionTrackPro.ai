# 14 — DURCISSEMENT SÉCURITÉ · ChampionTrackPro V2

> **Date : 15 août 2026.** Plan d'exécution technique dérivé de `docs/12_CONFORMITE_US.md`.
> **Aucun fichier de code n'a été modifié pour produire ce document.** Tout le SQL et tout le code ci-dessous sont des **propositions à implémenter**, pas des changements appliqués. Chaque mesure indique le fichier ou la migration concernée.
>
> **Règle du dépôt (doc 08 §0) :** toute modification structurelle met à jour `08_CARTOGRAPHIE_TECHNIQUE.md` **dans le même commit**. Les migrations 011 et suivantes proposées ici y ajoutent des lignes.
>
> **Environnement :** Windows + PowerShell 5 → une commande par ligne, pas de `&&`, `curl.exe` et non `curl`.

---

## Tableau de bord

| # | Mesure | Priorité | Effort | Risque couvert |
|---|---|---|---|---|
| **P0-1** | Rôle résolu côté serveur + code staff distinct | **Bloquant** | 4-6 h | R-01, R-09 |
| **P0-2** | Suppression complète athlète / équipe + journal de purge | **Bloquant** | 6-8 h | R-02 |
| **P0-3** | Confirmation d'email + politique de mot de passe | **Bloquant** | 30 min (console) | R-01 |
| **P0-4** | Corriger la déclaration de rétention Anthropic | **Bloquant** | 1 h | R-05 |
| **P1-1** | Politique de rétention exécutée par cron | Élevée | 3 h | R-02 |
| **P1-2** | MFA obligatoire pour les comptes staff | Élevée | 4-6 h | R-01, R-06 |
| **P1-3** | Expiration de session | Élevée | 1 h | R-06 |
| **P1-4** | Journal d'accès aux données d'athlète | Élevée | 6-8 h | R-03 |
| **P1-5** | Durcissement CSP + stockage de session | Élevée | 3-4 h | R-06 |
| **P1-6** | Rotation des secrets | Élevée | 2 h + procédure | R-01, R-06 |
| **P1-7** | Version et horodatage de la notice athlète | Élevée | 2 h | preuve, R-04 |
| **P1-8** | Purger les logs applicatifs de toute PII | Élevée | 1 h | hygiène |
| **P1-9** | Génération de pseudonyme non réutilisable | Élevée | 1 h | R-07, intégrité |
| **P2-1** | Export complet des données d'un athlète | Moyenne | 3 h | portabilité |
| **P2-2** | Retirer la porte de service de `create-team` | Moyenne | 15 min | R-01 |
| **P2-3** | Retirer `birth_year` de `v_ai_dataset` | Moyenne | 15 min | R-07 |
| **P2-4** | Garde-fous sur `coach_feedback.note` | Moyenne | 2 h | R-03, PII |
| **P2-5** | Sauvegardes et test de restauration | Moyenne | 3 h + récurrent | continuité |
| **P2-6** | Décommissionner Firebase / Firestore | Moyenne | 1-2 j | R-08 |
| **P2-7** | Corriger `friction_impact` non transmis | Basse | 15 min | intégrité |
| **P2-8** | Politique « ce qui ne doit jamais être loggué » | Basse | 1 h | hygiène |

**Chemin critique avant le premier client réel : P0-1 → P0-2 → P0-3 → P0-4. Deux à trois jours de travail.**

---
---

# P0 — BLOQUANT AVANT TOUT UTILISATEUR RÉEL

## P0-1 · Le rôle doit être décidé par le serveur, jamais par le client

**Le problème, vérifié.** `screens/StitchCreateAccountScreen.js:59-63` envoie le rôle choisi par un bouton de l'interface ; `src/lib/ctpApi.ts:45-61` le transmet tel quel ; `supabase/functions/join-team/index.ts:31` l'écrit dans `memberships` sans aucune vérification. Un seul code d'équipe existe, il est connu de tous les athlètes, et `ctpApi.getMyMembership` le leur renvoie explicitement (`ctpApi.ts:25`, embed `teams(... invite_code ...)`).

**Le principe.** Le rôle ne doit jamais être une donnée d'entrée. Il doit être **déduit du code présenté**. C'est exactement ce que faisait l'ancienne version via `lookupTeamByCode` — la V2 a perdu ce contrôle.

### Migration proposée — `supabase/migrations/011_role_hardening.sql`

```sql
-- ============================================================
-- 011 — Durcissement du rôle et des secrets d'équipe
-- Le rôle n'est plus une entrée client : il découle du code présenté.
-- ============================================================

-- 1. Deux codes distincts par équipe.
alter table teams add column if not exists staff_invite_code text unique;
alter table teams add column if not exists invite_code_rotated_at timestamptz;

-- Générateur de code (alphabet sans caractères ambigus)
create or replace function gen_invite_code(p_len int default 8)
returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; out text := ''; i int;
begin
  for i in 1..p_len loop
    out := out || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return out;
end $$;

-- Backfill : chaque équipe existante reçoit un code staff
update teams set staff_invite_code = 'S-' || gen_invite_code(8)
where staff_invite_code is null;

alter table teams alter column staff_invite_code set not null;

-- 2. Résolution serveur : un code -> (équipe, rôle). Rien d'autre.
--    security definer, car l'appelant n'a pas encore de membership.
create or replace function resolve_invite_code(p_code text)
returns table (team_id uuid, role text)
language sql stable security definer set search_path = public as $$
  select id, 'athlete'::text from teams where invite_code = btrim(p_code)
  union all
  select id, 'coach'::text  from teams where staff_invite_code = btrim(p_code)
$$;

revoke all on function resolve_invite_code(text) from anon, authenticated;
-- Appelée exclusivement par l'edge function join-team en service_role.

-- 3. Les secrets d'équipe ne doivent plus être lisibles par les athlètes.
--    La RLS est par ligne, pas par colonne : on utilise les GRANT de colonne.
revoke select on teams from authenticated;
grant select (id, organization_id, name, sport, timezone, created_at)
  on teams to authenticated;
-- => ics_url, invite_code, staff_invite_code ne sont plus jamais renvoyés
--    par un `select *` client, quel que soit le rôle.

-- 4. Accès staff aux réglages d'équipe, via RPC contrôlée.
create or replace function get_team_settings(p_team uuid)
returns table (ics_url text, invite_code text, staff_invite_code text)
language sql stable security definer set search_path = public as $$
  select t.ics_url, t.invite_code, t.staff_invite_code
  from teams t
  where t.id = p_team
    and my_role_in(p_team) in ('coach','admin')
$$;

grant execute on function get_team_settings(uuid) to authenticated;

-- 5. Rotation d'un code, réservée à l'admin de l'équipe.
create or replace function rotate_invite_codes(p_team uuid, p_which text)
returns text language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if my_role_in(p_team) <> 'admin' then
    raise exception 'forbidden';
  end if;
  if p_which = 'staff' then
    new_code := 'S-' || gen_invite_code(8);
    update teams set staff_invite_code = new_code, invite_code_rotated_at = now() where id = p_team;
  else
    new_code := gen_invite_code(8);
    update teams set invite_code = new_code, invite_code_rotated_at = now() where id = p_team;
  end if;
  return new_code;
end $$;

grant execute on function rotate_invite_codes(uuid, text) to authenticated;
```

### `supabase/functions/join-team/index.ts` — remplacer la résolution du rôle

Remplacer les lignes 27-36 actuelles :

```ts
// AVANT (à supprimer) :
//   const { invite_code, role, display_name } = await req.json();
//   const memberRole = role === "coach" ? "coach" : "athlete";
//   const { data: team } = await supa.from("teams")
//     .select("id, name").eq("invite_code", invite_code.trim()).single();

// APRÈS :
const { invite_code, display_name } = await req.json();   // `role` n'est plus lu
if (!invite_code || typeof invite_code !== "string") {
  return Response.json({ error: "invite_code required" }, { status: 400, headers: cors });
}

const { data: resolved } = await supa.rpc("resolve_invite_code", { p_code: invite_code });
if (!resolved || resolved.length === 0) {
  return Response.json({ error: "invalid code" }, { status: 404, headers: cors });
}
const teamId: string   = resolved[0].team_id;
const memberRole: string = resolved[0].role;   // décidé par le serveur, point.

// Un membership existant n'est jamais élevé par une nouvelle adhésion.
const { data: existing } = await supa.from("memberships")
  .select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
if (existing) {
  return Response.json(
    { ok: true, team_id: teamId, role: existing.role, note: "already a member" },
    { headers: cors },
  );
}
```

**Deux points d'attention.**
- Le `upsert` actuel sur `memberships` (`join-team/index.ts:49-51`) permet à un membre existant de rejouer l'adhésion. Avec un code staff, cela deviendrait une escalade. Le garde `existing` ci-dessus le bloque : **une adhésion ne modifie jamais un rôle déjà attribué.** Le changement de rôle passe par l'admin.
- `Access-Control-Allow-Origin: "*"` (`join-team/index.ts:13`) : à restreindre au domaine de production.

### `src/lib/ctpApi.ts` — trois retouches

```ts
// 1. joinTeam : ne plus envoyer de rôle
export async function joinTeam(inviteCode: string, displayName?: string) {
  const { data: { session } } = await db().auth.getSession();
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/join-team`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ invite_code: inviteCode, display_name: displayName }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "join failed");
  return j;   // { team_id, role } -> l'UI apprend son rôle, elle ne le choisit pas
}

// 2. getMyMembership : ne plus demander les colonnes secrètes (ctpApi.ts:25)
//    "team_id, role, pseudonym, teams(name, sport)"   <- ics_url et invite_code retirés

// 3. nouvelle fonction, pour les écrans staff uniquement
export async function getTeamSettings(teamId: string) {
  const { data, error } = await db().rpc("get_team_settings", { p_team: teamId });
  if (error) throw error;
  return data?.[0] ?? null;
}
```

### `screens/StitchCreateAccountScreen.js`

Le sélecteur ATHLETE / COACH (lignes 448-458) ne doit plus déterminer le rôle. Deux options :
- **le retirer** et n'afficher qu'un champ « team code » — le rôle apparaît après adhésion ;
- **le conserver comme aide à la saisie** (change le libellé du champ : « Team code » / « Staff code ») en supprimant tout effet sur la valeur envoyée.

La seconde est meilleure en UX : un coach saisissant par erreur le code athlète obtient un message clair. Dans les deux cas, **la valeur affichée ne doit plus voyager jusqu'au serveur**.

**Test d'acceptation.** Créer un compte, saisir le code athlète, cocher COACH, valider → `memberships.role` doit valoir `athlete`. Puis, connecté en athlète, exécuter `select * from teams` depuis le client → `ics_url` et `invite_code` doivent être absents du résultat.

---

## P0-2 · Pouvoir réellement supprimer un athlète et une équipe

**Le problème, vérifié.** `ctpApi.removeMember` (`ctpApi.ts:289-294`) ne supprime que la ligne `memberships`. Les `responses` et `daily_metrics` restent, et restent lisibles par le staff : la policy `responses_staff_read` (`002_rls.sql:74`) porte sur `my_role_in(team_id)`, indépendamment de l'appartenance actuelle de l'athlète. Aucune fonction de suppression complète n'existe nulle part dans le dépôt. La version LIVE avait au moins `anonymizePlayerDataForAI` (`functions/index.js:1402-1542`) : **la V2 est une régression.**

### Migration proposée — `supabase/migrations/012_purge.sql`

```sql
-- ============================================================
-- 012 — Suppression vérifiable : athlète, équipe, journal de purge.
-- Toute suppression laisse une preuve, sans conserver de données.
-- ============================================================

create table purge_log (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('athlete','team')),
  team_id uuid,                     -- pas de FK : la cible peut disparaître
  subject_ref text,                 -- pseudonyme uniquement, jamais de nom ni d'email
  requested_by uuid,                -- auth.uid() du demandeur
  reason text,
  rows_deleted jsonb not null,      -- {"responses": 142, "daily_metrics": 96, ...}
  executed_at timestamptz not null default now()
);
alter table purge_log enable row level security;
create policy purge_log_admin_read on purge_log for select
  using (team_id is not null and my_role_in(team_id) = 'admin');

-- ── Purge d'un athlète sur une équipe ──────────────────────
create or replace function purge_athlete(p_user uuid, p_team uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare counts jsonb; n_resp int; n_dm int; n_flags int; n_rem int; n_fb int;
        v_pseudo text; other_teams int;
begin
  if my_role_in(p_team) <> 'admin' then
    raise exception 'forbidden: admin role required on this team';
  end if;

  select pseudonym into v_pseudo from memberships where user_id = p_user and team_id = p_team;

  delete from responses      where user_id = p_user and team_id = p_team;  get diagnostics n_resp  = row_count;
  delete from daily_metrics  where user_id = p_user and team_id = p_team;  get diagnostics n_dm    = row_count;
  delete from flags          where user_id = p_user and team_id = p_team;  get diagnostics n_flags = row_count;
  delete from pending_reminders where user_id = p_user and team_id = p_team; get diagnostics n_rem = row_count;
  delete from coach_feedback where team_id = p_team and coach_id = p_user;  get diagnostics n_fb  = row_count;
  delete from memberships    where user_id = p_user and team_id = p_team;

  -- Plus aucune équipe : on efface aussi profil, souscriptions et compte.
  select count(*) into other_teams from memberships where user_id = p_user;
  if other_teams = 0 then
    delete from push_subscriptions where user_id = p_user;
    delete from profiles           where user_id = p_user;
    delete from auth.users         where id      = p_user;   -- cascade sur le reste
  end if;

  counts := jsonb_build_object(
    'responses', n_resp, 'daily_metrics', n_dm, 'flags', n_flags,
    'pending_reminders', n_rem, 'coach_feedback', n_fb,
    'account_deleted', (other_teams = 0));

  insert into purge_log (scope, team_id, subject_ref, requested_by, reason, rows_deleted)
  values ('athlete', p_team, v_pseudo, auth.uid(), p_reason, counts);

  return counts;
end $$;

grant execute on function purge_athlete(uuid, uuid, text) to authenticated;

-- ── Purge d'une équipe entière (fin de contrat) ────────────
-- Non exposée aux clients : service_role uniquement, via l'edge function admin-purge.
create or replace function purge_team(p_team uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare counts jsonb; n_resp int; n_dm int; n_flags int; n_briefs int; n_mem int; n_sess int;
begin
  delete from responses     where team_id = p_team; get diagnostics n_resp   = row_count;
  delete from daily_metrics where team_id = p_team; get diagnostics n_dm     = row_count;
  delete from flags         where team_id = p_team; get diagnostics n_flags  = row_count;
  delete from briefs        where team_id = p_team; get diagnostics n_briefs = row_count;
  delete from coach_feedback   where team_id = p_team;
  delete from pending_reminders where team_id = p_team;
  delete from sessions      where team_id = p_team; get diagnostics n_sess   = row_count;
  delete from memberships   where team_id = p_team; get diagnostics n_mem    = row_count;
  delete from team_questionnaires where team_id = p_team;
  update llm_logs set team_id = null where team_id = p_team;  -- coûts conservés, lien coupé
  delete from teams where id = p_team;

  counts := jsonb_build_object('responses', n_resp, 'daily_metrics', n_dm, 'flags', n_flags,
                               'briefs', n_briefs, 'sessions', n_sess, 'memberships', n_mem);
  insert into purge_log (scope, team_id, requested_by, reason, rows_deleted)
  values ('team', p_team, auth.uid(), p_reason, counts);
  return counts;
end $$;

revoke all on function purge_team(uuid, text) from anon, authenticated;
```

**Trois points à comprendre.**

1. **`briefs` n'est pas purgé par `purge_athlete`.** Un brief est un texte d'équipe qui cite des pseudonymes. Après la purge, la correspondance `pseudonym → user_id` disparaît avec la ligne `memberships` : le brief devient anonyme. C'est le comportement correct et il faut savoir l'expliquer à un juriste. `purge_team` les supprime.
2. **`llm_logs` est conservé avec `team_id = null`** : ce sont des données de coût, sans donnée athlète (vérifié dans `001_schema.sql:193-202`). Les effacer casserait la comptabilité ; les délier suffit.
3. **`purge_log` ne stocke que le pseudonyme**, jamais le nom ni l'email. Un journal de suppression qui conserve l'identité des personnes supprimées est une contradiction.

### Edge function proposée — `supabase/functions/admin-purge/index.ts`

Miroir de `join-team` : JWT utilisateur, vérification du rôle admin en service-role, puis appel de `purge_team`. À réserver à Gabin pour les fins de contrat.

### `src/lib/ctpApi.ts` — remplacer `removeMember`

```ts
/** Retire un athlète de l'équipe SANS supprimer ses données (départ d'effectif). */
export async function removeMember(teamId: string, userId: string) {
  const { error } = await db().from("memberships")
    .delete().eq("team_id", teamId).eq("user_id", userId);
  if (error) throw error;
  return { ok: true };
}

/** Supprime définitivement toutes les données d'un athlète sur cette équipe. Irréversible. */
export async function purgeAthlete(teamId: string, userId: string, reason?: string) {
  const { data, error } = await db().rpc("purge_athlete",
    { p_user: userId, p_team: teamId, p_reason: reason ?? null });
  if (error) throw error;
  return data;                     // {responses: 142, ...} -> à afficher comme attestation
}
```

**Côté UI (`AdminTeamDetailScreen.tsx`), deux actions distinctes et clairement libellées :**
- *« Remove from roster »* — l'athlète perd l'accès, les données restent (départ normal en cours de saison) ;
- *« Delete all data (permanent) »* — double confirmation, saisie du nom de l'athlète, puis affichage du décompte retourné.

**Sans cette distinction explicite, le coach croira que « remove » supprime.** C'est exactement l'erreur actuelle.

**Test d'acceptation.** Purger un athlète de test, puis, connecté en coach, vérifier que `select * from responses` ne renvoie plus aucune de ses lignes, et que `purge_log` contient une ligne avec les décomptes.

---

## P0-3 · Confirmation d'email et politique de mot de passe

**État vérifié.** « Confirm email » est désactivé (doc 08 §9, avec la note « le réactiver casse l'inscription — quota d'emails »). Le minimum de mot de passe est de 6 caractères, contrôlé uniquement côté client (`StitchCreateAccountScreen.js:39-42`). Aucun MFA.

**[APPRÉCIATION] La note du doc 08 identifie un vrai obstacle mais en tire la mauvaise conclusion.** Le quota d'emails de Supabase concerne le SMTP intégré, limité et destiné aux tests. La solution n'est pas de désactiver la vérification, c'est de configurer un SMTP réel.

**Actions, console Supabase, aucune modification de code :**

1. **Authentication → Emails → SMTP Settings** : brancher Resend, Postmark ou SendGrid. Coût nul au volume actuel. Domaine authentifié SPF/DKIM.
2. **Authentication → Providers → Email** : réactiver « Confirm email ».
3. **Authentication → Policies** : longueur minimale à **12**, activer la vérification contre les mots de passe compromis (HaveIBeenPwned) si le plan le permet.
4. Aligner le contrôle client (`StitchCreateAccountScreen.js:39`) sur 12 caractères, avec un message explicite.
5. **Authentication → Rate limits** : limiter les tentatives de connexion et d'inscription par IP.

**Sans P0-3, P0-1 est incomplet** : un code staff qui fuite reste exploitable avec une adresse jetable non vérifiée.

---

## P0-4 · Cesser d'affirmer une rétention zéro non contractée

**État vérifié.** `supabase/functions/_shared/llm.ts:3` porte le commentaire « *API zéro-rétention* ». Aucun accord ZDR n'est documenté. La rétention par défaut d'Anthropic est de 30 jours ([API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)).

C'est le seul point de ce document qui n'est pas un problème technique : c'est un problème de parole donnée. Le commentaire finit par devenir une phrase prononcée en discovery call.

**Deux voies, à trancher :**

- **A — demander un accord ZDR** auprès d'Anthropic (contact commercial). Si obtenu, archiver le document signé, garder le commentaire, cocher l'Option B de la Privacy Policy §6.
- **B — dire la vérité**, qui est déjà très bonne : le modèle ne reçoit **aucun identifiant**, Anthropic ne s'entraîne pas sur les données commerciales, la rétention par défaut est de 30 jours.

Commentaire proposé pour la voie B, en tête de `llm.ts` :

```ts
// Appel LLM — couche TRADUCTION uniquement. Le LLM ne calcule rien, ne décide rien :
// il narre des scores et des flags déjà produits.
//
// CONFIDENTIALITÉ (vérifié 2026-08-15) : le payload est pseudonymisé — référence
// codée (P-01), scores, baseline, déviation, zone, data_days, texte de règle.
// Aucun nom, email, date de naissance, identifiant de compte, nom d'équipe ni
// réponse brute au questionnaire n'est transmis. Voir morning-brief/index.ts:30-39.
//
// RÉTENTION : pas d'accord Zero Data Retention à ce jour. Anthropic supprime les
// entrées/sorties API sous 30 jours et ne s'entraîne pas sur les données commerciales.
// Ne PAS affirmer « zéro rétention » tant qu'un accord ZDR n'est pas signé et archivé.
```

**En même temps :** ajouter dans `llm.ts` le garde-fou correspondant, pour que la promesse tienne même si quelqu'un modifie le payload plus tard.

```ts
const FORBIDDEN_KEYS = ["name", "display_name", "email", "user_id", "uid",
                        "birth_year", "team_name", "metrics", "friction_type"];

function assertPseudonymized(payload: unknown) {
  const s = JSON.stringify(payload);
  for (const k of FORBIDDEN_KEYS) {
    if (s.includes(`"${k}"`)) throw new Error(`LLM payload leak: forbidden key "${k}"`);
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(s)) throw new Error("LLM payload leak: email pattern");
}
// à appeler en tête de narrate(), avant le fetch
```

**[APPRÉCIATION]** Ce garde-fou vaut plus que sa complexité : il transforme une propriété actuellement vraie *par discipline du développeur* en propriété vraie *par construction*. C'est exactement le genre d'élément qui fait bonne impression dans une revue de sécurité — et c'est vingt lignes.

---
---

# P1 — AVANT LE PREMIER CLIENT PAYANT

## P1-1 · Une politique de rétention qui s'exécute

Une politique de rétention écrite dans une Privacy Policy et non appliquée est pire qu'une absence de politique. Migration proposée — `013_retention.sql` :

```sql
-- Purge des données expirées. Appelée par pg_cron, quotidiennement.
create or replace function run_retention_policy()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_briefs int; n_logs int; n_rem int; n_access int;
begin
  delete from briefs where brief_date < current_date - interval '24 months';
  get diagnostics n_briefs = row_count;

  delete from llm_logs where created_at < now() - interval '12 months';
  get diagnostics n_logs = row_count;

  delete from pending_reminders
   where status in ('sent','responded','expired') and created_at < now() - interval '90 days';
  get diagnostics n_rem = row_count;

  delete from access_log where at < now() - interval '12 months';   -- cf. P1-4
  get diagnostics n_access = row_count;

  return jsonb_build_object('briefs', n_briefs, 'llm_logs', n_logs,
                            'pending_reminders', n_rem, 'access_log', n_access);
end $$;

revoke all on function run_retention_policy() from anon, authenticated;

select cron.schedule('retention-daily', '0 4 * * *',
  $$ select run_retention_policy() $$);
```

**Volontairement non inclus : la purge automatique des athlètes inactifs.** La Privacy Policy §8 propose 12 mois après la dernière activité, mais cette purge doit rester **manuelle et sur instruction de l'établissement** : un athlète blessé sur une saison longue ne doit pas voir son historique disparaître automatiquement. Ajouter plutôt un rapport mensuel « athlètes sans activité depuis 12 mois » présenté à l'admin, avec un bouton de purge.

## P1-2 · MFA obligatoire pour les comptes staff

Un compte coach donne accès aux données de bien-être nominatives de toute une équipe. C'est le compte le plus sensible du produit et il est aujourd'hui protégé par six caractères.

Supabase Auth prend en charge le MFA TOTP (`supabase.auth.mfa.*`). Implémentation :

1. **Console → Authentication → Multi-Factor** : activer TOTP.
2. **Enrôlement** dans `CoachProfileScreen.tsx` / `AdminHomeScreen.tsx` : `mfa.enroll({ factorType: 'totp' })`, affichage du QR, `mfa.challenge()` + `mfa.verify()`.
3. **Application** dans `AuthGate` (`navigation/StitchNavigator.js`, branche Supabase ~455-495) : après résolution du rôle, si `role in ('coach','admin')` et `mfa.getAuthenticatorAssuranceLevel()` renvoie `currentLevel !== 'aal2'`, router vers un écran d'enrôlement ou de challenge **avant** tout écran de données.
4. **Application côté base** — c'est le point qui compte, car un contrôle uniquement côté client ne vaut rien. Le JWT Supabase expose l'AAL ; les policies staff peuvent l'exiger :

```sql
-- Migration 014 : le staff ne lit les données athlètes qu'en AAL2 (MFA vérifié).
drop policy if exists responses_staff_read on responses;
create policy responses_staff_read on responses for select
  using (
    my_role_in(team_id) in ('coach','admin')
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );

-- Idem pour metrics_staff_read, flags_staff_read, briefs_staff_read, profiles_staff_read.
```

**[APPRÉCIATION] Ne pas déployer la partie SQL avant que 100 % du staff existant soit enrôlé** — sinon les coachs voient des écrans vides sans comprendre pourquoi. Séquence : activer l'enrôlement, accompagner, vérifier, puis appliquer les policies.

Impact commercial : « MFA required for all staff accounts » est une ligne de HECVAT et une ligne de DPA. Elle se coche ou ne se coche pas.

## P1-3 · Expiration de session

**Console Supabase → Authentication → Sessions :**
- durée du JWT : **1 heure** (défaut : 1 h, à confirmer) ;
- expiration du refresh token en cas d'inactivité : **12 heures** pour un usage staff ;
- durée de vie maximale de session : **30 jours** ;
- activer la rotation des refresh tokens et la détection de réutilisation.

**[APPRÉCIATION] Attention au compromis produit.** Un athlète qui doit se reconnecter chaque jour ne répond plus au questionnaire, et le produit meurt de son taux de complétion. Recommandation : session longue pour les athlètes, session courte pour le staff. Si Supabase ne permet pas une différenciation par rôle, prendre le paramètre athlète (long) et compenser côté staff par le MFA (P1-2), qui est la vraie protection.

## P1-4 · Journal d'accès aux données d'athlète

**C'est la mesure qui change la nature des conversations avec un RSSI universitaire.** Sans elle, la réponse à « qui a vu quoi ? » est « on ne sait pas », et tout incident se notifie au périmètre maximal.

Migration proposée — `015_access_log.sql` :

```sql
create table access_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid not null,              -- qui
  actor_role text,
  team_id uuid,
  subject uuid,                     -- de qui (null = vue agrégée d'équipe)
  action text not null,             -- 'view_athlete' | 'view_roster' | 'view_brief' | 'export' | 'purge'
  detail jsonb                      -- {"range":"2026-01-01..2026-03-01"} — jamais de valeurs de réponses
);
create index idx_access_log_team_at on access_log (team_id, at desc);
create index idx_access_log_subject on access_log (subject, at desc);

alter table access_log enable row level security;
create policy access_log_admin_read on access_log for select
  using (team_id is not null and my_role_in(team_id) = 'admin');
-- Aucune policy d'insert/update/delete : un journal ne se modifie pas depuis le client.

-- Écriture contrôlée : l'acteur est pris dans le JWT, jamais dans les paramètres.
create or replace function log_access(p_team uuid, p_subject uuid, p_action text, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into access_log (actor, actor_role, team_id, subject, action, detail)
  values (auth.uid(), my_role_in(p_team), p_team, p_subject, p_action, p_detail);
end $$;

grant execute on function log_access(uuid, uuid, text, jsonb) to authenticated;
```

**Instrumentation dans `src/lib/ctpApi.ts`** — la couche d'accès unique est le bon endroit, puisque « aucun écran migré n'appelle Supabase directement » (doc 08 §8) :

```ts
async function logAccess(teamId: string, subject: string | null, action: string, detail?: any) {
  try {
    await db().rpc("log_access",
      { p_team: teamId, p_subject: subject, p_action: action, p_detail: detail ?? null });
  } catch { /* jamais bloquer une lecture parce que la journalisation échoue */ }
}
```

Points d'appel : `getAthleteMetricsRange` et `getAthleteResponses` → `view_athlete` ; `getTeamMembers` → `view_roster` ; `getLatestBrief` → `view_brief` ; `getTeamMetricsRange` → `view_team_metrics` ; `purgeAthlete` → `purge`.

**Trois limites à assumer et à savoir énoncer.**
- La journalisation est côté client : un attaquant qui obtient un JWT et appelle PostgREST directement contourne le journal. La couverture est celle des **accès légitimes via l'application**, ce qui est déjà l'essentiel du besoin (« quel coach a consulté quel athlète »). Un journal réellement inviolable exigerait de faire passer toutes les lectures par des edge functions — refonte majeure, hors budget à ce stade.
- Ne jamais mettre de **valeurs de réponses** dans `detail`. Le journal deviendrait une seconde copie des données sensibles, à protéger autant que la première.
- Exposer une vue « qui a consulté mes données » à l'athlète : différenciant fort auprès des associations d'athlètes, et coût quasi nul une fois la table en place.

**Un écran admin « Access log » (30 derniers jours, filtrable) fait la démonstration en dix secondes pendant une revue de sécurité.**

## P1-5 · CSP et stockage de session

**État vérifié.** `vercel.json:17` : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. Combiné à un JWT en `localStorage`, un XSS donne une session coach complète.

**Étape 1 — retirer `unsafe-eval`.** Il est généralement dû au mode développement d'Expo/Metro ou à Hermes. Tester un build de production sans lui :

```json
"script-src 'self' 'unsafe-inline'"
```

Si l'application fonctionne, le gain est réel et gratuit. Si elle casse, documenter précisément pourquoi — un RSSI accepte une justification technique, jamais un silence.

**Étape 2 — resserrer `connect-src`.** Actuellement ouvert à `https://*.supabase.co`, `https://*.firebaseio.com`, `https://*.googleapis.com`. Remplacer les jokers Supabase par le projet exact, et **supprimer les entrées Firebase une fois P2-6 fait** :

```
connect-src 'self' https://wiopzitygsgincztwquz.supabase.co wss://wiopzitygsgincztwquz.supabase.co;
```

**Étape 3 — ajouter les en-têtes manquants** dans `vercel.json` : `Cross-Origin-Opener-Policy: same-origin`, `X-DNS-Prefetch-Control: off`, et `Cache-Control: no-store` sur les routes applicatives.

**Étape 4 — stockage de session.** Passer le JWT en cookie `HttpOnly` supprimerait le risque de vol par XSS, mais implique un backend proxy — refonte lourde, non justifiée ici. **[APPRÉCIATION] Décision recommandée : conserver `localStorage`, et compenser par le MFA (P1-2), l'expiration de session (P1-3) et le journal (P1-4).** Documenter ce choix ; c'est une question classique de HECVAT et une réponse argumentée vaut mieux qu'une case cochée à tort.

## P1-6 · Rotation des secrets

**Inventaire** (doc 08 §15, vérifié) : `ANTHROPIC_API_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publique par nature).

**La clé critique est `SUPABASE_SERVICE_ROLE_KEY`** : elle contourne toute la RLS et permet d'écrire dans `rules`, dont `condition_sql` est exécuté en `security definer` par `eval_rule` (`003_engine.sql:124-133`). **Sa compromission équivaut à un accès superutilisateur à la base.**

**Procédure à écrire dans `docs/GUIDE_ACTIONS_GABIN.md` :**

| Secret | Fréquence | Déclencheur immédiat |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | 12 mois | départ d'une personne y ayant eu accès ; suspicion de fuite ; poste compromis |
| `ANTHROPIC_API_KEY` | 12 mois | idem ; anomalie de facturation |
| `VAPID_PRIVATE_KEY` | ne pas faire tourner sans nécessité | **⚠ la rotation invalide toutes les souscriptions push existantes** — tous les athlètes devraient réactiver. À traiter comme une opération de crise, pas de routine. |
| Mots de passe des comptes de test | 6 mois | avant toute démonstration à un prospect |

Commande : `supabase secrets set NOM=valeur` (jamais dans le dépôt ; `.gitignore` couvre déjà `.env*`, vérifié).

**À vérifier une fois :** que `ANTHROPIC_API_KEY` et la clé service-role n'ont jamais transité par un historique Git ou un canal de chat. `git log -p -S "sk-ant"` sur tout l'historique. Si elles y sont, rotation immédiate — une clé dans un historique Git est une clé publique.

## P1-7 · Version et horodatage de la notice athlète

Aujourd'hui, **rien ne prouve qu'un athlète ait jamais vu le moindre texte d'information**. Le texte existant est un `<div>` statique dans `OnboardingNotifScreen.tsx:273-275`, non tracé.

```sql
-- Migration 016
alter table profiles add column if not exists notice_version text;
alter table profiles add column if not exists notice_accepted_at timestamptz;
```

Nouvel écran `AthleteNoticeScreen.tsx` (texte du fichier 13 §3.2), rendu par `AuthGate` avant tout écran de données lorsque `notice_version` est nul ou différent de la version courante. À l'acceptation : `updateMyProfile({ notice_version: 'v1.0', notice_accepted_at: new Date().toISOString() })`.

**[APPRÉCIATION] Faible effort, valeur juridique élevée.** Le jour où un athlète affirme n'avoir jamais été informé, la réponse est une ligne de base de données avec une version et un horodatage. Sans cela, il n'y a rien à opposer.

## P1-8 · Retirer toute PII des logs applicatifs

**Vérifié :** `navigation/StitchNavigator.js:309, 479, 519` écrivent `user.email` et le rôle dans la console du navigateur ; `screens/StitchCreateAccountScreen.js:93, 110, 121` loggent le rôle et l'objet utilisateur complet, email inclus.

Faible gravité — console client, pas de transmission — mais c'est ce qu'un pentester relève en premier, et c'est trivial à corriger. Remplacer par des identifiants tronqués :

```js
console.log("[SUPA] auth OK:", sessUser.id.slice(0, 8), "| role:", roleFromDb);
```

Et supprimer les `console.log` de diagnostic dans le build de production via la configuration Babel (`babel.config.cjs`, `transform-remove-console` en gardant `error`).

## P1-9 · Pseudonymes non réutilisables

**Vérifié :** `join-team/index.ts:45-47` génère le pseudonyme en comptant les membres existants. Après un départ, le compteur redescend et **deux athlètes différents peuvent porter le même `P-0x`**, ce qui corrompt l'historique des briefs et le `purge_log`.

```sql
-- Migration 017 : compteur monotone par équipe
alter table teams add column if not exists pseudonym_seq int not null default 0;

create or replace function next_pseudonym(p_team uuid)
returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update teams set pseudonym_seq = pseudonym_seq + 1 where id = p_team returning pseudonym_seq into n;
  return 'P-' || lpad(n::text, 2, '0');
end $$;

revoke all on function next_pseudonym(uuid) from anon, authenticated;
```

Dans `join-team/index.ts`, remplacer le comptage par `await supa.rpc("next_pseudonym", { p_team: teamId })`.

---
---

# P2 — À FAIRE ENSUITE

## P2-1 · Export complet des données d'un athlète

Exigé par le DPA §8.3 et par la Privacy Policy §9 (réponse en 30 jours).

```sql
-- Migration 018
create or replace function export_athlete_data(p_user uuid, p_team uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not (auth.uid() = p_user or my_role_in(p_team) = 'admin') then
    raise exception 'forbidden';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'profile',      (select to_jsonb(p) from profiles p where p.user_id = p_user),
    'membership',   (select to_jsonb(m) from memberships m where m.user_id = p_user and m.team_id = p_team),
    'responses',    (select coalesce(jsonb_agg(to_jsonb(r) order by r.submitted_at), '[]'::jsonb)
                       from responses r where r.user_id = p_user and r.team_id = p_team),
    'daily_metrics',(select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb)
                       from daily_metrics d where d.user_id = p_user and d.team_id = p_team),
    'flags',        (select coalesce(jsonb_agg(to_jsonb(f) order by f.day), '[]'::jsonb)
                       from flags f where f.user_id = p_user and f.team_id = p_team)
  ) into out;
  perform log_access(p_team, p_user, 'export', null);
  return out;
end $$;

grant execute on function export_athlete_data(uuid, uuid) to authenticated;
```

Bouton « Download my data (JSON) » dans `ProfileScreenSupabase.tsx`, et équivalent admin dans `AthleteDetailScreen.tsx`. **[APPRÉCIATION]** L'athlète se sert lui-même, l'université a une réponse immédiate, Gabin n'écrit plus de SQL à la main. Trois heures qui s'amortissent à la première demande.

## P2-2 · Retirer la porte de service de `create-team`

`supabase/functions/create-team/index.ts:48` : `isAdmin = (memberships.length > 0) || (teamCount === 0)`. La seconde condition permet à tout utilisateur authentifié de devenir admin tant qu'aucune équipe n'existe. Supprimer `|| (teamCount === 0)` et amorcer la première équipe manuellement par SQL.

*(Bug indépendant repéré au passage : la fonction insère `org_id` alors que la colonne du schéma est `organization_id` — `001_schema.sql:19`. La création d'équipe est probablement cassée. Hors périmètre conformité, mais à vérifier.)*

## P2-3 · Retirer `birth_year` de `v_ai_dataset`

`003_engine.sql:113`. Poste + année de naissance + série readiness identifient un joueur dans un effectif de quinze. Retirer la colonne de la vue ; si une stratification par âge devient nécessaire, utiliser une tranche (`u20` / `20-22` / `23+`) plutôt que l'année.

## P2-4 · Garde-fous sur `coach_feedback.note`

Seul champ de texte libre écrit par un humain, non filtré et non journalisé. C'est la porte d'entrée pour un nom, un diagnostic ou une remarque qui, dans un dossier soumis au droit d'accès de l'étudiant, deviendrait embarrassante.

Trois mesures : limiter à 500 caractères (contrainte `check`), afficher sous le champ un rappel *« Do not enter medical information, diagnoses, or personal details about an athlete »*, et journaliser l'écriture via `log_access(..., 'write_note')`.

## P2-5 · Sauvegardes et test de restauration

**[NON VÉRIFIÉ] Aucune information dans le dépôt.** À faire :

1. Confirmer le plan Supabase et l'activation du **Point-in-Time Recovery** (option payante — indispensable dès le premier client payant).
2. **Tester une restauration complète sur un projet Supabase distinct**, une fois maintenant puis une fois par an. Chronométrer, écrire la procédure, noter le RTO obtenu. Une sauvegarde jamais restaurée n'est pas une sauvegarde, et le DPA §5 s'y engage.
3. Consigner le résultat dans `docs/CHANGELOG_IMPLEMENTATION.md` — c'est la preuve que réclamera un HECVAT.

## P2-6 · Décommissionner Firebase / Firestore

Tant que l'ancienne pile vit, il existe une seconde copie des données athlètes dans un second cloud, sous un modèle de sécurité non audité ici (risque R-08).

Séquence : exporter et archiver hors ligne ce qui doit l'être → supprimer les Cloud Functions → supprimer les collections Firestore → révoquer les clés de service → retirer les dépendances `firebase` du `package.json` et les entrées Firebase de la CSP → attester la destruction par écrit → retirer la ligne 5 de la liste des sous-traitants.

**[APPRÉCIATION]** À faire avant le premier client payant si l'ancienne version ne sert plus commercialement. Le gain n'est pas seulement sécuritaire : il divise par deux la surface à décrire dans un questionnaire de sécurité, et supprime une question gênante.

## P2-7 · `friction_impact` collecté mais jamais enregistré

`StitchQuestionnaireScreen.js:821-823` recueille la valeur ; `ctpApi.ts:88-94` ne l'insère pas. La colonne reste NULL. Bug d'intégrité : on demande une information à l'athlète et on la jette. Soit on l'enregistre, soit on retire la question — collecter sans utiliser est exactement ce que la minimisation des données interdit.

## P2-8 · Ce qui ne doit jamais être écrit dans un log

À ajouter à `CLAUDE.md` ou `CONSTITUTION.md` comme règle permanente.

**Jamais, dans aucun log (client, edge function, service tiers, message d'erreur, ticket, capture d'écran de démonstration) :**

- une adresse email, un nom réel, un `user_id` complet (les 8 premiers caractères suffisent au débogage) ;
- une valeur de réponse au questionnaire, un `readiness_score`, un `worry_level`, un `friction_type` ;
- un JWT, une clé API, une clé service-role, un `endpoint` de souscription push complet ;
- un `invite_code`, un `staff_invite_code`, une `ics_url` ;
- le contenu d'un brief ou d'un payload LLM.

**Autorisé :** identifiants tronqués, décomptes, durées, codes d'erreur, noms d'équipe *(en interne uniquement)*, coûts et volumes de tokens.

**Règle de démonstration :** ne jamais montrer un écran contenant des données réelles d'athlètes à un prospect. Utiliser l'équipe Pilot Team et les pseudonymes. Une capture d'écran envoyée par email est une divulgation.

---
---

# Séquence d'exécution recommandée

**Semaine 1 — débloquer la signature** (P0-1, P0-2, P0-3, P0-4)
Migrations 011 et 012, retouches de `join-team`, `ctpApi`, `StitchCreateAccountScreen`, configuration SMTP et politique de mot de passe, correction de la déclaration Anthropic et garde-fou `assertPseudonymized`. **À l'issue de la semaine 1, l'application peut recevoir de vrais athlètes.**

**Semaine 2 — la couche que réclame un juriste** (P1-1, P1-4, P1-7)
Rétention exécutée, journal d'accès, notice versionnée. **À l'issue de la semaine 2, le DPA du fichier 13 peut être signé sans énoncé faux.**

**Semaine 3 — la couche que réclame un RSSI** (P1-2, P1-3, P1-5, P1-6, P1-8, P1-9)
MFA staff, expiration de session, CSP, rotation des secrets, hygiène des logs, pseudonymes.

**Ensuite, au rythme du produit** — P2, en commençant par P2-6 (décommissionnement Firebase) et P2-1 (export), les deux plus visibles en revue de sécurité.

---

## Rappel de la règle de dépôt

Chaque migration livrée met à jour, **dans le même commit** :
- `docs/08_CARTOGRAPHIE_TECHNIQUE.md` §9.5 (tableau des migrations), §9.1 (tables), §9.3 (fonctions SQL) ;
- `docs/CHANGELOG_IMPLEMENTATION.md` ;
- `docs/12_CONFORMITE_US.md` §3 lorsqu'un écart est comblé — **c'est ce document qui doit rester vrai**, puisque c'est celui qui sera montré à un client.
