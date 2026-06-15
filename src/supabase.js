var SUPABASE_URL = "https://rbpnmvzggshgytzascqz.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicG5tdnpnZ3NoZ3l0emFzY3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzE2MDAsImV4cCI6MjA5MzA0NzYwMH0.ahtUVzG2CDbagn8PtO4keBrey1NtbIKVcZHDQsq8vjc";

export var _authToken = null;
export function setAuthToken(t) { _authToken = t; }

export function saveSession(user, token) {
  try { sessionStorage.setItem("ps_token", token||""); sessionStorage.setItem("ps_user", JSON.stringify(user)); } catch(e) {}
}
export function loadSession() {
  try { var token=sessionStorage.getItem("ps_token"); var user=JSON.parse(sessionStorage.getItem("ps_user")); if(token&&user) return {token:token,user:user}; } catch(e) {}
  return null;
}
export function clearSession() {
  try { sessionStorage.removeItem("ps_token"); sessionStorage.removeItem("ps_user"); } catch(e) {}
}

function sbHeaders() {
  return { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":"Bearer "+(_authToken||SUPABASE_KEY), "Prefer":"return=representation" };
}

async function sbReq(method, table, qs, body) {
  var r = await fetch(SUPABASE_URL+"/rest/v1/"+table+(qs||""), { method:method, headers:sbHeaders(), body:body?JSON.stringify(body):null });
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
      upsert: function(data,conflict) { return sbReq("POST",table,"?on_conflict="+(conflict||"id")+"&select=*",Array.isArray(data)?data:[data]); }
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
  }
};
