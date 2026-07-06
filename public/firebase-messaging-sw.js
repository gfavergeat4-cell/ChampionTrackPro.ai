importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const firebaseConfig = {
  apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: "championtrackpro.firebaseapp.com",
  projectId: "championtrackpro",
  storageBucket: "championtrackpro.appspot.com",
  messagingSenderId: "308674968497",
  appId: "1:308674968497:web:5f8d10b09ee98717a81b90"
};

// Wrap init in try-catch: top-level throw causes "SW script evaluation failed"
// on devices where Push API is unavailable or firebase.messaging() throws.
var messaging;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
} catch (e) {
  console.error("[SW] Firebase messaging init failed:", e);
}

if (messaging) messaging.onBackgroundMessage(function(payload) {
  console.log("[SW] Background message received:", payload);
  const title = payload?.notification?.title || payload?.data?.title || "ChampionTrackPro ⚡";
  const body = payload?.notification?.body || payload?.data?.body || "Tell us — how did that session hit you?";
  const data = payload?.data || {};
  const trainingId = data.trainingId;
  const teamId = data.teamId;
  const url = trainingId
    ? `/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`
    : data.url || data.clickAction || "/";

  return self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192-v2.png",
    badge: "/icons/badge-72.png",
    tag: trainingId ? `questionnaire-${trainingId}` : (data.tag || "ctpro-questionnaire"),
    renotify: false,
    requireInteraction: false,
    silent: false,
    data: { url, trainingId, teamId },
    actions: [{ action: "open_questionnaire", title: "Tell us →" }],
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const trainingId = event.notification?.data?.trainingId;
  const teamId = event.notification?.data?.teamId;
  const url = trainingId
    ? `/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`
    : (event.notification?.data?.url || "/");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
