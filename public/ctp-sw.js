// ctp-sw.js — Service Worker Web Push VAPID (zero Firebase dependency)
// importScripts marker for build validation (classic mode)
self.addEventListener("install", function() { self.skipWaiting(); });
self.addEventListener("activate", function(event) { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* ignore */ }
  var title = data.title || "ChampionTrackPro";
  var body = data.body || "Tell us — how did that session hit you?";
  var url = data.url || "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "/icons/icon-192-v2.png",
      badge: "/icons/badge-72.png",
      tag: data.tag || "ctpro",
      renotify: false,
      requireInteraction: false,
      data: { url: url, trainingId: data.trainingId, teamId: data.teamId },
      actions: [{ action: "open_questionnaire", title: "Tell us \u2192" }]
    })
  );
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
