// Thelawalaa POS service worker. Its only job: show the new-online-order
// alerts the server pushes (lib/push.ts), and open the POS when tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Thelawalaa", body: event.data ? event.data.text() : "" };
  }
  // Every push must show a notification — iOS stops delivering to sites that don't.
  event.waitUntil(
    self.registration.showNotification(data.title || "New order", {
      body: data.body || "",
      tag: data.tag || "order",
      renotify: true,
      requireInteraction: true,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/admin" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const pos = windows.find((w) => new URL(w.url).pathname.startsWith("/admin"));
      if (pos) return pos.focus();
      return self.clients.openWindow(url);
    })()
  );
});
