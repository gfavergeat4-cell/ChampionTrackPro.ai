import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirestore, doc, setDoc, arrayUnion } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { registerWebPushTokenForCurrentUser } from "./webNotifications";

const firebaseConfig = {
  apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: "championtrackpro.firebaseapp.com",
  projectId: "championtrackpro",
  storageBucket: "championtrackpro.appspot.com",
  messagingSenderId: "308674968497",
  appId: "1:308674968497:web:5f8d10b09ee98717a81b90"
};

const VAPID_KEY = "BBXBd7aspsE3Q5RsaBnNsBtycm4tbqNItUDIQwbTcGfwLMTpNHoA6KnEENqiCVKoHqniyvqKs56ohNC_ovWI4LM";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function initializeFCM() {
  try {
    if (!("Notification" in window)) {
      console.warn("[FCM] Notifications non supportees sur ce navigateur");
      return null;
    }
    if (!("serviceWorker" in navigator)) {
      console.warn("[FCM] Service Workers non supportes");
      return null;
    }

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("[FCM] Permission refusee:", permission);
        return null;
      }
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    console.log("[FCM] Service Worker enregistre:", registration.scope);
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("[FCM] Token vide - verifie la VAPID key");
      return null;
    }

    console.log("[FCM] Token obtenu:", token.substring(0, 20) + "...");
    console.log("[FCM] Token mobile registered");
    await saveFCMToken(token);

    onMessage(messaging, (payload) => {
      console.log("[FCM] Message foreground recu:", payload);
      showForegroundNotification(payload);
    });

    // FIX 6: re-register token on visibilitychange if >24h since last registration
    const FCM_LAST_REG_KEY = "fcmLastRegistration";
    const now = Date.now();
    localStorage.setItem(FCM_LAST_REG_KEY, now.toString());

    if (!window.__fcmVisibilityListenerAttached) {
      window.__fcmVisibilityListenerAttached = true;
      document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible") {
          const lastReg = localStorage.getItem(FCM_LAST_REG_KEY);
          const elapsed = lastReg ? Date.now() - parseInt(lastReg, 10) : Infinity;
          if (elapsed > 86400000) {
            console.log("[FCM] >24h since last registration — re-registering token");
            try {
              await registerWebPushTokenForCurrentUser();
              localStorage.setItem(FCM_LAST_REG_KEY, Date.now().toString());
            } catch (e) {
              console.warn("[FCM] Re-registration failed:", e);
            }
          }
        }
      });
    }

    return token;
  } catch (error) {
    console.error("[FCM] Erreur initialisation:", error);
    return null;
  }
}

async function saveFCMToken(token) {
  try {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid),
      {
        fcmWebTokens: arrayUnion(token),
        fcmToken: token,
        fcmTokenUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log('[FCM] Token saved to Firestore');
  } catch (err) {
    console.warn('[FCM] Could not save token to Firestore:', err.message);
    // Ne pas bloquer — le token est quand même valide pour cette session
  }
}

function showForegroundNotification(payload) {
  const title = payload?.notification?.title
    || payload?.data?.title
    || "ChampionTrackPro";
  const body = payload?.notification?.body
    || payload?.data?.body
    || "";
  const url = payload?.data?.url
    || payload?.data?.clickAction
    || "/";

  if (Notification.permission !== "granted") return;

  navigator.serviceWorker.ready.then((reg) => {
    console.log('[FCM] showNotification via SW — firing');
    reg.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload?.data?.tag || "ctpro-foreground",
      requireInteraction: true,
      data: { url },
    }).then(() => {
      console.log('[FCM] showNotification resolved');
    }).catch((err) => {
      console.error('[FCM] showNotification failed:', err);
    });
  }).catch((err) => {
    console.warn("[FCM] showNotification via SW failed:", err);
  });
}
