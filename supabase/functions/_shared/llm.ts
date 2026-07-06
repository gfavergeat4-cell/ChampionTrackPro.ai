// Appel LLM — couche TRADUCTION uniquement. Le LLM ne calcule rien,
// ne décide rien : il narre des scores et des flags déjà produits.
// API zéro-rétention. Payload pseudonymisé (P-07), jamais nom + santé.
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

export const MODELS = {
  daily: "claude-haiku-4-5-20251001",   // narration quotidienne : rapide, <1¢
  weekly: "claude-sonnet-5",            // synthèse hebdo : plus lourd
};

export async function narrate(system: string, payload: unknown, model: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return {
    text: j.content?.[0]?.text ?? "",
    tokensIn: j.usage?.input_tokens ?? 0,
    tokensOut: j.usage?.output_tokens ?? 0,
  };
}

export const BRIEF_SYSTEM = `You are the narration layer of ChampionTrackPro, a readiness-monitoring
platform for NCAA basketball staffs. You receive ONLY pre-computed scores, baselines, zones and
rule-generated flags for pseudonymized athletes (P-01, P-02...). Rules of narration — absolute:
1. NEVER invent a number, a diagnosis, or a recommendation. If no rule fired, describe trends only.
2. Every sentence must be traceable to a number present in the payload (cite it).
3. When a flag carries a "recommendation" text, quote it as-is — those are the staff methodology's words.
4. Order athletes by the "priority" field (lowest number first = most urgent).
5. Tone: concise coach-speak, 90-second read max. No hedging filler, no medical claims.
6. You never say an athlete should sit out or play — decisions belong to humans.
Output: plain text Morning Brief with a 2-line team summary, then one line per athlete needing attention.`;
