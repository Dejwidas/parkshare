import { useState, useEffect, useRef } from "react";
import { c } from "../styles.js";
import { sb, clearSession } from "../supabase.js";
import { isPushSupported, getPushStatus, subscribePush, unsubscribePush } from "../push.js";

// ============ MENU UŻYTKOWNIKA (dropdown w headerze) ============
export function UserMenu({ user, onOpenSettings, onOpenHelp, onLogout }) {
  var [open,setOpen] = useState(false);
  var ref = useRef(null);

  useEffect(function(){
    function onClick(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return function(){ document.removeEventListener("mousedown", onClick); };
  }, []);

  var name = (user && user.name) || "Konto";
  var initial = (name.charAt(0) || "?").toUpperCase();
  var isGuest = !!(user && user.guest);

  var menuItemStyle = {display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"11px 12px",color:"#e8eaf0",fontSize:14,cursor:"pointer"};

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button
        onClick={function(){ setOpen(function(o){return !o;}); }}
        style={{display:"flex",alignItems:"center",gap:6,background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:10,padding:"4px 8px 4px 4px",cursor:"pointer",color:"#e8eaf0",fontSize:13}}
      >
        <div style={{...c.avatar,margin:0}}>{initial}</div>
        <span style={{fontSize:9,color:"#6b7280"}}>▾</span>
      </button>

      {open && (
        <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:10,minWidth:230,maxWidth:"calc(100vw - 24px)",boxShadow:"0 10px 30px rgba(0,0,0,0.4)",zIndex:250,overflow:"hidden"}}>
          <div style={{padding:"10px 12px",borderBottom:"1px solid #2a2d3e"}}>
            <div style={{fontSize:13,color:"#e8eaf0",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
            {user && user.email && <div style={{fontSize:11,color:"#6b7280",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</div>}
            {isGuest && <div style={{fontSize:11,color:"#6b7280"}}>Tryb gościa</div>}
          </div>

          {!isGuest && (
            <button
              onClick={function(){ setOpen(false); onOpenSettings(); }}
              style={menuItemStyle}
              onMouseEnter={function(e){e.currentTarget.style.background="#22253a";}}
              onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}
            >⚙  Ustawienia konta</button>
          )}

            <button
            onClick={function(){ setOpen(false); onOpenHelp(); }}
            style={menuItemStyle}
            onMouseEnter={function(e){e.currentTarget.style.background="#22253a";}}
            onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}
          >❓  Pomoc</button>

          <button
            onClick={function(){ setOpen(false); onLogout(); }}
            style={{...menuItemStyle,color:"#f87171",borderTop:!isGuest?"1px solid #2a2d3e":"none"}}
            onMouseEnter={function(e){e.currentTarget.style.background="#22253a";}}
            onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}
          >{isGuest?"↩  Zaloguj się":"↩  Wyloguj"}</button>
        </div>
      )}
    </div>
  );
}

// ============ EKRAN USTAWIEŃ KONTA ============
export function AccountSettingsView({ user, onBack, onLogout }) {
  return (
    <div style={{minHeight:"100vh",background:"#0f1117",padding:"20px 16px"}}>
      <div style={{maxWidth:520,margin:"0 auto"}}>
        <button onClick={onBack} style={{background:"transparent",color:"#9ca3af",border:"none",padding:0,fontSize:13,cursor:"pointer",marginBottom:16}}>← Wróć</button>
        <h2 style={{color:"#e8eaf0",fontSize:22,fontWeight:700,margin:"0 0 4px"}}>Ustawienia konta</h2>
        <div style={{color:"#6b7280",fontSize:13,marginBottom:20}}>Zarządzaj swoim kontem ParkShare</div>

        <div style={{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:12}}>Twoje dane</div>
          <Row label="Imię i nazwisko" value={(user && user.name) || "—"}/>
          <Row label="E-mail" value={(user && user.email) || "—"}/>
        </div>

        <NotificationsSection user={user}/>

        <DeleteAccountSection user={user} onLogout={onLogout}/>
      </div>
    </div>
  );
}

function Row({ label, value }){
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #22253a",gap:8}}>
      <span style={{fontSize:13,color:"#6b7280",flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,color:"#e8eaf0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</span>
    </div>
  );
}

// ============ SEKCJA POWIADOMIEŃ PUSH ============
function NotificationsSection({ user }) {
  var [status,setStatus] = useState({ supported: false, subscribed: false, permission: "default" });
  var [busy,setBusy] = useState(false);
  var [err,setErr] = useState("");

  useEffect(function(){
    getPushStatus().then(setStatus);
  }, []);

  async function toggle() {
    setErr(""); setBusy(true);
    try {
      if (status.subscribed) {
        await unsubscribePush();
      } else {
        await subscribePush(user && user.uid);
      }
      var fresh = await getPushStatus();
      setStatus(fresh);
    } catch(e) {
      setErr(e.message || "Nie udało się zmienić ustawień");
    } finally {
      setBusy(false);
    }
  }

  var card = {background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,padding:16,marginBottom:16};
  var btn = {background:status.subscribed?"transparent":"#7c3aed",color:status.subscribed?"#e8eaf0":"#fff",border:status.subscribed?"1px solid #2a2d3e":"none",borderRadius:8,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:busy?"wait":"pointer",width:"100%",opacity:busy?0.6:1};

  return (
    <div style={card}>
      <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:6}}>Powiadomienia push</div>
      <div style={{fontSize:12,color:"#9ca3af",lineHeight:1.5,marginBottom:12}}>
        Otrzymuj powiadomienie na telefon/przeglądarkę, gdy ktoś zarezerwuje Twoje miejsce parkingowe.
      </div>

      {!status.supported && (
        <div style={{fontSize:12,color:"#9ca3af"}}>
          Twoja przeglądarka nie obsługuje powiadomień. Na iOS musisz najpierw dodać aplikację do ekranu głównego.
        </div>
      )}

      {status.supported && status.permission === "denied" && (
        <div style={{fontSize:12,color:"#fbbf24",lineHeight:1.5,marginBottom:8}}>
          ⚠ Powiadomienia są zablokowane w ustawieniach przeglądarki. Aby je włączyć, odblokuj je w ustawieniach strony.
        </div>
      )}

      {status.supported && status.permission !== "denied" && (
        <>
          <button style={btn} onClick={toggle} disabled={busy}>
            {busy ? "..." : (status.subscribed ? "🔕  Wyłącz powiadomienia" : "🔔  Włącz powiadomienia")}
          </button>
          {status.subscribed && (
            <div style={{fontSize:11,color:"#6ee7b7",marginTop:8}}>✓ Powiadomienia są aktywne na tym urządzeniu</div>
          )}
        </>
      )}

      {err && <div style={{fontSize:12,color:"#f87171",marginTop:8}}>{err}</div>}
    </div>
  );
}

// ============ SEKCJA USUWANIA KONTA ============
function DeleteAccountSection({ user, onLogout }) {
  var [stage,setStage] = useState("idle");
  var [counts,setCounts] = useState({ booker: 0, owner: 0 });
  var [confirmText,setConfirmText] = useState("");
  var [err,setErr] = useState("");

  async function startDelete() {
    setErr("");
    try {
      var data = await sb.rpc("count_my_active_reservations");
      var payload = Array.isArray(data) ? data[0] : data;
      var booker = (payload && payload.booker) || 0;
      var owner = (payload && payload.owner) || 0;
      setCounts({ booker: booker, owner: owner });
      setStage(booker + owner > 0 ? "warning" : "confirm");
    } catch(e){
      console.error("count_my_active_reservations:", e);
      setErr("Błąd: " + (e.message || "nieznany"));
    }
  }

  async function doDelete() {
    setErr(""); setStage("deleting");
    try {
      await sb.rpc("delete_my_account");
      try { await sb.auth.signOut(); } catch(e){}
      try { clearSession(); } catch(e){}
      if(typeof onLogout === "function") {
        onLogout();
      } else {
        window.location.reload();
      }
    } catch(e){
      console.error("delete_my_account:", e);
      setErr("Nie udało się usunąć konta: " + (e.message || "nieznany"));
      setStage("confirm");
    }
  }

  var card = {background:"#1a1d2e",border:"1px solid #7f1d1d",borderRadius:12,padding:16};
  var btnDanger = {background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"12px 16px",fontSize:14,fontWeight:600,cursor:"pointer",width:"100%"};
  var btnGhost = {background:"transparent",color:"#9ca3af",border:"1px solid #2a2d3e",borderRadius:8,padding:"12px 16px",fontSize:14,cursor:"pointer",width:"100%",marginTop:8};
  var input = {width:"100%",background:"#0f1117",border:"1px solid #2a2d3e",borderRadius:8,padding:"12px",color:"#e8eaf0",fontSize:16,boxSizing:"border-box"};

  return (
    <div style={card}>
      <div style={{fontSize:14,fontWeight:600,color:"#f87171",marginBottom:6}}>Strefa niebezpieczna</div>
      <div style={{fontSize:12,color:"#9ca3af",lineHeight:1.5,marginBottom:12}}>
        Usunięcie konta jest nieodwracalne. Skasujemy wszystkie Twoje miejsca, terminy, rezerwacje i członkostwa w grupach.
      </div>

      {stage==="idle" && (
        <>
          <button style={btnDanger} onClick={startDelete}>Usuń konto</button>
          {err && <div style={{fontSize:12,color:"#f87171",marginTop:8}}>{err}</div>}
        </>
      )}

      {stage==="warning" && (
        <div>
          <div style={{background:"#3f1d1d",border:"1px solid #7f1d1d",borderRadius:8,padding:12,marginBottom:12,fontSize:13,color:"#fca5a5",lineHeight:1.5}}>
            ⚠ <strong>Masz aktywne rezerwacje:</strong>
            {counts.booker>0 && <div style={{marginTop:4}}>• Zarezerwowane przez Ciebie miejsca: <strong>{counts.booker}</strong></div>}
            {counts.owner>0 && <div style={{marginTop:4}}>• Rezerwacje na Twoich miejscach: <strong>{counts.owner}</strong></div>}
            <div style={{marginTop:8}}>Usunięcie konta skasuje również te rezerwacje. Osoby, których to dotyczy, nie zostaną powiadomione.</div>
          </div>
          <button style={btnDanger} onClick={function(){setStage("confirm");}}>Rozumiem, kontynuuj</button>
          <button style={btnGhost} onClick={function(){setStage("idle");}}>Anuluj</button>
        </div>
      )}

      {stage==="confirm" && (
        <div>
          <div style={{fontSize:13,color:"#e8eaf0",marginBottom:8}}>Aby potwierdzić, wpisz <strong style={{color:"#f87171"}}>USUŃ</strong>:</div>
          <input style={input} value={confirmText} onChange={function(e){setConfirmText(e.target.value);}} placeholder="USUŃ"/>
          {err && <div style={{fontSize:12,color:"#f87171",marginTop:8}}>{err}</div>}
          <button style={{...btnDanger,marginTop:10,opacity:confirmText==="USUŃ"?1:0.5}} disabled={confirmText!=="USUŃ"} onClick={doDelete}>Usuń konto na zawsze</button>
          <button style={btnGhost} onClick={function(){setStage("idle");setConfirmText("");setErr("");}}>Anuluj</button>
        </div>
      )}

      {stage==="deleting" && <div style={{textAlign:"center",padding:12,color:"#9ca3af",fontSize:13}}>Usuwam konto…</div>}
    </div>
  );
}
