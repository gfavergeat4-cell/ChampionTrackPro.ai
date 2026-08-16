// ConsentGate.tsx — Acceptation des conditions, avant tout accès aux données.
//
// Rendu par AuthGate quand `v_my_pending_consents` n'est pas vide. Tant que
// les textes sont en statut `draft`, cette vue ne renvoie rien : l'écran ne
// s'affiche jamais. Il devient bloquant le jour où un document passe en
// `active` — c'est-à-dire après relecture par un avocat.
//
// Le geste demandé est explicite : une case à cocher par document, pas un
// « en continuant vous acceptez ». Un consentement obtenu par inadvertance
// ne vaut rien devant un juriste universitaire.
import React from "react";
import { Platform, View, Text } from "react-native";
import { getPendingConsents, acceptConsents, signOut } from "../lib/ctpApi";
import type { PendingConsent } from "../lib/ctpApi";

const C = {
  bgTop: "#0B0F1A", bgBottom: "#020409",
  card: "#141A24", ring: "rgba(0,224,255,0.10)",
  accent: "#00E0FF", accentDeep: "#4A67FF",
  textHi: "rgba(255,255,255,0.9)",
  textMid: "rgba(154,163,178,0.7)",
  textLow: "rgba(154,163,178,0.45)",
};

export default function ConsentGate({ onDone }: { onDone: () => void }) {
  const [docs, setDocs] = React.useState<PendingConsent[]>([]);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getPendingConsents();
        if (cancelled) return;
        if (!d.length) { onDone(); return; }
        setDocs(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [onDone]);

  const allChecked = docs.length > 0 && docs.every((d) => checked[d.key]);

  const accept = async () => {
    if (!allChecked || busy) return;
    setBusy(true);
    try {
      await acceptConsents(docs.map((d) => ({ key: d.key, version: d.version })));
      onDone();
    } catch (e: any) {
      setError(e?.message || "Could not record your agreement. Please try again.");
      setBusy(false);
    }
  };

  if (Platform.OS !== "web") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgTop, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Please open the app in your browser to continue.</Text>
      </View>
    );
  }
  if (loading || !docs.length) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, overflowY: "auto",
      background: `linear-gradient(to bottom, ${C.bgTop}, ${C.bgBottom})`,
      color: C.textHi, fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{
          fontFamily: "'Marcellus', serif", fontSize: 12, letterSpacing: "0.22em",
          color: C.textMid, textAlign: "center", marginBottom: 10,
        }}>CHAMPIONTRACKPRO</div>
        <h1 style={{ fontSize: 25, fontWeight: 500, margin: "0 0 8px", textAlign: "center" }}>
          Before you start
        </h1>
        <p style={{
          fontSize: 14, color: C.textMid, textAlign: "center",
          margin: "0 auto 28px", maxWidth: 380, lineHeight: 1.6,
        }}>
          Please read and accept the following. You can reopen them at any time from your profile.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {docs.map((d) => (
            <label key={d.key} style={{
              display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer",
              background: C.card, borderRadius: 16, padding: 18,
              boxShadow: `inset 0 0 0 1px ${checked[d.key] ? "rgba(0,224,255,0.35)" : C.ring}`,
              transition: "box-shadow 160ms ease-out",
            }}>
              <input
                type="checkbox"
                checked={!!checked[d.key]}
                onChange={(e) => setChecked((p) => ({ ...p, [d.key]: e.target.checked }))}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: C.accent, cursor: "pointer", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 3 }}>
                  I have read and accept the{" "}
                  <a href={d.url} target="_blank" rel="noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     style={{ color: C.accent, textDecoration: "underline" }}>
                    {d.title}
                  </a>
                </div>
                {d.summary ? (
                  <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.55 }}>{d.summary}</div>
                ) : null}
                <div style={{ fontSize: 11, color: C.textLow, marginTop: 6 }}>
                  Version {d.version.replace(/^v/, "")} · effective {d.effective_at}
                </div>
              </div>
            </label>
          ))}
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "#FCA5A5", textAlign: "center", marginTop: 14 }}>{error}</div>
        ) : null}

        <button
          onClick={accept}
          disabled={!allChecked || busy}
          style={{
            width: "100%", marginTop: 22, padding: "14px 0", borderRadius: 12, border: "none",
            fontFamily: "inherit", fontSize: 16, fontWeight: 500, color: C.textHi,
            cursor: allChecked && !busy ? "pointer" : "default",
            background: allChecked
              ? `linear-gradient(to right, ${C.accent}, ${C.accentDeep})`
              : "rgba(30,34,45,0.9)",
            boxShadow: allChecked ? "0 0 20px 5px rgba(0,224,255,0.22)" : "none",
            opacity: allChecked ? 1 : 0.55,
            transition: "all 200ms ease-out",
          }}
        >
          {busy ? "Saving…" : "Continue"}
        </button>

        <button
          onClick={() => signOut()}
          style={{
            width: "100%", marginTop: 12, padding: "10px 0", background: "none",
            border: "none", color: C.textLow, fontFamily: "inherit", fontSize: 13, cursor: "pointer",
          }}
        >
          Sign out instead
        </button>

        <p style={{
          fontSize: 11, color: C.textLow, textAlign: "center",
          marginTop: 24, lineHeight: 1.6,
        }}>
          Your answers are used to support your coaching staff's decisions.
          They are never used to evaluate you, and you can ask for them to be deleted at any time.
        </p>
      </div>
    </div>
  );
}
