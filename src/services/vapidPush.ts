// Web Push VAPID registration — Supabase path (USE_SUPABASE=1).
// Firebase path (webNotifications.ts) remains untouched.
import { Platform } from "react-native";
import { savePushSubscription } from "../lib/ctpApi";

const VAPID_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Register the VAPID service worker, subscribe to push, store in Supabase.
 * Call from a user gesture (button click). Web only.
 */
export async function registerVapidPush(): Promise<boolean> {
  if (typeof window === "undefined" || Platform.OS !== "web") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[VAPID] Browser does not support push");
    return false;
  }
  if (!VAPID_KEY) {
    console.warn("[VAPID] EXPO_PUBLIC_VAPID_PUBLIC_KEY not set");
    return false;
  }

  // Request notification permission
  if (Notification.permission === "denied") {
    console.warn("[VAPID] Notifications denied by user");
    return false;
  }
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
  }

  // Register SW
  const reg = await navigator.serviceWorker.register("/ctp-sw.js", {
    type: "classic",
    scope: "/",
  });
  await navigator.serviceWorker.ready;
  console.log("[VAPID] SW registered");

  // Subscribe
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
  });
  console.log("[VAPID] Push subscription obtained");

  const key = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!key || !auth) {
    console.error("[VAPID] Missing p256dh or auth in subscription");
    return false;
  }

  // Store in Supabase
  await savePushSubscription({
    endpoint: sub.endpoint,
    p256dh: arrayBufToB64url(key),
    authKey: arrayBufToB64url(auth),
  });
  console.log("[VAPID] Subscription saved to Supabase");
  return true;
}
