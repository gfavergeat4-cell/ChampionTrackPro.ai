// src/services/webNotifications.ts
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, arrayUnion, getDoc } from "firebase/firestore";
import { auth, db, app } from "../../web/firebaseConfig.web";
import { getMessaging, isSupported } from "firebase/messaging";
import { Platform } from "react-native";

const VAPID_KEY = process.env.EXPO_PUBLIC_FCM_VAPID_KEY || process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

/**
 * Fonction de dÃ©bogage pour vÃ©rifier l'Ã©tat des notifications et service workers
 */
export function debugWebPushStatus(): void {
  if (typeof window === "undefined" || Platform.OS !== "web") {
    return;
  }

  console.log("[WEB PUSH][DEBUG] ===== Web Push Debug Info =====");
  console.log("[WEB PUSH][DEBUG] Notification permission:", Notification.permission);
  console.log("[WEB PUSH][DEBUG] Service Worker support:", "serviceWorker" in navigator);
  console.log("[WEB PUSH][DEBUG] VAPID key present:", !!VAPID_KEY);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      console.log("[WEB PUSH][DEBUG] Active service workers:", registrations.length);
      registrations.forEach((registration, index) => {
        console.log(`[WEB PUSH][DEBUG] SW #${index + 1}:`, {
          scope: registration.scope,
          active: !!registration.active,
          waiting: !!registration.waiting,
          installing: !!registration.installing,
        });
      });
    }).catch((err) => {
      console.error("[WEB PUSH][DEBUG] Error getting SW registrations:", err);
    });
  }

  console.log("[WEB PUSH][DEBUG] =================================");
}

/**
 * Enregistre le service worker (ESM, type: "classic") et rÃ©cupÃ¨re le token FCM.
 * Demande la permission de notification si nÃ©cessaire.
 * MUST be called from a user gesture (e.g. button click); do not call on page load (iOS/browser may block).
 * Web only, not iOS/Android native.
 */
export async function registerWebPushTokenForCurrentUser(): Promise<void> {
  // VÃ©rifier que nous sommes sur le web
  if (typeof window === "undefined" || Platform.OS !== "web") {
    console.log("[WEB PUSH] Not on web platform, skipping FCM registration");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.log("[WEB PUSH] No authenticated user, skipping FCM registration");
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("[WEB PUSH] Browser does not support notifications or service workers");
    return;
  }

  if (!VAPID_KEY) {
    console.warn("[WEB PUSH] VAPID key missing. Set EXPO_PUBLIC_FCM_VAPID_KEY or NEXT_PUBLIC_FCM_VAPID_KEY");
    return;
  }

  // Afficher l'Ã©tat de dÃ©bogage
  debugWebPushStatus();

  // Demander la permission uniquement si pas encore accordée
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[WEB PUSH] Notification permission not granted:", permission);
      return;
    }
  }

  console.log("[WEB PUSH] Notification permission granted");

  try {
    // Enregistrer le service worker AVANT d'appeler getToken
    // IMPORTANT: Le path doit Ãªtre exactement '/firebase-messaging-sw.js' (root)
    const swPath = '/firebase-messaging-sw.js';
    const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    console.log('[WEB PUSH] ===== Service Worker Registration =====');
    console.log('[WEB PUSH] Environment:', isProduction ? 'PRODUCTION (HTTPS)' : 'DEVELOPMENT');
    console.log('[WEB PUSH] Location origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
    console.log('[WEB PUSH] Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
    console.log('[WEB PUSH] Is secure context:', typeof window !== 'undefined' ? window.isSecureContext : 'N/A');
    console.log('[WEB PUSH] Protocol:', typeof window !== 'undefined' ? window.location.protocol : 'N/A');
    console.log('[WEB PUSH] Registering service worker at:', swPath);
    console.log('[WEB PUSH] Notification permission:', Notification.permission);
    
    // Lister les service workers existants AVANT l'enregistrement
    const existingRegs = await navigator.serviceWorker.getRegistrations();
    console.log('[WEB PUSH] Existing service worker registrations (before):', existingRegs.length);
    existingRegs.forEach((reg, idx) => {
      console.log(`[WEB PUSH] Existing SW #${idx + 1}:`, {
        scope: reg.scope,
        active: !!reg.active,
        waiting: !!reg.waiting,
        installing: !!reg.installing,
      });
    });
    
    // VÃ©rifier que nous sommes en HTTPS en production
    if (isProduction && window.location.protocol !== 'https:') {
      console.error('[WEB PUSH] âŒ Service workers require HTTPS in production');
      throw new Error('Service workers require HTTPS in production');
    }
    
    // FORCER l'enregistrement explicite du service worker
    console.log('[WEB PUSH] ðŸ”µ FORCING SERVICE WORKER REGISTRATION...');
    console.log('[WEB PUSH] ðŸ”µ Path:', swPath);
    console.log('[WEB PUSH] ðŸ”µ Scope:', '/');
    console.log('[WEB PUSH] ðŸ”µ Calling navigator.serviceWorker.register()...');
    
    const registration = await navigator.serviceWorker.register(swPath, {
      type: "classic",
      scope: "/",
    });

    console.log('[WEB PUSH] isSecureContext:', window.isSecureContext);
    console.log('[WEB PUSH] registration.scope:', registration.scope);
    console.log('[WEB PUSH] registration.active?.scriptURL:', registration.active?.scriptURL);

    console.log('[WEB PUSH] âœ… SERVICE WORKER REGISTERED');
    console.log('[WEB PUSH] ðŸ”µ Registration result:', {
      scope: registration.scope,
      active: !!registration.active,
      activeState: registration.active?.state,
      installing: !!registration.installing,
      installingState: registration.installing?.state,
      waiting: !!registration.waiting,
      waitingState: registration.waiting?.state,
      updateViaCache: registration.updateViaCache,
    });

    if (registration.waiting) {
      console.log('[WEB PUSH] Service worker is waiting, activating...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    const SW_READY_MS = 8000;
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SW ready timeout')), SW_READY_MS)
    );
    let readyRegistration;
    try {
      readyRegistration = await Promise.race([readyPromise, timeoutPromise]);
    } catch (e) {
      throw new Error(
        'Service worker did not become ready in time. Unregister SW + Clear site data (Chrome: DevTools > Application > Storage > Clear site data), then reload.'
      );
    }
    console.log('[WEB PUSH] navigator.serviceWorker.controller?.scriptURL:', navigator.serviceWorker.controller?.scriptURL);
    console.log('[WEB PUSH] âœ… SERVICE WORKER IS READY AND ACTIVE');
    console.log('[WEB PUSH] ðŸ”µ Ready registration details:', {
      scope: readyRegistration.scope,
      active: !!readyRegistration.active,
      activeState: readyRegistration.active?.state,
      activeScriptURL: readyRegistration.active?.scriptURL,
    });
    
    // VÃ©rification finale: s'assurer qu'un service worker est bien actif
    if (!readyRegistration.active) {
      console.error('[WEB PUSH] âŒâŒâŒ CRITICAL: Service worker registered but NOT active after ready âŒâŒâŒ');
      throw new Error('Service worker registered but not active after ready');
    }
    console.log('[WEB PUSH] âœ…âœ…âœ… VERIFIED ACTIVE SERVICE WORKER EXISTS âœ…âœ…âœ…');
    console.log('[WEB PUSH] ðŸ”µ Active worker state:', readyRegistration.active.state);
    console.log('[WEB PUSH] ðŸ”µ Active worker scriptURL:', readyRegistration.active.scriptURL);
    
    // Lister TOUS les service workers aprÃ¨s l'enregistrement
    const allRegsAfter = await navigator.serviceWorker.getRegistrations();
    console.log('[WEB PUSH] All service worker registrations (after):', allRegsAfter.length);
    allRegsAfter.forEach((reg, idx) => {
      console.log(`[WEB PUSH] SW #${idx + 1}:`, {
        scope: reg.scope,
        active: !!reg.active,
        activeState: reg.active?.state,
        activeScriptURL: reg.active?.scriptURL,
        waiting: !!reg.waiting,
        installing: !!reg.installing,
      });
    });

    // VÃ©rifier que le navigateur supporte les notifications avant d'initialiser messaging
    const supported = await isSupported();
    if (!supported) {
      console.warn('[WEB PUSH] Messaging not supported in this browser');
      return;
    }

    // Initialiser messaging avec l'instance Firebase app
    const messaging = getMessaging(app);
    console.log('[WEB PUSH] Firebase Messaging initialized');

    // Obtenir le token en passant le serviceWorkerRegistration explicitement
    // IMPORTANT: Utiliser readyRegistration qui garantit un worker actif
    console.log('[WEB PUSH] Requesting FCM token...');
    console.log('[WEB PUSH] Using service worker registration:', {
      scope: readyRegistration.scope,
      active: !!readyRegistration.active,
      activeState: readyRegistration.active?.state,
    });
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: readyRegistration,
    });

    if (!token) {
      console.warn("[WEB PUSH] âŒ No FCM token received");
      console.warn("[WEB PUSH] This usually means:");
      console.warn("[WEB PUSH] 1. Service worker is not active");
      console.warn("[WEB PUSH] 2. VAPID key is incorrect");
      console.warn("[WEB PUSH] 3. Firebase project configuration mismatch");
      return;
    }

    // Log le token (tronquÃ© pour la sÃ©curitÃ©) - LOGS TRÃˆS VISIBLES EN PROD
    const tokenPreview = token.substring(0, 20) + '...' + token.substring(token.length - 10);
    console.log('[WEB PUSH] âœ…âœ…âœ… FCM TOKEN OBTAINED SUCCESSFULLY âœ…âœ…âœ…');
    console.log('[WEB PUSH] ðŸ”µ Token preview:', tokenPreview);
    console.log('[WEB PUSH] ðŸ”µ Full token length:', token.length);
    console.log('[WEB PUSH] ðŸ”µ Token first 50 chars:', token.substring(0, 50));
    console.log('[WEB PUSH] ðŸ”µ Token last 20 chars:', token.substring(token.length - 20));

    // VÃ©rifier si le token existe dÃ©jÃ 
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    const existingTokens: string[] = userData?.fcmWebTokens || [];

    if (existingTokens.includes(token)) {
      console.log("[WEB PUSH] Token already registered for user:", user.uid);
      return;
    }

    // Ajouter le token Ã  la liste (append, ne pas overwrite)
    await setDoc(
      doc(db, "users", user.uid),
      {
        fcmWebTokens: arrayUnion(token),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Cap FCM tokens at 10 to prevent unbounded growth
    const newTokens = [...existingTokens, token];
    if (newTokens.length > 10) {
      await setDoc(
        doc(db, "users", user.uid),
        { fcmWebTokens: newTokens.slice(-10) },
        { merge: true }
      );
    }

    console.log("[WEB PUSH] FCM token saved to Firestore for user:", user.uid);
    console.log("[WEB PUSH] Total tokens for user:", Math.min(newTokens.length, 10));
  } catch (err: any) {
    console.error("[WEB PUSH] âŒ Error registering service worker or getting FCM token:", err);
    console.error("[WEB PUSH] Error details:", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      stack: err?.stack?.substring(0, 500), // Limiter la stack trace
    });
    
    // Log supplÃ©mentaire pour le dÃ©bogage en production
    if (typeof window !== 'undefined') {
      console.error("[WEB PUSH] Environment info:", {
        protocol: window.location.protocol,
        host: window.location.host,
        pathname: window.location.pathname,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        notificationSupported: 'Notification' in window,
        notificationPermission: Notification.permission,
      });
      
      // VÃ©rifier les service workers existants
      navigator.serviceWorker.getRegistrations().then((regs) => {
        console.error("[WEB PUSH] Existing service worker registrations:", regs.length);
        regs.forEach((reg, idx) => {
          console.error(`[WEB PUSH] SW #${idx}:`, {
            scope: reg.scope,
            active: !!reg.active,
            state: reg.active?.state || 'no active',
          });
        });
      }).catch((swErr) => {
        console.error("[WEB PUSH] Error getting SW registrations:", swErr);
      });
    }
  }
}

/**
 * Configure le handler pour les messages en foreground (quand l'app est ouverte)
 */
export function setupForegroundMessageHandler(): (() => void) | null {
  if (typeof window === "undefined") return null;

  try {
    const messaging = getMessaging(app);
    
    onMessage(messaging, (payload) => {
      console.log("[NOTIF] Foreground message received:", payload);
      
      const notificationTitle = payload.notification?.title || payload.data?.title || "ChampionTrackPro";
      const notificationBody = payload.notification?.body || payload.data?.body || "Questionnaire available";
      const icon = payload.notification?.icon || payload.data?.icon || "/icons/icon-192.png";
      const clickUrl = payload.data?.url || payload.data?.clickAction;

      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(notificationTitle, {
          body: notificationBody,
          icon: icon,
          data: { url: clickUrl },
        });

        notification.onclick = () => {
          if (clickUrl) {
            window.open(clickUrl, "_blank");
          }
          notification.close();
        };
      }
    });
  } catch (err) {
    console.error("[NOTIF] Error setting up foreground handler", err);
  }

  return null;
}


