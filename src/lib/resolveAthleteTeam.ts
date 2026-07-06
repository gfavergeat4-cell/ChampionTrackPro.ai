import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { createMembershipClientOnly } from "../services/membership";

/**
 * Résout le teamId de l'athlète et vérifie l'existence du membership
 * Si le membership n'existe pas mais que teamId existe, crée le membership automatiquement
 * Retourne { teamId, membershipExists }
 * 
 * Cette fonction doit être appelée avant toute requête Firestore côté athlète
 * pour s'assurer que le teamId est résolu et que le membership existe.
 */
export async function resolveAthleteTeamAndMembership(
  uid: string,
  userEmail?: string | null,
  userDisplayName?: string | null,
  autoCreateMembership: boolean = true
): Promise<{
  teamId: string | null;
  membershipExists: boolean;
}> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    console.error("[ATHLETE][DBG] user doc missing", { uid, path: userRef.path });
    throw new Error("[ATHLETE] user doc missing");
  }
  
  const user = userSnap.data() as any;
  const teamId: string | undefined = user?.teamId;
  
  console.log("[ATHLETE][DBG] user teamId:", teamId, { uid, path: userRef.path });
  
  if (!teamId) {
    return { teamId: null, membershipExists: false };
  }
  
  const memberRef = doc(db, "teams", teamId, "members", uid);
  const memberSnap = await getDoc(memberRef);
  let membershipExists = memberSnap.exists();
  
  console.log("[ATHLETE][DBG] membership path:", memberRef.path, "exists:", membershipExists);
  
  // Si le membership n'existe pas mais que teamId existe, créer le membership automatiquement
  if (!membershipExists && autoCreateMembership && teamId) {
    try {
      console.log("[ATHLETE] membership missing, creating on the fly", { teamId, uid });
      await createMembershipClientOnly({
        teamId,
        uid,
        email: userEmail || user?.email || "",
        name: userDisplayName || user?.displayName || user?.email?.split("@")[0] || uid,
      });
      console.log("[ATHLETE] membership created on the fly", { teamId, uid });
      membershipExists = true;
    } catch (error: any) {
      console.error("[ATHLETE] failed to create membership on the fly", {
        teamId,
        uid,
        error: error?.code || error?.message,
      });
      // Ne pas bloquer si la création échoue, on retourne quand même teamId
      // Les règles Firestore permettront peut-être la lecture via users/{uid}.teamId
    }
  }
  
  return { teamId, membershipExists };
}

