import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export type JoinTeamOptions = {
  teamId: string;
  uid: string;
  email?: string;
  name?: string;
};

/**
 * Version client-only : crée le membership et met à jour l'utilisateur
 * SANS toucher au document teams/{teamId} (pas de transaction, pas de compteur)
 * 
 * Cette fonction est appelée lors de l'inscription d'un athlète.
 * Elle écrit uniquement :
 * - teams/{teamId}/members/{uid} (création)
 * - users/{uid} (mise à jour)
 * 
 * Le compteur teams.members sera géré côté serveur ou ignoré pour l'instant.
 */
export async function createMembershipClientOnly({
  teamId,
  uid,
  email,
  name,
}: {
  teamId: string;
  uid: string;
  email?: string;
  name?: string;
}) {
  const memberRef = doc(db, "teams", teamId, "members", uid);
  const userRef = doc(db, "users", uid);
  const displayName = (name && name.trim()) || (email ? email.split("@")[0] : uid);

  try {
    // 1) Créer le membership (règle: allow create if request.auth.uid == uid)
    await setDoc(
      memberRef,
      {
        uid,
        name: displayName,
        email: email ?? "",
        role: "athlete",
        joinedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 2) Lier l'utilisateur à l'équipe
    // NOTE: role is intentionally NOT written here — the authoritative role is set by admins
    // and must never be overwritten by membership creation (would break coach accounts).
    await setDoc(
      userRef,
      {
        teamId,
        email: email ?? "",
        displayName: displayName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log("[join] membership created (client-only)", { teamId, uid });
  } catch (error: any) {
    // Log explicite pour les erreurs permission-denied
    if (error?.code === "permission-denied" || error?.message?.includes("permission")) {
      console.error("[membership] permission-denied error (client-only):", {
        code: error?.code,
        message: error?.message,
        teamId,
        uid,
        operation: "createMembershipClientOnly",
      });
    } else {
      console.error("[membership] error (client-only):", {
        code: error?.code,
        message: error?.message,
        teamId,
        uid,
      });
    }
    throw error;
  }
}

/**
 * @deprecated Utiliser createMembershipClientOnly à la place
 * Cette fonction utilise une transaction qui lit teams/{teamId}, ce qui peut échouer
 * si l'utilisateur n'est pas encore membre de l'équipe.
 */
export async function joinTeamAndCreateMembership(opts: JoinTeamOptions) {
  console.warn("[membership] joinTeamAndCreateMembership is deprecated, use createMembershipClientOnly");
  return createMembershipClientOnly(opts);
}

