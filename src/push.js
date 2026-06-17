// src/push.js — helpery do Web Push (subscribe / unsubscribe / status)
import { sb } from "./supabase.js";
import { VAPID_PUBLIC_KEY } from "./constants.js";

// Konwersja klucza VAPID base64url → Uint8Array (wymagane przez pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  var padding = "=".repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Czy Web Push w ogóle jest wspierany w tej przeglądarce?
export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Sprawdź czy użytkownik ma już aktywną subskrypcję
export async function getPushStatus() {
  if (!isPushSupported()) return { supported: false, subscribed: false, permission: "default" };
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    return { supported: true, subscribed: !!sub, permission: Notification.permission };
  } catch (e) {
    return { supported: true, subscribed: false, permission: Notification.permission };
  }
}

// Włącz powiadomienia: poproś o zgodę, subskrybuj w przeglądarce, zapisz w Supabase
export async function subscribePush(userId) {
  if (!isPushSupported()) throw new Error("Twoja przeglądarka nie obsługuje powiadomień");
  if (!userId) throw new Error("Musisz być zalogowany");

  var permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Nie udzielono zgody na powiadomienia");

  var reg = await navigator.serviceWorker.ready;

  // Jeśli już jest subskrypcja, zwróć ją (nie tworzymy nowej)
  var sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  var json = sub.toJSON();
  await sb.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth
  }, "endpoint");

  return true;
}

// Wyłącz powiadomienia: usuń subskrypcję z przeglądarki i z Supabase
export async function unsubscribePush() {
  if (!isPushSupported()) return;
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (sub) {
      var endpoint = sub.endpoint;
      await sub.unsubscribe();
      try { await sb.from("push_subscriptions").delete("?endpoint=eq." + encodeURIComponent(endpoint)); } catch(e){}
    }
  } catch(e) { console.error("unsubscribePush:", e); }
}
