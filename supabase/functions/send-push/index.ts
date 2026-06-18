// supabase/functions/send-push/index.ts
// Edge Function: wysyła powiadomienia push dla dwóch zdarzeń:
//   type="new_booking"     → do właściciela miejsca o nowej rezerwacji  (domyślny)
//   type="owner_cancelled" → do rezerwującego o anulowaniu rezerwacji
//
// Input: POST { slot_id: string, type?: "new_booking" | "owner_cancelled" }
//
// UWAGA: dla "owner_cancelled" funkcję trzeba wywołać ZANIM rezerwacja zostanie
// wyczyszczona z tabeli slots — inaczej nie da się ustalić odbiorcy.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@parkshare.pl";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const reqBody = await req.json();
    const slot_id = reqBody.slot_id;
    const type = reqBody.type || "new_booking";
    if (!slot_id) return json({ error: "slot_id required" }, 400);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: slot, error: e1 } = await supa
      .from("slots")
      .select("id, spot_id, date, all_day, from_time, to_time, booked_by, booked_by_uid")
      .eq("id", slot_id)
      .single();
    if (e1 || !slot) return json({ error: "slot not found" }, 404);

    const { data: spot, error: e2 } = await supa
      .from("spots")
      .select("id, name, owner_uid")
      .eq("id", slot.spot_id)
      .single();
    if (e2 || !spot) return json({ error: "spot not found" }, 404);

    const when = slot.all_day ? "cały dzień" : (slot.from_time + "–" + slot.to_time);

    let recipient_uid: string | null;
    let title: string;
    let body_text: string;

    if (type === "owner_cancelled") {
      recipient_uid = slot.booked_by_uid;
      title = "Rezerwacja anulowana";
      body_text = "Właściciel anulował Twoją rezerwację miejsca „" + spot.name + "” na " + slot.date + " (" + when + ")";
    } else {
      // new_booking (default)
      recipient_uid = spot.owner_uid;
      title = "Nowa rezerwacja w ParkShare";
      body_text = (slot.booked_by || "Ktoś") + " zarezerwował Twoje miejsce „" + spot.name + "” na " + slot.date + " (" + when + ")";
    }

    if (!recipient_uid) return json({ ok: true, sent: 0, reason: "no recipient" });

    const { data: subs, error: e3 } = await supa
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", recipient_uid);
    if (e3) return json({ error: e3.message }, 500);
    if (!subs || subs.length === 0) return json({ ok: true, sent: 0, reason: "no subscriptions" });

    const payload = JSON.stringify({ title, body: body_text, url: "/" });

    let sent = 0;
    const expired: string[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.id);
        else console.error("push send error:", err.statusCode, err.body);
      }
    }
    if (expired.length > 0) await supa.from("push_subscriptions").delete().in("id", expired);

    return json({ ok: true, sent, expired: expired.length, type });
  } catch (e: any) {
    console.error(e);
    return json({ error: e.message || "internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
