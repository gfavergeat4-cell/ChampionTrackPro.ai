# 12 — CONFORMITÉ US · ChampionTrackPro V2

> **Date de l'analyse : 15 août 2026.**
> **Périmètre audité :** `C:\GAB\PRO\ChampionTrackPRO\APP\ChampionTrackPro-V2` (chemin bash : `/sessions/great-cool-maxwell/mnt/ChampionTrackPRO/APP/ChampionTrackPro-V2`), plus le document antérieur `ChampionTrackPro-LIVE/FERPA_COMPLIANCE.md`.
> **Niveau visé :** « minimum viable pour signer » — permettre à un coach de signer sans que le service juridique de son université bloque. Ce n'est **pas** un dossier institutionnel complet.

---

## AVERTISSEMENT

**Je ne suis pas avocat.** Ce document est une analyse d'ingénierie de conformité, pas un avis juridique. Il est destiné à préparer une revue par un conseil qualifié en droit américain (FERPA / privacy / edtech) et, pour le volet européen, par un conseil français. Aucune affirmation ci-dessous ne doit être reprise telle quelle dans un contrat ou dans un argumentaire commercial sans validation.

**Convention de traçabilité.** Chaque affirmation porte un marqueur :

| Marqueur | Signification |
|---|---|
| **[CODE]** | Vérifié dans le dépôt, fichier et ligne cités. Fait établi. |
| **[WEB]** | Vérifié par recherche web le 15/08/2026, source citée. |
| **[APPRÉCIATION]** | Mon jugement professionnel. Discutable. À faire trancher par un avocat. |
| **[NON VÉRIFIÉ]** | Dépend d'un élément hors dépôt (console Supabase, contrats signés). À confirmer par Gabin. |

---

# 1. CARTOGRAPHIE DES DONNÉES

## 1.1 Méthode

Inventaire construit champ par champ à partir de `supabase/migrations/001_schema.sql`, `009_push_notifications.sql`, `003_engine.sql`, croisé avec les écrans de saisie (`screens/StitchCreateAccountScreen.js`, `screens/StitchQuestionnaireScreen.js`) et la couche d'accès `src/lib/ctpApi.ts`. **[CODE]**

Résidence physique : projet Supabase `wiopzitygsgincztwquz`, région **US East** (doc `08_CARTOGRAPHIE_TECHNIQUE.md` §9). **[CODE]** Front hébergé sur Vercel (CDN global, mais aucune donnée applicative persistée côté Vercel — le bundle est statique et parle directement à Supabase). API Anthropic : traitement aux États-Unis. **[NON VÉRIFIÉ : région exacte du edge runtime Deno de Supabase — à confirmer dans la console.]**

## 1.2 Tableau des données

Légende « Nature juridique » :
- **DE** = *education record* au sens FERPA (20 U.S.C. § 1232g ; 34 CFR Part 99)
- **PII** = donnée personnelle identifiante
- **SANTÉ-ADJ** = donnée de bien-être à la frontière de la donnée de santé (voir §2.2)
- **DÉRIVÉ** = calculé à partir des précédentes, hérite de leur qualification

### Compte et identité

| Table.colonne | Contenu réel | Nature | Qui y accède | Conservation actuelle | Résidence |
|---|---|---|---|---|---|
| `auth.users.email` | email saisi à l'inscription | **PII + DE** | l'utilisateur ; service_role ; staff de l'équipe via `profiles` | **illimitée** | Supabase US East |
| `auth.users.encrypted_password` | hash | secret d'authentification | personne (hash bcrypt géré par Supabase) | illimitée | idem |
| `profiles.display_name` | **nom complet réel** saisi à l'inscription (`formData.fullName`, `StitchCreateAccountScreen.js:62`) | **PII + DE** | l'utilisateur ; tout `coach`/`admin` d'une équipe partagée (policy `profiles_staff_read`, `002_rls.sql:37`) | **illimitée** | idem |
| `profiles.email` | duplication de l'email | **PII + DE** | idem | illimitée | idem |
| `profiles.fcm_tokens` | jsonb, hérité Firebase, **vide sur le chemin Supabase** | identifiant d'appareil | idem | illimitée | idem |
| `memberships.role` | `athlete` / `coach` / `admin` | **DE** | tous les membres de l'équipe (`memberships_team_read`) | illimitée | idem |
| `memberships.jersey_number`, `.position` | numéro de maillot, poste | **DE** — et pour le maillot, proche du *directory information* **[WEB]** | tous les membres de l'équipe | illimitée | idem |
| `memberships.birth_year` | colonne présente au schéma, **jamais alimentée par l'UI V2** (`join-team/index.ts` ne l'écrit pas ; `ctpApi.updateMyProfile` ne l'expose pas) **[CODE]** | **PII + DE** si un jour alimentée | tous les membres de l'équipe | n/a | idem |
| `memberships.pseudonym` | `P-01`, `P-02`… généré par comptage (`join-team/index.ts:45-47`) | **pseudonyme réversible** (voir §3.4) | tous les membres de l'équipe | illimitée | idem |

### Réponses au questionnaire — le cœur du sujet

| Table.colonne | Contenu réel | Nature | Qui y accède | Conservation | Résidence |
|---|---|---|---|---|---|
| `responses.metrics` (jsonb) | 6 curseurs 1-100 : `tankLevel` (niveau d'énergie), `cardioLoad` (essoufflement de la veille), `legBounce` (fraîcheur des jambes), `motorControl` (coordination), `tacticalSharpness` (netteté cognitive), `teamChemistry` (connexion à l'équipe) — libellés exacts dans `006_seed_initial.sql:17-24` **[CODE]** | **DE + SANTÉ-ADJ** | l'athlète (`responses_self_read`) ; tout `coach`/`admin` de l'équipe (`responses_staff_read`, `002_rls.sql:74`) | **illimitée — aucune purge, aucun TTL, aucun cron de suppression dans le dépôt** **[CODE]** | Supabase US East |
| `responses.has_friction` | booléen « une gêne limite-t-elle ta performance ? » | **DE + SANTÉ-ADJ** | idem | illimitée | idem |
| `responses.friction_type` | **choix multiple : `Physical Soreness`, `Academic / Life Stress`, `Court Confusion`, `Mental / Emotional`** (`StitchQuestionnaireScreen.js:810, 1189-1193`) **[CODE]** | **la donnée la plus sensible du produit.** `Physical Soreness` = douleur physique. `Mental / Emotional` = auto-déclaration de mal-être psychologique. `Academic / Life Stress` = stress scolaire, donc explicitement académique. | idem | illimitée | idem |
| `responses.friction_impact` | 1-100, intensité de la gêne. **Collecté dans l'UI mais non transmis par `ctpApi.submitResponse` (le champ manque dans l'insert, `ctpApi.ts:88-94`)** — la colonne reste NULL sur le chemin Supabase **[CODE]** | SANTÉ-ADJ | idem | n/a | idem |
| `responses.worry_level` | 1-100 : « à quel point cette gêne te travaille la tête ? » (`StitchQuestionnaireScreen.js:1273`) | **SANTÉ-ADJ — santé mentale auto-déclarée** | idem | illimitée | idem |
| `responses.worry_flag` | booléen, vrai si `worry_level > 70` (`ctpApi.ts:93`) | **SANTÉ-ADJ — signal de détresse** | idem | illimitée | idem |
| `responses.readiness_score` | score composite calculé par trigger serveur | DÉRIVÉ | idem | illimitée | idem |
| `responses.submitted_at` | horodatage | métadonnée comportementale (dit à quelle heure l'athlète était éveillé) | idem | illimitée | idem |
| `responses.session_load`, `.workload_au` | prévus V4, **NULL aujourd'hui** | DÉRIVÉ | idem | n/a | idem |

### Moteur et sorties

| Table.colonne | Contenu | Nature | Accès | Conservation | Résidence |
|---|---|---|---|---|---|
| `daily_metrics.*` | readiness, `ema_28`, `deviation_pct`, `zone`, `z_score`, `acwr`, `data_days` | DÉRIVÉ (hérite DE + SANTÉ-ADJ) | athlète pour lui-même ; staff pour l'équipe | illimitée | US East |
| `flags.*` | règle déclenchée + valeur | DÉRIVÉ | staff uniquement | illimitée | US East |
| `briefs.body` | **texte du brief généré par le LLM**, pseudonymisé | DÉRIVÉ | staff uniquement | illimitée | US East |
| `briefs.payload` | **copie exacte du JSON envoyé à Anthropic** (`morning-brief/index.ts:44-47`) — pseudonymisé | DÉRIVÉ | staff uniquement | illimitée | US East |
| `coach_feedback.note` | **texte libre saisi par le coach** | **risque : rien n'empêche un coach d'y écrire un nom, un diagnostic, une remarque médicale** **[APPRÉCIATION]** | staff de l'équipe | illimitée | US East |
| `llm_logs.*` | modèle, tokens, coût, erreur — **aucune donnée athlète** **[CODE]** | opérationnel | admin de l'équipe en lecture (`010_admin_health_read.sql:10`) | illimitée | US East |
| `v_ai_dataset` (vue) | `pseudonym`, `position`, `birth_year`, métriques, règle, action du coach (`003_engine.sql:112-120`) | **pseudonymisé mais ré-identifiable** (voir §3.4) | `service_role` uniquement (`005_security_views.sql:9` révoque `select` pour `anon`/`authenticated`) **[CODE]** | illimitée | US East |

### Infrastructure et calendrier

| Table.colonne | Contenu | Nature | Accès | Conservation | Résidence |
|---|---|---|---|---|---|
| `teams.ics_url` | **URL du calendrier du coach.** Une URL ICS « secrète » est une capacité au porteur : quiconque l'obtient lit tout le calendrier de l'équipe. | **secret d'infrastructure client** **[APPRÉCIATION]** | écrite via RPC `set_team_ics` ; lue par `getMyMembership` → **exposée à tout membre de l'équipe via l'embed `teams(... ics_url ...)`, `ctpApi.ts:25`** **[CODE]** | illimitée | US East |
| `teams.invite_code` | code d'adhésion unique, partagé, sans expiration | **secret d'accès** | lu par tout membre via `getMyMembership` (`ctpApi.ts:25`) **[CODE]** | illimitée | US East |
| `sessions.title` | titres importés de l'ICS (peuvent contenir des noms de lieux, d'adversaires, d'intitulés internes) | DE (contexte scolaire) | membres de l'équipe | illimitée | US East |
| `push_subscriptions.endpoint` / `.p256dh` / `.auth_key` | souscription Web Push : URL unique d'appareil + clés de chiffrement | **identifiant d'appareil + secret** | l'utilisateur ; service_role | jusqu'à expiration du endpoint (nettoyage sur `410 Gone`, `notify/index.ts:76-91`) **[CODE]** | US East |
| `pending_reminders.*` | relances de check-in | métadonnée comportementale (dit qui n'a pas répondu) | service_role ; admin en lecture | illimitée | US East |

## 1.3 Ce qui n'est PAS collecté — et c'est un argument commercial

Vérifié par lecture exhaustive du schéma **[CODE]** :

- pas de notes, GPA, dossier académique ;
- pas de diagnostic médical, de traitement, de prescription ;
- pas de numéro de sécurité sociale ni d'identifiant étudiant institutionnel ;
- pas de donnée financière ;
- pas de biométrie au sens strict (pas de fréquence cardiaque, pas de GPS, pas de sommeil mesuré par capteur, pas d'empreinte, pas de reconnaissance faciale) — **tout est auto-déclaré sur des curseurs 1-100** ;
- pas de géolocalisation (`Permissions-Policy: geolocation=()` dans `vercel.json:15`) ;
- pas de caméra ni de micro (même en-tête).

**[APPRÉCIATION]** C'est le meilleur atout du dossier. L'absence de capteur fait sortir le produit du périmètre le plus chaud (BIPA de l'Illinois, lois d'État sur la biométrie, débat NCAA sur les wearables). À écrire noir sur blanc dans la Privacy Policy et à répéter en discovery call.

## 1.4 Le point aveugle : la double pile

Le dépôt V2 contient encore `functions/index.js` (Cloud Functions Firebase actives) et l'ancienne version tourne toujours en production sur `champtrackpro.com` avec Firestore (doc `08` §14). **[CODE]** Tant que les deux existent, **il y a deux copies de données athlètes, dans deux clouds, sous deux modèles de sécurité différents**. Un questionnaire de sécurité universitaire posera la question « listez tous les systèmes qui stockent nos données ». Il faudra soit décommissionner et purger Firestore, soit le déclarer.

---

# 2. CADRES APPLICABLES

## 2.1 FERPA — le cadre principal

**Ce qui s'applique.** FERPA (20 U.S.C. § 1232g, 34 CFR Part 99) s'impose à tout établissement recevant des fonds fédéraux du Department of Education — donc à la quasi-totalité des universités NCAA. **[WEB]** ([CRS, *FERPA and Its Exceptions*](https://www.congress.gov/crs-product/IF13155))

Point structurant à comprendre : **FERPA ne s'applique pas directement à ChampionTrackPro.** Il s'applique à l'université. ChampionTrackPro n'est pas régulé par FERPA — il est *contractuellement* tenu de permettre à l'université de rester conforme. Le risque juridique de Gabin n'est donc **pas** une sanction fédérale, c'est **une rupture de contrat, une action en indemnisation par l'université, et la mort commerciale**. **[APPRÉCIATION]**

**Le mécanisme utilisable : l'exception « school official ».** 34 CFR § 99.31(a)(1)(i)(B) permet à un établissement de partager des *education records* avec un prestataire extérieur sans consentement individuel, à quatre conditions cumulatives **[WEB]** ([U.S. Dept. of Education, Protecting Student Privacy FAQ](https://studentprivacy.ed.gov/frequently-asked-questions)) :

1. le prestataire exécute un service que l'établissement aurait sinon confié à ses propres employés ;
2. il est **sous le contrôle direct** de l'établissement quant à l'usage et à la conservation des dossiers ;
3. il ne redivulgue pas les dossiers à des tiers non autorisés ;
4. il respecte les conditions de § 99.33(a) (limitation d'usage à la finalité).

Et — point que la version antérieure du document FERPA sous-estimait — l'établissement doit avoir **désigné les prestataires comme *school officials* dans sa notification annuelle FERPA** et défini le « *legitimate educational interest* ». Ce n'est donc pas quelque chose que ChampionTrackPro peut s'auto-attribuer. **[WEB]**

**Ce qui ne s'applique pas.** ChampionTrackPro n'a aucune obligation FERPA propre : pas de notification annuelle à produire, pas de bureau FERPA à tenir, pas d'obligation d'inspection directe des dossiers envers l'athlète (c'est l'université qui la porte). Le § 99.32 (registre des divulgations) pèse sur l'établissement, pas sur le vendeur — **mais** un vendeur incapable de dire qui a consulté quoi rend l'établissement incapable de tenir ce registre. **[APPRÉCIATION]**

**Le trou dans le document antérieur.** `ChampionTrackPro-LIVE/FERPA_COMPLIANCE.md` est titré « **Status: Compliant by design** » et affirme que « authorized vendors […] are permitted to access student data without individual consent ». C'est **juridiquement inversé** : l'exception school official n'est pas un droit du vendeur, c'est une faculté de l'établissement, conditionnée à un contrat et à une désignation. Le document, présenté à un juriste universitaire, se retournerait contre Gabin — il donne l'impression que le fournisseur croit détenir un droit d'accès. **[APPRÉCIATION]** Le reste du fichier (données collectées / non collectées, minimisation, droits) est bon et réutilisable ; c'est le cadrage juridique et le mot « compliant » qui doivent disparaître.

**Ce qu'il faut en retirer :** ne jamais dire « we are FERPA compliant ». Dire « **we are built to operate as a School Official under your institution's FERPA policy, and here is the contractual language that makes that possible** ». Le premier est une prétention invérifiable ; le second est ce qu'un juriste universitaire cherche.

## 2.2 Le statut des données de bien-être et de douleur — la vraie zone grise

**HIPAA ne s'applique pas.** Deux raisons cumulatives **[WEB]** ([HHS, *FERPA and HIPAA*](https://www.hhs.gov/hipaa/for-professionals/faq/ferpa-and-hipaa/index.html)) :

1. ChampionTrackPro n'est pas une *covered entity* (ni prestataire de soins facturant électroniquement, ni assureur santé, ni chambre de compensation) et ne devient *business associate* que s'il traite du PHI pour le compte d'une covered entity ;
2. la règle HIPAA exclut expressément de la définition de PHI les *education records* couverts par FERPA et les *treatment records* post-secondaires. Concrètement, les dossiers tenus par un athletic trainer employé de l'université pour ses étudiants-athlètes relèvent de FERPA, pas de HIPAA. **[WEB]**

**[APPRÉCIATION] Conséquence pratique décisive :** HIPAA est le repoussoir que les juristes universitaires invoquent le plus vite quand ils voient les mots « pain », « mental », « wellness ». Il faut être capable de répondre en une phrase, avec la citation HHS, que le sujet est FERPA et non HIPAA. C'est un argument que Gabin doit savoir dire par cœur.

**Mais l'analyse ne s'arrête pas là.** Deux réserves sérieuses :

- **Le passage à HIPAA est possible.** Si un jour le staff médical de l'université (medical staff, sports medicine) devient utilisateur, si l'app sert à documenter un suivi de blessure, ou si les données alimentent un dossier de soins, l'université peut exiger un BAA. Supabase propose un BAA à partir du plan Team **[WEB]** ([Supabase, HIPAA compliance](https://supabase.com/docs/guides/security/hipaa-compliance)) ; Anthropic et Vercel devraient aussi être couverts. **Règle de conduite : refuser explicitement, dans les CGU, tout usage clinique / diagnostique / de retour au jeu.** Le prompt LLM le fait déjà (`_shared/llm.ts:44` : « *You never say an athlete should sit out or play* ») — c'est excellent, il faut le remonter au niveau contractuel. **[CODE]**
- **`friction_type = "Mental / Emotional"` et `worry_level` sont de la santé mentale auto-déclarée.** Juridiquement ce n'est pas du PHI. Réputationnellement et contractuellement, c'est le champ qui fera lever un sourcil à un *Title IX officer* ou à un directeur de counseling. **[APPRÉCIATION]** Deux exigences en découlent : (a) le consentement affiché à l'athlète doit dire explicitement que le staff sportif voit ces réponses — pas de suggestion de confidentialité ; (b) il faut prévoir contractuellement ce que fait l'université d'un `worry_flag`, sinon on crée un devoir de vigilance implicite sans protocole (voir §4, risque R-04).

**Lois d'État sur les « données de santé grand public ».** Le Washington *My Health My Data Act* et le Nevada SB 370 visent les données de santé de consommateurs hors HIPAA, avec droit d'action privé côté Washington. **[APPRÉCIATION]** Ces textes ciblent le modèle publicitaire/revente ; ChampionTrackPro ne vend ni ne monétise. Mais si un client se trouve à Washington, la question sera posée. À signaler au conseil, pas à traiter en priorité.

## 2.3 Lois d'État sur la vie privée

**État du droit au 15/08/2026 :** vingt États ont une loi de confidentialité générale en vigueur, l'Indiana, le Kentucky et le Rhode Island ayant rejoint le 1er janvier 2026. **[WEB]** ([MultiState, *20 State Privacy Laws in Effect in 2026*](https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026))

**Trois filtres font qu'elles mordent peu :**

1. **Exemption FERPA quasi universelle.** Toutes ces lois excluent les données déjà régies par FERPA. Si la donnée est un education record, la loi d'État se retire.
2. **Exemption des établissements d'enseignement supérieur.** Le Connecticut, l'Indiana et le Kentucky exemptent explicitement les *institutions of higher education*. **[WEB]** Le Colorado, le New Jersey et le Maryland n'ont pas d'exemption non-profit large : dans ces États, une université privée pourrait être couverte pour ses traitements non-FERPA. **[WEB]**
3. **Statut de sous-traitant (*processor*).** ChampionTrackPro agit pour le compte de l'université, sur ses instructions. Les obligations lourdes (avis, opt-out, évaluations d'impact) pèsent sur le *controller*, c'est-à-dire l'université. Les obligations du *processor* sont contractuelles : contrat écrit, assistance aux demandes de droits, sécurité, sous-traitants ultérieurs, suppression en fin de contrat. **[APPRÉCIATION]**

**Ce qui s'applique donc réellement :** la nécessité d'un **contrat de sous-traitance écrit** (le DPA du fichier 13), qui est de toute façon exigé par FERPA. Une seule obligation à traiter en propre, indépendamment de tout : **la notification de violation de données**. Les 50 États en ont une, avec des délais compris entre 30 et 60 jours ; la Californie est passée à un délai fixe de 30 jours calendaires au 1er janvier 2026 (SB 446). **[WEB]** ([Privacy Rights Clearinghouse, *50-State Survey 2026*](https://privacyrights.org/resources-tools/reports/data-breach-notification-laws-50-state-survey-2026-edition)) En pratique, le vendeur notifie l'université qui notifie les personnes — d'où l'obligation contractuelle du DPA de prévenir l'université **sans délai injustifié et en tout état de cause sous 72 heures**, pour lui laisser sa marge.

## 2.4 Athlètes mineurs — un faux problème et un vrai

**Le faux problème : COPPA.** COPPA vise les moins de 13 ans. Aucun athlète NCAA n'est concerné. Hors sujet. **[APPRÉCIATION]**

**Le vrai point, contre-intuitif : sous FERPA, un athlète de 17 ans inscrit à l'université est déjà un *eligible student*.** Les droits FERPA sont transférés des parents à l'étudiant dès qu'il atteint 18 ans **ou dès qu'il s'inscrit dans un établissement post-secondaire, à n'importe quel âge**. **[WEB]** ([U.S. Dept. of Education, *Eligible Student*](https://studentprivacy.ed.gov/content/eligible-student)) Autrement dit, un freshman de 17 ans exerce lui-même ses droits FERPA ; il n'y a **pas** de consentement parental à recueillir au titre de FERPA.

**Ce qui reste à traiter quand même :**

- **Capacité contractuelle.** Un mineur de 17 ans ne peut pas valablement s'engager par des CGU dans la plupart des États. **[APPRÉCIATION]** D'où la structure retenue au fichier 13 : le contrat est **entre ChampionTrackPro et l'université**, jamais entre ChampionTrackPro et l'athlète. L'athlète ne voit qu'un *avis* (notice) et un accusé de réception, pas un contrat. C'est le montage le plus sûr et il est déjà cohérent avec le modèle commercial.
- **Lois d'État sur les mineurs.** Plusieurs lois d'État imposent un opt-in pour le traitement des données sensibles d'un mineur de moins de 16 ou 18 ans. Elles cèdent généralement devant l'exemption FERPA. **[APPRÉCIATION]** À faire confirmer par l'avocat, dossier à faible probabilité.
- **Sport de division inférieure / camps / lycéens.** Si le produit sort un jour du cadre NCAA vers du lycée (K-12), le régime change complètement : FERPA avec parents comme titulaires des droits, plus les lois d'État student-privacy type SOPIPA (Californie), plus des interdictions de profilage. **Ne pas vendre à un lycée sans reprendre toute l'analyse.** **[APPRÉCIATION]**
- **Le produit ne connaît pas l'âge.** `memberships.birth_year` existe mais n'est jamais alimentée. **[CODE]** Conséquence : Gabin ne peut pas aujourd'hui savoir s'il a un mineur dans la base. **[APPRÉCIATION]** Ce n'est pas un problème tant que le montage contractuel passe par l'université — mais c'est un problème si on ajoute un jour une fonctionnalité qui dépend de l'âge. Recommandation : **ne pas collecter la date de naissance**, et supprimer `birth_year` de `v_ai_dataset` (voir doc 14, mesure P2-3).

## 2.5 Le transfert transatlantique — le sujet que l'université ne posera pas, et que le fisc européen posera

C'est le point où le dossier de Gabin est le plus faible et le moins visible.

**Le RGPD s'applique, et il s'applique par l'établissement, pas par les personnes.** L'article 3(1) du RGPD déclenche l'application dès lors que le traitement est effectué « dans le cadre des activités d'un établissement d'un responsable de traitement sur le territoire de l'Union », **indépendamment du lieu du traitement et de la localisation des personnes concernées**. **[WEB]** ([EDPB, *Guidelines 3/2018 on territorial scope*](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf))

**[APPRÉCIATION] Conséquence : Gabin, établi en France, traitant des données d'athlètes américains sur des serveurs américains, est dans le champ du RGPD.** C'est contre-intuitif — l'intuition commune est « données US, personnes US, pas de RGPD » — et c'est faux. Le RGPD suit le responsable, pas les personnes.

Ce que cela implique concrètement, dans l'ordre de coût croissant :

| Obligation RGPD | Applicable ici ? | Coût |
|---|---|---|
| Registre des traitements (art. 30) | Oui. Une PME de moins de 250 salariés en est dispensée **sauf** si le traitement porte sur des données sensibles ou n'est pas occasionnel — ce qui est le cas. | Faible : un tableau. Le §1.2 ci-dessus en est déjà l'ossature. |
| Base légale | À définir. **[APPRÉCIATION]** Si Gabin est **sous-traitant** de l'université, il n'a pas à définir la base légale — c'est le rôle du responsable. Or l'université américaine n'est pas soumise au RGPD et n'en définira jamais. Position pragmatique : se qualifier de **sous-traitant** au contrat, documenter l'intérêt légitime en interne. À faire trancher par un conseil français. |
| Transfert hors UE (chapitre V) | **Non, en réalité.** Le chapitre V encadre les transferts *depuis* l'UE. Ici les données sont collectées aux États-Unis, par des personnes aux États-Unis, stockées aux États-Unis. Il n'y a pas de transfert sortant à encadrer. **[APPRÉCIATION]** Le sujet ne surgit que si Gabin, depuis la France, exporte des données pour les traiter localement (export CSV, analyse sur son poste). |
| Statut du *Data Privacy Framework* | Contexte à connaître : la décision d'adéquation UE-US reste valide ; le recours Latombe a été rejeté par le Tribunal le 3 septembre 2025 et est frappé d'appel devant la CJUE (aff. C-703/25 P), pendant à ce jour. **[WEB]** ([IAPP, *EU-US DPF guidance*](https://iapp.org/resources/article/eu-us-data-privacy-framework-guidance-and-resources)) Ce n'est pas un sujet bloquant pour ChampionTrackPro tant qu'aucun flux ne part de l'UE. |
| Données sensibles (art. 9) | **Sujet réel.** `friction_type = "Mental / Emotional"`, `worry_level` : sous RGPD, ce sont des données concernant la santé. L'art. 9 les interdit sauf exception, dont le consentement explicite. **[APPRÉCIATION]** C'est un argument supplémentaire — et sans doute le plus fort — pour recueillir de l'athlète un **consentement explicite et actif** plutôt qu'une simple notice, alors même que FERPA ne l'exige pas. |

**[APPRÉCIATION] Traduction pour la décision de Gabin :** le volet européen ne bloquera pas une signature. Il ne se manifestera que lors d'un contrôle CNIL, d'une plainte, ou d'une due diligence d'investisseur. Coût de la mise à niveau minimale (registre + mention dans la privacy policy + consentement explicite au lieu de la notice) : quelques heures. À faire maintenant parce que c'est bon marché, pas parce que c'est urgent.

## 2.6 NCAA — la nouveauté de décembre 2025, à connaître absolument

**Le fait :** le *Committee on Competitive Safeguards and Medical Aspects of Sports* (CSMAS) de la NCAA a approuvé en décembre 2025 une **guidance sur l'usage responsable des « performance technologies »**, issue d'un processus Delphi après le Summit du Sport Science Institute de mai 2025. **[WEB]** ([NCAA.org, *Performance technology guidance approved by CSMAS*](https://www.ncaa.org/news/2025/12/11/media-center-performance-technology-guidance-approved-by-csmas.aspx))

**Le périmètre couvre explicitement ChampionTrackPro :** la définition retenue englobe non seulement les wearables, mais aussi « *cameras, sensors, **surveys**, software, and **mobile apps** that monitor performance indirectly* ». **[WEB]** Un auto-questionnaire quotidien dans une PWA est exactement cela.

**Ce que la guidance demande à l'école :** établir un **plan écrit** couvrant (a) l'éducation des groupes concernés, (b) la gestion et la protection des données des étudiants-athlètes, (c) les décisions d'achat et de déploiement de nouvelles technologies, (d) l'amélioration continue. **[WEB]**

**[APPRÉCIATION] C'est la meilleure nouvelle de cet audit, et il faut la jouer offensivement.** Ce n'est pas une contrainte réglementaire — la guidance est recommandatoire et non contraignante ([analyse académique](https://moritzlaw.osu.edu/sites/default/files/2025-10/Samantha%20Peacock%20Blog%201.pdf)). C'est une **checklist que chaque département athlétique va devoir remplir en 2026**. Un vendeur qui arrive avec le plan écrit déjà rédigé — cartographie des données, contrôle d'accès, rétention, suppression, protocole d'incident — ne fait pas passer une revue de sécurité : il fait gagner du temps à son client. **Recommandation : produire un one-pager « NCAA CSMAS Performance Technology Plan — vendor section », dérivé des fichiers 12/13/14, et l'envoyer en pièce jointe du discovery call.** Impact commercial supérieur à tout le reste de ce document.

---

# 3. ANALYSE D'ÉCART — ce que l'app fait vs. ce qu'elle devrait faire

## 3.1 Chiffrement

| | Aujourd'hui | Cible | Écart |
|---|---|---|---|
| **En transit, navigateur → Supabase** | TLS imposé, HSTS `max-age=31536000; includeSubDomains; preload` (`vercel.json:16`) **[CODE]** | idem | **Aucun. Conforme.** |
| **En transit, edge function → Anthropic** | HTTPS (`llm.ts:12`) **[CODE]** | idem | Aucun. |
| **Au repos, Postgres** | AES-256 côté Supabase/AWS **[WEB]** ([Supabase Security](https://supabase.com/security)) | idem | **Aucun au niveau disque.** |
| **Chiffrement applicatif des colonnes sensibles** | **Absent.** `responses.friction_type`, `worry_level` sont en clair dans la table. | Chiffrement colonne (pgsodium/Vault) pour le champ mental | **[APPRÉCIATION] Écart assumable.** Le chiffrement colonne casserait le moteur de calcul et n'apporte rien contre le risque réel (compromission d'un compte staff, pas vol de disque). Ne pas dépenser là. |
| **Secrets** | `ANTHROPIC_API_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` en secrets Supabase, hors dépôt (doc 08 §15) ; `.gitignore` couvre `.env*` **[CODE]** | + rotation documentée | Écart : **aucune politique ni trace de rotation**. |

## 3.2 Journalisation des accès — l'écart le plus lourd

**Aujourd'hui : rien.** Les 18 tables ne comportent aucune table d'audit ; aucun trigger ne journalise les `SELECT` ; aucun code applicatif n'enregistre une consultation. **[CODE]**

Conséquence en clair : **si un coach consulte le dossier de bien-être d'un athlète à 2 h du matin, ou si un compte staff est compromis et aspire la table `responses`, il n'existe aucune trace exploitable.** Gabin serait incapable, en cas d'incident, de dire à l'université *qui* a vu *quoi* et *quand* — c'est-à-dire incapable de dimensionner la notification de violation, donc contraint de notifier au pire (tous les athlètes, toutes les données).

Le fichier `FERPA_COMPLIANCE.md` antérieur affirmait « *Audit trail available via Firebase console logs* ». **[CODE]** Les logs de la console cloud tracent les requêtes d'infrastructure, pas la sémantique métier « le coach X a ouvert la fiche de l'athlète Y ». **[APPRÉCIATION]** L'affirmation ne tiendra pas trente secondes face à un RSSI universitaire.

**Cible minimale :** une table `access_log` alimentée par la couche `ctpApi` sur chaque lecture nominative (fiche joueur, roster, export), conservée 12 mois, consultable par l'admin de l'équipe. Implémentation détaillée en doc 14, mesure **P1-4**.

## 3.3 Durée de conservation, droit de suppression, portabilité

| Exigence | Aujourd'hui | Écart |
|---|---|---|
| **Durée de conservation définie** | **Aucune.** Aucun TTL, aucun cron de purge, aucune politique écrite. Tout est conservé indéfiniment. **[CODE]** | **Critique.** C'est la première question d'un DPA universitaire : « combien de temps gardez-vous nos données et que se passe-t-il à la fin du contrat ? » Sans réponse, pas de signature. |
| **Suppression d'un athlète** | `ctpApi.removeMember` (`ctpApi.ts:289-294`) **supprime uniquement la ligne `memberships`**. Les `responses`, `daily_metrics`, `flags` subsistent — et **restent lisibles par le staff**, puisque la policy `responses_staff_read` porte sur `team_id`, pas sur l'appartenance actuelle. **[CODE]** | **Critique et trompeur.** « Retirer un athlète » dans l'UI ne retire rien. Un athlète qui quitte l'équipe voit ses données de bien-être rester accessibles au staff indéfiniment. Un athlète transféré vers une autre université laisse tout derrière lui. |
| **Suppression complète d'un compte** | Aucune fonction. Une suppression de `auth.users` déclencherait bien les `on delete cascade` du schéma, mais aucune UI ni edge function ne l'expose. **[CODE]** | **Critique.** La version LIVE avait au moins `anonymizePlayerDataForAI` sur suppression Firebase (`functions/index.js:1402-1542`) ; **la V2 a perdu cette capacité**. Régression. |
| **Suppression d'une équipe / fin de contrat** | Aucune procédure. Le `on delete cascade` sur `teams` existe mais rien ne l'expose ni ne le documente. **[CODE]** | **Critique.** Un DPA exige une clause « retour ou destruction des données sous X jours après résiliation, avec attestation ». Impossible à honorer aujourd'hui. |
| **Portabilité / export** | Aucun export. Aucune fonction ne produit un fichier des données d'un athlète. **[CODE]** | Élevé. Un athlète FERPA a le droit d'inspecter ses dossiers ; l'université doit pouvoir répondre en 45 jours (34 CFR § 99.10). **[WEB]** Sans export, chaque demande devient une requête SQL manuelle de Gabin. |
| **Rectification** | Partielle : `updateMyProfile` permet de corriger nom, maillot, poste. Aucun moyen de corriger ou retirer une réponse au questionnaire. **[CODE]** | Moyen. **[APPRÉCIATION]** Défendable : une auto-déclaration horodatée n'est pas « inexacte », c'est un fait historique. À expliciter dans la notice plutôt qu'à implémenter. |

## 3.4 Pseudonymisation — solide côté LLM, décorative côté base

**Le bon côté, et il est vraiment bon.** J'ai relu ligne à ligne le payload envoyé à Anthropic (`morning-brief/index.ts:30-39`). **[CODE]** Il contient : `ref` (le pseudonyme `P-01`), `readiness`, `baseline`, `deviation_pct`, `zone`, `acwr`, `data_days`, et pour chaque flag la règle et sa recommandation. **Il ne contient ni nom, ni email, ni `user_id`, ni `team_id`, ni nom d'équipe, ni date de naissance, ni le détail des réponses au questionnaire, ni `friction_type`, ni `worry_level`.** C'est une conception défensive bien exécutée, plus rigoureuse que ce que font la plupart des SaaS sportifs. **[APPRÉCIATION]** À mettre en avant commercialement : *« the AI never sees a name. »*

**Le mauvais côté : la pseudonymisation ne protège rien à l'intérieur du produit.**

1. `memberships_team_read` (`002_rls.sql:52`) autorise **tout membre de l'équipe** à lire la table `memberships` complète — donc la correspondance `pseudonym` ↔ `user_id` pour tous ses coéquipiers. **[CODE]** La table de correspondance est publique à l'équipe.
2. Les écrans coach (`CoachTeamScreen`, `AthleteDetailScreen`) affichent de toute façon **nom réel + readiness + historique**. C'est le produit. La pseudonymisation ne concerne donc que le trajet vers le LLM, ce qui est le bon choix — mais il ne faut pas la présenter comme une protection générale.
3. `v_ai_dataset` (`003_engine.sql:112-120`) expose `pseudonym` + `position` + `birth_year` + série temporelle. **[APPRÉCIATION]** Dans une équipe de 15 joueurs, poste + année de naissance + courbe de readiness = ré-identification triviale. Cette vue ne doit **jamais** sortir du périmètre du client sans une agrégation supplémentaire, et si un jour un dataset multi-clients est constitué, il faudra un vrai travail d'anonymisation (k-anonymat) et une clause explicite dans le DPA. **Aujourd'hui la vue est verrouillée au `service_role`** (`005_security_views.sql:9`) — c'est correct. **[CODE]**
4. Le pseudonyme est généré par comptage des membres (`join-team/index.ts:45-47`). **[CODE]** Après un `removeMember`, le compteur redescend : **deux athlètes différents peuvent recevoir le même `P-0x` à des périodes différentes**, ce qui corrompt l'historique et les briefs. Bug fonctionnel avec conséquence de traçabilité.

## 3.5 Contrôle d'accès — la faille structurante

**Ce qui est bon.** La RLS est activée sur toutes les tables, l'isolation multi-tenant repose sur `my_teams()`, `rules` et `llm_logs` sont fermées aux clients, les vues du moteur sont en `security_invoker` avec `revoke`, et la fenêtre d'écriture du check-in est bornée à `[end_utc, end_utc + 5h]` (`002_rls.sql:63-71`). **[CODE]** C'est un travail sérieux, nettement au-dessus de la moyenne des MVP.

**Ce qui l'annule en pratique — le rôle est auto-déclaré.** Chaîne vérifiée de bout en bout **[CODE]** :

```
StitchCreateAccountScreen.js:59-63   supaJoinTeam(code, role.toLowerCase()==="coach" ? "coach":"athlete", ...)
        ↓  le "role" vient d'un bouton de l'interface (l'utilisateur choisit ATHLETE ou COACH)
src/lib/ctpApi.ts:45-61              body: JSON.stringify({ invite_code, role, display_name })
        ↓
supabase/functions/join-team/index.ts:27,31
        const { invite_code, role, display_name } = await req.json();
        const memberRole = role === "coach" ? "coach" : "athlete";
        ↓  aucune vérification : le rôle du corps de requête est écrit tel quel dans memberships
```

Et sur le chemin Firebase (l'ancienne version), le rôle était au contraire **résolu côté serveur** par la Cloud Function `lookupTeamByCode` à partir du code saisi (`StitchCreateAccountScreen.js:85-99`, commentaire explicite ligne 108 : « *Le rôle vient du code Firestore qui a matché, pas du bouton UI* »). **La V2 a supprimé ce contrôle.** **[CODE]** C'est une régression de sécurité introduite par la migration.

**Trois facteurs aggravants :**

- **un seul code d'invitation par équipe** (`teams.invite_code`), partagé par tous, sans expiration ni révocation ; il est lisible par tout membre via `getMyMembership` (`ctpApi.ts:25`) **[CODE]** ;
- **la confirmation d'email est désactivée** dans Supabase Auth (doc 08 §9) **[CODE]** : on peut s'inscrire avec n'importe quelle adresse, y compris celle de quelqu'un d'autre, sans la contrôler ;
- **mot de passe minimum 6 caractères**, contrôlé uniquement côté client (`StitchCreateAccountScreen.js:39-42`) **[CODE]**, et **aucun MFA** nulle part.

**Scénario concret :** un athlète transmet le code d'équipe à un ami extérieur — ou un joueur adverse le récupère dans un vestiaire, ou une capture d'écran circule. La personne s'inscrit en trente secondes avec une adresse jetable, coche « COACH », et obtient immédiatement en lecture, via `responses_staff_read` et `metrics_staff_read`, **les réponses de bien-être nominatives de toute l'équipe : douleurs, stress académique, état mental, `worry_level`, avec les noms réels.** Aucune trace, puisqu'il n'y a pas de journal d'accès (§3.2).

**[APPRÉCIATION] C'est le risque numéro un du produit, et de loin.** Il ne s'agit pas d'une faiblesse théorique : l'exploitation ne demande aucune compétence technique, seulement la connaissance d'un code que tous les athlètes possèdent. Correctif en doc 14, mesure **P0-1**.

**Deux autres écarts de moindre gravité, mais réels :**

- **`create-team` a une porte de service** : `isAdmin = (memberships.length > 0) || (teamCount === 0)` (`create-team/index.ts:48`). **[CODE]** Tant qu'aucune équipe n'existe, tout utilisateur authentifié peut créer une équipe et s'auto-attribuer `admin`. Faible probabilité en production, à retirer par principe. *(Note hors sujet conformité : cette fonction insère `org_id` alors que la colonne du schéma est `organization_id` (`001_schema.sql:19`) — elle est probablement cassée.)*
- **`eval_rule`** exécute `condition_sql` via `execute format()` en `security definer` (`003_engine.sql:124-133`). **[CODE]** C'est une exécution SQL arbitraire par conception, correctement enfermée derrière un accès `service_role` à la table `rules`. Impact nul aujourd'hui, mais cela signifie que **la compromission de la clé service_role équivaut à un accès superutilisateur à la base.** À prendre en compte dans la politique de rotation des secrets (doc 14, P1-6).

## 3.6 Sous-traitants

| Sous-traitant | Rôle réel (vérifié) | Ce qui est en place | Écart |
|---|---|---|---|
| **Supabase** (AWS us-east) | base Postgres, Auth, edge functions — **stocke 100 % des données athlètes** | SOC 2 Type 2 et HIPAA (avec BAA à partir du plan Team) ; AES-256 au repos ; DPA disponible **[WEB]** ([Supabase, *SOC2 & HIPAA*](https://supabase.com/blog/supabase-soc2-hipaa)) | **DPA à signer et à archiver. [NON VÉRIFIÉ]** Plan actuel inconnu — à confirmer : le rapport SOC 2 n'est accessible qu'à partir du plan Team. C'est le seul document que réclamera une revue universitaire. |
| **Vercel** | build + hébergement statique + CDN. **Ne reçoit aucune donnée athlète** : le bundle appelle Supabase directement depuis le navigateur. Logs d'accès HTTP (IP, user-agent, URL). | headers de sécurité corrects (`vercel.json`) | Faible. DPA Vercel à signer. **[APPRÉCIATION]** À qualifier honnêtement de « hosting/CDN, no application data » dans la liste des sous-traitants — c'est une réponse qui rassure. |
| **Anthropic** | narration du brief quotidien. Reçoit **des dérivés pseudonymisés uniquement** (§3.4). | Appel API standard (`llm.ts:11-27`) | **Écart de déclaration, important.** Le commentaire en tête de `llm.ts:3` affirme « *API zéro-rétention* ». Or, sans accord ZDR négocié, Anthropic supprime les entrées/sorties API sous **30 jours**, avec des exceptions (contenu signalé en trust & safety conservé jusqu'à 2 ans). **[WEB]** ([Anthropic, *API and data retention*](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)) Anthropic ne s'entraîne pas sur les données des produits commerciaux **[WEB]** — ce point-là est exact. **Deux actions : soit demander un accord ZDR, soit corriger le commentaire.** Répéter à un coach une affirmation « zéro rétention » non fondée serait une déclaration inexacte dans une relation contractuelle. |
| **Firebase / Google Cloud** | **encore actif** : `functions/index.js`, FCM, Firestore de la version LIVE (doc 08 §14) **[CODE]** | — | **À décommissionner ou à déclarer.** Sous-traitant non documenté détenant potentiellement une copie des données. |

## 3.7 Notification de violation

Aucune procédure écrite, aucun contact désigné, aucun délai contractuel, aucun canal. **[CODE]** L'adresse `ferpa@championtrackpro.com` figurant dans le document antérieur est marquée « *(to be configured)* » — **elle n'existe pas.** **[CODE]** Fournir dans un document de conformité une adresse inexistante est un risque en soi. Correctif : fichier 13, section 6 (procédure une page) et création effective de la boîte.

## 3.8 Sauvegardes

**[NON VÉRIFIÉ]** Rien dans le dépôt. Supabase fournit des sauvegardes quotidiennes ; le *Point-in-Time Recovery* est une option payante. Aucun test de restauration n'est documenté. Une sauvegarde jamais restaurée n'est pas une sauvegarde. Doc 14, mesure P2-5.

## 3.9 Divers, vérifié dans le code

- **CSP avec `unsafe-inline` et `unsafe-eval`** dans `script-src` (`vercel.json:17`). **[CODE]** Contrainte du bundle Expo web, mais cela affaiblit la défense contre le XSS — or le JWT Supabase est en `localStorage` par défaut, donc un XSS = vol de session d'un compte coach = accès complet aux données de l'équipe. **[APPRÉCIATION]** Combiné à §3.5, c'est le second vecteur d'exfiltration.
- **Emails écrits dans la console navigateur** : `StitchNavigator.js:309, 479, 519` loggent `user.email` et le rôle. **[CODE]** Faible gravité (console client) mais à supprimer en production : c'est le genre de détail qu'un pentester d'université relève.
- **`teams.ics_url` renvoyée à tout membre** via l'embed de `getMyMembership` (`ctpApi.ts:25`). **[CODE]** Une URL ICS privée est une capacité au porteur sur le calendrier complet du staff. À retirer de la projection athlète.
- **`coach_feedback.note`** : texte libre, non filtré, non journalisé. Vecteur d'introduction de PII et de contenu potentiellement diffamatoire dans un dossier soumis au droit d'accès de l'étudiant. **[APPRÉCIATION]**

---

# 4. RISQUES CLASSÉS

Cotation : **Gravité** = ampleur du dommage si l'événement survient. **Probabilité** = à 12 mois avec 1 à 5 équipes clientes.

---

### R-01 — Escalade de privilège par auto-déclaration du rôle
**Gravité : critique · Probabilité : moyenne à élevée · Exposition : procès + fin de contrat**

**Scénario.** Le code d'équipe circule (il est par construction connu de tous les athlètes et affiché dans leur propre profil). Une personne extérieure s'inscrit avec une adresse jetable — sans vérification d'email — coche « COACH », et lit instantanément les réponses nominatives de toute l'équipe : douleurs, stress académique, état mental, `worry_level`. Elle exporte, elle publie ou elle fait chanter. Aucune trace n'existe.

**Pourquoi c'est le pire.** L'université découvre que ses *education records* ont été divulgués par défaut de conception du fournisseur. Elle est tenue de notifier ses étudiants. Elle résilie, exige une indemnisation, et le raconte à ses homologues de conférence — un marché de coachs NCAA se parle beaucoup. La responsabilité contractuelle est directe : la faille est dans le code, pas dans l'usage.

**Base :** **[CODE]** `StitchCreateAccountScreen.js:59-63` → `ctpApi.ts:45-61` → `join-team/index.ts:27,31`. Aggravé par la confirmation d'email désactivée (doc 08 §9).

**Correctif :** doc 14, **P0-1** (code coach distinct, non exposé aux athlètes ; rôle résolu côté serveur par le code, jamais par le client). **Bloquant absolu avant le premier client.**

---

### R-02 — Impossibilité de supprimer les données d'un athlète ou d'une équipe
**Gravité : critique · Probabilité : certaine · Exposition : blocage à la signature, puis rupture de contrat**

**Scénario A, commercial (certain, immédiat).** Le juriste de l'université lit le projet de contrat et demande : « à la fin du contrat, sous quel délai nos données sont-elles détruites, et comment nous l'attestez-vous ? » Il n'existe aucune procédure. La signature s'arrête là.

**Scénario B, opérationnel (probable).** Un athlète quitte le programme, se blesse gravement, ou est en conflit avec le staff. Il demande le retrait de ses données. Le coach clique « remove » dans l'admin ; la ligne `memberships` disparaît ; **ses réponses restent lisibles par le staff** (`responses_staff_read` porte sur `team_id`). L'athlète découvre que ses réponses sur son état mental restent visibles par le coach avec qui il est en conflit.

**Base :** **[CODE]** `ctpApi.ts:289-294` ; policy `002_rls.sql:74` ; aucune fonction de suppression complète dans tout le dépôt. Régression par rapport à `functions/index.js:1402-1542` (version LIVE).

**Correctif :** doc 14, **P0-2** (RPC `purge_athlete` et `purge_team` en service-role, avec journal de purge et attestation). **Bloquant avant le premier client.**

---

### R-03 — Aucune traçabilité des accès
**Gravité : élevée · Probabilité : élevée (l'incident, lui, est incertain ; l'incapacité à répondre est certaine) · Exposition : notification de violation maximale, perte de confiance**

**Scénario.** Un incident survient — mot de passe de coach réutilisé et compromis, ou R-01 exploité. Question de l'université : « quelles données ont été consultées, et pour quels étudiants ? » Réponse actuelle : inconnu. Sans périmètre, il faut notifier **tous** les athlètes pour **toutes** les données, dans les délais de l'État (30 jours en Californie depuis SB 446 **[WEB]**). Un incident mineur devient une notification maximale, avec le coût de réputation correspondant.

**Base :** **[CODE]** aucune table d'audit dans les 18 tables ; aucun trigger ; aucun log applicatif.

**Correctif :** doc 14, **P1-4**. **[APPRÉCIATION]** Non bloquant pour un pilote gratuit ; bloquant pour tout contrat payant.

---

### R-04 — Le signal de détresse sans protocole
**Gravité : très élevée (le seul risque comportant un scénario humain irréversible) · Probabilité : faible · Exposition : responsabilité civile, réputation**

**Scénario.** Un athlète répond pendant plusieurs semaines `friction_type = "Mental / Emotional"` avec `worry_level` à 90. Le champ est stocké, `worry_flag` passe à `true` — et **rien ne se passe** : aucune règle n'est activée (`rules.enabled = false` partout, doc 08 §13.4), le brief LLM ne mentionne pas le sujet, personne n'est alerté. Si un drame survient, la famille et l'avocat découvrent que le produit **avait la donnée**, l'avait horodatée, et n'a rien fait.

**[APPRÉCIATION]** Juridiquement, le devoir de vigilance appartient à l'université, pas au fournisseur. Mais collecter un indicateur de détresse crée une attente implicite. Deux voies possibles, et il faut en choisir une explicitement :

- **soit** on assume : les CGU disent en toutes lettres que le produit n'est pas un outil de santé mentale, ne détecte pas la crise, ne remplace aucun protocole, et l'établissement s'engage par contrat à disposer de son propre dispositif ; l'athlète voit un rappel des ressources de son école dans l'écran de check-in ;
- **soit** on retire les champs `Mental / Emotional` et `worry_level` du questionnaire.

**Recommandation : la première voie.** La donnée a une vraie valeur produit et le désaveu contractuel est simple à rédiger. Mais **il faut le décider maintenant**, pas après. Rédaction proposée : fichier 13, ToS §7 et Athlete Notice.

---

### R-05 — Déclaration inexacte sur la rétention Anthropic
**Gravité : moyenne à élevée · Probabilité : moyenne · Exposition : *misrepresentation* contractuelle**

**Scénario.** Gabin, en discovery call, répète ce que dit son propre code : « l'API est en zéro rétention ». Le RSSI le note au dossier. Six mois plus tard, un audit établit qu'aucun accord ZDR n'existe et que la rétention par défaut est de 30 jours **[WEB]**. Ce n'est plus un écart technique, c'est une fausse déclaration ayant déterminé le consentement du client.

**Base :** **[CODE]** `_shared/llm.ts:3` ; **[WEB]** [Anthropic, API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

**Correctif :** demander un accord ZDR à Anthropic, **ou** corriger le commentaire et écrire dans la Privacy Policy la vérité : *pseudonymized derived metrics only, 30-day provider retention, no training on customer data*. Coût : une heure. **Bloquant avant le premier client, parce que c'est de la parole donnée.**

---

### R-06 — Vol de session par XSS
**Gravité : élevée · Probabilité : faible · Exposition : identique à R-01**

**Scénario.** Une dépendance npm compromise, ou un titre de séance ICS malicieux mal échappé, injecte du script. La CSP autorise `unsafe-inline` et `unsafe-eval` (`vercel.json:17`) **[CODE]**. Le JWT Supabase, en `localStorage`, part vers un serveur tiers. Un compte coach volé = toutes les données de l'équipe, sans MFA pour arrêter l'attaquant et sans journal pour le détecter.

**Correctif :** doc 14, **P1-5** (durcissement CSP autant que le bundle Expo l'autorise), **P1-2** (MFA staff), **P1-3** (expiration de session).

---

### R-07 — Ré-identification depuis le dataset dérivé
**Gravité : moyenne · Probabilité : faible aujourd'hui, élevée le jour d'un dataset multi-clients · Exposition : contractuelle (usage secondaire non autorisé)**

**Scénario.** `v_ai_dataset` (pseudonyme + poste + année de naissance + série readiness) est exporté pour entraîner un modèle, ou montré à un investisseur. Dans une équipe de quinze joueurs, poste + année suffisent à identifier. L'usage secondaire n'est autorisé par aucun contrat.

**Base :** **[CODE]** `003_engine.sql:112-120`. Atténué aujourd'hui par le verrou `service_role` (`005_security_views.sql:9`).

**Correctif :** retirer `birth_year` de la vue ; interdire tout usage secondaire par défaut au DPA, avec opt-in écrit de l'établissement pour la recherche agrégée.

---

### R-08 — Double pile Firebase / Supabase
**Gravité : moyenne · Probabilité : moyenne · Exposition : questionnaire de sécurité, périmètre de violation**

Deux copies des données athlètes dans deux clouds, dont une sous un modèle de sécurité non audité dans ce document. **[CODE]** Toute question « listez les systèmes qui stockent nos données » devient embarrassante, et tout incident chez l'un élargit le périmètre.

**Correctif :** décommissionner Firestore et attester la purge, ou le déclarer dans la liste des sous-traitants.

---

### R-09 — Fuite d'`ics_url` et de `invite_code`
**Gravité : faible à moyenne · Probabilité : élevée · Exposition : gêne opérationnelle**

`getMyMembership` renvoie à **tout membre**, athlètes compris, `ics_url` et `invite_code` de l'équipe (`ctpApi.ts:25`). **[CODE]** L'URL ICS est une capacité au porteur sur le calendrier complet du staff ; le code d'invitation est le vecteur de R-01. Correctif trivial : restreindre la projection selon le rôle.

---

### R-10 — RGPD côté français
**Gravité : faible à moyenne · Probabilité : faible · Exposition : CNIL, due diligence investisseur**

Aucun registre de traitement, aucune base légale documentée, données de santé au sens de l'art. 9 traitées sans consentement explicite. **[APPRÉCIATION]** Se manifestera lors d'une levée de fonds ou d'une plainte, pas devant un coach. Coût de mise à niveau : quelques heures. À traiter parce que c'est bon marché.

---

# 5. CE QUI DEVIENT OBLIGATOIRE, ET QUAND

**[APPRÉCIATION]** Le tableau suivant est un jugement professionnel calibré sur ce que demandent réellement les services achats et sécurité de l'enseignement supérieur américain. Il est fait pour décider où mettre l'argent, dans l'ordre.

| Déclencheur | Ce qui devient obligatoire | Coût / délai réaliste | Pourquoi ce déclencheur |
|---|---|---|---|
| **Aujourd'hui — avant tout premier utilisateur réel, même gratuit** | Correctifs **P0-1** (rôle serveur) et **P0-2** (suppression) ; Privacy Policy + Athlete Notice en ligne ; correction de la déclaration Anthropic ; création de `privacy@championtrackpro.com` | 2 à 4 jours de dev + 0 € | En dessous de ce seuil, une seule fuite tue l'entreprise. Ce n'est pas de la conformité, c'est de la survie. |
| **Premier pilote gratuit, une équipe, coach volontaire, D2/D3/NAIA** | Un **Pilot Agreement d'une page** signé par le coach ou l'AD : finalité, périmètre, durée, suppression en fin de pilote, contact incident. Athlete Notice affichée dans l'app. | 1 jour + relecture avocat US (1 500-3 000 $, mutualisée avec l'étape suivante) | Un pilote sans écrit n'est pas un pilote, c'est une exposition. Une page suffit ; un coach signe une page. |
| **Premier contrat payant, quelle que soit la division** | **DPA / Student Data Addendum signé** (fichier 13) ; liste des sous-traitants ; politique de rétention écrite ; procédure d'incident ; désignation *School Official* obtenue par écrit de l'établissement ; **DPA Supabase et Vercel signés côté Gabin** | 3 000-6 000 $ de relecture avocat US, une fois | Dès qu'il y a facture, il y a bon de commande, donc revue juridique. Le DPA est le document qui décide de la signature. Sans lui, le juriste dit non par défaut. |
| **Premier athlète mineur identifié** | **[APPRÉCIATION] Rien de nouveau au titre de FERPA** — un mineur inscrit en post-secondaire est déjà *eligible student* **[WEB]**. Ce qu'il faut : que le contrat lie l'université et non l'athlète (déjà le cas), et que l'Athlete Notice reste lisible par un lecteur de 17 ans. | 0 € | Le déclencheur souvent cité n'en est pas un ici. À ne pas surinvestir. |
| **Passage à un contrat institutionnel** — signé par le *procurement office* et non par le coach ; typiquement un département athlétique entier, une D1, ou tout achat au-delà de 10 000-25 000 $ | **HECVAT** (Lite d'abord, Full ensuite) ; assurance **Cyber + E&O** 1 à 2 M$ ; W-9/EIN et entité de facturation US ; VPAT si l'établissement est sensible à l'accessibilité ; politique de sécurité écrite | HECVAT Lite : 3 à 5 jours de rédaction. Assurance : 1 500-4 000 $/an. Entité US : 1 000-3 000 $ + comptable. | Le HECVAT n'est imposé par aucune loi, mais c'est le format standard de la revue fournisseur en enseignement supérieur, et la plupart des grandes universités le demandent même à un fournisseur déjà certifié SOC 2. **[WEB]** ([Isora GRC, *HECVAT vs SOC 2 (2026)*](https://www.saltycloud.com/blog/hecvat-vs-soc-2/)) |
| **Première D1 Power 4, ou 3-5 clients institutionnels, ou premier vrai appel d'offres** | **SOC 2 Type II** (Type I d'abord) ; MFA généralisé ; pentest annuel ; DPO ou responsable sécurité désigné ; plan de continuité | SOC 2 Type I : 15-25 k$. Type II : 30-60 k$ + 6 à 12 mois d'observation. Pentest : 5-15 k$. | À ce niveau, l'absence de SOC 2 fait éliminer le dossier avant la démonstration produit. **Ne pas y aller avant :** dépenser 40 k$ en SOC 2 sans client payant est la meilleure façon de mourir conforme. **[APPRÉCIATION]** |
| **Ajout de wearables, de capteurs, de HR/GPS, ou usage par le staff médical** | Réanalyse complète : BAA HIPAA, lois d'État sur la biométrie (BIPA Illinois et son droit d'action privé), guidance NCAA CSMAS dans son volet wearables **[WEB]** | Élevé, à réévaluer | Le produit sort alors de la zone confortable de l'auto-déclaration. C'est un autre métier juridique. |
| **Marché européen, ou levée de fonds** | Registre art. 30, base légale documentée, DPO à évaluer, éventuellement représentant | Faible en interne, à valider par un conseil français | Se déclenche à la due diligence, pas au commercial. |

**[APPRÉCIATION] La ligne à retenir.** Un coach de D2 ou D3 signe un pilote sur la confiance et une page de contrat. Un directeur athlétique de D1 signe sur un HECVAT. Un service achats d'une grande université signe sur un SOC 2. **Vendre au premier permet de financer le troisième — l'inverse est impossible.** L'ordre des dépenses est donc dicté par la taille du premier client visé, pas par un idéal de conformité.

---

# 6. SOURCES

**Sources web consultées le 15 août 2026**

- [CRS — *The Family Educational Rights and Privacy Act (FERPA) and Its Exceptions*](https://www.congress.gov/crs-product/IF13155)
- [U.S. Department of Education — *Protecting Student Privacy, FAQ*](https://studentprivacy.ed.gov/frequently-asked-questions)
- [U.S. Department of Education — *Eligible Student*](https://studentprivacy.ed.gov/content/eligible-student)
- [U.S. Department of Education — *FERPA Protections for Student Health Records*](https://studentprivacy.ed.gov/sites/default/files/resource_document/file/Know%20Your%20Rights_FERPA%20Protections%20for%20Student%20Health%20Records.pdf)
- [HHS — *FERPA and HIPAA*](https://www.hhs.gov/hipaa/for-professionals/faq/ferpa-and-hipaa/index.html)
- [NCAA.org — *Performance technology guidance approved by CSMAS* (11 décembre 2025)](https://www.ncaa.org/news/2025/12/11/media-center-performance-technology-guidance-approved-by-csmas.aspx)
- [NCAA.org — *Performance Technologies Guidelines*](https://www.ncaa.org/what-we-do/health-safety-and-performance/performance-technologies-guidelines/)
- [Moritz College of Law — *Data Privacy Concerns Associated with College Athletes' Use of Technology*](https://moritzlaw.osu.edu/sites/default/files/2025-10/Samantha%20Peacock%20Blog%201.pdf)
- [MultiState — *All of the Comprehensive Privacy Laws That Take Effect in 2026*](https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026)
- [Privacy Rights Clearinghouse — *Data Breach Notification Laws: A 50-State Survey (2026)*](https://privacyrights.org/resources-tools/reports/data-breach-notification-laws-50-state-survey-2026-edition)
- [EDPB — *Guidelines 3/2018 on the territorial scope of the GDPR*](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf)
- [IAPP — *EU-US Data Privacy Framework: Guidance and Resources*](https://iapp.org/resources/article/eu-us-data-privacy-framework-guidance-and-resources)
- [Anthropic — *API and data retention*](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- [Anthropic Privacy Center — *Zero data retention agreements*](https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to)
- [Supabase — *SOC 2 Type 2 and HIPAA compliance*](https://supabase.com/blog/supabase-soc2-hipaa)
- [Supabase — *Security*](https://supabase.com/security)
- [Isora GRC — *HECVAT vs SOC 2, Complete Guide 2026*](https://www.saltycloud.com/blog/hecvat-vs-soc-2/)

**Fichiers du dépôt lus intégralement**

`docs/08_CARTOGRAPHIE_TECHNIQUE.md` · `supabase/migrations/001_schema.sql` · `002_rls.sql` · `005_security_views.sql` · `006_seed_initial.sql` · `009_push_notifications.sql` · `010_admin_health_read.sql` · `003_engine.sql` (extraits vues et `eval_rule`) · `supabase/functions/_shared/llm.ts` · `supabase/functions/morning-brief/index.ts` · `supabase/functions/join-team/index.ts` · `supabase/functions/create-team/index.ts` · `supabase/functions/notify/index.ts` · `src/lib/ctpApi.ts` · `src/screens/OnboardingNotifScreen.tsx` · `screens/StitchCreateAccountScreen.js` (extraits) · `screens/StitchQuestionnaireScreen.js` (extraits) · `vercel.json` · `.gitignore` · `../ChampionTrackPro-LIVE/FERPA_COMPLIANCE.md`

---

## Documents liés

- `13_DOCUMENTS_JURIDIQUES.md` — brouillons ToS, Privacy Policy, Athlete Notice, DPA, sous-traitants, procédure d'incident.
- `14_DURCISSEMENT_SECURITE.md` — plan technique priorisé, fichier par fichier, SQL et code.
