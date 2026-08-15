// QuestionnaireCourtlight.tsx — Écran de check-in athlète (doc 15 v3).
//
// Rendu conforme au modèle visuel fourni par le fondateur : en-tête de séance,
// cartes empilées avec libellé + explication, LogoSlider (l'emblème de marque),
// porte d'entrée douleur, bouton Submit en dégradé.
//
// Entièrement piloté par la donnée : les items, leurs libellés, leurs
// explications et leur ordre viennent de `questionnaires.questions`. Aucun
// libellé n'est écrit en dur ici — changer le questionnaire en base change
// l'écran, sans toucher au code.
//
// Web uniquement. Chemin Supabase. Le chemin Firebase reste sur
// screens/StitchQuestionnaireScreen.js, intact.
import React from "react";
import { Platform, View, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  getMyMembership,
  getTeamQuestionnaire,
  getQuestionnaireForSession,
  getSessionById,
  getMyResponseForSession,
  submitResponse,
} from "../lib/ctpApi";
import LogoSlider from "../components/LogoSlider";

// ── Palette du modèle fourni ───────────────────────────────
const C = {
  bgTop: "#0B0F1A",
  bgBottom: "#020409",
  card: "#141A24",
  cardRing: "inset 0 0 0 1px rgba(0, 224, 255, 0.10)",
  inactive: "#1E222D",
  textPrimary: "rgba(255,255,255,0.9)",
  textSecondary: "rgba(154,163,178,0.7)",
  gradFrom: "#00E0FF",
  gradTo: "#4A67FF",
};

const BODY_AREAS = [
  "Head/neck", "Shoulder", "Back", "Hip/groin", "Thigh",
  "Knee", "Calf/shin", "Ankle", "Foot", "Hand/wrist", "Other",
];

interface QuestionDef {
  id: string;
  metricKey: string;
  questionText: string;
  description?: string;
  leftAnchor?: string;
  rightAnchor?: string;
  weight?: number;
  inverted?: boolean;
  role?: string;
  axis?: string;
  category?: string;
}

// ── Carte générique ────────────────────────────────────────
function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: 16,
        boxShadow: C.cardRing,
        padding: 16,
        animation: "ctp-card-in 150ms ease-out both",
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function QuestionnaireCourtlight() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId: sessionIdParam, trainingId, eventTitle, eventDate } = (route.params || {}) as any;
  const sessionId = trainingId || sessionIdParam;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = React.useState<any>(null);
  const [questions, setQuestions] = React.useState<QuestionDef[]>([]);
  const [metrics, setMetrics] = React.useState<Record<string, number>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [title, setTitle] = React.useState<string>(eventTitle || "Session");
  const [timeRange, setTimeRange] = React.useState<string>(eventDate || "");
  const [alreadyDone, setAlreadyDone] = React.useState(false);

  // Bloc douleur
  const [hasPain, setHasPain] = React.useState<boolean | null>(null);
  const [painType, setPainType] = React.useState<string | null>(null);
  const [painArea, setPainArea] = React.useState<string | null>(null);
  const [painImpact, setPainImpact] = React.useState(50);
  const [painImpactTouched, setPainImpactTouched] = React.useState(false);
  const [worry, setWorry] = React.useState(50);
  const [worryTouched, setWorryTouched] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // ── Chargement ───────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const m: any = await getMyMembership();
        if (!m?.team_id) throw new Error("You are not linked to a team yet.");
        if (!cancelled) setTeamId(m.team_id);

        // Séance : type (qui détermine le questionnaire), titre et créneau
        let sessionType: string | null = null;
        if (sessionId) {
          try {
            const s: any = await getSessionById(sessionId);
            if (s) {
              sessionType = s.session_type ?? null;
              if (!cancelled) {
                setTitle(s.title || eventTitle || "Session");
                const fmt = (iso: string) =>
                  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                if (s.start_utc && s.end_utc) setTimeRange(`${fmt(s.start_utc)} – ${fmt(s.end_utc)}`);
              }
            }
          } catch { /* en-tête best-effort */ }
        }

        // Résolution du questionnaire par type de séance (doc 15 §3),
        // avec repli sur l'ancien comportement si rien n'est configuré.
        const q: any =
          (await getQuestionnaireForSession(m.team_id, sessionType)) ??
          (await getTeamQuestionnaire(m.team_id));
        if (!q) throw new Error("No questionnaire configured for your team.");
        const list: QuestionDef[] = Array.isArray(q.questions) ? q.questions : [];
        if (!cancelled) {
          setQuestionnaire(q);
          setQuestions(list);
          const init: Record<string, number> = {};
          list.forEach((it) => { init[it.metricKey] = 50; });
          setMetrics(init);
        }

        if (sessionId) {
          const existing = await getMyResponseForSession(sessionId);
          if (existing && !cancelled) setAlreadyDone(true);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, eventTitle]);

  // Le bloc douleur appartient à la passation journalière (doc 15 §5).
  // Les questionnaires hérités (sans champ `role`) le conservent, pour ne
  // jamais perdre le signal pendant la transition.
  const isLegacy = questions.length > 0 && !questions.some((q) => q.role);
  const showPain = questionnaire?.session_type === "daily" || isLegacy;

  const setMetric = (key: string, v: number) => {
    setMetrics((p) => ({ ...p, [key]: v }));
    setTouched((p) => ({ ...p, [key]: true }));
  };

  const allTouched = questions.every((q) => touched[q.metricKey]);
  const painAnswered = !showPain || hasPain !== null;
  const painComplete =
    !showPain || hasPain === false ||
    (painType !== null && (painType === "Mental / emotional" || painArea !== null));
  const canSubmit = allTouched && painAnswered && painComplete && !submitting && !alreadyDone;

  const handleSubmit = async () => {
    if (!teamId || !sessionId || !questionnaire || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitResponse({
        teamId,
        sessionId,
        questionnaireId: questionnaire.id,
        metrics,
        hasFriction: showPain ? hasPain === true : false,
        frictionType: showPain && hasPain ? painType : null,
        frictionArea: showPain && hasPain && painType !== "Mental / emotional" ? painArea : null,
        frictionImpact: showPain && hasPain ? painImpact : null,
        worryLevel: showPain && hasPain ? worry : null,
      } as any);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgTop, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Check-in is optimized for web.</Text>
      </View>
    );
  }

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background: `linear-gradient(to bottom, ${C.bgTop}, ${C.bgBottom})`,
    color: C.textPrimary,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    position: "relative",
    overflowX: "hidden",
  };

  const keyframes = `
    @keyframes ctp-card-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ctp-pulse-glow { 0%,100% { box-shadow: 0 0 10px 0 rgba(0,224,255,0.2); } 50% { box-shadow: 0 0 20px 5px rgba(0,224,255,0.4); } }
    @media (prefers-reduced-motion: reduce) { @keyframes ctp-card-in { from { opacity: 1; } to { opacity: 1; } } }
  `;

  // ── Écran de confirmation ────────────────────────────────
  if (done) {
    return (
      <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{keyframes}</style>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%", margin: "0 auto 28px",
            background: "rgba(0,224,255,0.10)", border: "2px solid rgba(0,224,255,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none"
                 stroke={C.gradFrom} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div style={{ fontFamily: "'Marcellus', serif", fontSize: 26, letterSpacing: "0.12em", marginBottom: 12 }}>
            LOCKED IN
          </div>
          <div style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.6, marginBottom: 32 }}>
            See you tomorrow.
          </div>
          <button onClick={() => navigation.goBack()} style={submitBtn(true)}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <style>{keyframes}</style>
      {/* halo haut, comme le modèle */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 300, height: 300, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle, rgba(0,224,255,0.10), transparent 70%)",
      }} />

      <div style={{
        position: "relative", zIndex: 1, display: "flex", flexDirection: "column",
        minHeight: "100vh", padding: 16, maxWidth: 430, margin: "0 auto", boxSizing: "border-box",
      }}>
        {/* ── En-tête de séance ── */}
        <header style={{ textAlign: "center", paddingBottom: 24, paddingTop: 8 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <h1 style={{ fontSize: 30, fontWeight: 600, margin: 0, color: "#fff" }}>{title}</h1>
            <div style={{
              position: "absolute", inset: 0, zIndex: -1, filter: "blur(24px)",
              background: "radial-gradient(circle, rgba(0,224,255,0.20), transparent 70%)",
            }} />
          </div>
          {timeRange ? (
            <p style={{ fontSize: 17, fontWeight: 500, color: C.textSecondary, margin: "4px 0 0" }}>
              {timeRange}
            </p>
          ) : null}
        </header>

        <main style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div style={{ color: C.textSecondary, textAlign: "center", padding: 60 }}>Loading…</div>
          ) : error && questions.length === 0 ? (
            <Card><div style={{ color: "#FCA5A5", fontSize: 14 }}>{error}</div></Card>
          ) : alreadyDone ? (
            <Card>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#fff", marginBottom: 6 }}>
                Already submitted
              </div>
              <div style={{ fontSize: 14, color: C.textSecondary }}>
                You've already checked in for this session.
              </div>
            </Card>
          ) : (
            <>
              {questions.map((q, i) => (
                <Card key={q.id || q.metricKey} delay={50 + i * 50}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontWeight: 500, fontSize: 18, color: "#fff", display: "block" }}>
                      {q.questionText}
                    </label>
                    {q.description ? (
                      <p style={{ fontSize: 14, color: C.textSecondary, letterSpacing: "0.01em", margin: "2px 0 0" }}>
                        {q.description}
                      </p>
                    ) : null}
                  </div>
                  <LogoSlider
                    value={metrics[q.metricKey] ?? 50}
                    touched={!!touched[q.metricKey]}
                    onChange={(v) => setMetric(q.metricKey, v)}
                    ariaLabel={q.questionText}
                  />
                  {(q.leftAnchor || q.rightAnchor) ? (
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      fontSize: 12, color: "rgba(154,163,178,0.55)", marginTop: 8,
                    }}>
                      <span>{q.leftAnchor}</span>
                      <span style={{ textAlign: "right" }}>{q.rightAnchor}</span>
                    </div>
                  ) : null}
                </Card>
              ))}

              {/* ── Porte d'entrée douleur ── */}
              {showPain && (
                <Card delay={50 + questions.length * 50}>
                  <p style={{ fontWeight: 500, fontSize: 18, color: "#fff", margin: "0 0 12px" }}>
                    Anything hurting or bothering you today?
                  </p>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={() => { setHasPain(false); setPainType(null); setPainArea(null); }}
                            style={choiceBtn(hasPain === false)}>No</button>
                    <button onClick={() => setHasPain(true)} style={choiceBtn(hasPain === true)}>Yes</button>
                  </div>

                  {hasPain === true && (
                    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
                      <div>
                        <p style={sublabel}>What kind?</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {["Physical", "Mental / emotional", "Both"].map((t) => (
                            <button key={t} onClick={() => setPainType(t)} style={chip(painType === t)}>{t}</button>
                          ))}
                        </div>
                      </div>

                      {painType && painType !== "Mental / emotional" && (
                        <div>
                          <p style={sublabel}>Where?</p>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {BODY_AREAS.map((a) => (
                              <button key={a} onClick={() => setPainArea(a)} style={chip(painArea === a)}>{a}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p style={sublabel}>How much did it get in your way?</p>
                        <LogoSlider
                          value={painImpact}
                          touched={painImpactTouched}
                          onChange={(v) => { setPainImpact(v); setPainImpactTouched(true); }}
                          ariaLabel="Pain interference"
                        />
                        <div style={anchorRow}>
                          <span>Didn't affect me</span><span>Couldn't play through it</span>
                        </div>
                      </div>

                      <div>
                        <p style={sublabel}>How worried are you about it?</p>
                        <LogoSlider
                          value={worry}
                          touched={worryTouched}
                          onChange={(v) => { setWorry(v); setWorryTouched(true); }}
                          ariaLabel="Worry level"
                        />
                        <div style={anchorRow}>
                          <span>Not worried</span><span>Very worried</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {error ? (
                <div style={{ color: "#FCA5A5", fontSize: 13, textAlign: "center" }}>{error}</div>
              ) : null}
            </>
          )}
        </main>

        {/* ── Submit ── */}
        {!loading && !alreadyDone && questions.length > 0 && (
          <footer style={{ paddingTop: 24, paddingBottom: 8 }}>
            {!canSubmit && !submitting ? (
              <p style={{ fontSize: 12, color: "rgba(154,163,178,0.5)", textAlign: "center", margin: "0 0 10px" }}>
                {!allTouched ? "Move every slider to confirm your answer." : "Finish the pain section."}
              </p>
            ) : null}
            <button onClick={handleSubmit} disabled={!canSubmit} style={submitBtn(canSubmit)}>
              {submitting ? "Sending…" : "Submit"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────
const sublabel: React.CSSProperties = {
  fontSize: 14, color: C.textSecondary, margin: "0 0 10px",
};

const anchorRow: React.CSSProperties = {
  display: "flex", justifyContent: "space-between",
  fontSize: 12, color: "rgba(154,163,178,0.55)", marginTop: 8,
};

function choiceBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px 0",
    borderRadius: 12,
    border: "none",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 500,
    color: C.textPrimary,
    cursor: "pointer",
    background: active ? `linear-gradient(to right, ${C.gradFrom}, ${C.gradTo})` : C.inactive,
    animation: active ? "ctp-pulse-glow 2s infinite ease-in-out" : "none",
    transition: "background 180ms ease-out",
  };
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: active ? "1px solid rgba(0,224,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(0,224,255,0.12)" : C.inactive,
    color: active ? C.gradFrom : C.textSecondary,
    fontFamily: "inherit",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 150ms ease-out",
  };
}

function submitBtn(enabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    fontFamily: "inherit",
    fontSize: 16,
    fontWeight: 500,
    color: C.textPrimary,
    cursor: enabled ? "pointer" : "default",
    background: enabled
      ? `linear-gradient(to right, ${C.gradFrom}, ${C.gradTo})`
      : "rgba(30,34,45,0.9)",
    boxShadow: enabled ? "0 0 20px 5px rgba(0,224,255,0.25)" : "none",
    opacity: enabled ? 1 : 0.55,
    transition: "all 200ms ease-out",
  };
}
