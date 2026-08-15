# 01 — Créer une équipe et attribuer les rôles

**En une phrase.** Créer une équipe génère deux codes ; c'est le code utilisé à l'inscription qui décide du rôle, pas ce que la personne coche.

---

## Étapes

1. Se connecter en **admin** → onglet **AdminHome** → créer l'équipe (nom + sport).
2. Relever les deux codes sur la fiche de l'équipe :
   - `XXXXXX-A` → **athlètes**
   - `XXXXXX-C` → **staff**
3. Envoyer le code `-A` au roster (groupe, affichage vestiaire, peu importe).
4. Envoyer le code `-C` **individuellement** à chaque membre du staff.
5. Chacun crée son compte et saisit son code. Le rôle est attribué automatiquement.
6. Coller l'adresse iCal du calendrier de l'équipe dans les réglages : sans elle, aucune séance, donc aucune notification.

---

## La règle qui ne se négocie pas

**Le code `-C` ne circule jamais dans le roster.** Celui qui le possède lit les réponses nominatives de toute l'équipe : douleurs, stress, état mental. Un athlète qui met la main dessus voit tout de ses coéquipiers.

Le bouton ATHLETE / COACH de l'écran d'inscription n'a **aucun effet** sur le rôle réel. Le serveur ignore ce que le client déclare et ne regarde que le code. Ne pas se fier à ce bouton pour vérifier quoi que ce soit.

---

## Ce qui peut mal tourner

| Symptôme | Cause | Correctif |
|---|---|---|
| Quelqu'un s'est inscrit avec le mauvais code | Code envoyé au mauvais destinataire | SQL ci-dessous — l'app refuse de changer un rôle existant, volontairement |
| Un coach voit l'interface athlète | Il a utilisé le code `-A` | Idem |
| Aucune séance n'apparaît | Calendrier iCal absent ou privé | Réglages de l'équipe → coller l'adresse **secrète** iCal, pas l'URL publique |
| Aucune notification | L'athlète n'a pas activé les notifications sur son appareil | Profil → Notifications → activer. Sur iPhone, l'app doit d'abord être ajoutée à l'écran d'accueil |
| L'app choisit la mauvaise équipe | Tu es membre de plusieurs équipes | Limite connue : pas encore de sélecteur d'équipe |

---

## SQL de secours

**Voir les codes de toutes les équipes**
```sql
select name, invite_code as code_athlete, coach_code as code_staff
from teams order by name;
```

**Corriger un rôle**
```sql
update memberships set role = 'coach'
where team_id = '<TEAM_ID>'
  and user_id = (select id from auth.users where email = 'coach@universite.edu');
```

**Régénérer un code staff** (si le code a fuité)
```sql
update teams
set coach_code = upper(substring(replace(gen_random_uuid()::text,'-','') for 6)) || '-C'
where id = '<TEAM_ID>'
returning name, coach_code;
```

**Qui est dans l'équipe, et avec quel rôle**
```sql
select p.display_name, m.role, m.pseudonym, m.jersey_number
from memberships m
join profiles p on p.user_id = m.user_id
where m.team_id = '<TEAM_ID>'
order by m.role, p.display_name;
```

---

## Ce qu'on dit au coach

> « Vous allez recevoir deux codes. Le premier, vous le donnez à vos joueurs — c'est celui qui leur ouvre l'application. Le second est le vôtre et celui de votre staff : ne le partagez pas avec l'équipe, il donne accès aux réponses individuelles de chaque joueur.
>
> Vos joueurs créent leur compte en une minute avec le code athlète. Vous n'avez rien à valider, rien à paramétrer. La seule chose dont j'ai besoin de votre part, c'est le lien de votre calendrier d'entraînement — c'est lui qui déclenche les notifications après chaque séance. »
