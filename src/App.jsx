import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://rbpnmvzggshgytzascqz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicG5tdnpnZ3NoZ3l0emFzY3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzE2MDAsImV4cCI6MjA5MzA0NzYwMH0.ahtUVzG2CDbagn8PtO4keBrey1NtbIKVcZHDQsq8vjc";

const DAYS_SHORT = ["Pn","Wt","Śr","Cz","Pt","Sb","Nd"];
const MONTHS = ["stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"];
const MONTHS_FULL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const DAYS_PL = ["Niedziela","Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota"];
const CANCEL_WINDOW_MS = 60 * 60 * 1000;
const today = new Date(); today.setHours(0,0,0,0);

const f = {
  dateKey: function(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); },
  addDays: function(d,n) { var r=new Date(d); r.setDate(r.getDate()+n); return r; },
  isSameDay: function(a,b) { return f.dateKey(a)===f.dateKey(b); },
  daysInMonth: function(y,m) { return new Date(y,m+1,0).getDate(); },
  firstDay: function(y,m) { return (new Date(y,m,1).getDay()+6)%7; },
  fmtDate: function(d) { return d.getDate()+" "+MONTHS[d.getMonth()]+" "+d.getFullYear(); },
  parseDate: function(str) { var p=str.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]); },
  genId: function() { return Math.random().toString(36).slice(2,10); },
  canCancel: function(at) { return at && (Date.now()-at)<CANCEL_WINDOW_MS; },
  timeLeft: function(at) { var ms=CANCEL_WINDOW_MS-(Date.now()-at); var m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000); return ms>0?(m+"m "+s+"s"):null; },
};

var _authToken = null;

function sbHeaders() {
  return { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":"Bearer "+(_authToken||SUPABASE_KEY), "Prefer":"return=representation" };
}
async function sbReq(method, table, qs, body) {
  var r = await fetch(SUPABASE_URL+"/rest/v1/"+table+(qs||""), { method:method, headers:sbHeaders(), body:body?JSON.stringify(body):null });
  if (!r.ok) { var e=await r.text(); throw new Error(e); }
  var ct = r.headers.get("content-type")||"";
  return ct.includes("json") ? r.json() : [];
}
var sb = {
  from: function(table) {
    return {
      select: function(cols,qs) { return sbReq("GET",table,"?select="+(cols||"*")+(qs||"")); },
      insert: function(data) { return sbReq("POST",table,"?select=*",Array.isArray(data)?data:[data]); },
      update: function(data,qs) { return sbReq("PATCH",table,(qs||"")+"&select=*",data); },
      delete: function(qs) { return sbReq("DELETE",table,qs); },
      upsert: function(data,conflict) { return sbReq("POST",table,"?on_conflict="+(conflict||"id")+"&select=*",Array.isArray(data)?data:[data]); }
    };
  },
  auth: {
    signUp: async function(email,password,name) {
      var r=await fetch(SUPABASE_URL+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({email:email,password:password,data:{name:name}})});
      var d=await r.json(); if(d.error) throw new Error(d.error.message||d.msg); return d;
    },
    signIn: async function(email,password) {
      var r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({email:email,password:password})});
      var d=await r.json(); if(d.error) throw new Error(d.error.message||d.msg); if(d.error_description) throw new Error(d.error_description); return d;
    },
    signOut: async function() {
      await fetch(SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+(_authToken||"")}});
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
            var wsUrl = SUPABASE_URL.replace("https","wss") + "/realtime/v1/websocket?apikey=" + SUPABASE_KEY + "&vsn=1.0.0";
            var ws = new WebSocket(wsUrl);
            ws.onopen = function() {
              ws.send(JSON.stringify({ topic:"realtime:"+name, event:"phx_join", payload:{ config:{ broadcast:{self:true}, postgres_changes:[{event:"*",schema:"public"}] } }, ref:"1" }));
            };
            ws.onmessage = function(msg) {
              try {
                var d = JSON.parse(msg.data);
                if (d.event === "postgres_changes") {
                  handlers.forEach(function(h) { try { h.cb(d.payload); } catch(e) {} });
                }
                if (d.topic === "phoenix") {
                  ws.send(JSON.stringify({ topic:"phoenix", event:"heartbeat", payload:{}, ref:"hb" }));
                }
              } catch(e) {}
            };
            return { unsubscribe: function() { try { ws.close(); } catch(e) {} } };
          }
        };
      }
    };
  }
};

function Footer() {
  return (
    <div style={{textAlign:"center",padding:"20px 0 8px"}}>
      <div style={{fontSize:11,color:"#374151"}}>v0.25 · <a href="mailto:kontakt@parkshare.pl" style={{color:"#4b5563",textDecoration:"none"}}>kontakt@parkshare.pl</a></div>
    </div>
  );
}

function ParkLogo({size}) {
  size = size || 32;
  return (
    <div style={{width:size,height:size,borderRadius:Math.round(size*0.22),background:"#7c3aed",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <span style={{fontSize:Math.round(size*0.58),fontWeight:800,color:"#fff",fontFamily:"system-ui,sans-serif",lineHeight:1,letterSpacing:"-0.5px"}}>P</span>
    </div>
  );
}

var c = {
  app: {fontFamily:"system-ui,sans-serif",minHeight:"100vh",background:"#0f1117",color:"#e8eaf0"},
  hdr: {background:"#1a1d2e",borderBottom:"1px solid #2a2d3e",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  wrap: {maxWidth:680,margin:"0 auto",padding:"20px 16px 60px"},
  navBtn: function(a){return {padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:a?"#7c3aed":"transparent",color:a?"#fff":"#9ca3af"};},
  card: function(hi){return {background:"#1a1d2e",border:"1px solid "+(hi?"#7c3aed":"#2a2d3e"),borderRadius:12,padding:16,marginBottom:12};},
  btn: function(v){var m={primary:["#7c3aed","#fff"],ghost:["transparent","#7c3aed"],danger:["#3b0d0d","#f87171"],success:["#064e3b","#6ee7b7"],warn:["#451a03","#fbbf24"],admin:["#1e1b4b","#a78bfa"],default:["#1f2230","#9ca3af"]}[v||"default"];return {padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:m[0],color:m[1]};},
  input: {width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #2a2d3e",background:"#0f1117",color:"#e8eaf0",fontSize:14,boxSizing:"border-box"},
  textarea: {width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #2a2d3e",background:"#0f1117",color:"#e8eaf0",fontSize:14,boxSizing:"border-box",resize:"vertical",minHeight:72,fontFamily:"inherit"},
  label: {fontSize:12,color:"#9ca3af",marginBottom:5,display:"block"},
  arrow: {background:"none",border:"1px solid #2a2d3e",borderRadius:8,color:"#a78bfa",cursor:"pointer",fontSize:18,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"},
  weekBar: {display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:16},
  weekCell: function(act,cnt){return {borderRadius:8,padding:"6px 4px",textAlign:"center",cursor:"pointer",background:act?"#7c3aed":cnt>0?"#0d2a1e":"#1a1d2e",border:"1px solid "+(act?"#7c3aed":"#2a2d3e")};},
  dayNav: {display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,padding:"12px 16px",marginBottom:16},
  overlay: {position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  modal: {background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:14,padding:24,width:"100%",maxWidth:400,maxHeight:"90vh",overflowY:"auto"},
  toast: function(t){return {position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:t==="success"?"#065f46":t==="warn"?"#451a03":"#7f1d1d",color:t==="success"?"#6ee7b7":t==="warn"?"#fbbf24":"#fca5a5",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:999};},
  calGrid: {display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4},
  calCell: function(has,past,sel){return {borderRadius:6,aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,cursor:past?"default":"pointer",opacity:past?0.3:1,background:sel?"#7c3aed":has?"#065f46":"transparent",color:sel?"#fff":has?"#6ee7b7":"#4b5563",border:"1px solid "+(sel?"#7c3aed":has?"#065f46":"#1f2230")};},
  slotRow: {display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f1117",borderRadius:8,padding:"8px 12px",marginBottom:6},
  noteBubble: {background:"#12151f",border:"1px solid #2a2d3e",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#c4b5fd",lineHeight:1.5,marginTop:10},
  divider: {borderTop:"1px solid #1f2230",margin:"12px 0"},
  linkBox: {background:"#0f1117",border:"1px solid #2a2d3e",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#6b7280",wordBreak:"break-all",display:"flex",alignItems:"center",gap:10},
  avatar: {width:30,height:30,borderRadius:"50%",background:"#7c3aed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0},
  spinner: {width:32,height:32,border:"3px solid #2a2d3e",borderTop:"3px solid #7c3aed",borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  memberRow: {display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f1117",borderRadius:8,padding:"10px 12px",marginBottom:6},
  roleBadge: function(r){return {display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:r==="admin"?"#1e1b4b":"#1a1d2e",color:r==="admin"?"#a78bfa":"#6b7280",border:"1px solid "+(r==="admin"?"#4338ca":"#2a2d3e")};},
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
function AuthScreen({onAuth}) {
  var [mode,setMode]=useState("choose");
  var [name,setName]=useState(""); var [email,setEmail]=useState(""); var [pass,setPass]=useState("");
  var [err,setErr]=useState(""); var [loading,setLoading]=useState(false); var [verifyMsg,setVerifyMsg]=useState(false);

  async function register() {
    if(!name.trim()||!email.trim()||!pass.trim()){setErr("Uzupełnij wszystkie pola.");return;}
    if(pass.length<6){setErr("Hasło musi mieć co najmniej 6 znaków.");return;}
    setLoading(true);setErr("");
    try{await sb.auth.signUp(email.trim(),pass,name.trim());setVerifyMsg(true);}
    catch(e){setErr("Błąd rejestracji: "+e.message);}finally{setLoading(false);}
  }
  async function login() {
    if(!email.trim()||!pass.trim()){setErr("Uzupełnij pola.");return;}
    setLoading(true);setErr("");
    try{
      var data=await sb.auth.signIn(email.trim(),pass);
      _authToken=data.access_token;
      var uname=(data.user&&data.user.user_metadata&&data.user.user_metadata.name)||email;
      onAuth({uid:data.user.id,name:uname,email:data.user.email,guest:false,token:data.access_token});
    }catch(e){
      var msg=e.message;
      if(msg.includes("Email not confirmed"))msg="Potwierdź swój adres e-mail przed logowaniem.";
      if(msg.includes("Invalid login"))msg="Nieprawidłowy e-mail lub hasło.";
      setErr(msg);
    }finally{setLoading(false);}
  }

  if(verifyMsg) return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{marginBottom:16}}><ParkLogo size={56}/></div>
      <div style={{...c.card(true),maxWidth:360,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:600,color:"#e8eaf0",marginBottom:8}}>Sprawdź swoją skrzynkę!</div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:16,lineHeight:1.6}}>Wysłaliśmy link weryfikacyjny na adres<br/><span style={{color:"#a78bfa"}}>{email}</span><br/><br/>Kliknij w link w e-mailu, a następnie wróć tutaj i się zaloguj.</div>
        <button style={{...c.btn("primary"),width:"100%"}} onClick={function(){setVerifyMsg(false);setMode("login");}}>Przejdź do logowania</button>
      </div>
    </div>
  );

  if(mode==="choose") return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{fontSize:40,marginBottom:8}}><ParkLogo size={56}/></div>
      <div style={{fontSize:24,fontWeight:600,color:"#a78bfa",marginBottom:4}}>ParkShare</div>
      <div style={{fontSize:13,color:"#4b5563",marginBottom:40}}>Wynajem miejsc parkingowych na osiedlu</div>
      <div style={{width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:10}}>
        <button style={{...c.btn("primary"),width:"100%",padding:"12px"}} onClick={function(){setMode("register");}}>Utwórz konto</button>
        <button style={{...c.btn("default"),width:"100%",padding:"12px"}} onClick={function(){setMode("login");}}>Zaloguj się</button>
        <button style={{...c.btn("ghost"),width:"100%",padding:"12px",border:"1px solid #2a2d3e"}} onClick={function(){onAuth({uid:"guest-"+f.genId(),name:"Gość",email:"",guest:true});}}>Kontynuuj jako gość</button>
        <div style={{fontSize:11,color:"#374151",textAlign:"center",marginTop:4}}>Goście mogą przeglądać i rezerwować, ale nie mogą zarządzać miejscami.</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{width:"100%",maxWidth:340}}>
        <button style={{...c.btn("ghost"),paddingLeft:0,marginBottom:20,fontSize:13}} onClick={function(){setMode("choose");setErr("");}}>← Wróć</button>
        <div style={c.card(true)}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:16}}>{mode==="register"?"Utwórz konto":"Zaloguj się"}</div>
          {mode==="register"&&<input style={{...c.input,marginBottom:10}} placeholder="Imię i nazwisko" value={name} onChange={function(e){setName(e.target.value);}}/>}
          <input style={{...c.input,marginBottom:10}} type="email" placeholder="E-mail" value={email} onChange={function(e){setEmail(e.target.value);}}/>
          <input style={{...c.input,marginBottom:10}} type="password" placeholder="Hasło (min. 6 znaków)" value={pass} onChange={function(e){setPass(e.target.value);}}/>
          {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{err}</div>}
          <button style={{...c.btn("primary"),width:"100%",opacity:loading?0.6:1}} onClick={mode==="register"?register:login} disabled={loading}>
            {loading?"Ładowanie...":mode==="register"?"Zarejestruj się":"Zaloguj"}
          </button>
          <div style={{fontSize:12,color:"#4b5563",textAlign:"center",marginTop:12,cursor:"pointer"}} onClick={function(){setMode(mode==="register"?"login":"register");setErr("");}}>
            {mode==="register"?"Masz już konto? Zaloguj się":"Nie masz konta? Zarejestruj się"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────────────────────────────
function Landing({user,onJoin,onNew,onLogout}) {
  var [code,setCode]=useState(""); var [err,setErr]=useState("");
  var [myGroups,setMyGroups]=useState([]); var [loading,setLoading]=useState(true); var [showJoin,setShowJoin]=useState(false);

  useEffect(function(){
    if(user.guest){setLoading(false);return;}
    (async function(){
      try{
        var ugs=await sb.from("user_groups").select("group_id","&user_id=eq."+user.uid);
        if(!ugs.length){setLoading(false);return;}
        var ids=ugs.map(function(r){return r.group_id;});
        var groups=await sb.from("groups").select("*","&id=in.("+ids.join(",")+")");
        setMyGroups(groups);
        if(groups.length===1) onJoin(groups[0].id);
      }catch(e){}finally{setLoading(false);}
    })();
  },[]);

  async function join(){
    var t=code.trim();
    try{
      var rows=await sb.from("groups").select("*","&id=eq."+t);
      if(!rows.length){setErr("Nie znaleziono grupy o tym kodzie.");return;}
      if(!user.guest) await sb.from("user_groups").upsert({user_id:user.uid,group_id:t,role:"member",user_name:user.name,user_email:user.email},"user_id,group_id");
      setErr("");onJoin(t);
    }catch(e){setErr("Błąd: "+e.message);}
  }

  if(loading) return <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style><div style={c.spinner}/></div>;

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:40,marginBottom:8}}><ParkLogo size={56}/></div>
      <div style={{fontSize:24,fontWeight:600,color:"#a78bfa",marginBottom:2}}>ParkShare</div>
      <div style={{fontSize:12,color:"#6b7280",marginBottom:28}}>Zalogowany jako: <span style={{color:"#a78bfa"}}>{user.name}</span>{user.guest?" (gość)":""}</div>
      <div style={{width:"100%",maxWidth:360}}>
        {myGroups.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Twoje grupy</div>
            {myGroups.map(function(g){return (
              <div key={g.id} style={{...c.card(false),marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}} onClick={function(){onJoin(g.id);}}>
                <div><div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{g.name}</div><div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{g.id}</div></div>
                <span style={{fontSize:18,color:"#7c3aed"}}>→</span>
              </div>
            );})}
            <div style={{borderTop:"1px solid #1f2230",margin:"16px 0"}}/>
          </div>
        )}
        {user.guest?(
          <div style={{...c.card(true),marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:12}}>Dołącz do grupy</div>
            <label style={c.label}>Kod grupy</label>
            <input style={{...c.input,marginBottom:err?6:12}} placeholder="np. zielone-abc123" value={code} onChange={function(e){setCode(e.target.value.trim());}}/>
            {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:8}}>{err}</div>}
            <button style={{...c.btn("primary"),width:"100%"}} onClick={join}>Dołącz</button>
          </div>
        ):(!showJoin?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button style={{...c.btn("ghost"),width:"100%",border:"1px solid #2a2d3e",padding:"11px"}} onClick={function(){setShowJoin(true);}}>+ Dołącz do nowej grupy (kod)</button>
            <button style={{...c.btn("default"),width:"100%",padding:"11px"}} onClick={onNew}>Utwórz nową grupę</button>
          </div>
        ):(
          <div style={{...c.card(true),marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:12}}>Dołącz do grupy</div>
            <label style={c.label}>Kod grupy</label>
            <input style={{...c.input,marginBottom:err?6:12}} placeholder="np. zielone-abc123" value={code} onChange={function(e){setCode(e.target.value.trim());}}/>
            {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:8}}>{err}</div>}
            <div style={{display:"flex",gap:8}}>
              <button style={{...c.btn("primary"),flex:1}} onClick={join}>Dołącz</button>
              {myGroups.length>0&&<button style={c.btn()} onClick={function(){setShowJoin(false);setErr("");}}>Anuluj</button>}
            </div>
            <div style={{borderTop:"1px solid #1f2230",margin:"14px 0 10px"}}/>
            <button style={{...c.btn("default"),width:"100%",fontSize:12}} onClick={onNew}>+ Utwórz nową grupę</button>
          </div>
        ))}
        <button style={{...c.btn("default"),width:"100%",fontSize:12,marginTop:8}} onClick={onLogout}>Wyloguj / zmień konto</button>
      </div>
    </div>
  );
}

function NewGroup({onBack,onCreate}) {
  var [name,setName]=useState(""); var [loading,setLoading]=useState(false);
  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <button style={{...c.btn("ghost"),paddingLeft:0,marginBottom:20,fontSize:13}} onClick={onBack}>← Wróć</button>
        <div style={c.card(true)}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:4}}>Nowa grupa osiedlowa</div>
          <div style={{fontSize:12,color:"#6b7280",marginBottom:16}}>Wygenerujemy unikalny kod do udostępnienia sąsiadom</div>
          <label style={c.label}>Nazwa osiedla *</label>
          <input style={{...c.input,marginBottom:16}} placeholder="np. Osiedle Zielone" value={name} onChange={function(e){setName(e.target.value);}}/>
          <button style={{...c.btn("primary"),width:"100%",opacity:(name.trim()&&!loading)?1:0.4}} disabled={!name.trim()||loading}
            onClick={async function(){setLoading(true);await onCreate(name.trim());setLoading(false);}}>
            {loading?"Tworzenie...":"Utwórz grupę"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareModal({group,onClose}) {
  var [copied,setCopied]=useState(false);
  var link="parkshare.pl/g/"+group.id;
  function copy(t){navigator.clipboard&&navigator.clipboard.writeText(t).catch(function(){});setCopied(true);setTimeout(function(){setCopied(false);},2000);}
  return (
    <div style={c.overlay} onClick={onClose}>
      <div style={c.modal} onClick={function(e){e.stopPropagation();}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>Udostępnij grupę</div>
          <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={onClose}>✕</button>
        </div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:14}}>{group.name}</div>
        <label style={c.label}>Link</label>
        <div style={{...c.linkBox,marginBottom:12}}><span style={{flex:1}}>{link}</span><button style={{...c.btn(copied?"success":"primary"),padding:"5px 10px",fontSize:12}} onClick={function(){copy(link);}}>{copied?"✓ Skopiowano":"Kopiuj"}</button></div>
        <label style={c.label}>Kod grupy</label>
        <div style={{...c.linkBox,marginBottom:16}}><span style={{flex:1,fontWeight:600,color:"#a78bfa",fontSize:14}}>{group.id}</span><button style={{...c.btn("default"),padding:"5px 10px",fontSize:12}} onClick={function(){copy(group.id);}}>Kopiuj</button></div>
        <div style={{background:"#0d2a1e",border:"1px solid #065f46",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#6ee7b7"}}>Wyślij ten kod na grupę osiedlową — każda osoba zobaczy te same miejsca w czasie rzeczywistym.</div>
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({groupId, user, spots, slots, onClose, onDataChange}) {
  var [members,setMembers]=useState([]);
  var [loading,setLoading]=useState(true);
  var [groupName,setGroupName]=useState("");
  var [editingName,setEditingName]=useState(false);
  var [newName,setNewName]=useState("");
  var [toast,setToast]=useState(null);
  var [confirmModal,setConfirmModal]=useState(null);

  function showToast(msg,type){setToast({msg:msg,type:type||"success"});setTimeout(function(){setToast(null);},3000);}

  async function loadMembers(){
    try{
      var rows=await sb.from("user_groups").select("*","&group_id=eq."+groupId+"&order=role.desc");
      setMembers(rows);
    }catch(e){}finally{setLoading(false);}
  }

  async function loadGroup(){
    var g=await sb.from("groups").select("*","&id=eq."+groupId);
    if(g.length){setGroupName(g[0].name);setNewName(g[0].name);}
  }

  useEffect(function(){loadMembers();loadGroup();},[]);

  async function setRole(userId,role){
    try{
      await sb.from("user_groups").update({role:role},"?user_id=eq."+userId+"&group_id=eq."+groupId);
      showToast(role==="admin"?"Nadano uprawnienia admina":"Odebrano uprawnienia admina");
      loadMembers();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function removeMember(userId,userName){
    try{
      await sb.from("user_groups").delete("?user_id=eq."+userId+"&group_id=eq."+groupId);
      showToast(userName+" został usunięty z grupy","warn");
      loadMembers(); onDataChange();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function removeSpotAdmin(spotId){
    try{
      var spSlots=slots.filter(function(sl){return sl.spot_id===spotId;});
      for(var i=0;i<spSlots.length;i++) await sb.from("slots").delete("?id=eq."+spSlots[i].id);
      await sb.from("spots").delete("?id=eq."+spotId);
      showToast("Miejsce usunięte","warn"); onDataChange();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function cancelBookingAdmin(slotId){
    try{
      await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},"?id=eq."+slotId);
      showToast("Rezerwacja anulowana","warn"); onDataChange();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function saveGroupName(){
    if(!newName.trim()) return;
    try{
      await sb.from("groups").update({name:newName.trim()},"?id=eq."+groupId);
      setGroupName(newName.trim()); setEditingName(false);
      showToast("Nazwa grupy zaktualizowana"); onDataChange();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  var myRole=members.find(function(m){return m.user_id===user.uid;});
  var isAdmin=myRole&&myRole.role==="admin";

  return (
    <div style={c.overlay} onClick={onClose}>
      <div style={{...c.modal,maxWidth:560,width:"100%"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:600,color:"#a78bfa"}}>⚙ Panel admina</div>
          <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={onClose}>✕</button>
        </div>

        {/* Group name */}
        <div style={{...c.card(false),marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Nazwa grupy</div>
          {editingName?(
            <div style={{display:"flex",gap:8}}>
              <input style={{...c.input,flex:1}} value={newName} onChange={function(e){setNewName(e.target.value);}}/>
              <button style={c.btn("primary")} onClick={saveGroupName}>Zapisz</button>
              <button style={c.btn()} onClick={function(){setEditingName(false);setNewName(groupName);}}>Anuluj</button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{groupName}</div>
              <button style={{...c.btn("ghost"),padding:"5px 10px",fontSize:12}} onClick={function(){setEditingName(true);}}>Edytuj</button>
            </div>
          )}
        </div>

        {/* Members */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>
            Członkowie grupy ({members.length})
          </div>
          {loading?<div style={{textAlign:"center",color:"#4b5563",padding:"20px 0"}}>Ładowanie...</div>:members.map(function(m){
            var isSelf=m.user_id===user.uid;
            var mSpots=spots.filter(function(sp){return sp.owner_uid===m.user_id;});
            return (
              <div key={m.user_id} style={c.memberRow}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                  <div style={{...c.avatar,flexShrink:0}}>{(m.user_name||"?")[0].toUpperCase()}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#e8eaf0",display:"flex",alignItems:"center",gap:6}}>
                      {m.user_name||"Nieznany"} {isSelf&&<span style={{fontSize:10,color:"#6b7280"}}>(Ty)</span>}
                    </div>
                    <div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{m.user_email||""} · {mSpots.length} {mSpots.length===1?"miejsce":mSpots.length<5?"miejsca":"miejsc"}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
                  <span style={c.roleBadge(m.role)}>{m.role==="admin"?"Admin":"Członek"}</span>
                  {!isSelf&&(
                    <>
                      <button style={{...c.btn(m.role==="admin"?"default":"admin"),padding:"4px 8px",fontSize:11}}
                        onClick={function(){setRole(m.user_id,m.role==="admin"?"member":"admin");}}>
                        {m.role==="admin"?"Odbierz admina":"Nadaj admina"}
                      </button>
                      <button style={{...c.btn("danger"),padding:"4px 8px",fontSize:11}}
                        onClick={function(){setConfirmModal({type:"member",label:m.user_name||"tego użytkownika",action:function(){removeMember(m.user_id,m.user_name);}});}}>
                        Usuń
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* All spots */}
        <div>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>
            Wszystkie miejsca ({spots.length})
          </div>
          {spots.length===0?<div style={{fontSize:12,color:"#374151",textAlign:"center",padding:"10px 0"}}>Brak miejsc w grupie</div>:spots.map(function(sp){
            var owner=members.find(function(m){return m.user_id===sp.owner_uid;});
            var spSlots=slots.filter(function(sl){return sl.spot_id===sp.id;});
            var bookedSlots=spSlots.filter(function(sl){return sl.booked;});
            return (
              <div key={sp.id} style={{background:"#0f1117",borderRadius:8,padding:"10px 12px",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:"#e8eaf0"}}>
                      {sp.type==="outdoor"?"🌤":"🏗"} nr {sp.name}
                    </div>
                    <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>
                      Właściciel: {owner?owner.user_name:sp.owner||"Nieznany"} · {spSlots.length} termin{spSlots.length===1?"":"ów"} · {bookedSlots.length} zarezerwowanych
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                    {bookedSlots.map(function(sl){return (
                      <button key={sl.id} style={{...c.btn("warn"),padding:"4px 8px",fontSize:11}}
                        onClick={function(){setConfirmModal({type:"booking",label:"rezerwację ("+sl.booked_by+")",action:function(){cancelBookingAdmin(sl.id);}});}}>
                        Anuluj rez.
                      </button>
                    );})}
                    <button style={{...c.btn("danger"),padding:"4px 8px",fontSize:11}}
                      onClick={function(){setConfirmModal({type:"spot",label:"miejsce nr "+sp.name,action:function(){removeSpotAdmin(sp.id);}});}}>
                      Usuń miejsce
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {confirmModal&&(
          <div style={{...c.overlay,zIndex:200}} onClick={function(){setConfirmModal(null);}}>
            <div style={{...c.modal,maxWidth:320}} onClick={function(e){e.stopPropagation();}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:8}}>Potwierdź akcję</div>
              <div style={{fontSize:13,color:"#6b7280",marginBottom:20}}>Czy na pewno chcesz usunąć {confirmModal.label}? Tej akcji nie można cofnąć.</div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...c.btn("danger"),flex:1}} onClick={function(){confirmModal.action();setConfirmModal(null);}}>Tak, usuń</button>
                <button style={{...c.btn(),flex:1}} onClick={function(){setConfirmModal(null);}}>Anuluj</button>
              </div>
            </div>
          </div>
        )}
        {toast&&<div style={c.toast(toast.type)}>{toast.msg}</div>}
      </div>
    </div>
  );
}

// ─── ParkApp ──────────────────────────────────────────────────────────────────
function ParkApp({groupId,user,onLeave}) {
  var [group,setGroup]=useState(null);
  var [spots,setSpots]=useState([]);
  var [slots,setSlots]=useState([]);
  var [myRole,setMyRole]=useState("member");
  var [loading,setLoading]=useState(true);
  var [view,setView]=useState("browse");
  var [selDate,setSelDate]=useState(new Date(today));
  var [showAdd,setShowAdd]=useState(false);
  var [newSpot,setNewSpot]=useState({name:"",desc:"",owner:user.guest?"":user.name,phone:"",email:user.email||"",note:"",type:"underground",spotVisibility:"private"});
  var [bookModal,setBookModal]=useState(null);
  var [bookerName,setBookerName]=useState(user.guest?"":user.name);
  var [bookerPhone,setBookerPhone]=useState("");
  var [toast,setToast]=useState(null);
  var [contactModal,setContactModal]=useState(null);
  var [editingSpotId,setEditingSpotId]=useState(null);
  var [slotForm,setSlotForm]=useState({allDay:false,from:"08:00",to:"20:00",price:"0"});
  var [calY,setCalY]=useState(today.getFullYear());
  var [calM,setCalM]=useState(today.getMonth());
  var [multiDates,setMultiDates]=useState([]);
  var [showShare,setShowShare]=useState(false);
  var [showAdmin,setShowAdmin]=useState(false);
  var [weekOffset,setWeekOffset]=useState(0);
  var subRef=useRef(null);

  useEffect(function(){var t=setInterval(function(){setSlots(function(s){return [...s];});},15000);return function(){clearInterval(t);};},[]);

  async function loadAll(){
    try{
      var grp=await sb.from("groups").select("*","&id=eq."+groupId);
      var sps=await sb.from("spots").select("*","&group_id=eq."+groupId+"&order=created_at.asc");
      var spIds=sps.map(function(s){return s.id;});
      var sls=spIds.length?await sb.from("slots").select("*","&spot_id=in.("+spIds.join(",")+")&order=date.asc"):[];
      if(!user.guest){
        var ug=await sb.from("user_groups").select("role","&user_id=eq."+user.uid+"&group_id=eq."+groupId);
        if(ug.length) setMyRole(ug[0].role);
      }
      setGroup(grp[0]);setSpots(sps);setSlots(sls);
    }catch(e){console.error(e);}finally{setLoading(false);}
  }

  useEffect(function(){
    loadAll();
    var sub=sb.channel("group-"+groupId).on("*",{table:"*"},function(){loadAll();}).subscribe();
    subRef.current=sub;
    return function(){try{sub.unsubscribe();}catch(e){}};
  },[groupId]);

  function showToast(msg,type){setToast({msg:msg,type:type||"success"});setTimeout(function(){setToast(null);},3500);}
  function slotsForSpot(id){return slots.filter(function(sl){return sl.spot_id===id;});}
  function slotsOn(id,d){return slotsForSpot(id).filter(function(sl){return sl.date===d;});}
  var dk=f.dateKey(selDate);
  var weekDays=Array.from({length:7},function(_,i){return f.addDays(today,weekOffset*7+i);});
  function spotsAvailOn(d){return spots.filter(function(sp){return slotsOn(sp.id,d).some(function(sl){return !sl.booked;});}).length;}
  function isOwner(sp){return !user.guest&&sp.owner_uid===user.uid;}
  var isAdmin=myRole==="admin";
  function toggleMulti(k){setMultiDates(function(p){return p.includes(k)?p.filter(function(d){return d!==k;}):[...p,k];});}

  async function addSpot(){
    if(!newSpot.name.trim()) return;
    try{
      await sb.from("spots").insert({id:f.genId(),group_id:groupId,name:newSpot.name.trim(),desc:newSpot.desc,owner:newSpot.owner,owner_uid:user.uid,phone:newSpot.phone,email:newSpot.email,note:newSpot.note,type:newSpot.type,spot_visibility:newSpot.spotVisibility});
      setNewSpot({name:"",desc:"",owner:user.guest?"":user.name,phone:"",email:user.email||"",note:"",type:"underground",spotVisibility:"private"});
      setShowAdd(false);showToast("Miejsce dodane!");loadAll();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function updateField(spotId,field,val){
    try{await sb.from("spots").update({[field]:val},"?id=eq."+spotId);loadAll();}catch(e){}
  }

  async function addSlots(){
    if(!multiDates.length) return;
    var price=parseFloat(slotForm.price)||0;
    try{
      var rows=multiDates.map(function(d){return {id:f.genId(),spot_id:editingSpotId,date:d,all_day:slotForm.allDay,from_time:slotForm.allDay?"00:00":slotForm.from,to_time:slotForm.allDay?"24:00":slotForm.to,price:price};});
      await sb.from("slots").insert(rows);
      setMultiDates([]);showToast("Dodano "+multiDates.length+" termin"+(multiDates.length===1?"":"ów")+"!");loadAll();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function removeSlot(id){try{await sb.from("slots").delete("?id=eq."+id);loadAll();}catch(e){}}
  async function cancelBooking(id){
    try{await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},"?id=eq."+id);showToast("Rezerwacja anulowana.","warn");loadAll();}catch(e){}
  }
  async function confirmBook(){
    if(!bookerName.trim()) return;
    try{
      await sb.from("slots").update({booked:true,booked_by:bookerName,booker_phone:bookerPhone,booked_at:Date.now(),booked_by_uid:user.uid},"?id=eq."+bookModal.slotId);
      setBookModal(null);setBookerName(user.guest?"":user.name);setBookerPhone("");showToast("Rezerwacja potwierdzona!");loadAll();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  function SlotCal(){
    var dim=f.daysInMonth(calY,calM),first=f.firstDay(calY,calM);
    var cells=[...Array(first).fill(null),...Array.from({length:dim},function(_,i){return i+1;})];
    var editSlots=editingSpotId?slotsForSpot(editingSpotId):[];
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <button style={{...c.arrow,width:28,height:28,fontSize:15}} onClick={function(){calM===0?(setCalY(function(y){return y-1;}),setCalM(11)):setCalM(function(m){return m-1;});}}>‹</button>
          <span style={{fontSize:13,fontWeight:600,color:"#c4b5fd"}}>{MONTHS_FULL[calM]} {calY}</span>
          <button style={{...c.arrow,width:28,height:28,fontSize:15}} onClick={function(){calM===11?(setCalY(function(y){return y+1;}),setCalM(0)):setCalM(function(m){return m+1;});}}>›</button>
        </div>
        <div style={c.calGrid}>
          {DAYS_SHORT.map(function(d){return <div key={d} style={{textAlign:"center",fontSize:10,color:"#4b5563",padding:"3px 0"}}>{d}</div>;})}
          {cells.map(function(day,i){
            if(!day) return <div key={"e"+i}/>;
            var k=calY+"-"+String(calM+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
            var past=new Date(calY,calM,day)<today,sel=multiDates.includes(k);
            var has=editSlots.some(function(sl){return sl.date===k;});
            return <div key={k} style={c.calCell(has,past,sel)} onClick={function(){if(!past)toggleMulti(k);}}>{day}</div>;
          })}
        </div>
        {multiDates.length>0&&<div style={{fontSize:11,color:"#a78bfa",marginTop:8}}>Zaznaczono {multiDates.length} {multiDates.length===1?"dzień":"dni"}</div>}
      </div>
    );
  }

  if(loading||!group) return <div style={{...c.app,display:"flex",alignItems:"center",justifyContent:"center"}}><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style><div style={c.spinner}/></div>;

  var isToday=f.isSameDay(selDate,today);
  var browseSpots=spots.map(function(sp){return {...sp,todaySlots:slotsOn(sp.id,dk)};}).filter(function(sp){return sp.todaySlots.length>0;});

  return (
    <div style={c.app}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={c.hdr}>
        <div>
          <div style={{fontSize:16,fontWeight:600,color:"#a78bfa",display:"flex",alignItems:"center",gap:8}}><ParkLogo size={22}/> ParkShare</div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:"#6b7280"}}>{group.name}</span>
            {isAdmin&&<span style={c.roleBadge("admin")}>Admin</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <button style={c.navBtn(view==="browse")} onClick={function(){setView("browse");}}>Przeglądaj</button>
          {!user.guest&&<button style={c.navBtn(view==="myspots")} onClick={function(){setView("myspots");}}>Moje miejsca</button>}
          {isAdmin&&<button style={{...c.btn("admin"),padding:"6px 10px",fontSize:12}} onClick={function(){setShowAdmin(true);}}>⚙ Admin</button>}
          <button style={{...c.btn("ghost"),padding:"6px 10px",fontSize:12,border:"1px solid #2a2d3e",borderRadius:8}} onClick={function(){setShowShare(true);}}>⬆ Udostępnij</button>
          <div style={c.avatar} title={user.name}>{user.name[0].toUpperCase()}</div>
          <button style={{...c.btn("default"),padding:"6px 10px",fontSize:12}} onClick={onLeave}>⇄</button>
        </div>
      </div>

      <div style={c.wrap}>
        {view==="browse"&&(
          <>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <button style={{...c.arrow,width:30,height:30,fontSize:15,flexShrink:0}} onClick={function(){setWeekOffset(function(o){return Math.max(0,o-1);});}} disabled={weekOffset===0}>‹</button>
              <div style={{...c.weekBar,flex:1,marginBottom:0}}>
                {weekDays.map(function(d,i){
                  var cnt=spotsAvailOn(f.dateKey(d)),act=f.isSameDay(d,selDate);
                  return (
                    <div key={i} style={c.weekCell(act,cnt)} onClick={function(){setSelDate(new Date(d));}}>
                      <div style={{fontSize:10,color:act?"#e8eaf0":"#6b7280",marginBottom:2}}>{f.isSameDay(d,today)?"Dziś":DAYS_SHORT[(d.getDay()+6)%7]}</div>
                      <div style={{fontSize:13,fontWeight:600,color:act?"#fff":"#9ca3af"}}>{d.getDate()}</div>
                      {cnt>0&&<div style={{fontSize:10,color:act?"#c4b5fd":"#6ee7b7",marginTop:2}}>{cnt} wol.</div>}
                    </div>
                  );
                })}
              </div>
              <button style={{...c.arrow,width:30,height:30,fontSize:15,flexShrink:0}} onClick={function(){setWeekOffset(function(o){return o+1;});}}>›</button>
            </div>
            <div style={c.dayNav}>
              <button style={c.arrow} onClick={function(){setSelDate(function(d){return f.addDays(d,-1);});}}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{isToday?"Dzisiaj":DAYS_PL[selDate.getDay()]}</div>
                <div style={{fontSize:12,color:"#6b7280"}}>{f.fmtDate(selDate)}</div>
              </div>
              <button style={c.arrow} onClick={function(){setSelDate(function(d){return f.addDays(d,1);});}}>›</button>
            </div>
            {user.guest&&<div style={{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#6b7280"}}>Przeglądasz jako gość. <span style={{color:"#a78bfa",cursor:"pointer"}} onClick={onLeave}>Zaloguj się</span>, aby dodawać miejsca.</div>}
            {browseSpots.length===0?(
                              <div style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{marginBottom:16,display:"flex",justifyContent:"center"}}><ParkLogo size={48}/></div>
                <div style={{fontSize:14,fontWeight:500,color:"#6b7280"}}>Brak wolnych miejsc tego dnia</div>
                <div style={{fontSize:12,color:"#374151",marginTop:6}}>Spróbuj innego dnia lub wróć później</div>
              </div>
            ):browseSpots.map(function(sp){return (
              <div key={sp.id} style={c.card(false)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:20}}>{sp.type==="outdoor"?"🌤":"🏗"}</span>
                      <div>
                        <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{sp.type==="outdoor"?"Miejsce naziemne":"Garaż podziemny"}</div>
                        <div style={{fontSize:12,color:"#6b7280"}}>{sp.desc}</div>
                      </div>
                    </div>
                    <div style={{fontSize:11,color:"#4b5563"}}>Właściciel: {sp.owner||"—"}</div>
                  </div>
                  <button style={{...c.btn("primary"),padding:"6px 12px",fontSize:12}} onClick={function(){setContactModal(sp);}}>Kontakt i nr miejsca</button>
                </div>
                {sp.note&&<div style={c.noteBubble}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:3}}>Notatka</span>{sp.note}</div>}
                <div style={c.divider}/>
                {sp.todaySlots.map(function(sl){return (
                  <div key={sl.id} style={{...c.slotRow,opacity:sl.booked?0.55:1}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:sl.booked?"#818cf8":"#e8eaf0"}}>{sl.all_day?"Cały dzień":sl.from_time+" – "+sl.to_time}</div>
                      <div style={{fontSize:12,color:sl.price===0?"#6ee7b7":"#a78bfa",marginTop:2}}>{sl.booked?"Zarezerwowane: "+sl.booked_by:sl.price===0?"Bezpłatnie":sl.price+" zł"}</div>
                    </div>
                    {!sl.booked&&<button style={{...c.btn("ghost"),padding:"6px 12px",fontSize:12,border:"1px solid #2a2d3e"}} onClick={function(){setBookModal({spotId:sp.id,slotId:sl.id,sl:sl,sp:sp,dk:dk});}}>Zarezerwuj</button>}
                  </div>
                );})}
              </div>
            );})}
          </>
        )}

        {view==="myspots"&&!user.guest&&(
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:"#c4b5fd"}}>Moje miejsca parkingowe</div>
              <button style={c.btn("primary")} onClick={function(){setShowAdd(function(v){return !v;});}}>+ Dodaj</button>
            </div>
            {showAdd&&(
              <div style={{...c.card(true),marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:600,color:"#c4b5fd",marginBottom:14}}>Nowe miejsce</div>
                {[["name","Numer miejsca *","np. A-15"],["desc","Opis","np. poziom -1, przy windzie"],["owner","Imię i nazwisko","np. Jan Kowalski"],["phone","Telefon","np. 600 123 456"],["email","E-mail","np. jan@email.com"]].map(function(row){
                  var fld=row[0],l=row[1],p=row[2];
                  return <div key={fld} style={{marginBottom:10}}><label style={c.label}>{l}</label><input style={c.input} placeholder={p} value={newSpot[fld]} onChange={function(e){var v=e.target.value;setNewSpot(function(prev){return {...prev,[fld]:v};});}}/></div>;
                })}
                <div style={{marginBottom:10}}>
                  <label style={c.label}>Widoczność numeru miejsca</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["public","🔓 Jawne","Numer widoczny od razu po rezerwacji"],["private","🔒 Tajne","Numer widoczny po zatwierdzeniu przez właściciela"]].map(function(row){
                      return (
                        <button key={row[0]} style={{...c.btn(newSpot.spotVisibility===row[0]?"primary":"default"),flex:1,fontSize:11,padding:"8px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,height:"auto"}}
                          onClick={function(){setNewSpot(function(p){return {...p,spotVisibility:row[0]};});}}>
                          <span style={{fontSize:16}}>{row[1].split(" ")[0]}</span>
                          <span style={{fontWeight:600}}>{row[1].split(" ")[1]}</span>
                          <span style={{fontSize:10,opacity:0.7,fontWeight:400}}>{row[2]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={c.label}>Rodzaj miejsca</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["underground","🏗 Garaż podziemny"],["outdoor","🌤 Naziemne"]].map(function(row){
                      return <button key={row[0]} style={{...c.btn(newSpot.type===row[0]?"primary":"default"),flex:1,fontSize:12}} onClick={function(){setNewSpot(function(p){return {...p,type:row[0]};});}}>{row[1]}</button>;
                    })}
                  </div>
                </div>
                <div style={{marginBottom:14}}><label style={c.label}>Notatka / płatność</label><textarea style={c.textarea} placeholder="np. Preferuję BLIK, klucz u portiera..." value={newSpot.note} onChange={function(e){var v=e.target.value;setNewSpot(function(p){return {...p,note:v};});}}/></div>
                <div style={{display:"flex",gap:8}}><button style={c.btn("primary")} onClick={addSpot}>Dodaj</button><button style={c.btn()} onClick={function(){setShowAdd(false);}}>Anuluj</button></div>
              </div>
            )}
            {spots.filter(isOwner).length===0&&!showAdd&&<div style={{textAlign:"center",padding:"30px 0",color:"#4b5563",fontSize:13}}>Nie masz jeszcze żadnych miejsc.</div>}
            {spots.filter(isOwner).map(function(sp){
              var spSlots=slotsForSpot(sp.id);
              return (
                <div key={sp.id} style={{...c.card(editingSpotId===sp.id),marginBottom:16,cursor:"default"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{sp.type==="outdoor"?"🌤 Naziemne":"🏗 Garaż"} · nr {sp.name}</div>
                      <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{sp.desc||"Brak opisu"}</div>
                    </div>
                    <button style={c.btn(editingSpotId===sp.id?"ghost":"primary")} onClick={function(){setEditingSpotId(editingSpotId===sp.id?null:sp.id);setMultiDates([]);}}>
                      {editingSpotId===sp.id?"Zamknij":"+ Termin"}
                    </button>
                  </div>
                  <div style={{background:"#0f1117",borderRadius:10,padding:12,marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Dane kontaktowe</div>
                    {[["owner","Imię i nazwisko","np. Jan Kowalski"],["phone","Telefon","np. 600 123 456"],["email","E-mail","np. jan@email.com"]].map(function(row){
                      var fld=row[0],l=row[1],p=row[2];
                      return <div key={fld} style={{marginBottom:8}}><label style={c.label}>{l}</label><input style={c.input} placeholder={p} value={sp[fld]||""} onBlur={function(e){updateField(sp.id,fld,e.target.value);}} onChange={function(e){var v=e.target.value;setSpots(function(prev){return prev.map(function(s){return s.id===sp.id?{...s,[fld]:v}:s;});});}}/></div>;
                    })}
                    <label style={c.label}>Notatka / płatność</label>
                    <textarea style={c.textarea} placeholder="np. Preferuję BLIK..." value={sp.note||""} onBlur={function(e){updateField(sp.id,"note",e.target.value);}} onChange={function(e){var v=e.target.value;setSpots(function(prev){return prev.map(function(s){return s.id===sp.id?{...s,note:v}:s;});});}}/>
                  </div>
                  {editingSpotId===sp.id&&(
                    <div style={{background:"#0f1117",borderRadius:10,padding:14,marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#a78bfa",marginBottom:12}}>Wybierz dni dostępności</div>
                      <SlotCal/>
                      <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div style={{gridColumn:"1/-1"}}>
                          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#9ca3af",cursor:"pointer"}}>
                            <input type="checkbox" checked={slotForm.allDay} onChange={function(e){var v=e.target.checked;setSlotForm(function(p){return {...p,allDay:v};});}} style={{accentColor:"#7c3aed"}}/>
                            Cały dzień
                          </label>
                        </div>
                        {!slotForm.allDay&&(
                          <>
                            <div><label style={c.label}>Od</label><input type="time" style={c.input} value={slotForm.from} onChange={function(e){var v=e.target.value;setSlotForm(function(p){return {...p,from:v};});}}/></div>
                            <div><label style={c.label}>Do</label><input type="time" style={c.input} value={slotForm.to} onChange={function(e){var v=e.target.value;setSlotForm(function(p){return {...p,to:v};});}}/></div>
                          </>
                        )}
                        <div style={{gridColumn:"1/-1"}}><label style={c.label}>Cena (zł), 0 = bezpłatnie</label><input type="number" min="0" style={c.input} value={slotForm.price} onChange={function(e){var v=e.target.value;setSlotForm(function(p){return {...p,price:v};});}}/></div>
                      </div>
                      <button style={{...c.btn("primary"),marginTop:14,width:"100%",opacity:multiDates.length?1:0.4}} onClick={addSlots} disabled={!multiDates.length}>
                        Dodaj {multiDates.length>0?(multiDates.length+" termin"+(multiDates.length===1?"":"ów")):"terminy"}
                      </button>
                    </div>
                  )}
                  {spSlots.length>0&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Terminy</div>
                      {spSlots.sort(function(a,b){return a.date.localeCompare(b.date);}).map(function(sl){
                        var canCancel=sl.booked&&f.canCancel(sl.booked_at);
                        return (
                          <div key={sl.id} style={c.slotRow}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:500,color:"#e8eaf0"}}>{f.fmtDate(f.parseDate(sl.date))}</div>
                              <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{sl.all_day?"Cały dzień":(sl.from_time+"–"+sl.to_time)} · {sl.price===0?"Bezpłatnie":(sl.price+" zł")}</div>
                              {sl.booked&&<div style={{fontSize:11,color:"#818cf8",marginTop:2}}>{sl.booked_by}{sl.booker_phone?(" · "+sl.booker_phone):""}{canCancel?<span style={{color:"#fbbf24"}}> · anuluj ({f.timeLeft(sl.booked_at)})</span>:<span style={{color:"#4b5563"}}> · zaakceptowane</span>}</div>}
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                              {canCancel&&<button style={{...c.btn("warn"),padding:"5px 10px",fontSize:11}} onClick={function(){cancelBooking(sl.id);}}>Anuluj rez.</button>}
                              {!sl.booked&&<button style={{...c.btn("danger"),padding:"5px 10px",fontSize:11}} onClick={function(){removeSlot(sl.id);}}>Usuń</button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {contactModal&&(
        <div style={c.overlay} onClick={function(){setContactModal(null);}}>
          <div style={c.modal} onClick={function(e){e.stopPropagation();}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:"#e8eaf0"}}>{contactModal.type==="outdoor"?"🌤 Miejsce naziemne":"🏗 Garaż podziemny"}</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{contactModal.desc}</div>
              </div>
              <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={function(){setContactModal(null);}}>✕</button>
            </div>
            <div style={{background:"#0f1117",borderRadius:10,padding:12,marginBottom:12}}>
              {[{icon:"👤",label:"Imię i nazwisko",val:contactModal.owner},{icon:"📞",label:"Telefon",val:contactModal.phone},{icon:"✉️",label:"E-mail",val:contactModal.email}].map(function(row){
                return (
                  <div key={row.label} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #1f2230"}}>
                    <div style={{...c.avatar,width:28,height:28,fontSize:14,background:"#1a1d2e"}}>{row.icon}</div>
                    <div><div style={{fontSize:11,color:"#4b5563"}}>{row.label}</div><div style={{fontSize:13,color:row.val?"#e8eaf0":"#374151"}}>{row.val||"Nie podano"}</div></div>
                  </div>
                );
              })}
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}>
                <div style={{...c.avatar,width:28,height:28,fontSize:14,background:"#1a1d2e"}}>🅿</div>
                <div>
                  <div style={{fontSize:11,color:"#4b5563"}}>Numer miejsca</div>
                  {(function(){
                    var isPublic = contactModal.spot_visibility === "public";
                    var mySlot = slots.find(function(sl){return sl.spot_id===contactModal.id&&sl.booked&&sl.booked_by_uid===user.uid&&!f.canCancel(sl.booked_at);});
                    var show = !user.guest && (isOwner(contactModal) || isAdmin || (isPublic && mySlot) || (!isPublic && mySlot));
                    var showImmediate = !user.guest && (isOwner(contactModal) || isAdmin || isPublic);
                    if (showImmediate) return <div style={{fontSize:15,fontWeight:700,color:"#a78bfa"}}>{contactModal.name||"Nie podano"}</div>;
                    if (mySlot) return <div style={{fontSize:15,fontWeight:700,color:"#a78bfa"}}>{contactModal.name||"Nie podano"}</div>;
                    if (isPublic) return <div style={{fontSize:12,color:"#6b7280"}}>Widoczny po dokonaniu rezerwacji</div>;
                    return (
                      <div>
                        <div style={{fontSize:12,color:"#374151",marginBottom:4}}>Widoczny po zatwierdzeniu rezerwacji</div>
                        {contactModal.phone&&<div style={{fontSize:12,color:"#6b7280"}}>Możesz też zapytać właściciela: <span style={{color:"#a78bfa"}}>{contactModal.phone}</span></div>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            {contactModal.note&&<div style={c.noteBubble}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Notatka właściciela</span>{contactModal.note}</div>}
          </div>
        </div>
      )}

      {bookModal&&(
        <div style={c.overlay} onClick={function(){setBookModal(null);}}>
          <div style={c.modal} onClick={function(e){e.stopPropagation();}}>
            <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:6}}>Zarezerwuj miejsce</div>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>{bookModal.sp.type==="outdoor"?"🌤 Naziemne":"🏗 Garaż"} · {f.fmtDate(f.parseDate(bookModal.dk))}<br/>{bookModal.sl.all_day?"Cały dzień":(bookModal.sl.from_time+"–"+bookModal.sl.to_time)} · {bookModal.sl.price===0?"Bezpłatnie":(bookModal.sl.price+" zł")}</div>
            {bookModal.sp.note&&<div style={{...c.noteBubble,marginBottom:14}}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:3}}>Notatka właściciela</span>{bookModal.sp.note}</div>}
            <div style={{background:"#0d2a1e",border:"1px solid #065f46",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#6ee7b7",marginBottom:14}}>Właściciel ma 1 godzinę na anulowanie. Po tym czasie rezerwacja jest automatycznie zatwierdzona.</div>
            <div style={{marginBottom:10}}><label style={c.label}>Twoje imię i nazwisko *</label><input style={c.input} value={bookerName} onChange={function(e){setBookerName(e.target.value);}} placeholder="np. Marek Nowak"/></div>
            <div style={{marginBottom:16}}><label style={c.label}>Telefon (opcjonalnie)</label><input style={c.input} value={bookerPhone} onChange={function(e){setBookerPhone(e.target.value);}} placeholder="np. 600 123 456"/></div>
            <div style={{display:"flex",gap:8}}><button style={c.btn("primary")} onClick={confirmBook}>Potwierdź</button><button style={c.btn()} onClick={function(){setBookModal(null);}}>Anuluj</button></div>
          </div>
        </div>
      )}

      <div style={{textAlign:"center",padding:"24px 0 8px",borderTop:"1px solid #1a1d2e"}}>
        <div style={{fontSize:11,color:"#374151"}}>v0.25 · <a href="mailto:kontakt@parkshare.pl" style={{color:"#4b5563",textDecoration:"none"}}>kontakt@parkshare.pl</a></div>
      </div>

      {showAdmin&&<AdminPanel groupId={groupId} user={user} spots={spots} slots={slots} onClose={function(){setShowAdmin(false);}} onDataChange={loadAll}/>}
      {showShare&&<ShareModal group={group} onClose={function(){setShowShare(false);}}/>}
      {toast&&<div style={c.toast(toast.type)}>{toast.msg}</div>}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Root() {
  var [screen,setScreen]=useState("auth");
  var [user,setUser]=useState(null);
  var [activeGroupId,setActiveGroupId]=useState(null);

  function handleAuth(u){_authToken=u.token||null;setUser(u);setScreen("landing");}

  async function handleJoin(id){
    if(user&&!user.guest){
      try{await sb.from("user_groups").upsert({user_id:user.uid,group_id:id,role:"member",user_name:user.name,user_email:user.email},"user_id,group_id");}catch(e){}
    }
    setActiveGroupId(id);setScreen("app");
  }

  async function handleNew(name){
    var slug=name.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").slice(0,20);
    var id=slug+"-"+f.genId();
    try{
      await sb.from("groups").insert({id:id,name:name});
      if(user&&!user.guest) await sb.from("user_groups").upsert({user_id:user.uid,group_id:id,role:"admin",user_name:user.name,user_email:user.email},"user_id,group_id");
      setActiveGroupId(id);setScreen("app");
    }catch(e){console.error(e);}
  }

  async function handleLogout(){try{await sb.auth.signOut();}catch(e){}setUser(null);setScreen("auth");}

  if(screen==="auth") return <AuthScreen onAuth={handleAuth}/>;
  if(screen==="landing") return <Landing user={user} onJoin={handleJoin} onNew={function(){setScreen("newgroup");}} onLogout={handleLogout}/>;
  if(screen==="newgroup") return <NewGroup onBack={function(){setScreen("landing");}} onCreate={handleNew}/>;
  if(screen==="app"&&activeGroupId) return <ParkApp groupId={activeGroupId} user={user} onLeave={function(){setScreen("landing");}}/>;
  return null;
}