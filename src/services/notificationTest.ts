import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db, app } from "../../web/firebaseConfig.web";

export interface NotificationTestResult {
  success: boolean;
  trainingId?: string;
  message?: string;
  error?: string;
}

export async function testNotificationFlow(
  uid: string,
  teamId: string
): Promise<NotificationTestResult> {
  // 1. Verify FCM token exists
  const userSnap = await getDoc(doc(db, "users", uid));
  const tokens: string[] = (userSnap.data() as any)?.fcmWebTokens || [];
  if (tokens.length === 0) {
    return { success: false, error: "no_token" };
  }

  // 2. Create test training with endUtc = now + 30s
  const now = Timestamp.now();
  const startUtc = new Timestamp(now.seconds - 3600, now.nanoseconds);
  const endUtc = new Timestamp(now.seconds + 30, now.nanoseconds);
  const trainingId = `test_notif_${uid}_${Date.now()}`;

  await setDoc(doc(db, "teams", teamId, "trainings", trainingId), {
    title: "🧪 Notification Test",
    summary: "Notification Test",
    startUtc,
    endUtc,
    questionnaireNotified: false,
    isTestSession: true,
    status: "scheduled",
    createdBy: uid,
  });

  // 3. Send notification immediately via Cloud Function
  const functions = getFunctions(app);
  const sendTestNotif = httpsCallable(functions, "sendTestNotification");
  await sendTestNotif({ teamId, trainingId });

  // Force background mode pour déclencher onBackgroundMessage
  // si onMessage foreground n'est pas disponible
  console.log('[TEST] Notification sent — minimize the app to see it');

  return {
    success: true,
    trainingId,
    message: "Notification sent! Check your device.",
  };
}
