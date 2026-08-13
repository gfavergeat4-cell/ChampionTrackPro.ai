// AdminSystemHealthScreen.tsx — Console santé système (doc 09, lot L3)
// LECTURE SEULE. Répond à : « est-ce que tout tourne, et sinon où ? »
// Aucune écriture, aucune action destructrice.
import React, { useCallback, useEffect, useState } from "react";
import { Platform, ActivityIndicator, View, Text } from "react-native";
import { getAdminSystemHealth } from "../lib/ctpApi";
import type { TeamHealth } from "../lib/ctpApi";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { courtlight as cl } from "../theme/tokens";

type Severity = "ok" | "warn" | "bad" | "idle";

const SEV_COLOR: Record<Severity, string> = {
  ok: "#00FF9D",
  warn: "#FFB800",
  bad: "#EF4444",
  idle: "rgba(255,255,255,0.28)",
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z").getTime();
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86400000);
}

/** Sévérité du brief : généré aujourd'hui ou hier = OK. */
function briefSeverity(t: TeamHealth): Severity {
  const age = daysSince(t.lastBriefDate);
  if (age === null) return t.athletes === 0 ? "idle" : "bad";
  if (age <= 1) return "ok";
  if (age <= 3) return "warn";
  return "bad";
}

function complianceSeverity(pct: number | null): Severity {
  if (pct === null) return "idle";
  if (pct >= 75) return "ok";
  if (pct >= 50) return "warn";
  return "bad";
}

// ── Primitives d'affichage ──────────────────────────────────
function Dot({ sev }: { sev: Severity }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: 999,
      background: SEV_COLOR[sev], marginRight: 8, flexShrink: 0,
      boxShadow: sev === "idle" ? "none" : `0 0 10px ${SEV_COLOR[sev]}66`,
    }} />
  );
}

function Metric({
  label, value, hint, sev = "idle",
}: { label: string; value: string; hint?: string; sev?: Severity }) {
  return (
    <div style={{ minWidth: 132, flex: "1 1 132px" }}>
      <div style={{
        fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.38)", marginBottom: 6,
      }}>{label}</div>
      <div style={{
        display: "flex", alignItems: "center",
        fontSize: 22, fontWeight: 300, fontVariantNumeric: "tabular-nums",
        color: sev === "idle" ? "rgba(255,255,255,0.86)" : SEV_COLOR[sev],
      }}>
        {sev !== "idle" && <Dot sev={sev} />}
        {value}
      </div>
      {hint ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.34)", marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}

export default function AdminSystemHealthScreen() {
  const isDesktop = useIsDesktop();
  const [rows, setRows] = useState<TeamHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminSystemHealth(7);
      setRows(data);
      setCheckedAt(new Date());
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>System health is optimized for web.</Text>
      </View>
    );
  }

  const maxWidth = isDesktop ? 1040 : 480;

  // ── Bandeau de synthèse ───────────────────────────────────
  const teamsLate = rows.filter((t) => briefSeverity(t) === "bad").length;
  const teamsLowCompliance = rows.filter((t) => complianceSeverity(t.compliancePct) === "bad").length;
  const totalCost = rows.reduce((a, t) => a + (t.cost30dUsd ?? 0), 0);
  const costKnown = rows.some((t) => t.cost30dUsd !== null);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(1200px 800px at 50% -10%, #0D2545 0%, #070B14 60%)",
      color: "#FFFFFF",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: isDesktop ? "40px 48px 100px" : "24px 16px 100px",
      overflowY: "auto",
    }}>
      <div style={{ maxWidth, margin: "0 auto" }}>

        {/* En-tête */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: "'Marcellus', serif", fontSize: isDesktop ? 26 : 21,
            letterSpacing: "0.14em", marginBottom: 6,
          }}>SYSTEM HEALTH</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.44)" }}>
            Fenêtre : 7 derniers jours · coût sur 30 jours
            {checkedAt ? ` · vérifié à ${checkedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 60 }}>
            <ActivityIndicator color={cl.accent?.cyan ?? "#00D4FF"} />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Lecture de l'état du système…</span>
          </div>
        ) : error ? (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 14, padding: 20, fontSize: 14, color: "#FCA5A5",
          }}>
            {error}
            <div style={{ marginTop: 10 }}>
              <button onClick={load} style={btnStyle}>Réessayer</button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, padding: 40, textAlign: "center" }}>
            Aucune équipe rattachée à ce compte.
          </div>
        ) : (
          <>
            {/* Synthèse */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 24,
              background: "rgba(19,28,51,0.66)",
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(0,212,255,0.14)",
              borderRadius: 16, padding: "20px 22px", marginBottom: 24,
              boxShadow: "0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(160,220,255,0.10)",
            }}>
              <Metric label="Équipes" value={String(rows.length)} />
              <Metric
                label="Briefs en retard"
                value={String(teamsLate)}
                sev={teamsLate === 0 ? "ok" : "bad"}
                hint={teamsLate === 0 ? "toutes les équipes à jour" : "aucun brief depuis 3 j+"}
              />
              <Metric
                label="Compliance basse"
                value={String(teamsLowCompliance)}
                sev={teamsLowCompliance === 0 ? "ok" : "warn"}
                hint="équipes sous 50 %"
              />
              <Metric
                label="Coût LLM 30 j"
                value={costKnown ? `$${totalCost.toFixed(4)}` : "—"}
                hint={costKnown ? "toutes équipes" : "migration 010 non appliquée"}
              />
            </div>

            {/* Une carte par équipe */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rows.map((t) => {
                const bs = briefSeverity(t);
                const cs = complianceSeverity(t.compliancePct);
                const age = daysSince(t.lastBriefDate);
                return (
                  <div key={t.id} style={{
                    background: "rgba(17,26,45,0.92)",
                    border: "1px solid rgba(0,212,255,0.10)",
                    borderRadius: 16, padding: isDesktop ? "22px 24px" : "18px 16px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(160,220,255,0.10)",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "baseline", justifyContent: "space-between",
                      gap: 12, marginBottom: 18, flexWrap: "wrap",
                    }}>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
                        {t.athletes} athlètes · {t.staff} staff ·{" "}
                        {t.icsConfigured ? "calendrier connecté" : "aucun calendrier"}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
                      <Metric
                        label="Dernier brief"
                        value={t.lastBriefDate ?? "aucun"}
                        sev={bs}
                        hint={age === null ? "jamais généré" : age === 0 ? "aujourd'hui" : `il y a ${age} j`}
                      />
                      <Metric
                        label="Briefs 7 j"
                        value={`${t.briefsCount}/7`}
                        sev={t.briefsCount >= 6 ? "ok" : t.briefsCount >= 3 ? "warn" : "bad"}
                      />
                      <Metric
                        label="Compliance 7 j"
                        value={t.compliancePct === null ? "—" : `${t.compliancePct}%`}
                        sev={cs}
                        hint={`${t.responses}/${t.expectedResponses} réponses attendues`}
                      />
                      <Metric
                        label="Séances 7 j"
                        value={String(t.sessionsEnded)}
                        hint={`${t.sessionsUpcoming} à venir`}
                        sev={t.sessionsEnded === 0 && t.sessionsUpcoming === 0 ? "warn" : "idle"}
                      />
                      <Metric
                        label="Relances"
                        value={`${t.remindersSent} envoyées`}
                        hint={`${t.remindersPending} en attente`}
                        sev={t.remindersSent === 0 && t.sessionsEnded > 0 ? "warn" : "idle"}
                      />
                      <Metric
                        label="Coût 30 j"
                        value={t.cost30dUsd === null ? "—" : `$${t.cost30dUsd.toFixed(4)}`}
                        hint={t.llmErrors ? `${t.llmErrors} erreurs LLM` : undefined}
                        sev={t.llmErrors ? "warn" : "idle"}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
              <button onClick={load} style={btnStyle}>Actualiser</button>
            </div>

            <div style={{
              marginTop: 26, fontSize: 11, lineHeight: 1.6,
              color: "rgba(255,255,255,0.26)", textAlign: "center",
            }}>
              Compliance = réponses reçues ÷ (séances terminées × athlètes) sur 7 jours.
              Un brief est considéré à jour s'il date d'aujourd'hui ou d'hier.
              Écran en lecture seule.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(0,212,255,0.10)",
  border: "1px solid rgba(0,212,255,0.30)",
  color: "#00D4FF",
  borderRadius: 10,
  padding: "10px 20px",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
};
