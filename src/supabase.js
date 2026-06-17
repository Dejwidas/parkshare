var SUPABASE_URL = "https://rbpnmvzggshgytzascqz.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicG5tdnpnZ3NoZ3l0emFzY3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzE2MDAsImV4cCI6MjA5MzA0NzYwMH0.ahtUVzG2CDbagn8PtO4keBrey1NtbIKVcZHDQsq8vjc";

export var _authToken = null;
export function setAuthToken(t) { _authToken = t; }

// ── Sesja: localStorage + refresh_token + expires_at ─────────────────────────
// Format w storage: { user, access_token, refresh_token, expires_at (ms) }

var SESSION_KEY = "ps_session";
var LEGACY_TOKEN_KEY = "ps_token";   // dla migracji ze starych sessionStorage
var LEGACY_USER_KEY = "ps_user";

// saveSession akceptuje dwa formaty dla zgodności:
//   saveSession(user, "stringToken")            — stary: tylko token, brak refresh (sesja wygaśnie po ~godzinie)
//   saveSession(user, supabaseAuthDataObject)   — nowy: pełne dane z signIn/signUp, z refresh_token
export function saveSession(user, tokenOrAuthData) {
  try {
    var data;
    if (typeof tokenOrAuthData === "string") {
      data = { user: user, access_token: tokenOrAuthData, refresh_token: null, expires_at: null };
    } else if (tokenOrAuthData && typeof tokenOrAuthData === "object") {
      var expSec = tokenOrAuthData.expires_at;            // sekundy unix
      var expMs = expSec ? expSec * 1000 : (tokenOrAuthData.expires_in ? Date.now() + tokenOrAuthData.expires_in * 1000 : null);
      data = {
        user: user,
        access_token: tokenOrAuthData.access_token || null,
        refresh_token: tokenOrAuthData.refresh_token || null,
        expires_at: expMs
      };
    } else {
      data = { user: user, access_token: null, refresh_token: null, expires_at: null };
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    // sprzątanie starych kluczy z sessionStorage gdyby ktoś migrował
    try { sessionStorage.removeItem(LEGACY_TOKEN_KEY); sessionStorage.removeItem(LEGACY_USER_KEY); } catch(e){}
  } catch(e) {}
}

export function loadSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (d && d.user && d.access_token) {
        return { user: d.user, token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at };
      }
    }
    // migracja ze starych sessionStorage (jednorazowa)
    var legacyToken = sessionStorage.getItem(LEGACY_TOKEN_KEY);
    var legacyUser = sessionStorage.getItem(LEGACY_USER_KEY);
    if (legacyToken && legacyUser) {
      var u = JSON.parse(legacyUser);
      saveSession(u, legacyToken);
      return { user: u, token: legacyToken, refresh_token: null, expires_at: null };
    }
  } catch(e) {}
  return null;
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_USER_KEY);
  } catch(e) {}
}

// Wymienia refresh_token na nowy access_token. Zwraca nowy token lub null jeśli się nie udało.
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) return null;
  try {
    var r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!r.ok) return null;
    var d = await r.json();
    if (!d.access_token) return null;
    return d;  // { access_token, refresh_token, expires_in, expires_at, user, ... }
  } catch(e) { return null; }
}

// Wywoływane na starcie apki. Sprawdza zapisaną sesję, w razie potrzeby odświeża token.
// Zwraca { user, token } gdy sesja jest ważna; null gdy trzeba zalogować się od nowa.
export async function ensureValidSession() {
  var s = loadSession();
  if (!s) return null;

  // Brak danych do refreshu (stara sesja sprzed migracji) — używamy starego tokena póki nie wygaśnie, na zwykłe 401 i tak wyrzuci usera
  if (!s.refresh_token || !s.expires_at) {
    setAuthToken(s.token);
    return { user: s.user, token: s.token };
  }

  // Token wygasa za mniej niż 60 sek (lub już wygasł) → odśwież
  var needsRefresh = (s.expires_at - Date.now()) < 60_000;
  if (!needsRefresh) {
    setAuthToken(s.token);
    return { user: s.user, token: s.token };
  }

  var refreshed = await refreshAccessToken(s.refresh_token);
  if (!refreshed) {
    // refresh_token też wygasł lub nieważny → wyrzuć sesję
    clearSession();
    return null;
  }
  saveSession(s.user, refreshed);
  setAuthToken(refreshed.access_token);
  return { user: s.user, token: refreshed.access_token };
}

// ── Klient REST ──────────────────────────────────────────────────────────────

function sbHeaders(extra) {
  var h = { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":"Bearer "+(_authToken||SUPABASE_KEY), "Prefer":"return=representation" };
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}

async function sbReq(method, table, qs, body, extraHeaders) {
  var r = await fetch(SUPABASE_URL+"/rest/v1/"+table+(qs||""), { method:method, headers:sbHeaders(extraHeaders), body:body?JSON.stringify(body):null });
  if (!r.ok) { var e=await r.text(); throw new Error(e); }
  var ct = r.headers.get("content-type")||"";
  return ct.includes("json") ? r.json() : [];
}

export var sb = {
  from: function(table) {
    return {
      select: function(cols,qs) { return sbReq("GET",table,"?select="+(cols||"*")+(qs||"")); },
      insert: function(data) { return sbReq("POST",table,"?select=*",Array.isArray(data)?data:[data]); },
      update: function(data,qs) { return sbReq("PATCH",table,(qs||"")+"&select=*",data); },
      delete: function(qs) { return sbReq("DELETE",table,qs); },
      upsert: function(data, conflict) { return sbReq("POST", table, "?on_conflict="+(conflict||"id")+"&select=*", Array.isArray(data)?data:[data], {"Prefer":"resolution=merge-duplicates,return=representation"}); }
    };
  },
  rpc: function(fn, args) {
    return sbReq("POST", "rpc/"+fn, "", args || {});
  },
  auth: {
    signUp: async function(email,password,name) {
      var r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({email:email,password:password,data:{name:name}})});
      var d=await r.json();
      if(!r.ok) throw new Error(d.msg||d.error_description||d.error||"Signup failed");
      return d;
    },
    signIn: async function(email,password) {
      var r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({email:email,password:password})});
      var d=await r.json();
      if(!r.ok) throw new Error(d.msg||d.error_description||(d.error&&d.error.message)||d.error||"Login failed");
      if(!d.user) throw new Error("Login failed");
      return d;
    },
    signOut: async function() {
      try {
        await fetch(SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+(_authToken||"")}});
      } catch(e) {}
      _authToken=null;
    }
  },
  channel: function(name) {
    var handlers = [];
    return {
      on: function(event, filter, cb) {
        handlers.push({ cb: cb });
        return {
          subscribe: function() {
            var wsUrl = SUPABASE_URL.replace("https","wss")+"/realtime/v1/websocket?apikey="+SUPABASE_KEY+"&vsn=1.0.0";
            var ws = new WebSocket(wsUrl);
            ws.onopen = function() {
              ws.send(JSON.stringify({ topic:"realtime:"+name, event:"phx_join", payload:{ config:{ broadcast:{self:true}, postgres_changes:[{event:"*",schema:"public"}] } }, ref:"1" }));
            };
            ws.onmessage = function(msg) {
              try {
                var d = JSON.parse(msg.data);
                if (d.event==="postgres_changes") { handlers.forEach(function(h){ try{h.cb(d.payload);}catch(e){} }); }
                if (d.topic==="phoenix") { ws.send(JSON.stringify({topic:"phoenix",event:"heartbeat",payload:{},ref:"hb"})); }
              } catch(e) {}
            };
            return { unsubscribe: function() { try{ws.close();}catch(e){} } };
          }
        };
      }
    };
  },
  invoke: async function(fnName, body) {
    var r = await fetch(SUPABASE_URL + "/functions/v1/" + fnName, {
      method: "POST",
      headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":"Bearer "+(_authToken||SUPABASE_KEY) },
      body: JSON.stringify(body || {})
    });
    if (!r.ok) { var e = await r.text(); throw new Error(e); }
    var ct = r.headers.get("content-type")||"";
    return ct.includes("json") ? r.json() : null;
  },
};