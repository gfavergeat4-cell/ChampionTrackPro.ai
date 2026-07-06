/**
 * questionnaireTemplates.ts
 * Default questionnaire templates + Firestore seeding + fetch utilities.
 */

import {
  doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuestionDef {
  id: string;           // "q1", "q2", etc.
  metricKey: string;    // Firestore field name in response.metrics
  category: string;     // "Physical Engine" | "Mental Energy" | "Technical Execution" | "Recovery" | "Custom"
  questionText: string;
  leftAnchor: string;
  rightAnchor: string;
  weight: number;       // 0.0–1.0, all must sum to 1.0
  inverted: boolean;    // true → high slider score = bad
  isRequired: boolean;
}

export interface QuestionnaireDoc {
  id: string;
  name: string;
  sport: string;
  sessionType: string;
  description: string;
  questions: QuestionDef[];
  isDefault: boolean;
  isArchived?: boolean;
  createdBy?: string;
  createdAt?: any;
}

// ── Template IDs (stable, used for idempotent seeding) ────────────────────────

export const TEMPLATE_IDS = {
  BASKETBALL_ANY:  "tpl-basketball-any",
  BASKETBALL_GAME: "tpl-basketball-game",
  HANDBALL_ANY:    "tpl-handball-any",
  SOCCER_ANY:      "tpl-soccer-any",
  GENERIC_ANY:     "tpl-generic-any",
} as const;

// ── Templates ─────────────────────────────────────────────────────────────────

function makeQ(
  id: string,
  metricKey: string,
  category: string,
  questionText: string,
  leftAnchor: string,
  rightAnchor: string,
  weight: number,
  inverted = false,
): QuestionDef {
  return { id, metricKey, category, questionText, leftAnchor, rightAnchor, weight, inverted, isRequired: true };
}

const BASKETBALL_ANY_QUESTIONS: QuestionDef[] = [
  makeQ("q1","tankLevel",        "Physical Engine",    "How loaded is your tank walking into today's session?",                 "Running on empty",            "Fully charged",               0.20),
  makeQ("q2","cardioLoad",       "Physical Engine",    "How gassed were your lungs and transitions yesterday?",                "Barely felt it",              "Completely gassed",           0.20, true),
  makeQ("q3","legBounce",        "Physical Engine",    "How bouncy do your legs feel right now?",                              "Legs are bricks",             "Springy and explosive",       0.20),
  makeQ("q4","motorControl",     "Technical Execution","How dialed-in does your handle and shot feel today?",                  "Completely off",              "Silky smooth, locked in",     0.15),
  makeQ("q5","tacticalSharpness","Technical Execution","How sharp are you at reading the floor and playbook?",                 "Mentally foggy",              "Seeing everything",           0.15),
  makeQ("q6","teamChemistry",    "Mental Energy",      "How connected do you feel to the team's energy?",                     "Disconnected",                "Locked in together",          0.10),
];

const BASKETBALL_GAME_QUESTIONS: QuestionDef[] = [
  makeQ("q1","tankLevel",        "Physical Engine",    "How ready does your body feel for tonight's game?",                    "Not ready at all",            "Fully charged",               0.20),
  makeQ("q2","cardioLoad",       "Physical Engine",    "How recovered are your legs and lungs from the last game?",            "Still feeling last game",     "Completely fresh",            0.20, true),
  makeQ("q3","legBounce",        "Physical Engine",    "How explosive do you feel right now?",                                 "Heavy and slow",              "Explosive and bouncy",        0.20),
  makeQ("q4","motorControl",     "Technical Execution","How sharp is your handle and shot timing today?",                      "Off-rhythm",                  "Dialed in, locked on",        0.15),
  makeQ("q5","tacticalSharpness","Technical Execution","How locked in are you on the scouting report and game plan?",          "Fuzzy on the details",        "Seeing everything clearly",   0.15),
  makeQ("q6","teamChemistry",    "Mental Energy",      "How connected and fired up does this team feel right now?",            "Fragmented energy",           "Locked in together",          0.10),
];

const HANDBALL_ANY_QUESTIONS: QuestionDef[] = [
  makeQ("q1","tankLevel",        "Physical Engine",    "How loaded is your energy going into today's session?",                "Empty",                       "Fully charged",               0.20),
  makeQ("q2","cardioLoad",       "Physical Engine",    "How heavy were your legs and breathing in yesterday's session?",       "Barely felt it",              "Completely gassed",           0.20, true),
  makeQ("q3","legBounce",        "Physical Engine",    "How explosive do your legs and jumps feel right now?",                 "Heavy and sluggish",          "Springy and reactive",        0.20),
  makeQ("q4","motorControl",     "Technical Execution","How sharp is your throwing arm and footwork today?",                   "Off-sync",                    "Fluid and controlled",        0.15),
  makeQ("q5","tacticalSharpness","Technical Execution","How clear are you on the game plan and defensive schemes?",            "Foggy on the details",        "Crystal clear",               0.15),
  makeQ("q6","teamChemistry",    "Mental Energy",      "How connected and cohesive does the team feel today?",                 "Disconnected",                "Locked in together",          0.10),
];

const SOCCER_ANY_QUESTIONS: QuestionDef[] = [
  makeQ("q1","tankLevel",        "Physical Engine",    "How full is your energy tank before today's session?",                 "Running on fumes",            "Fully charged",               0.20),
  makeQ("q2","cardioLoad",       "Physical Engine",    "How heavy were your lungs and legs after yesterday?",                  "Felt nothing",                "Completely gassed",           0.20, true),
  makeQ("q3","legBounce",        "Physical Engine",    "How fresh and explosive do your legs feel right now?",                 "Stiff and heavy",             "Light and reactive",          0.20),
  makeQ("q4","motorControl",     "Technical Execution","How sharp is your touch and movement today?",                          "Disconnected",                "Smooth and precise",          0.15),
  makeQ("q5","tacticalSharpness","Technical Execution","How clear are you on the shape, press, and set pieces?",               "Mentally foggy",              "Seeing the game clearly",     0.15),
  makeQ("q6","teamChemistry",    "Mental Energy",      "How together and motivated does the squad feel?",                      "Flat energy",                 "Fired up together",           0.10),
];

const GENERIC_ANY_QUESTIONS: QuestionDef[] = [
  makeQ("q1","tankLevel",        "Physical Engine",    "How loaded is your energy tank for today's session?",                  "Empty",                       "Fully charged",               0.20),
  makeQ("q2","cardioLoad",       "Physical Engine",    "How fatigued were you after yesterday's effort?",                      "Barely felt it",              "Completely exhausted",        0.20, true),
  makeQ("q3","legBounce",        "Physical Engine",    "How physically ready and explosive do you feel?",                      "Heavy and sluggish",          "Light and reactive",          0.20),
  makeQ("q4","motorControl",     "Technical Execution","How precise and controlled do your technical movements feel?",         "Off and uncoordinated",       "Fluid and controlled",        0.15),
  makeQ("q5","tacticalSharpness","Technical Execution","How sharp is your focus and tactical understanding today?",            "Foggy, one step behind",      "Fully focused and sharp",     0.15),
  makeQ("q6","teamChemistry",    "Mental Energy",      "How connected do you feel to the group's energy and goals?",           "Disconnected",                "Locked in together",          0.10),
];

export const TEMPLATES: Record<string, Omit<QuestionnaireDoc, "id" | "createdAt">> = {
  [TEMPLATE_IDS.BASKETBALL_ANY]: {
    name: "Basketball — Any Session",
    sport: "Basketball",
    sessionType: "any",
    description: "Standard 6-metric DAR questionnaire for daily basketball training sessions.",
    questions: BASKETBALL_ANY_QUESTIONS,
    isDefault: true,
  },
  [TEMPLATE_IDS.BASKETBALL_GAME]: {
    name: "Basketball — Game Day",
    sport: "Basketball",
    sessionType: "game",
    description: "Game-day variant with tuned question text for competition readiness.",
    questions: BASKETBALL_GAME_QUESTIONS,
    isDefault: false,
  },
  [TEMPLATE_IDS.HANDBALL_ANY]: {
    name: "Handball — Any Session",
    sport: "Handball",
    sessionType: "any",
    description: "Handball-adapted DAR questionnaire for daily training sessions.",
    questions: HANDBALL_ANY_QUESTIONS,
    isDefault: true,
  },
  [TEMPLATE_IDS.SOCCER_ANY]: {
    name: "Soccer — Any Session",
    sport: "Soccer",
    sessionType: "any",
    description: "Soccer-adapted DAR questionnaire for daily training sessions.",
    questions: SOCCER_ANY_QUESTIONS,
    isDefault: true,
  },
  [TEMPLATE_IDS.GENERIC_ANY]: {
    name: "Generic — Any Session",
    sport: "Generic",
    sessionType: "any",
    description: "Sport-agnostic DAR questionnaire for any training context.",
    questions: GENERIC_ANY_QUESTIONS,
    isDefault: true,
  },
};

// ── Seeding ───────────────────────────────────────────────────────────────────

/**
 * Idempotent — only writes documents that don't yet exist.
 */
export async function seedDefaultQuestionnaires(): Promise<void> {
  await Promise.all(
    Object.entries(TEMPLATES).map(async ([id, template]) => {
      const ref = doc(db, "questionnaires", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          ...template,
          id,
          createdBy: "system",
          createdAt: serverTimestamp(),
          isArchived: false,
        });
      }
    })
  );
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the questionnaire assigned to a team.
 * Falls back to the default questionnaire for the team's sport.
 * Returns null if nothing found.
 */
export async function fetchTeamQuestionnaire(
  teamId: string,
  teamSport?: string,
): Promise<QuestionnaireDoc | null> {
  try {
    const teamSnap = await getDoc(doc(db, "teams", teamId));
    const teamData = teamSnap.exists() ? (teamSnap.data() as any) : {};
    const sport: string = teamSport || teamData.sport || "Basketball";
    // Support both multi-select (questionnaireIds[]) and legacy single (questionnaireId)
    const questionnaireIds: string[] = teamData.questionnaireIds?.length > 0
      ? teamData.questionnaireIds
      : teamData.questionnaireId ? [teamData.questionnaireId] : [];

    if (questionnaireIds.length > 0) {
      const fetchedQs: QuestionnaireDoc[] = [];
      for (const qid of questionnaireIds) {
        const qSnap = await getDoc(doc(db, "questionnaires", qid));
        if (qSnap.exists() && (qSnap.data() as any).questions?.length > 0) {
          fetchedQs.push({ id: qSnap.id, ...(qSnap.data() as any) } as QuestionnaireDoc);
        }
      }
      // Return "any" session type as the default view (admin preview)
      const anyQ = fetchedQs.find(q => q.sessionType === "any");
      if (anyQ) return anyQ;
      if (fetchedQs.length > 0) return fetchedQs[0];
    }

    // Default for sport
    const q = query(
      collection(db, "questionnaires"),
      where("sport", "==", sport),
      where("isDefault", "==", true),
      where("sessionType", "==", "any"),
    );
    const defaultSnap = await getDocs(q);
    if (!defaultSnap.empty) {
      const d = defaultSnap.docs[0];
      return { id: d.id, ...(d.data() as any) } as QuestionnaireDoc;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Calculates readiness score dynamically from questions + metric values.
 * Clamps result to [1, 100].
 */
export function calcReadinessFromQuestionnaire(
  metrics: Record<string, number>,
  questions: QuestionDef[],
): number {
  let score = 0;
  for (const q of questions) {
    let val = metrics[q.metricKey] ?? 50;
    if (q.inverted) val = 101 - val;
    score += val * q.weight;
  }
  return Math.max(1, Math.min(100, Math.round(score)));
}
