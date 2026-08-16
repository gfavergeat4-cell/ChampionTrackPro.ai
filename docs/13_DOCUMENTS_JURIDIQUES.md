# 13 — DOCUMENTS JURIDIQUES (BROUILLONS) · ChampionTrackPro

---

# ⚠️ AVERTISSEMENT / WARNING

> **FR — À LIRE AVANT TOUT USAGE.**
> Les textes de ce fichier sont des **brouillons de travail**, rédigés par un agent d'ingénierie de conformité qui **n'est pas avocat** et n'est habilité à exercer le droit dans aucune juridiction. Ils sont destinés à **faire gagner du temps et de l'argent à un conseil qualifié en droit américain** (FERPA / student data privacy / SaaS), et pour le volet européen à un conseil français — pas à le remplacer.
> **Aucun de ces textes ne doit être publié, envoyé à un prospect, joint à un contrat ou signé avant relecture et validation par un avocat américain.**
> Les crochets `[…]` signalent une information à compléter par Gabin. Les blocs `>> DRAFTING NOTE` s'adressent à l'avocat relecteur et **doivent être supprimés** des versions publiées.
> Base factuelle : `docs/12_CONFORMITE_US.md` (audit du 15 août 2026), lui-même fondé sur une lecture directe du code.

> **EN — READ BEFORE ANY USE.**
> The documents below are **working drafts** prepared by a compliance-engineering agent that is **not a lawyer** and is not licensed to practice law in any jurisdiction. They exist to reduce the time and cost of review by qualified U.S. counsel — not to replace it.
> **None of these documents may be published, sent to a prospect, attached to a contract, or signed before review and approval by U.S. counsel.**
> Bracketed items `[…]` require input from the company. `>> DRAFTING NOTE` blocks are addressed to reviewing counsel and **must be deleted** from any published version.

---

## Sommaire

| § | Document | Destinataire | Statut |
|---|---|---|---|
| 1 | Terms of Service | Institution + utilisateurs | Brouillon |
| 2 | Privacy Policy | Public (site + app) | Brouillon |
| 3 | Athlete Consent / Notice | Athlète, à l'inscription | Brouillon — remplace le texte actuel |
| 4 | Data Processing & Student Data Addendum | Annexe au contrat d'équipe | Brouillon |
| 5 | Subprocessor List | Public, annexe au DPA | Brouillon, factuel |
| 6 | Incident Response Procedure | Interne + annexe au DPA | Brouillon, une page |
| 7 | Pilot Agreement (une page) | Coach / AD, pilote gratuit | Brouillon |

**Éléments à créer avant toute publication :** boîte `privacy@championtrackpro.com` (l'adresse `ferpa@championtrackpro.com` citée dans l'ancien document FERPA n'existe pas), entité juridique et adresse postale, nom du responsable désigné.

---
---

# 1. TERMS OF SERVICE

**Draft v0.1 — not legally reviewed. Do not publish.**

**ChampionTrackPro — Terms of Service**
Last updated: [DATE] · Effective: [DATE]

## 1. Who these terms are between

These Terms of Service ("Terms") govern access to and use of the ChampionTrackPro platform ("Service"), operated by [LEGAL ENTITY NAME], [legal form], registered at [ADDRESS], [COUNTRY] ("ChampionTrackPro", "we", "us").

The Service is licensed to educational institutions, athletic departments, and sports organizations ("Institution", "you"). Individual users — coaches, staff, and student-athletes — access the Service **under and through their Institution's agreement**. Individual users do not enter into a separate commercial agreement with us and are not asked to accept payment or license obligations.

>> DRAFTING NOTE (delete before publication): this structure is deliberate. A material share of NCAA first-year athletes are 17 and lack capacity to contract in most U.S. states. Placing the commercial contract exclusively at the institution level avoids relying on a minor's assent. See `docs/12_CONFORMITE_US.md` §2.4. Please confirm this holds in the target states.

## 2. What the Service is

ChampionTrackPro is a **self-reported readiness monitoring tool**. Student-athletes answer a short questionnaire after training sessions. The Service computes statistical derivatives from those answers (a readiness score, a personal 28-day baseline, deviation from that baseline, and a zone classification), applies interpretation rules configured by the Institution or by ChampionTrackPro, and presents a daily summary to authorized coaching staff.

The Service collects **only self-reported subjective ratings**. It does not use wearables, biometric sensors, heart-rate monitors, GPS, cameras, microphones, or location data.

## 3. What the Service is NOT

**This section is material. Please read it.**

The Service is **not** a medical device, a diagnostic tool, a clinical decision support system, a mental-health service, a crisis-detection system, or a return-to-play authority.

- The Service **does not diagnose** injury, illness, concussion, overtraining, depression, anxiety, or any other condition.
- The Service **does not recommend** whether an athlete should train, play, rest, or be withheld from competition. Those decisions belong exclusively to qualified humans employed by or engaged by the Institution.
- The Service **does not monitor for emergencies** and **does not alert anyone in real time**. It produces one scheduled summary per day. Nothing in the Service should be relied upon to detect a health emergency, a mental-health crisis, or a risk of self-harm.
- Outputs, including any text generated by an artificial-intelligence narration layer, are **descriptive summaries of numbers the athlete reported about themselves**. They are not clinical findings.

**The Institution is solely responsible** for maintaining its own medical, athletic-training, mental-health, and emergency protocols, and for ensuring that qualified personnel — not this Service — make all health and participation decisions. The Institution agrees that it will not use the Service as its sole or primary means of identifying an athlete in distress.

>> DRAFTING NOTE: this section addresses risk R-04 in the compliance analysis. The product collects a self-reported psychological worry rating (`worry_level`, 1-100) and a friction category that includes "Mental / Emotional". That data is stored but currently triggers no alert of any kind. Counsel should confirm this disclaimer plus the corresponding institutional undertaking in the DPA (§4.9) is sufficient, and whether any state imposes a duty that cannot be contractually allocated.

## 4. Accounts, roles, and access

4.1 The Service uses three roles: **athlete**, **coach**, and **admin**. Coach and admin roles carry access to other individuals' data and may only be granted through a staff-specific invitation code issued to the Institution's designated administrator. The Institution must not distribute staff invitation codes to athletes or to anyone outside authorized staff.

4.2 The Institution designates in writing the individuals authorized to hold coach or admin roles, and must notify us **within five (5) business days** when such an individual leaves the program or changes role, so access can be revoked.

4.3 Accounts are personal. Credentials must not be shared. The Institution is responsible for use of the Service through its users' accounts.

4.4 We may suspend an account immediately where we reasonably believe it is being used to access data the user is not authorized to see.

>> DRAFTING NOTE: §4.1 describes the intended state, not the current state. As of this draft, role is self-declared by the client at signup (`join-team/index.ts:31`) and a single shared team code exists. **These Terms must not be published until fix P0-1 in `docs/14_DURCISSEMENT_SECURITE.md` is deployed**, or §4.1 becomes a false statement of fact.

## 5. Institution responsibilities

The Institution represents and undertakes that it will:

(a) determine the lawful basis for collecting athlete data and provide any notice required by its own policies and applicable law;
(b) where it relies on the FERPA "school official" exception (34 CFR § 99.31(a)(1)), **designate ChampionTrackPro as a school official with a legitimate educational interest in its annual FERPA notification**, and confirm that designation in writing;
(c) limit access to athlete data to staff with a legitimate educational interest;
(d) maintain its own health, safety, and emergency protocols as described in §3;
(e) not use the Service to make eligibility, scholarship, disciplinary, roster, or employment decisions about an individual athlete based solely on Service outputs;
(f) not upload or enter into free-text fields any medical diagnosis, treatment record, protected health information, academic record, government identifier, or financial information.

>> DRAFTING NOTE: (e) protects athletes from adverse use and protects us from being pulled into a scholarship or eligibility dispute as a fact witness. (f) is directed at `coach_feedback.note`, the only free-text field a staff member can write to.

## 6. Our responsibilities

We will: (a) process athlete data solely to provide the Service and as instructed by the Institution; (b) not sell athlete data, and not use it for advertising, profiling for third parties, or any purpose unrelated to the Service; (c) not use identifiable athlete data to train machine-learning models without the Institution's separate written opt-in; (d) maintain the security measures described in the Data Processing Addendum; (e) notify the Institution of a Security Incident as set out in that Addendum; (f) return or delete athlete data on termination as set out in that Addendum.

## 7. Artificial intelligence

The Service uses a third-party large language model (Anthropic) to convert already-computed numbers into readable prose. **The model receives pseudonymized derived metrics only** — a coded athlete reference (e.g. "P-01"), scores, baselines, deviations, zones, and triggered-rule text. It does not receive names, email addresses, dates of birth, account identifiers, institution names, or raw questionnaire answers.

The model does not compute scores, generate diagnoses, or make recommendations; it narrates. It is instructed never to state that an athlete should or should not participate.

AI-generated text may contain errors. It must be read alongside the underlying numbers, which are always displayed.

>> DRAFTING NOTE: the pseudonymization claim is verified in code (`morning-brief/index.ts:30-39`). The retention claim below must be aligned with reality before publication — see Privacy Policy §6 and risk R-05.

## 8. Fees, term, and termination

8.1 Fees, term, and renewal are set out in the applicable Order Form or Pilot Agreement.
8.2 Either party may terminate for material breach not cured within thirty (30) days of written notice.
8.3 The Institution may terminate immediately if we materially breach the Data Processing Addendum.
8.4 On termination, data is handled as set out in the Data Processing Addendum §7.

## 8bis. Fulfillment, cancellation, and refunds

>> DRAFTING NOTE — Required by payment processors (Stripe, Paddle) before an account is approved. The commercial terms marked 🔶 are the founder's decision, not legal boilerplate.

**8bis.1 What is delivered.** The Service is software delivered over the internet. There are no physical goods, and nothing is shipped.

**8bis.2 When it is delivered.** Access is provisioned within **two (2) business days** of the later of: (a) receipt of payment or a signed purchase order, and (b) receipt of the information we need to configure the team — team name, staff contact, and training calendar. 🔶

**8bis.3 What a subscription includes.** For the subscription term: unlimited athlete and staff accounts within the contracted team, daily check-in collection, the coaching dashboard, daily briefs, email support with a two-business-day response target, and all updates released during the term. 🔶

**8bis.4 Term.** Subscriptions run for the term stated on the Order Form or Pilot Agreement — typically one competitive season. Unless stated otherwise, subscriptions **do not auto-renew**. 🔶

**8bis.5 Cancellation.** The Institution may cancel at any time by written notice to billing@championtrackpro.com. Cancellation stops the next renewal; it does not by itself trigger a refund of the current term, except as set out in 8bis.6.

**8bis.6 Refunds.** 🔶
- **First fourteen (14) days of an initial subscription:** full refund on request, no reason required.
- **After fourteen (14) days:** fees are non-refundable, except where we fail to provide the Service and do not remedy that failure within thirty (30) days of written notice — in which case unused fees are refunded pro rata from the date of notice.
- Refunds are issued to the original payment method within ten (10) business days of approval.

**8bis.7 Service availability.** We target 99 % monthly availability, excluding scheduled maintenance announced at least 48 hours in advance and failures of third-party infrastructure providers listed in the Subprocessor List. This is a target, not a contractual service level, unless an SLA is attached to the Order Form.

**8bis.8 Prices, currency, and taxes.** Prices are quoted in **U.S. dollars** and are exclusive of any sales, use, VAT, or similar taxes. Where such taxes apply, they are added at invoicing. Institutions claiming tax exemption must provide a valid exemption certificate before invoicing. 🔶

**8bis.9 Payment processing.** Card payments are processed by a third-party payment processor. We do not receive, store, or process full card numbers. The processor's own terms apply to the payment transaction.

**8bis.10 Chargebacks.** If a chargeback is raised without first contacting us under 8bis.5, we may suspend access until the dispute is resolved.

## 9. Warranties and disclaimers

The Service is provided "as is". To the maximum extent permitted by law, we disclaim all implied warranties, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted or error-free, or that its outputs will be accurate predictors of any athlete's performance, health, or injury risk.

## 10. Limitation of liability

Neither party will be liable for indirect, incidental, special, consequential, or punitive damages. Each party's aggregate liability arising out of or relating to this agreement will not exceed [the greater of (i) the fees paid or payable in the twelve (12) months preceding the claim, or (ii) USD [AMOUNT]].

**Exclusions from the cap.** The cap does not apply to: (a) our breach of confidentiality or data-protection obligations; (b) our indemnification obligations under §11; (c) either party's gross negligence or willful misconduct.

>> DRAFTING NOTE — commercially significant. Institutional counsel will almost always insist on carving data-breach liability out of the cap, and will often demand a "super-cap" (e.g. 2-3× fees) or uncapped liability for a breach caused by the vendor. Please advise the client on where to concede and where to hold, and how this interacts with the cyber insurance requirement (see `docs/12` §5). This clause and the DPA are the two the client should be prepared to actually negotiate.

## 11. Indemnification

We will defend and indemnify the Institution against third-party claims arising from (a) our infringement of intellectual property rights, and (b) our breach of the Data Processing Addendum resulting in unauthorized disclosure of athlete data caused by our act or omission.

The Institution will defend and indemnify us against third-party claims arising from (a) its use of Service outputs to make health, participation, eligibility, or employment decisions, and (b) its failure to provide notice or obtain any consent required by its own policies or applicable law.

## 12. Governing law and disputes

[TO BE DETERMINED WITH COUNSEL — e.g. [State], U.S.A., exclusive jurisdiction in [venue].]

>> DRAFTING NOTE: the vendor is French; customers are U.S. public and private universities. Public institutions are frequently prohibited by state law from agreeing to out-of-state or foreign governing law and from indemnifying vendors. Counsel should propose (i) a default clause and (ii) a pre-approved fallback for public institutions, so the client is not renegotiating from scratch with every state school.

## 13. Changes

Material changes to these Terms will be notified at least thirty (30) days in advance to the Institution's designated contact.

## 14. Contact

[LEGAL ENTITY] · [ADDRESS] · legal@championtrackpro.com · privacy@championtrackpro.com

---
---

# 2. PRIVACY POLICY

**Draft v0.1 — not legally reviewed. Do not publish.**

**ChampionTrackPro — Privacy Policy**
Last updated: [DATE]

## 1. Who we are and what this covers

ChampionTrackPro is operated by [LEGAL ENTITY NAME], based in [COUNTRY]. This policy explains what we collect, why, who can see it, how long we keep it, and what rights you have.

**Our role.** When we handle student-athlete data, we act as a **service provider to the athlete's institution**. The institution decides what is collected and who may see it. We process that data on the institution's instructions and for no other purpose. Where a U.S. institution relies on the FERPA "school official" exception, we operate under the institution's direct control with respect to the use and maintenance of education records.

## 2. What we collect

**Account information**
- Name, email address, and password (stored only as a cryptographic hash).
- Team, role (athlete / coach / admin), and, if provided, jersey number and playing position.
- A coded athlete reference (for example "P-01") used so that our AI narration layer never sees a real name.

**Daily check-in answers** — the core of the Service. After a session, athletes move sliders from 1 to 100 to rate:
- energy level, breathing/conditioning load from the previous day, leg freshness, coordination and shooting feel, mental sharpness, and connection to the team;
- whether anything is currently limiting their performance, and if so its category (physical soreness, academic or life stress, on-court confusion, or mental/emotional), and how much it is on their mind (1-100).

**Calculated values** — a readiness score, a personal 28-day rolling baseline, deviation from that baseline, a zone classification, and any flags raised by interpretation rules.

**Schedule information** — training and game sessions imported from a calendar (ICS) URL provided by the coaching staff.

**Technical information** — notification subscription identifiers if notifications are enabled; standard server and hosting logs (IP address, browser type, timestamps) generated by our hosting providers.

## 3. What we deliberately do NOT collect

We want this to be unambiguous. We do **not** collect:

- grades, GPA, transcripts, or any academic record;
- medical diagnoses, treatment records, injury reports, prescriptions, or anything from a clinician;
- Social Security numbers, student ID numbers, or government identifiers;
- financial or payment information from athletes;
- biometric identifiers — no heart rate, no sleep tracking, no GPS, no fingerprints, no facial recognition, no wearable data of any kind;
- location data, camera access, microphone access, or contacts;
- data from other apps, advertising identifiers, or cross-site tracking.

We do not use cookies for advertising and we do not run third-party advertising or analytics trackers in the athlete-facing application.

>> DRAFTING NOTE: every line above was verified against the database schema and the frontend. If the product later adds wearables, this section and the entire compliance analysis must be redone (see `docs/12` §5).

## 4. Why we process this data

Solely to provide the Service to the institution: to compute readiness metrics against an athlete's own history, to produce a daily staff summary, to send session reminders, to operate and secure the platform, and to comply with law.

We do **not** use athlete data for advertising, and we do **not** sell it. We do not "share" or "sell" personal information as those terms are defined under U.S. state privacy laws.

## 5. Who can see what

| Who | Can see |
|---|---|
| **The athlete** | Their own answers, their own scores and history. Nothing about teammates. |
| **Coaching staff of the athlete's team** | Their team's roster, and each athlete's answers, scores, history, and flags — identified by name. Nothing from any other team or institution. |
| **Team administrator** | The above, plus team settings and system-health information (costs, delivery status). |
| **ChampionTrackPro personnel** | Access is limited to named personnel, restricted to what is necessary to operate and support the Service, and logged. |
| **Our subprocessors** | Only as described in §7, under contract, and only to provide infrastructure. |
| **Anyone else** | No one. We do not disclose athlete data to third parties except as required by law, and we will notify the institution of any legally compelled disclosure unless prohibited from doing so. |

**Athletes should understand clearly:** answers about soreness, stress, and mental or emotional state are **visible to the coaching staff, identified by name**. This tool is not anonymous and is not confidential from the coaching staff.

## 6. Artificial intelligence

We use Anthropic's Claude API to turn already-computed numbers into a readable daily summary for staff.

**What the model receives:** a coded athlete reference (e.g. "P-01"), the readiness score, the 28-day baseline, the deviation, the zone, the number of days of data behind the baseline, and the text of any triggered rule.

**What the model does not receive:** names, email addresses, dates of birth, account identifiers, team or institution names, or raw questionnaire answers.

**Retention by the AI provider:** [OPTION A — if no ZDR agreement is in place] *Anthropic deletes API inputs and outputs from its systems within 30 days, other than limited exceptions such as content flagged under its usage policies. Anthropic does not use commercial API data to train its models.* [OPTION B — only if a Zero Data Retention agreement has been signed and can be evidenced] *We operate under a Zero Data Retention agreement with Anthropic: prompts and outputs from our API traffic are not retained after processing, subject to that agreement's exceptions.*

We do not use identifiable athlete data to train any machine-learning model.

>> DRAFTING NOTE — MUST BE RESOLVED BEFORE PUBLICATION. The codebase currently carries a comment asserting "zero-retention API" (`supabase/functions/_shared/llm.ts:3`) that is **not supported** by any agreement known to us. Anthropic's published default is 30-day retention. Gabin must either (i) obtain and evidence a ZDR agreement and select Option B, or (ii) select Option A and correct the code comment. Repeating an unverified zero-retention claim to a customer is a misrepresentation risk. See risk R-05.

## 7. Where data is stored and who else touches it

Data is stored in the **United States (US East)** on infrastructure operated by Supabase (on Amazon Web Services). The application front end is delivered by Vercel. AI narration is processed by Anthropic in the United States. Full details in the Subprocessor List (§5 of `13_DOCUMENTS_JURIDIQUES.md`, published at [URL]).

Our company is established in [COUNTRY, EU]. Personnel there may access data remotely for support and operations, under the same restrictions.

## 8. How long we keep data

| Category | Retention |
|---|---|
| Check-in answers and derived metrics | For the duration of the institution's subscription, then deleted per §9 |
| Account and profile data | For the duration of the account, then deleted per §9 |
| Daily briefs and their input payloads | [24] months, then deleted |
| Access and security logs | [12] months |
| Operational logs (AI cost, delivery status) | [12] months |
| Backups | Deleted on the provider's rolling backup cycle, no later than [30] days after deletion from production |

**On termination**, we delete or return all athlete data within **thirty (30) days** of the institution's written request, and provide written confirmation. See the Data Processing Addendum §7.

>> DRAFTING NOTE: these periods are proposals, not current behaviour. As of this draft the platform has **no retention policy and no deletion mechanism** (see `docs/12` §3.3, risk R-02). This section must not be published until fix P0-2 in `docs/14` is deployed. Publishing a retention policy you cannot execute is worse than publishing none.

## 9. Your rights

Which rights apply depends on where you live and, for student-athletes, on whether your data is held by your institution as an education record. Where a right applies, we honour it — regardless of whether we are strictly required to.

**9.1 How to exercise any right.** Email privacy@championtrackpro.com from the address on your account, or ask your institution to contact us on your behalf. We respond within thirty (30) days. We may ask you to confirm your identity — we will not ask for more information than necessary to do so.

**9.2 If you are in the European Economic Area or the United Kingdom (GDPR / UK GDPR).**
- **Legal bases.** We process athlete responses on the basis of the contract with your institution (Art. 6(1)(b)) and our legitimate interest in operating the Service (Art. 6(1)(f)). Where responses touch on health, your institution is responsible for establishing the appropriate condition under Art. 9.
- **Your rights:** access, rectification, erasure, restriction of processing, data portability, objection, and the right not to be subject to a decision based solely on automated processing. **The Service produces no automated decisions** — every decision is taken by a human member of your coaching staff.
- **Transfers.** Data is stored in the United States. Transfers rely on the European Commission's Standard Contractual Clauses, available on request.
- **Complaints.** You may lodge a complaint with your national supervisory authority. In France, that is the CNIL.

**9.3 If you are a California resident (CCPA, as amended by the CPRA).**
- **We do not sell your personal information, and we do not share it for cross-context behavioural advertising.** We never have.
- **Categories collected:** identifiers (name, email), professional or education-related information (team, jersey number, position), and self-reported information about how you felt after training. See §2 for the full list, and §3 for what we deliberately do not collect.
- **Sources:** you, and your institution.
- **Purposes:** operating the Service for your coaching staff. See §4.
- **Disclosure:** to the service providers listed in the Subprocessor List, under contract, for no purpose other than providing the Service.
- **Retention:** see §8.
- **Your rights:** to know, to delete, to correct, to limit the use of sensitive personal information, and to be free from discrimination for exercising any of them. Exercising a right will never affect your standing on the team — and any attempt to make it do so should be reported to your institution.
- **Authorised agents** may act for you with written permission.
- **Possible exemption.** Where your data is held by your institution as an education record under FERPA, the CCPA may not apply to it. We do not rely on that exemption to refuse a request: we treat requests on their merits.

**9.4 If you are elsewhere in the United States.** Several states have adopted comparable privacy laws. We apply the rights described in 9.3 to all users, wherever they live, rather than maintaining a different standard per state.

## 10. Security

We maintain: encryption in transit (TLS) and at rest (AES-256); database-level row isolation so no team can read another team's data; role-based access control; restricted administrative access; and secrets held outside source control. A fuller description is in the Data Processing Addendum §5.

No system is perfectly secure. If a security incident affects your data, we will notify your institution as described in §6 of the Incident Response Procedure, and your institution will notify you as required by law.

## 11. Children

The Service is not directed to children under 13 and we do not knowingly collect data from them. It is intended for enrolled student-athletes at postsecondary institutions.

## 12. Changes

We will post changes here with a new "last updated" date, and notify institutions of material changes at least thirty (30) days in advance.

## 13. Contact

privacy@championtrackpro.com · [LEGAL ENTITY], [ADDRESS]
Data protection contact: [NAME / ROLE]

---
---

# 3. ATHLETE CONSENT / NOTICE

**Draft v0.1 — not legally reviewed.**

## 3.1 Context — what exists today

The application currently shows athletes exactly one sentence, on the push-notification onboarding screen (`src/screens/OnboardingNotifScreen.tsx:273-275`), rendered in 11px type at 25% opacity:

> *"Your data is used solely for performance tracking by your coaching staff. You may request deletion at any time. FERPA rights apply."*

**Assessment.** The content is honest and the intent is right. Three problems: it is placed on a notifications screen rather than at account creation; it is styled to be unreadable; and "FERPA rights apply" tells an athlete nothing actionable. Most importantly, it **does not say the one thing that matters** — that the coaching staff sees the answers about pain, stress, and mental state, by name.

## 3.2 Proposed replacement — full screen, shown once at signup, before the first check-in

Requires an explicit tap to continue. Body text minimum 14px at full contrast. Acceptance timestamp and version recorded.

---

### **Before you start — how your answers are used**

**What you'll do.** After each session you'll answer about 60 seconds of questions about how you feel — energy, legs, focus, and whether anything is bothering you.

**Who sees your answers.** **Your coaching staff sees your answers, with your name on them.** That includes what you say about soreness, stress, and how you're feeling mentally. This is not anonymous and it is not private from your coaches. If that changes what you want to write, that's your call to make — but make it knowing this.

**Who does NOT see your answers.**
- Your teammates never see your answers.
- No other team and no other school ever sees them.
- Our AI writes the daily summary using a code (like "P-01") instead of your name. **The AI never sees who you are.**
- We never sell your data. We never use it for advertising.

**What we don't collect.** No grades. No medical records. No heart rate, sleep tracking, GPS, or wearables. No location. No camera or microphone. Only what you type in yourself.

**What this is not.** This is a training tool, not a health service. It doesn't diagnose anything and it doesn't decide whether you play. **It does not alert anyone in real time.** If you are struggling — with an injury, with stress, or with your mental health — please talk to your athletic trainer, your team physician, or your school's counseling services. **[SCHOOL CRISIS / COUNSELING CONTACT]**

**Your rights.** You can ask to see everything we hold about you, ask us to correct it, or ask us to delete it. Contact your athletics compliance office or email us at privacy@championtrackpro.com. As an enrolled college student you hold these rights yourself, whatever your age.

**Honest answers only help you if they're honest.** The system compares you to *your own* baseline, not to your teammates. Inflating your numbers just moves your baseline.

[ ] **I've read this and I understand my coaching staff will see my answers.**

**[ I understand — continue ]**   ·   [Read the full Privacy Policy]

---

>> DRAFTING NOTE (a): calling this "consent" is legally imprecise under a FERPA school-official model, where the institution's authority — not the athlete's consent — is the basis for staff access. It is nonetheless the right product decision: an athlete who discovers after the fact that a coach reads their mental-state ratings is a reputational and litigation event regardless of what the law required. Counsel should advise whether to label this "Notice and Acknowledgement" (safer — avoids implying the institution needs consent it does not need) or "Consent" (stronger for the Article 9 GDPR position described in `docs/12` §2.5). Recommendation: **"Notice and Acknowledgement" in the U.S.-facing product, with the acknowledgement timestamp and version stored** — it gives the evidentiary benefit without the legal mischaracterization.
>> DRAFTING NOTE (b): the crisis-resources line must be populated per institution during onboarding. Shipping it blank is worse than omitting it.
>> DRAFTING NOTE (c): store `notice_version` and `accepted_at` per user. Without them, there is no proof any athlete was ever told. See `docs/14`, measure P1-7.

## 3.3 Short in-app reminder (footer of the check-in screen, every time)

> *Your coaching staff sees these answers. Not a medical or crisis service — if you need help now, contact [SCHOOL RESOURCE].*

---
---

# 4. DATA PROCESSING & STUDENT DATA ADDENDUM

**Draft v0.1 — not legally reviewed. Do not sign.**

**DATA PROCESSING AND STUDENT DATA ADDENDUM**
to the ChampionTrackPro Services Agreement between [INSTITUTION] ("Institution") and [LEGAL ENTITY] ("Provider")
Effective: [DATE]

## 1. Definitions

**"Athlete Data"** — all data relating to an identified or identifiable student-athlete that Provider processes under the Agreement, including check-in responses, derived metrics, flags, briefs, account and roster information.

**"Education Records"** — as defined at 34 CFR § 99.3.

**"Security Incident"** — any confirmed unauthorized access to, acquisition of, disclosure of, alteration of, or loss of Athlete Data in Provider's custody.

**"Subprocessor"** — a third party engaged by Provider that processes Athlete Data.

## 2. Roles

2.1 Institution is the party that determines the purposes and means of processing Athlete Data. Provider processes Athlete Data **solely on Institution's documented instructions**, which consist of the Agreement, this Addendum, and Institution's configuration of the Service.

2.2 **School Official designation.** Institution designates Provider as a **school official with a legitimate educational interest** in Athlete Data under 34 CFR § 99.31(a)(1)(i)(B). Provider acknowledges that it:
(a) performs an institutional service that Institution would otherwise perform using its own employees;
(b) is **under the direct control of Institution** with respect to the use and maintenance of Education Records;
(c) will use Athlete Data only for the authorized purpose and **will not redisclose it** to any third party except as permitted by § 99.33(a) and this Addendum;
(d) will comply with Institution's instructions regarding access, correction, retention, and deletion.

2.3 **Ownership.** Athlete Data is and remains the property of Institution and the individual athletes. Provider obtains no ownership interest and no license beyond that necessary to perform the Service.

>> DRAFTING NOTE: 2.2 is the operative clause of this entire document. It is the paragraph a university's general counsel reads first. The obligation to actually designate Provider in the institution's annual FERPA notification sits with the institution — Provider cannot self-designate. Counsel should consider adding a Provider representation that it will not claim school-official status with respect to any institution that has not executed this Addendum.

## 3. Permitted and prohibited processing

3.1 Provider will process Athlete Data only to: deliver the Service; provide support at Institution's request; maintain security, availability, and integrity; and comply with law.

3.2 Provider will **not**: sell Athlete Data; use it for advertising, marketing, or profiling for any third party; use it to train, fine-tune, or evaluate machine-learning models except as permitted by 3.3; disclose it to any third party other than Subprocessors listed in Exhibit A; or use it to build a product or dataset for any party other than Institution.

3.3 **Research and product improvement.** Provider may use Athlete Data in **aggregated and de-identified form** for service improvement and research **only where Institution has given separate, specific, written opt-in**. De-identification must be sufficient that no individual can reasonably be re-identified, including by combining playing position, age, team size, and time series. Provider will not attempt re-identification and will contractually bind any recipient not to do so.

3.4 **AI processing.** Provider transmits to its AI Subprocessor **only pseudonymized derived metrics**: a coded athlete reference, readiness score, baseline, deviation, zone, data-days count, and triggered-rule text. Provider will **not** transmit names, email addresses, dates of birth, account identifiers, institution or team names, or raw questionnaire responses. Provider's AI Subprocessor does not use Provider's data to train models. AI provider retention is described in Exhibit A.

>> DRAFTING NOTE: 3.3 is the clause that protects the athlete against the most likely commercial temptation — building a cross-institution dataset. The re-identification standard is drafted deliberately tightly because `v_ai_dataset` currently exposes pseudonym + position + birth year + time series, which is re-identifiable within a 15-person roster (risk R-07).

## 4. Confidentiality and personnel

4.1 Provider limits access to Athlete Data to personnel who need it to perform the Service, who are bound by written confidentiality obligations surviving termination.
4.2 Provider maintains a current list of personnel with production data access and provides it on request.
4.3 Provider trains personnel with access on their obligations under this Addendum and FERPA at least annually.

## 5. Security measures

Provider maintains, at minimum:

| Domain | Measure |
|---|---|
| Encryption in transit | TLS for all connections; HSTS enforced |
| Encryption at rest | AES-256 |
| Tenant isolation | Database-level row isolation; no team can query another team's data |
| Access control | Role-based; staff roles issued only through a staff-specific code controlled by Institution's administrator |
| Authentication | Minimum [12]-character passwords; **multi-factor authentication required for all coach and admin accounts**; session expiry after [12] hours of inactivity |
| Access logging | All access to identified athlete records is logged with actor, subject, action, and timestamp; logs retained [12] months and available to Institution on request |
| Secrets management | Credentials stored outside source control; rotated at least annually and immediately on personnel departure |
| Backups | Automated daily backups; restore tested at least [annually] with documented results |
| Vulnerability management | Dependency scanning; security patches applied within [30] days of availability, or [7] days for critical severity |
| Subprocessor assurance | Infrastructure subprocessors maintain SOC 2 Type II or equivalent |

>> DRAFTING NOTE — CRITICAL. Of the twelve rows above, the following are **not yet true** as of this draft: staff-specific role codes, MFA, session expiry, access logging, documented secret rotation, tested restores. See `docs/12` §3 and the fix plan in `docs/14`. **Signing this Addendum before those are implemented is a knowing false representation in a contract.** Either implement first, or strike the untrue rows and add them as a dated remediation commitment in an exhibit. The second option is honest and, in the client's experience, generally accepted by institutional counsel — an itemized roadmap reads better than silence.

## 6. Security Incidents

6.1 Provider notifies Institution's designated contact of a Security Incident **without undue delay and no later than seventy-two (72) hours** after confirming it.
6.2 Notification includes, to the extent known: nature of the incident, categories and approximate number of athletes and records affected, likely consequences, measures taken and proposed, and a contact point. Provider supplements as information develops.
6.3 Provider cooperates with Institution's investigation and with any notification Institution must make under state breach-notification law, and bears reasonable costs of notification where the incident results from Provider's act or omission.
6.4 Provider does not notify affected individuals or any regulator about an incident affecting Athlete Data without Institution's prior written approval, except where independently required by law.
6.5 Provider's Incident Response Procedure is attached as Exhibit B.

## 7. Retention, return, and deletion

7.1 Provider retains Athlete Data only as long as necessary for the purposes of the Agreement, per the schedule in Exhibit C.
7.2 **Individual deletion.** On Institution's instruction, Provider deletes all data relating to a named athlete — responses, derived metrics, flags, profile, and account — within **thirty (30) days**, and confirms in writing. Where an athlete has left the program, Institution may instruct deletion or retention; absent instruction, Provider deletes [twelve (12)] months after the athlete's last activity.
7.3 **Termination.** On expiry or termination, Provider, at Institution's election, returns Athlete Data in a machine-readable format and/or deletes it, in either case within **thirty (30) days** of the request, and provides **written certification of deletion**.
7.4 **Backups.** Data in backups is deleted on the rolling backup cycle, no later than [thirty (30)] days after deletion from production. Backup copies remain subject to this Addendum until deleted.
7.5 Provider may retain data where required by law, for the minimum period required, subject to continuing protection.

>> DRAFTING NOTE: §7 is the second clause institutional counsel reads. As of this draft **no deletion mechanism exists** — removing an athlete deletes only the membership row and leaves responses readable by staff (risk R-02). Do not sign this until fix P0-2 ships.

## 8. Athlete rights

8.1 Provider assists Institution in responding to athlete requests for access, correction, deletion, and portability, without additional charge, within **thirty (30) days** of Institution's request.
8.2 Provider promptly forwards to Institution any request received directly from an athlete and does not respond substantively itself, except to acknowledge and redirect.
8.3 Provider provides Institution with a self-service means of exporting an individual athlete's complete data.

## 9. Institution obligations

Institution: (a) provides any notice and obtains any consent required by its policies and applicable law; (b) designates Provider as a school official per §2.2 and confirms this in writing; (c) manages staff role assignment and promptly notifies Provider of departures; (d) **maintains its own medical, mental-health, and emergency protocols and acknowledges that the Service does not detect, alert on, or respond to health or mental-health emergencies**; (e) does not enter medical diagnoses, treatment records, protected health information, academic records, or government identifiers into free-text fields; (f) does not use Service outputs as the sole basis for eligibility, scholarship, disciplinary, roster, or employment decisions about an individual.

## 10. Subprocessors

10.1 Institution authorizes the Subprocessors in Exhibit A.
10.2 Provider gives **thirty (30) days'** written notice before adding or replacing a Subprocessor. Institution may object on reasonable data-protection grounds; if the parties cannot resolve the objection, Institution may terminate the affected Service without penalty and receive a pro-rata refund.
10.3 Provider imposes on each Subprocessor obligations no less protective than this Addendum and remains fully liable for their performance.

## 11. Audit

11.1 Provider responds to reasonable security questionnaires (including HECVAT) within thirty (30) days, no more than once per year absent a Security Incident.
11.2 Provider provides available third-party audit reports of its infrastructure Subprocessors on request, subject to confidentiality.
11.3 [Where Provider holds its own SOC 2 Type II report, Provider provides it annually.]
11.4 Institution may conduct an on-site or remote audit no more than once per year on thirty (30) days' notice, at its own cost, or immediately following a Security Incident.

>> DRAFTING NOTE: 11.3 is bracketed because no such report exists today. Do not delete the bracket — leaving it visible signals the roadmap without promising a date.

## 12. Data location and transfers

12.1 Athlete Data is stored in the **United States**. Provider will not relocate primary storage outside the United States without Institution's prior written consent.
12.2 Provider is established in [COUNTRY, EU]. Provider personnel may access Athlete Data remotely from [COUNTRY] for support and operations, subject to this Addendum. Such access does not constitute a transfer of storage.
12.3 Where any transfer subject to Chapter V of the GDPR occurs, the parties will put an appropriate transfer mechanism in place.

>> DRAFTING NOTE: 12.2 must be disclosed, not hidden. Some U.S. institutions have data-residency or foreign-access restrictions, particularly for federally funded research programs. Better to surface it at contracting than to have it found during a security review.

## 13. Precedence and term

13.1 This Addendum prevails over the Agreement in case of conflict regarding Athlete Data.
13.2 It remains in force as long as Provider holds Athlete Data, and §§ 3, 4, 6, 7 survive termination.

**Signatures** — [INSTITUTION] / [PROVIDER], name, title, date.

**Exhibits:** A — Subprocessor List (§5 below) · B — Incident Response Procedure (§6 below) · C — Retention Schedule (Privacy Policy §8) · D — [Remediation Roadmap, if used]

---
---

# 5. SUBPROCESSOR LIST

**Draft v0.1 — factual as of 15 August 2026. Verify before every publication.**

**ChampionTrackPro — Subprocessors**
Last updated: [DATE] · Published at [URL] · Change notice: 30 days to institutional contacts

| # | Subprocessor | Entity / location | What it does | Athlete data it touches | Location of processing | Assurance |
|---|---|---|---|---|---|---|
| 1 | **Supabase** (on AWS) | Supabase Inc., USA — infrastructure AWS US East | Primary database (PostgreSQL), authentication, serverless functions | **All athlete data**: accounts, responses, derived metrics, flags, briefs | United States (US East) | SOC 2 Type II; HIPAA-capable with BAA (Team plan+); AES-256 at rest; DPA available |
| 2 | **Vercel** | Vercel Inc., USA | Hosting and CDN for the web application | **None.** Serves static application files only; the browser connects directly to Supabase. Standard HTTP access logs (IP, user-agent, URL) | United States / global CDN edge | SOC 2 Type II; DPA available |
| 3 | **Anthropic** | Anthropic PBC, USA | AI narration of the daily brief | **Pseudonymized derived metrics only**: coded reference (e.g. "P-01"), readiness score, baseline, deviation, zone, data-days, triggered-rule text. **No names, emails, dates of birth, identifiers, institution names, or raw responses** | United States | Commercial terms: no training on customer data. Default API retention 30 days [or: Zero Data Retention agreement — select per Privacy Policy §6] |
| 4 | **Push delivery services** (Google FCM, Mozilla, Apple, per athlete's browser) | Various, USA | Delivery of encrypted push notifications | Notification endpoint identifier and encrypted payload. **Payload contains no athlete data** — only "Session complete — time for your check-in" or "Morning Brief ready" | United States | Standard Web Push (RFC 8291); payloads end-to-end encrypted by us |
| 5 | **[Google Firebase / Firestore]** | Google LLC, USA | **Legacy system.** Authentication, database, and notifications for the previous production version | **Potentially a full historical copy of athlete data** | United States | **STATUS TO BE RESOLVED — see note** |
| 6 | [Email provider] | [TBD] | Transactional email (password reset) | Email address only | [TBD] | [TBD] |

**Notes**

- No advertising networks, no analytics trackers, no data brokers, no CRM containing athlete data.
- **Line 5 requires a decision before this list is published.** The legacy Firebase/Firestore stack is still referenced in the codebase and still serves the previous production version. Either decommission it and certify data destruction — in which case delete this line — or keep it and declare it. Publishing a subprocessor list that omits a live system holding athlete data is the kind of omission that destroys credibility during a security review. See risk R-08.
- Line 6 depends on Supabase Auth email configuration; note that email confirmation is currently disabled (see `docs/12` §3.5).

---
---

# 6. INCIDENT RESPONSE PROCEDURE

**Draft v0.1 — one page. Print it. It is useless if it has to be found under stress.**

**ChampionTrackPro — Security Incident Response**
Owner: [NAME] · Backup owner: [NAME] · Version [1.0] · Review: every 6 months

## 1. What counts as an incident

Any of: unauthorized access to athlete data; credentials, API key, or service-role key exposed; an account acting outside its role; suspected data exfiltration; ransomware or destructive action; a report from a coach, athlete, or researcher of seeing data they should not see; a subprocessor notifying us of a breach affecting our data.

**When unsure, treat it as an incident.** Over-declaring costs a few hours; under-declaring costs the company.

## 2. Severity

| Level | Definition | Clock |
|---|---|---|
| **SEV-1** | Athlete data confirmed or likely accessed by an unauthorized party | Institution notified **within 72 hours of confirmation**. Work continuously. |
| **SEV-2** | Vulnerability that could have allowed such access; no evidence of exploitation | Contain within 24 h. Notify institutions within 5 business days if their data was exposed to risk. |
| **SEV-3** | Security-relevant issue, no athlete data exposure (e.g. exposed non-production secret) | Fix within 30 days. Log it. No external notification. |

## 3. The first hour

1. **Write down the time.** Open a timestamped log file. Every subsequent action goes in it with a time. This log is the evidence base for the notification and, if it comes to it, for the defense.
2. **Contain, don't investigate first.** Revoke the compromised credential; rotate the key; disable the account; if necessary take the Service offline. A few hours of downtime is recoverable; ongoing exfiltration is not.
3. **Preserve evidence.** Do not delete logs, accounts, or rows. Export the relevant Supabase logs and the `access_log` table **before** any cleanup — retention windows are short and evidence disappears on its own.
4. **Do not communicate externally yet.** No email, no call, no message to a coach until §4 is complete. An inaccurate first statement cannot be withdrawn.

## 4. Assess (hours 1-24)

Answer, in writing, in the log:

- What happened, and through which path?
- **Which institutions and which athletes are affected?** Names and counts.
- **Which data categories?** Wellness responses? Names and emails? Mental-health ratings? The answer determines the severity of the notification.
- Is it still ongoing?
- When did it start? When did we detect it? Why did the gap exist?

If the `access_log` cannot answer "who saw what", say so explicitly in the log and **assume maximum scope** for notification purposes.

## 5. Fix

Remove the root cause, not just the symptom. Verify the fix in production. Check whether the same weakness exists elsewhere. Confirm that no other credential or path is affected.

## 6. Notify

**SEV-1 — institution notified within 72 hours of confirmation**, by phone or video call to the designated contact, immediately followed by written notice containing: what happened; when; which of their athletes and which data; what we have done; what we are doing; what we recommend they do; a named contact; and a commitment to update every [48] hours until closure.

Do not speculate. Do not minimize. Do not promise it cannot happen again. State facts, and state clearly what is not yet known.

**The institution notifies athletes and any regulator** — that is its legal obligation under state breach-notification law, not ours, and we do not pre-empt it (DPA §6.4). We cooperate fully and bear reasonable notification costs where the cause is on our side (DPA §6.3).

**Deadlines to be aware of:** all 50 states have breach-notification statutes; several impose fixed deadlines of 30 to 60 days, and California moved to a fixed 30 calendar days effective 1 January 2026. Our 72-hour contractual commitment exists precisely to leave the institution room inside those windows.

**If the company is established in the EU**, assess whether a GDPR Article 33 notification to the [CNIL] is required within 72 hours. Take advice.

## 7. Close

Within 10 business days of resolution, write a post-incident report: timeline, root cause, scope, actions taken, corrective measures with owners and dates. Send it to affected institutions. Update this procedure. **Add a test that would have caught it.**

## 8. Contacts

| Role | Who | How |
|---|---|---|
| Incident owner | [NAME] | [phone] |
| Backup | [NAME] | [phone] |
| U.S. counsel | [FIRM] | [phone] |
| Cyber insurer, claims hotline | [INSURER, POLICY #] | [phone] |
| Supabase support | [plan-level channel] | [link] |
| Institution contacts | Maintained in [location] | — |
| Public reports | privacy@championtrackpro.com | monitored [daily] |

>> DRAFTING NOTE: this procedure assumes an `access_log` table (`docs/14`, measure P1-4) and a real `privacy@` mailbox. Neither exists today. Until they do, step §4 cannot be performed and every incident becomes maximum-scope by default.

---
---

# 7. PILOT AGREEMENT (ONE PAGE)

**Draft v0.1 — not legally reviewed. For an unpaid pilot with a single team.**

>> DRAFTING NOTE: the purpose of this document is to be signed. A coach will sign one page; a coach will not sign twenty. It should carry the minimum needed so that an unpaid pilot is not a bare exposure, and it should reference — not reproduce — the full documents.

---

**CHAMPIONTRACKPRO — PILOT PROGRAM AGREEMENT**

Between **[INSTITUTION / ATHLETIC DEPARTMENT]** and **[LEGAL ENTITY]** ("Provider").
Pilot period: **[START] to [END]** ([X] weeks). **No fee.**

**1. What the pilot is.** Provider gives [TEAM] access to the ChampionTrackPro readiness platform. Athletes answer a short daily self-report; coaching staff receive a daily summary. No wearables, no sensors, no medical data.

**2. Who sees what.** Coaching staff see their own team's responses, identified by name. Athletes see only their own. No other team or institution sees anything. Provider's AI narration layer receives coded references, never names.

**3. What this is not.** The platform is not a medical device and does not diagnose, does not decide participation, and does not alert anyone in real time. Institution maintains its own medical, mental-health, and emergency protocols and remains solely responsible for all health and participation decisions.

**4. FERPA.** To the extent data processed here constitutes education records, Institution designates Provider as a **school official with a legitimate educational interest** under 34 CFR § 99.31(a)(1). Provider will use the data only to deliver the platform to Institution, will not redisclose it, and will act under Institution's direction as to use and retention.

**5. Provider will not.** Sell the data. Use it for advertising. Share it with any third party other than the infrastructure subprocessors listed at [URL]. Use identifiable data to train AI models. Reference Institution by name publicly without prior written consent.

**6. Security.** Encryption in transit and at rest; team-level isolation enforced at the database; access restricted by role; storage in the United States. Provider is established in [COUNTRY] and its personnel may access data remotely to operate and support the platform.

**7. Incidents.** Provider notifies Institution's contact **within 72 hours** of confirming any unauthorized access to Institution's data, and cooperates with any notification Institution must make.

**8. End of pilot.** Within **30 days** of the pilot ending or on Institution's request, Provider deletes all of Institution's data and confirms deletion in writing — or exports it to Institution first if Institution asks.

**9. Athlete requests.** Provider assists Institution, at no charge and within 30 days, with any athlete request to access, correct, export, or delete their data.

**10. Either party may end this pilot at any time, for any reason, in writing.** §§ 4, 5, 7, 8 survive.

**11. No warranty; limited liability.** The platform is provided as-is for evaluation. Neither party is liable for indirect or consequential damages. This section does not limit Provider's liability for its own breach of §§ 4, 5, or 8.

**12. Full terms.** The Terms of Service, Privacy Policy, and Data Processing Addendum at [URL] apply and control in case of conflict. If Institution's counsel requires the full Data Processing Addendum instead of this one-pager, Provider will sign it.

Institution: ______________________ Name / Title / Date
Provider: ______________________ Name / Title / Date

---

## Checklist avant d'envoyer quoi que ce soit à un prospect

- [ ] Un avocat américain a relu les §1 à §7 et les blocs `>> DRAFTING NOTE` ont été supprimés des versions publiées
- [ ] Entité juridique créée, adresse postale réelle renseignée
- [ ] `privacy@championtrackpro.com` et `legal@championtrackpro.com` existent et sont relevées
- [ ] Privacy Policy §6 : Option A ou Option B tranchée, et le commentaire de `llm.ts:3` mis en cohérence
- [ ] Privacy Policy §8 : la politique de rétention est **exécutable** (fix P0-2 déployé)
- [ ] ToS §4.1 : les codes staff distincts sont **déployés** (fix P0-1)
- [ ] DPA §5 : les lignes non vraies ont été retirées ou déplacées dans une roadmap de remédiation datée
- [ ] Subprocessor List ligne 5 : Firebase décommissionné et purgé, ou déclaré
- [ ] Athlete Notice : ressources de crise de l'établissement renseignées, version et horodatage stockés
- [ ] DPA Supabase et Vercel signés côté Provider et archivés
