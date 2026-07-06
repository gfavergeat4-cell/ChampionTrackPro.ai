import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Renvoie le statut de réponse de l'athlète pour un entraînement donné.
 * Utilise getDoc() direct sur responses/{uid} — pas de query() ni de list().
 */
export async function getMyResponseStatus(teamId, trainingId, uid) {
  const ref = doc(db, "teams", teamId, "trainings", trainingId, "responses", uid);
  try {
    console.log("[FS][ATHLETE] get response", { path: ref.path });
    const snap = await getDoc(ref);
    if (!snap.exists()) return "unknown";
    const d = snap.data() || {};
    return d?.status ?? "unknown";
  } catch (e) {
    if (e?.code === "permission-denied") {
      console.warn("[FS][RESP] permission denied (expected, fallback unknown)", { path: ref.path });
      return "unknown";
    }
    throw e;
  }
}

/**
 * Vérifie si un utilisateur a répondu à un événement
 * Retourne un objet avec hasResponse, responseId et responseStatus
 * Utilise getDoc() direct sur responses/{uid} — pas de query() ni de list().
 */
export async function getMyResponseInfo(teamId, trainingId, uid) {
  const ref = doc(db, "teams", teamId, "trainings", trainingId, "responses", uid);
  try {
    console.log("[FS][ATHLETE] get response info", { path: ref.path });
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { hasResponse: false, responseStatus: "unknown" };
    }
    const d = snap.data() || {};
    const status = d?.status ?? "unknown";
    return {
      hasResponse: true,
      responseId: snap.id,
      responseStatus: status === "completed" ? "completed" : status,
    };
  } catch (e) {
    if (e?.code === "permission-denied") {
      console.warn("[FS][RESP] permission denied (expected, fallback unknown)", { path: ref.path });
      return { hasResponse: false, responseStatus: "unknown" };
    }
    throw e;
  }
}

/**
 * Sauvegarde une réponse de questionnaire pour un training
 * @param teamId - ID de l'équipe
 * @param trainingId - ID du training
 * @param uid - ID de l'utilisateur
 * @param responseData - Données de la réponse (sliders, etc.)
 */
/**
 * Sauvegarde une réponse de questionnaire pour un training
 * @param teamId - ID de l'équipe
 * @param trainingId - ID du training
 * @param uid - ID de l'utilisateur
 * @param responseData - Données de la réponse (sliders, etc.)
 */
export async function saveQuestionnaireResponse(
  teamId: string,
  trainingId: string,
  uid: string,
  responseData: Record<string, any>
) {
  const ref = doc(db, "teams", teamId, "trainings", trainingId, "responses", uid);
  
  console.log("[FS][RESP] Saving questionnaire response", {
    path: ref.path,
    teamId,
    trainingId,
    uid,
    responseDataKeys: Object.keys(responseData),
  });
  
  try {
    await setDoc(ref, {
      userId: uid,
      teamId,
      trainingId,
      status: "completed",
      submittedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      ...responseData,
    }, { merge: true });
    
    console.log("[FS][RESP] questionnaire response saved successfully", { path: ref.path });
  } catch (error: any) {
    console.error("[FS][RESP] Error saving questionnaire response", {
      path: ref.path,
      code: error?.code,
      message: error?.message,
      error,
    });
    
    // Log détaillé pour diagnostiquer les problèmes de permissions
    if (error?.code === "permission-denied") {
      console.error("[FS][RESP] Permission denied details", {
        teamId,
        trainingId,
        uid,
        path: ref.path,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
    
    throw error;
  }
}