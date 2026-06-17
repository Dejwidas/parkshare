// ParkShare Service Worker
// Cache offline app shell + przygotowanie pod push notifications

var CACHE_VERSION = "v1";
var CACHE_NAME = "parkshare-" + CACHE_VERSION;

// Zasoby do wstępnego zcache'owania przy instalacji (app shell)
var PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/favicon-32.png",
  "/favicon-16.png",
  "/favicon-192.png",
  "/favicon-512.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(PRECACHE_URLS); })
      .catch(function(){ /* nie blokuj instalacji jeśli precache się nie powiedzie */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  var req = event.request;

  // Cache'ujemy tylko GET
  if (req.method !== "GET") return;

  var url = new URL(req.url);

  // Nigdy nie cache'uj requestów do Supabase (REST/Auth/Realtime) — dane muszą być zawsze świeże
  if (url.hostname.indexOf("supabase.co") !== -1) return;

  // Nawigacja (wejście na stronę / odświeżenie) — network-first, fallback do cache, fallback do "/"
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(function(res){
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, resClone); });
          return res;
        })
        .catch(function(){
          return caches.match(req).then(function(cached){ return cached || caches.match("/"); });
        })
    );
    return;
  }

  // Statyczne assety (JS/CSS/obrazy/fonty) — cache-first, fallback network
  if (/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function(cached){
        if (cached) return cached;
        return fetch(req).then(function(res){
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, resClone); });
          return res;
        });
      })
    );
    return;
  }

  // Wszystko inne — network-first z fallbackiem do cache
  event.respondWith(
    fetch(req).catch(function(){ return caches.match(req); })
  );
});

// ============================================================
// FUNDAMENT POD PUSH NOTIFICATIONS (kolejna faza)
// Te listenery są gotowe, ale nieaktywne dopóki nie dorobimy
// subskrypcji push (VAPID keys + zapis subscription w Supabase)
// ============================================================

self.addEventListener("push", function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  var title = data.title || "ParkShare";
  var options = {
    body: data.body || "",
    icon: "/favicon-192.png",
    badge: "/favicon-192.png",
    data: data.url || "/"
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  var targetUrl = event.notification.data || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function(clientList){
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
