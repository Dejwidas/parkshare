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
  dateKey: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
  addDays: (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; },
  isSameDay: (a,b) => f.dateKey(a)===f.dateKey(b),
  daysInMonth: (y,m) => new Date(y,m+1,0).getDate(),
  firstDay: (y,m) => (new Date(y,m,1).getDay()+6)%7,
  fmtDate: d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  parseDate: str => { const [y,m,d]=str.split('-').map(Number); return new Date(y,m-1,d); },
  genId: () => Math.random().toString(36).slice(2,10),
  canCancel: at => at && (Date.now()-at) < CANCEL_WINDOW_MS,
  timeLeft: at => { const ms=CANCEL_WINDOW_MS-(Date.now()-at); const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000); return ms>0?`${m}m ${s}s`:null; },
};

// ─── Supabase client ──────────────────────────────────────────────────────────
const sbHeaders = () => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY,
  "Prefer": "return=representation"
});

const sbReq = async (method, table, qs, body) => {
  qs = qs || "";
  const url = SUPABASE_URL + "/rest/v1/" + table + qs;
  const opts = { method: method, headers: sbHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("json") ? r.json() : [];
};

const sb = {
  from: function(table) {
    return {
      select: function(cols, qs) { return sbReq("GET", table, "?select=" + (cols||"*") + (qs||"")); },
      insert: function(data) { return sbReq("POST", table, "?select=*", Array.isArray(data) ? data : [data]); },
      update: function(data, qs) { return sbReq("PATCH", table, (qs||"") + "&select=*", data); },
      delete: function(qs) { return sbReq("DELETE", table, qs); },
      upsert: function(data) { return sbReq("POST", table, "?on_conflict=id&select=*", Array.isArray(data) ? data : [data]); }
    };
  },
  channel: function(name) {
    var handlers = [];
    return {
      on: function(event, filter, cb) {
        handlers.push({ cb: cb });
        return {
          subscribe: function() {
            var wsUrl = SUPABASE_URL.replace("https", "wss") + "/realtime/v1/websocket?apikey=" + SUPABASE_KEY + "&vsn=1.0.0";
            var socket = new WebSocket(wsUrl);
            socket.onopen = function() {
              socket.send(JSON.stringify({
                topic: "realtime:" + name,
                event: "phx_join",
                payload: { config: { broadcast: { self: true }, postgres_changes: [{ event: "*", schema: "public" }] } },
                ref: "1"
              }));
            };
            socket.onmessage = function(msg) {
              try {
                var d = JSON.parse(msg.data);
                if (d.event === "postgres_changes") {
                  handlers.forEach(function(h) { try { h.cb(d.payload); } catch(e) {} });
                }
                if (d.event === "phx_reply") return;
                if (d.topic === "phoenix") socket.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: "hb" }));
              } catch(e) {}
            };
            return { unsubscribe: function() { try { socket.close(); } catch(e) {} } };
          }
        };
      }
    };
  }
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const c = {
  app: { fontFamily:"system-ui,sans-serif", minHeight:"100vh", background:"#0f1117", color:"#e8eaf0" },
  hdr: { background:"#1a1d2e", borderBottom:"1px solid #2a2d3e", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 },
  wrap: { maxWidth:680, margin:"0 auto", padding:"20px 16px 60px" },
  navBtn: a => ({ padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:500, background:a?"#7c3aed":"transparent", color:a?"#fff":"#9ca3af" }),
  card: hi => ({ background:"#1a1d2e", border:`1px solid ${hi?"#7c3aed":"#2a2d3e"}`, borderRadius:12, padding:16, marginBottom:12 }),
  btn: v => { const m={primary:["#7c3aed","#fff"],ghost:["transparent","#7c3aed"],danger:["#3b0d0d","#f87171"],success:["#064e3b","#6ee7b7"],warn:["#451a03","#fbbf24"],default:["#1f2230","#9ca3af"]}[v||"default"]; return {padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:m[0],color:m[1]}; },
  input: { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #2a2d3e", background:"#0f1117", color:"#e8eaf0", fontSize:14, boxSizing:"border-box" },
  textarea: { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #2a2d3e", background:"#0f1117", color:"#e8eaf0", fontSize:14, boxSizing:"border-box", resize:"vertical", minHeight:72, fontFamily:"inherit" },
  label: { fontSize:12, color:"#9ca3af", marginBottom:5, display:"block" },
  arrow: { background:"none", border:"1px solid #2a2d3e", borderRadius:8, color:"#a78bfa", cursor:"pointer", fontSize:18, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center" },
  weekBar: { display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:16 },
  weekCell: (act,cnt) => ({ borderRadius:8, padding:"6px 4px", textAlign:"center", cursor:"pointer", background:act?"#7c3aed":cnt>0?"#0d2a1e":"#1a1d2e", border:`1px solid ${act?"#7c3aed":"#2a2d3e"}` }),
  dayNav: { display:"flex", alignItems:"center", justifyContent:"space-between", background:"#1a1d2e", border:"1px solid #2a2d3e", borderRadius:12, padding:"12px 16px", marginBottom:16 },
  overlay: { position:"fixed", top:0,left:0,right:0,bottom:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modal: { background:"#1a1d2e", border:"1px solid #2a2d3e", borderRadius:14, padding:24, width:"100%", maxWidth:360, maxHeight:"90vh", overflowY:"auto" },
  toast: t => ({ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:t==="success"?"#065f46":t==="warn"?"#451a03":"#7f1d1d", color:t==="success"?"#6ee7b7":t==="warn"?"#fbbf24":"#fca5a5", padding:"10px 20px", borderRadius:10, fontSize:13, fontWeight:500, zIndex:999 }),
  calGrid: { display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 },
  calCell: (has,past,sel) => ({ borderRadius:6, aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:500, cursor:past?"default":"pointer", opacity:past?0.3:1, background:sel?"#7c3aed":has?"#065f46":"transparent", color:sel?"#fff":has?"#6ee7b7":"#4b5563", border:"1px solid "+(sel?"#7c3aed":has?"#065f46":"#1f2230") }),
  slotRow: { display:"flex", alignItems:"center", justifyContent:"space-between", background:"#0f1117", borderRadius:8, padding:"8px 12px", marginBottom:6 },
  noteBubble: { background:"#12151f", border:"1px solid #2a2d3e", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#c4b5fd", lineHeight:1.5, marginTop:10 },
  divider: { borderTop:"1px solid #1f2230", margin:"12px 0" },
  linkBox: { background:"#0f1117", border:"1px solid #2a2d3e", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#6b7280", wordBreak:"break-all", display:"flex", alignItems:"center", gap:10 },
  avatar: { width:30, height:30, borderRadius:"50%", background:"#7c3aed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 },
  spinner: { width:32, height:32, border:"3px solid #2a2d3e", borderTop:"3px solid #7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("choose");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);

  async function register() {
    if (!name.trim()||!email.trim()||!pass.trim()) { setErr("Uzupełnij wszystkie pola."); return; }
    setLoading(true); setErr("");
    try {
      const existing = await sb.from("users").select("*", `&email=eq.${encodeURIComponent(email)}`);
      if (existing.length) { setErr("Konto z tym e-mailem już istnieje."); return; }
      const uid = f.genId();
      await sb.from("users").insert({ id:uid, name:name.trim(), email:email.trim(), pass_hash:btoa(pass) });
      onAuth({ uid, name:name.trim(), email:email.trim(), guest:false });
    } catch(e) { setErr("Błąd rejestracji: "+e.message); } finally { setLoading(false); }
  }

  async function login() {
    if (!email.trim()||!pass.trim()) { setErr("Uzupełnij pola."); return; }
    setLoading(true); setErr("");
    try {
      const rows = await sb.from("users").select("*", `&email=eq.${encodeURIComponent(email)}&pass_hash=eq.${encodeURIComponent(btoa(pass))}`);
      if (!rows.length) { setErr("Nieprawidłowy e-mail lub hasło."); return; }
      const u = rows[0];
      onAuth({ uid:u.id, name:u.name, email:u.email, guest:false });
    } catch(e) { setErr("Błąd logowania: "+e.message); } finally { setLoading(false); }
  }

  const inp = (val,set,ph,type="text") => <input style={{...c.input,marginBottom:10}} type={type} placeholder={ph} value={val} onChange={e=>set(e.target.value)}/>;

  if (mode==="choose") return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:40,marginBottom:8}}>🅿</div>
      <div style={{fontSize:24,fontWeight:600,color:"#a78bfa",marginBottom:4}}>ParkShare</div>
      <div style={{fontSize:13,color:"#4b5563",marginBottom:40}}>Wynajem miejsc parkingowych na osiedlu</div>
      <div style={{width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:10}}>
        <button style={{...c.btn("primary"),width:"100%",padding:"12px"}} onClick={()=>setMode("register")}>Utwórz konto</button>
        <button style={{...c.btn("default"),width:"100%",padding:"12px"}} onClick={()=>setMode("login")}>Zaloguj się</button>
        <button style={{...c.btn("ghost"),width:"100%",padding:"12px",border:"1px solid #2a2d3e"}} onClick={()=>onAuth({uid:"guest-"+f.genId(),name:"Gość",email:"",guest:true})}>Kontynuuj jako gość</button>
        <div style={{fontSize:11,color:"#374151",textAlign:"center",marginTop:4}}>Goście mogą przeglądać i rezerwować, ale nie mogą zarządzać miejscami.</div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:340}}>
        <button style={{...c.btn("ghost"),paddingLeft:0,marginBottom:20,fontSize:13}} onClick={()=>{setMode("choose");setErr("");}}>← Wróć</button>
        <div style={{...c.card(true)}}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:16}}>{mode==="register"?"Utwórz konto":"Zaloguj się"}</div>
          {mode==="register"&&inp(name,setName,"Imię i nazwisko")}
          {inp(email,setEmail,"E-mail","email")}
          {inp(pass,setPass,"Hasło","password")}
          {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{err}</div>}
          <button style={{...c.btn("primary"),width:"100%",opacity:loading?0.6:1}} onClick={mode==="register"?register:login} disabled={loading}>
            {loading?"Ładowanie...":mode==="register"?"Zarejestruj się":"Zaloguj"}
          </button>
          <div style={{fontSize:12,color:"#4b5563",textAlign:"center",marginTop:12,cursor:"pointer"}} onClick={()=>{setMode(mode==="register"?"login":"register");setErr("");}}>
            {mode==="register"?"Masz już konto? Zaloguj się":"Nie masz konta? Zarejestruj się"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Landing ──────────────────────────────────────────────────────────────────
function Landing({ user, onJoin, onNew, onLogout }) {
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  const [myGroups, setMyGroups] = useState([]); const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    if (user.guest) { setLoading(false); return; }
    (async () => {
      try {
        const ugs = await sb.from("user_groups").select("group_id", `&user_id=eq.${user.uid}`);
        if (!ugs.length) { setLoading(false); return; }
        const ids = ugs.map(r=>r.group_id);
        const groups = await sb.from("groups").select("*", `&id=in.(${ids.join(",")})`);
        setMyGroups(groups);
        if (groups.length===1) onJoin(groups[0].id);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  async function join() {
    const t = code.trim();
    try {
      const rows = await sb.from("groups").select("*", `&id=eq.${t}`);
      if (!rows.length) { setErr("Nie znaleziono grupy o tym kodzie."); return; }
      if (!user.guest) {
        await sb.from("user_groups").upsert({ user_id:user.uid, group_id:t });
      }
      setErr(""); onJoin(t);
    } catch(e) { setErr("Błąd: "+e.message); }
  }

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={c.spinner}/>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:40,marginBottom:8}}>🅿</div>
      <div style={{fontSize:24,fontWeight:600,color:"#a78bfa",marginBottom:2}}>ParkShare</div>
      <div style={{fontSize:12,color:"#6b7280",marginBottom:28}}>Zalogowany jako: <span style={{color:"#a78bfa"}}>{user.name}</span>{user.guest?" (gość)":""}</div>
      <div style={{width:"100%",maxWidth:360}}>
        {myGroups.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Twoje grupy</div>
            {myGroups.map(g=>(
              <div key={g.id} style={{...c.card(false),marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}} onClick={()=>onJoin(g.id)}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{g.name}</div>
                  <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{g.id}</div>
                </div>
                <span style={{fontSize:18,color:"#7c3aed"}}>→</span>
              </div>
            ))}
            <div style={{borderTop:"1px solid #1f2230",margin:"16px 0"}}/>
          </div>
        )}

        {(!showJoin&&!user.guest)?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button style={{...c.btn("ghost"),width:"100%",border:"1px solid #2a2d3e",padding:"11px"}} onClick={()=>setShowJoin(true)}>+ Dołącz do nowej grupy (kod)</button>
            <button style={{...c.btn("default"),width:"100%",padding:"11px"}} onClick={onNew}>Utwórz nową grupę</button>
          </div>
        ):(
          <div style={{...c.card(true),marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:12}}>Dołącz do grupy</div>
            <label style={c.label}>Kod grupy</label>
            <input style={{...c.input,marginBottom:err?6:12}} placeholder="np. zielone-abc123" value={code} onChange={e=>setCode(e.target.value.trim())}/>
            {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:8}}>{err}</div>}
            <div style={{display:"flex",gap:8}}>
              <button style={{...c.btn("primary"),flex:1}} onClick={join}>Dołącz</button>
              {myGroups.length>0&&<button style={c.btn()} onClick={()=>{setShowJoin(false);setErr("");}}>Anuluj</button>}
            </div>
            {!user.guest&&<><div style={{borderTop:"1px solid #1f2230",margin:"14px 0 10px"}}/><button style={{...c.btn("default"),width:"100%",fontSize:12}} onClick={onNew}>+ Utwórz nową grupę</button></>}
          </div>
        )}

        {user.guest&&(
          <div style={{...c.card(true),marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:12}}>Dołącz do grupy</div>
            <label style={c.label}>Kod grupy</label>
            <input style={{...c.input,marginBottom:err?6:12}} placeholder="np. zielone-abc123" value={code} onChange={e=>setCode(e.target.value.trim())}/>
            {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:8}}>{err}</div>}
            <button style={{...c.btn("primary"),width:"100%"}} onClick={join}>Dołącz</button>
          </div>
        )}
        <button style={{...c.btn("default"),width:"100%",fontSize:12,marginTop:8}} onClick={onLogout}>Wyloguj / zmień konto</button>
      </div>
    </div>
  );
}

function NewGroup({ onBack, onCreate }) {
  const [name, setName] = useState(""); const [loading, setLoading] = useState(false);
  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:360}}>
        <button style={{...c.btn("ghost"),paddingLeft:0,marginBottom:20,fontSize:13}} onClick={onBack}>← Wróć</button>
        <div style={{...c.card(true)}}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:4}}>Nowa grupa osiedlowa</div>
          <div style={{fontSize:12,color:"#6b7280",marginBottom:16}}>Wygenerujemy unikalny kod do udostępnienia sąsiadom</div>
          <label style={c.label}>Nazwa osiedla *</label>
          <input style={{...c.input,marginBottom:16}} placeholder="np. Osiedle Zielone" value={name} onChange={e=>setName(e.target.value)}/>
          <button style={{...c.btn("primary"),width:"100%",opacity:name.trim()&&!loading?1:0.4}} disabled={!name.trim()||loading} onClick={async()=>{setLoading(true);await onCreate(name.trim());setLoading(false);}}>
            {loading?"Tworzenie...":"Utwórz grupę"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareModal({ group, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `parkshare.app/g/${group.id}`;
  function copy(t) { navigator.clipboard?.writeText(t).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }
  return (
    <div style={c.overlay} onClick={onClose}>
      <div style={c.modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>Udostępnij grupę</div>
          <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={onClose}>✕</button>
        </div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:14}}>{group.name}</div>
        <label style={c.label}>Link</label>
        <div style={{...c.linkBox,marginBottom:12}}><span style={{flex:1}}>{link}</span><button style={{...c.btn(copied?"success":"primary"),padding:"5px 10px",fontSize:12}} onClick={()=>copy(link)}>{copied?"✓ Skopiowano":"Kopiuj"}</button></div>
        <label style={c.label}>Kod grupy</label>
        <div style={{...c.linkBox,marginBottom:16}}><span style={{flex:1,fontWeight:600,color:"#a78bfa",fontSize:14}}>{group.id}</span><button style={{...c.btn("default"),padding:"5px 10px",fontSize:12}} onClick={()=>copy(group.id)}>Kopiuj</button></div>
        <div style={{background:"#0d2a1e",border:"1px solid #065f46",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#6ee7b7"}}>Wyślij ten kod na grupę osiedlową — każda osoba zobaczy te same miejsca w czasie rzeczywistym.</div>
      </div>
    </div>
  );
}

// ─── Main ParkApp ─────────────────────────────────────────────────────────────
function ParkApp({ groupId, user, onLeave }) {
  const [group, setGroup] = useState(null);
  const [spots, setSpots] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("browse");
  const [selDate, setSelDate] = useState(new Date(today));
  const [showAdd, setShowAdd] = useState(false);
  const [newSpot, setNewSpot] = useState({name:"",desc:"",owner:user.guest?"":user.name,phone:"",email:user.email||"",note:"",type:"underground"});
  const [bookModal, setBookModal] = useState(null);
  const [bookerName, setBookerName] = useState(user.guest?"":user.name);
  const [bookerPhone, setBookerPhone] = useState("");
  const [toast, setToast] = useState(null);
  const [contactModal, setContactModal] = useState(null);
  const [editingSpotId, setEditingSpotId] = useState(null);
  const [slotForm, setSlotForm] = useState({allDay:false,from:"08:00",to:"20:00",price:"0"});
  const [calY, setCalY] = useState(today.getFullYear());
  const [calM, setCalM] = useState(today.getMonth());
  const [multiDates, setMultiDates] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [tick, setTick] = useState(0);
  const subRef = useRef(null);

  useEffect(() => { const t=setInterval(()=>setTick(n=>n+1),15000); return ()=>clearInterval(t); },[]);

  async function loadAll() {
    try {
      const [grp, sps, sls] = await Promise.all([
        sb.from("groups").select("*", `&id=eq.${groupId}`),
        sb.from("spots").select("*", `&group_id=eq.${groupId}&order=created_at.asc`),
        sb.from("slots").select("*", `&spot_id=in.(${(await sb.from("spots").select("id",`&group_id=eq.${groupId}`)).map(s=>s.id).join(",") || "null"})&order=date.asc`),
      ]);
      setGroup(grp[0]); setSpots(sps); setSlots(sls);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => {
    loadAll();
    const sub = sb.channel(`group-${groupId}`).on("*", {table:"*"}, () => { loadAll(); }).subscribe();
    subRef.current = sub;
    return () => { try { sub.unsubscribe(); } catch {} };
  }, [groupId]);

  function showToast(msg,type="success") { setToast({msg,type}); setTimeout(()=>setToast(null),3500); }

  const slotsForSpot = (spotId) => slots.filter(sl=>sl.spot_id===spotId);
  const slotsOn = (spotId, d) => slotsForSpot(spotId).filter(sl=>sl.date===d);
  const dk = f.dateKey(selDate);
  const weekDays = Array.from({length:7},(_,i)=>f.addDays(today,i));
  const spotsAvailOn = d => spots.filter(sp=>slotsOn(sp.id,d).some(sl=>!sl.booked)).length;
  const isOwner = sp => !user.guest && sp.owner_uid===user.uid;

  async function addSpot() {
    if (!newSpot.name.trim()) return;
    try {
      await sb.from("spots").insert({ id:f.genId(), group_id:groupId, name:newSpot.name.trim(), desc:newSpot.desc, owner:newSpot.owner, owner_uid:user.uid, phone:newSpot.phone, email:newSpot.email, note:newSpot.note, type:newSpot.type });
      setNewSpot({name:"",desc:"",owner:user.guest?"":user.name,phone:"",email:user.email||"",note:"",type:"underground"});
      setShowAdd(false); showToast("Miejsce dodane!");
      loadAll();
    } catch(e) { showToast("Błąd: "+e.message,"error"); }
  }

  async function updateField(spotId, field, val) {
    const dbField = field==="desc"?"desc":field==="phone"?"phone":field==="email"?"email":field==="note"?"note":field==="owner"?"owner":field;
    try { await sb.from("spots").update({[dbField]:val}, `?id=eq.${spotId}`); loadAll(); } catch {}
  }

  async function addSlots() {
    if (!multiDates.length) return;
    const price = parseFloat(slotForm.price)||0;
    try {
      const rows = multiDates.map(d=>({ id:f.genId(), spot_id:editingSpotId, date:d, all_day:slotForm.allDay, from_time:slotForm.allDay?"00:00":slotForm.from, to_time:slotForm.allDay?"24:00":slotForm.to, price }));
      await sb.from("slots").insert(rows);
      setMultiDates([]); showToast(`Dodano ${multiDates.length} termin${multiDates.length===1?"":"ów"}!`); loadAll();
    } catch(e) { showToast("Błąd: "+e.message,"error"); }
  }

  async function removeSlot(slotId) {
    try { await sb.from("slots").delete(`?id=eq.${slotId}`); loadAll(); } catch {}
  }

  async function cancelBooking(slotId) {
    try { await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},`?id=eq.${slotId}`); showToast("Rezerwacja anulowana.","warn"); loadAll(); } catch {}
  }

  async function confirmBook() {
    if (!bookerName.trim()) return;
    try {
      await sb.from("slots").update({booked:true,booked_by:bookerName,booker_phone:bookerPhone,booked_at:Date.now(),booked_by_uid:user.uid},`?id=eq.${bookModal.slotId}`);
      setBookModal(null); setBookerName(user.guest?"":user.name); setBookerPhone(""); showToast("Rezerwacja potwierdzona!"); loadAll();
    } catch(e) { showToast("Błąd: "+e.message,"error"); }
  }

  function toggleMulti(k) { setMultiDates(p=>p.includes(k)?p.filter(d=>d!==k):[...p,k]); }

  function SlotCal() {
    const dim=f.daysInMonth(calY,calM), first=f.firstDay(calY,calM);
    const cells=[...Array(first).fill(null),...Array.from({length:dim},(_,i)=>i+1)];
    const editSlots = editingSpotId ? slotsForSpot(editingSpotId) : [];
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <button style={{...c.arrow,width:28,height:28,fontSize:15}} onClick={()=>calM===0?(setCalY(y=>y-1),setCalM(11)):setCalM(m=>m-1)}>‹</button>
          <span style={{fontSize:13,fontWeight:600,color:"#c4b5fd"}}>{MONTHS_FULL[calM]} {calY}</span>
          <button style={{...c.arrow,width:28,height:28,fontSize:15}} onClick={()=>calM===11?(setCalY(y=>y+1),setCalM(0)):setCalM(m=>m+1)}>›</button>
        </div>
        <div style={c.calGrid}>
          {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:"#4b5563",padding:"3px 0"}}>{d}</div>)}
          {cells.map((day,i)=>{
            if(!day) return <div key={`e${i}`}/>;
            const k=`${calY}-${String(calM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const past=new Date(calY,calM,day)<today, sel=multiDates.includes(k);
            const has=editSlots.some(sl=>sl.date===k);
            return <div key={k} style={c.calCell(has,past,sel)} onClick={()=>!past&&toggleMulti(k)}>{day}</div>;
          })}
        </div>
        {multiDates.length>0&&<div style={{fontSize:11,color:"#a78bfa",marginTop:8}}>Zaznaczono {multiDates.length} {multiDates.length===1?"dzień":"dni"}</div>}
      </div>
    );
  }

  if (loading||!group) return (
    <div style={{...c.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={c.spinner}/>
    </div>
  );

  const isToday=f.isSameDay(selDate,today);
  const browseSpots=spots.map(sp=>({...sp,todaySlots:slotsOn(sp.id,dk)})).filter(sp=>sp.todaySlots.length>0);

  return (
    <div style={c.app}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={c.hdr}>
        <div>
          <div style={{fontSize:16,fontWeight:600,color:"#a78bfa"}}>🅿 ParkShare</div>
          <div style={{fontSize:11,color:"#6b7280"}}>{group.name}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <button style={c.navBtn(view==="browse")} onClick={()=>setView("browse")}>Przeglądaj</button>
          {!user.guest&&<button style={c.navBtn(view==="myspots")} onClick={()=>setView("myspots")}>Moje miejsca</button>}
          <button style={{...c.btn("ghost"),padding:"6px 10px",fontSize:12,border:"1px solid #2a2d3e",borderRadius:8}} onClick={()=>setShowShare(true)}>⬆ Udostępnij</button>
          <div style={c.avatar} title={user.name}>{user.name[0].toUpperCase()}</div>
          <button style={{...c.btn("default"),padding:"6px 10px",fontSize:12}} onClick={onLeave}>⇄</button>
        </div>
      </div>

      <div style={c.wrap}>
        {view==="browse"&&(
          <>
            <div style={c.weekBar}>
              {weekDays.map((d,i)=>{
                const cnt=spotsAvailOn(f.dateKey(d)),act=f.isSameDay(d,selDate);
                return (
                  <div key={i} style={c.weekCell(act,cnt)} onClick={()=>setSelDate(new Date(d))}>
                    <div style={{fontSize:10,color:act?"#e8eaf0":"#6b7280",marginBottom:2}}>{f.isSameDay(d,today)?"Dziś":DAYS_SHORT[(d.getDay()+6)%7]}</div>
                    <div style={{fontSize:13,fontWeight:600,color:act?"#fff":"#9ca3af"}}>{d.getDate()}</div>
                    {cnt>0&&<div style={{fontSize:10,color:act?"#c4b5fd":"#6ee7b7",marginTop:2}}>{cnt} wol.</div>}
                  </div>
                );
              })}
            </div>
            <div style={c.dayNav}>
              <button style={c.arrow} onClick={()=>setSelDate(d=>f.addDays(d,-1))}>‹</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{isToday?"Dzisiaj":DAYS_PL[selDate.getDay()]}</div>
                <div style={{fontSize:12,color:"#6b7280"}}>{f.fmtDate(selDate)}</div>
              </div>
              <button style={c.arrow} onClick={()=>setSelDate(d=>f.addDays(d,1))}>›</button>
            </div>
            {user.guest&&<div style={{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#6b7280"}}>Przeglądasz jako gość. <span style={{color:"#a78bfa",cursor:"pointer"}} onClick={onLeave}>Zaloguj się</span>, aby dodawać miejsca.</div>}
            {browseSpots.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{fontSize:32,marginBottom:12}}>🅿</div>
                <div style={{fontSize:14,fontWeight:500,color:"#6b7280"}}>Brak wolnych miejsc tego dnia</div>
                <div style={{fontSize:12,color:"#374151",marginTop:6}}>Spróbuj innego dnia lub wróć później</div>
              </div>
            ):browseSpots.map(sp=>(
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
                  <button style={{...c.btn("primary"),padding:"6px 12px",fontSize:12}} onClick={()=>setContactModal(sp)}>Kontakt i nr miejsca</button>
                </div>
                {sp.note&&<div style={c.noteBubble}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:3}}>Notatka</span>{sp.note}</div>}
                <div style={c.divider}/>
                {sp.todaySlots.map(sl=>(
                  <div key={sl.id} style={{...c.slotRow,opacity:sl.booked?0.55:1}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:sl.booked?"#818cf8":"#e8eaf0"}}>{sl.all_day?"Cały dzień":`${sl.from_time} – ${sl.to_time}`}</div>
                      <div style={{fontSize:12,color:sl.price===0?"#6ee7b7":"#a78bfa",marginTop:2}}>{sl.booked?`Zarezerwowane: ${sl.booked_by}`:sl.price===0?"Bezpłatnie":`${sl.price} zł`}</div>
                    </div>
                    {!sl.booked&&<button style={{...c.btn("ghost"),padding:"6px 12px",fontSize:12,border:"1px solid #2a2d3e"}} onClick={()=>setBookModal({spotId:sp.id,slotId:sl.id,sl,sp,dk})}>Zarezerwuj</button>}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {view==="myspots"&&!user.guest&&(
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:"#c4b5fd"}}>Moje miejsca parkingowe</div>
              <button style={c.btn("primary")} onClick={()=>setShowAdd(v=>!v)}>+ Dodaj</button>
            </div>
            {showAdd&&(
              <div style={{...c.card(true),marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:600,color:"#c4b5fd",marginBottom:14}}>Nowe miejsce</div>
                {[["name","Numer miejsca (prywatny) *","np. A-15"],["desc","Opis","np. poziom -1, przy windzie"],["owner","Imię i nazwisko","np. Jan Kowalski"],["phone","Telefon","np. 600 123 456"],["email","E-mail","np. jan@email.com"]].map(([fld,l,p])=>(
                  <div key={fld} style={{marginBottom:10}}>
                    <label style={c.label}>{l}</label>
                    <input style={c.input} placeholder={p} value={newSpot[fld]} onChange={e=>setNewSpot(prev=>({...prev,[fld]:e.target.value}))}/>
                  </div>
                ))}
                <div style={{marginBottom:10}}>
                  <label style={c.label}>Rodzaj miejsca</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["underground","🏗 Garaż podziemny"],["outdoor","🌤 Naziemne"]].map(([val,lbl])=>(
                      <button key={val} style={{...c.btn(newSpot.type===val?"primary":"default"),flex:1,fontSize:12}} onClick={()=>setNewSpot(p=>({...p,type:val}))}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={c.label}>Notatka / płatność</label>
                  <textarea style={c.textarea} placeholder="np. Preferuję BLIK, klucz u portiera..." value={newSpot.note} onChange={e=>setNewSpot(p=>({...p,note:e.target.value}))}/>
                </div>
                <div style={{display:"flex",gap:8}}><button style={c.btn("primary")} onClick={addSpot}>Dodaj</button><button style={c.btn()} onClick={()=>setShowAdd(false)}>Anuluj</button></div>
              </div>
            )}
            {spots.filter(isOwner).length===0&&!showAdd&&<div style={{textAlign:"center",padding:"30px 0",color:"#4b5563",fontSize:13}}>Nie masz jeszcze żadnych miejsc.</div>}
            {spots.filter(isOwner).map(sp=>(
              <div key={sp.id} style={{...c.card(editingSpotId===sp.id),marginBottom:16,cursor:"default"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{sp.type==="outdoor"?"🌤 Naziemne":"🏗 Garaż"} · nr {sp.name}</div>
                    <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{sp.desc||"Brak opisu"}</div>
                  </div>
                  <button style={c.btn(editingSpotId===sp.id?"ghost":"primary")} onClick={()=>{setEditingSpotId(editingSpotId===sp.id?null:sp.id);setMultiDates([]);}}>
                    {editingSpotId===sp.id?"Zamknij":"+ Termin"}
                  </button>
                </div>
                <div style={{background:"#0f1117",borderRadius:10,padding:12,marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Dane kontaktowe</div>
                  {[["owner","Imię i nazwisko","np. Jan Kowalski"],["phone","Telefon","np. 600 123 456"],["email","E-mail","np. jan@email.com"]].map(([fld,l,p])=>(
                    <div key={fld} style={{marginBottom:8}}>
                      <label style={c.label}>{l}</label>
                      <input style={c.input} placeholder={p} value={sp[fld]||""} onChange={e=>updateField(sp.id,fld,e.target.value)} onBlur={e=>updateField(sp.id,fld,e.target.value)}/>
                    </div>
                  ))}
                  <label style={c.label}>Notatka / płatność</label>
                  <textarea style={c.textarea} placeholder="np. Preferuję BLIK..." value={sp.note||""} onChange={e=>updateField(sp.id,"note",e.target.value)} onBlur={e=>updateField(sp.id,"note",e.target.value)}/>
                </div>
                {editingSpotId===sp.id&&(
                  <div style={{background:"#0f1117",borderRadius:10,padding:14,marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:600,color:"#a78bfa",marginBottom:12}}>Wybierz dni dostępności</div>
                    <SlotCal/>
                    <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div style={{gridColumn:"1/-1"}}>
                        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#9ca3af",cursor:"pointer"}}>
                          <input type="checkbox" checked={slotForm.allDay} onChange={e=>setSlotForm(p=>({...p,allDay:e.target.checked}))} style={{accentColor:"#7c3aed"}}/>
                          Cały dzień
                        </label>
                      </div>
                      {!slotForm.allDay&&(
                        <>
                          <div><label style={c.label}>Od</label><input type="time" style={c.input} value={slotForm.from} onChange={e=>setSlotForm(p=>({...p,from:e.target.value}))}/></div>
                          <div><label style={c.label}>Do</label><input type="time" style={c.input} value={slotForm.to} onChange={e=>setSlotForm(p=>({...p,to:e.target.value}))}/></div>
                        </>
                      )}
                      <div style={{gridColumn:"1/-1"}}>
                        <label style={c.label}>Cena (zł), 0 = bezpłatnie</label>
                        <input type="number" min="0" style={c.input} value={slotForm.price} onChange={e=>setSlotForm(p=>({...p,price:e.target.value}))}/>
                      </div>
                    </div>
                    <button style={{...c.btn("primary"),marginTop:14,width:"100%",opacity:multiDates.length?1:0.4}} onClick={addSlots} disabled={!multiDates.length}>
                      Dodaj {multiDates.length>0?`${multiDates.length} termin${multiDates.length===1?"":"ów"}`:"terminy"}
                    </button>
                  </div>
                )}
                {slotsForSpot(sp.id).length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Terminy</div>
                    {slotsForSpot(sp.id).sort((a,b)=>a.date.localeCompare(b.date)).map(sl=>{
                      const canCancel=sl.booked&&f.canCancel(sl.booked_at);
                      return (
                        <div key={sl.id} style={c.slotRow}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:500,color:"#e8eaf0"}}>{f.fmtDate(f.parseDate(sl.date))}</div>
                            <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{sl.all_day?"Cały dzień":`${sl.from_time}–${sl.to_time}`} · {sl.price===0?"Bezpłatnie":`${sl.price} zł`}</div>
                            {sl.booked&&<div style={{fontSize:11,color:"#818cf8",marginTop:2}}>
                              {sl.booked_by}{sl.booker_phone?` · ${sl.booker_phone}`:""}
                              {canCancel&&<span style={{color:"#fbbf24"}}> · anuluj ({f.timeLeft(sl.booked_at)})</span>}
                              {!canCancel&&<span style={{color:"#4b5563"}}> · zaakceptowane</span>}
                            </div>}
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                            {canCancel&&<button style={{...c.btn("warn"),padding:"5px 10px",fontSize:11}} onClick={()=>cancelBooking(sl.id)}>Anuluj rez.</button>}
                            {!sl.booked&&<button style={{...c.btn("danger"),padding:"5px 10px",fontSize:11}} onClick={()=>removeSlot(sl.id)}>Usuń</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {contactModal&&(
        <div style={c.overlay} onClick={()=>setContactModal(null)}>
          <div style={c.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:16,fontWeight:600,color:"#e8eaf0"}}>{contactModal.type==="outdoor"?"🌤 Miejsce naziemne":"🏗 Garaż podziemny"}</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{contactModal.desc}</div>
              </div>
              <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={()=>setContactModal(null)}>✕</button>
            </div>
            <div style={{background:"#0f1117",borderRadius:10,padding:12,marginBottom:12}}>
              {[{icon:"👤",label:"Imię i nazwisko",val:contactModal.owner},{icon:"📞",label:"Telefon",val:contactModal.phone},{icon:"✉️",label:"E-mail",val:contactModal.email}].map(({icon,label,val})=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #1f2230"}}>
                  <div style={{...c.avatar,width:28,height:28,fontSize:14,background:"#1a1d2e"}}>{icon}</div>
                  <div><div style={{fontSize:11,color:"#4b5563"}}>{label}</div><div style={{fontSize:13,color:val?"#e8eaf0":"#374151"}}>{val||"Nie podano"}</div></div>
                </div>
              ))}
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}>
                <div style={{...c.avatar,width:28,height:28,fontSize:14,background:"#1a1d2e"}}>🅿</div>
                <div>
                  <div style={{fontSize:11,color:"#4b5563"}}>Numer miejsca</div>
                  {(() => {
                    const mySlot = slots.find(sl=>sl.spot_id===contactModal.id&&sl.booked&&sl.booked_by_uid===user.uid&&!f.canCancel(sl.booked_at));
                    const show = !user.guest&&(isOwner(contactModal)||mySlot);
                    return show
                      ? <div style={{fontSize:15,fontWeight:700,color:"#a78bfa"}}>{contactModal.name||"Nie podano"}</div>
                      : <div style={{fontSize:12,color:"#374151"}}>Widoczny po zaakceptowaniu rezerwacji</div>;
                  })()}
                </div>
              </div>
            </div>
            {contactModal.note&&<div style={c.noteBubble}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Notatka właściciela</span>{contactModal.note}</div>}
          </div>
        </div>
      )}

      {bookModal&&(
        <div style={c.overlay} onClick={()=>setBookModal(null)}>
          <div style={c.modal} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:6}}>Zarezerwuj miejsce</div>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>
              {bookModal.sp.type==="outdoor"?"🌤 Naziemne":"🏗 Garaż"} · {f.fmtDate(f.parseDate(bookModal.dk))}<br/>
              {bookModal.sl.all_day?"Cały dzień":`${bookModal.sl.from_time}–${bookModal.sl.to_time}`} · {bookModal.sl.price===0?"Bezpłatnie":`${bookModal.sl.price} zł`}
            </div>
            {bookModal.sp.note&&<div style={{...c.noteBubble,marginBottom:14}}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:3}}>Notatka właściciela</span>{bookModal.sp.note}</div>}
            <div style={{background:"#0d2a1e",border:"1px solid #065f46",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#6ee7b7",marginBottom:14}}>
              Właściciel ma 1 godzinę na anulowanie. Po tym czasie rezerwacja jest automatycznie zatwierdzona.
            </div>
            <div style={{marginBottom:10}}><label style={c.label}>Twoje imię i nazwisko *</label><input style={c.input} value={bookerName} onChange={e=>setBookerName(e.target.value)} placeholder="np. Marek Nowak"/></div>
            <div style={{marginBottom:16}}><label style={c.label}>Telefon (opcjonalnie)</label><input style={c.input} value={bookerPhone} onChange={e=>setBookerPhone(e.target.value)} placeholder="np. 600 123 456"/></div>
            <div style={{display:"flex",gap:8}}><button style={c.btn("primary")} onClick={confirmBook}>Potwierdź</button><button style={c.btn()} onClick={()=>setBookModal(null)}>Anuluj</button></div>
          </div>
        </div>
      )}

      {showShare&&<ShareModal group={group} onClose={()=>setShowShare(false)}/>}
      {toast&&<div style={c.toast(toast.type)}>{toast.msg}</div>}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Root() {
  const [screen, setScreen] = useState("auth");
  const [user, setUser] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);

  function handleAuth(u) { setUser(u); setScreen("landing"); }

  async function handleJoin(id) {
    if (!user.guest) {
      try { await sb.from("user_groups").upsert({ user_id:user.uid, group_id:id }); } catch {}
    }
    setActiveGroupId(id); setScreen("app");
  }

  async function handleNew(name) {
    const slug = name.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").slice(0,20);
    const id = `${slug}-${f.genId()}`;
    try {
      await sb.from("groups").insert({ id, name });
      if (!user.guest) await sb.from("user_groups").upsert({ user_id:user.uid, group_id:id });
      setActiveGroupId(id); setScreen("app");
    } catch(e) { console.error(e); }
  }

  if (screen==="auth") return <AuthScreen onAuth={handleAuth}/>;
  if (screen==="landing") return <Landing user={user} onJoin={handleJoin} onNew={()=>setScreen("newgroup")} onLogout={()=>{setUser(null);setScreen("auth");}}/>;
  if (screen==="newgroup") return <NewGroup onBack={()=>setScreen("landing")} onCreate={handleNew}/>;
  if (screen==="app"&&activeGroupId) return <ParkApp groupId={activeGroupId} user={user} onLeave={()=>setScreen("landing")}/>;
  return null;
}
