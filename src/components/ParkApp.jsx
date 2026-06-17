import { useState, useEffect, useRef } from "react";
import { c, useIsMobile } from "../styles.js";
import { sb } from "../supabase.js";
import { f, today, DAYS_SHORT, DAYS_PL, MONTHS_FULL, CANCEL_WINDOW_MS } from "../constants.js";
import { ParkLogo, ConfirmDialog, Spinner } from "./UI.jsx";
import { GroupSwitcher } from "./GroupSwitcher.jsx";
import { AdminPanel } from "./AdminPanel.jsx";
import { UserMenu, AccountSettingsView } from "./AccountSettings.jsx";


function InviteModal({ group, onClose, isMobile }) {
  var [copied,setCopied] = useState(false);
  var [copiedAll,setCopiedAll] = useState(false);
  var msg = "Dołącz do grupy "+group.name+" na ParkShare! Adres: https://parkshare.pl Kod grupy: "+group.id;
  function copyCode(){navigator.clipboard&&navigator.clipboard.writeText(group.id).catch(function(){});setCopied(true);setTimeout(function(){setCopied(false);},2000);}
  function copyAll(){navigator.clipboard&&navigator.clipboard.writeText(msg).catch(function(){});setCopiedAll(true);setTimeout(function(){setCopiedAll(false);},2000);}
  return (
    <div style={c.overlay} onClick={onClose}>
      <div style={isMobile?c.modalMobile:c.modal} onClick={function(e){e.stopPropagation();}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>📨 Zaproś do grupy</div>
          <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={onClose}>X</button>
        </div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:16}}>{group.name}</div>
        <label style={c.label}>Kod grupy</label>
        <div style={{...c.linkBox,marginBottom:16}}>
          <span style={{flex:1,fontWeight:700,color:"#a78bfa",fontSize:16}}>{group.id}</span>
          <button style={{...c.btn(copied?"success":"primary"),padding:"5px 10px",fontSize:12,flexShrink:0}} onClick={copyCode}>{copied?"Skopiowano":"Kopiuj kod"}</button>
        </div>
        <label style={c.label}>Gotowa wiadomość</label>
        <div style={{background:"#0f1117",border:"1px solid #2a2d3e",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#9ca3af",lineHeight:1.7,marginBottom:10}}>{msg}</div>
        <button style={{...c.btn(copiedAll?"success":"default"),width:"100%",marginBottom:16}} onClick={copyAll}>{copiedAll?"Skopiowano":"Kopiuj wiadomość"}</button>
        <div style={{background:"#0d2a1e",border:"1px solid #065f46",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#6ee7b7"}}>Wyślij kod na grupę osiedlową — każda osoba wchodzi na parkshare.pl i wpisuje kod żeby dołączyć.</div>
      </div>
    </div>
  );
}

function phoneInput(val, onChange) {
  return <input style={c.input} placeholder="np. +48 600 123 456" value={val} onChange={function(e){var v=e.target.value.replace(/[^0-9+\s\-]/g,"");onChange(v);}}/>;
}

// ============ BOTTOM NAV (mobile) ============
function BottomNav({ view, setView, pendingCount, myBookingsCount, isGuest }) {
  return (
    <div style={c.bottomNav}>
      <button style={c.bottomNavBtn(view==="browse")} onClick={function(){setView("browse");}}>
        <span style={c.bottomNavIcon}>🗓</span>
        <span>Przeglądaj</span>
      </button>
      <button style={c.bottomNavBtn(view==="mybookings")} onClick={function(){setView("mybookings");}}>
        <span style={{...c.bottomNavIcon,position:"relative"}}>
          📋
          {myBookingsCount>0 && <span style={{position:"absolute",top:-4,right:-10,background:"#7c3aed",color:"#fff",borderRadius:10,fontSize:9,fontWeight:700,padding:"1px 5px",minWidth:14,textAlign:"center"}}>{myBookingsCount}</span>}
        </span>
        <span>Rezerwacje</span>
      </button>
      {!isGuest && (
        <button style={c.bottomNavBtn(view==="myspots")} onClick={function(){setView("myspots");}}>
          <span style={{...c.bottomNavIcon,position:"relative"}}>
            🚗
            {pendingCount>0 && <span style={{position:"absolute",top:-4,right:-10,background:"#dc2626",color:"#fff",borderRadius:10,fontSize:9,fontWeight:700,padding:"1px 5px",minWidth:14,textAlign:"center"}}>{pendingCount}</span>}
          </span>
          <span>Moje miejsca</span>
        </button>
      )}
    </div>
  );
}

export function ParkApp({ groupId, user, onLeave, onLogout, onSwitchGroup, onNew, onOpenHelp }) {
  var isMobile = useIsMobile();
  var [group,setGroup] = useState(null);
  var [spots,setSpots] = useState([]);
  var [slots,setSlots] = useState([]);
  var [myRole,setMyRole] = useState("member");
  var [loading,setLoading] = useState(true);
  var [view,setView] = useState("browse");
  var [selDate,setSelDate] = useState(new Date(today));
  var [weekOffset,setWeekOffset] = useState(0);
  var [confirmDialog,setConfirmDialog] = useState(null);
  var [showAdd,setShowAdd] = useState(false);
  var [newSpot,setNewSpot] = useState({name:"",desc:"",owner:user.guest?"":user.name,phone:"",email:"",note:"",type:"underground",spotVisibility:"private"});
  var [newSpotErr,setNewSpotErr] = useState("");
  var [bookModal,setBookModal] = useState(null);
  var [bookerName,setBookerName] = useState(user.guest?"":user.name);
  var [bookerPhone,setBookerPhone] = useState("");
  var [toast,setToast] = useState(null);
  var [contactModal,setContactModal] = useState(null);
  var [editingSpotId,setEditingSpotId] = useState(null);
  var [slotForm,setSlotForm] = useState({allDay:false,from:"08:00",to:"20:00",price:"0"});
  var [calY,setCalY] = useState(today.getFullYear());
  var [calM,setCalM] = useState(today.getMonth());
  var [multiDates,setMultiDates] = useState([]);
  var [showInvite,setShowInvite] = useState(false);
  var [editSpotModal,setEditSpotModal] = useState(null);
  var [editSlotModal, setEditSlotModal] = useState(null);
  var subRef = useRef(null);

  var modalStyle = isMobile ? c.modalMobile : c.modal;

  useEffect(function(){
    var t = setInterval(function(){setSlots(function(s){return [...s];});},15000);
    return function(){clearInterval(t);};
  },[]);

  async function loadAll(){
    try{
      var grp = await sb.from("groups").select("*","&id=eq."+groupId);
      var sps = await sb.from("spots").select("*","&group_id=eq."+groupId+"&order=created_at.asc");
      var spIds = sps.map(function(s){return s.id;});
      var sls = spIds.length ? await sb.from("slots").select("*","&spot_id=in.("+spIds.join(",")+")&order=date.asc") : [];
      if(!user.guest){
        var ug = await sb.from("user_groups").select("role","&user_id=eq."+user.uid+"&group_id=eq."+groupId);
        if(ug.length) setMyRole(ug[0].role);
      }
      setGroup(grp[0]); setSpots(sps); setSlots(sls);
    }catch(e){console.error(e);}finally{setLoading(false);}
  }

  useEffect(function(){
    loadAll();
    var sub = sb.channel("group-"+groupId).on("*",{table:"*"},function(){loadAll();}).subscribe();
    subRef.current = sub;
    return function(){try{sub.unsubscribe();}catch(e){}};
  },[groupId]);

  function showToast(msg,type){setToast({msg,type:type||"success"});setTimeout(function(){setToast(null);},3500);}
  function confirm(msg,onConfirm){setConfirmDialog({msg,onConfirm});}
  function slotsForSpot(id){return slots.filter(function(sl){return sl.spot_id===id;});}
  function slotsOn(id,d){return slotsForSpot(id).filter(function(sl){return sl.date===d;});}
  function hasConflict(spotId, dateKey) {
    var existing = slotsForSpot(spotId).filter(function(sl){return sl.date===dateKey;});
    if(!existing.length) return false;
    if(slotForm.allDay) return true;
    if(existing.some(function(sl){return sl.all_day;})) return true;
    var newFrom = f.timeToMin(slotForm.from);
    var newTo = f.timeToMin(slotForm.to);
    return existing.some(function(sl){
      var exFrom = f.timeToMin(sl.from_time);
      var exTo = f.timeToMin(sl.to_time);
      return newFrom < exTo && newTo > exFrom;
    });
  }
  var dk = f.dateKey(selDate);
  var weekDays = Array.from({length:7},function(_,i){return f.addDays(today,weekOffset*7+i);});
  function spotsAvailOn(d){return spots.filter(function(sp){return slotsOn(sp.id,d).some(function(sl){return !sl.booked;});}).length;}
  function isOwner(sp){return !user.guest&&sp.owner_uid===user.uid;}
  var isAdmin = myRole==="admin";
  function toggleMulti(k){setMultiDates(function(p){return p.includes(k)?p.filter(function(d){return d!==k;}):[...p,k];});}

  function getPendingBookings(){
    return spots.filter(isOwner).flatMap(function(sp){
      return slotsForSpot(sp.id).filter(function(sl){return sl.booked&&f.canCancel(sl.booked_at);}).map(function(sl){return {...sl,spotName:sp.name};});
    });
  }
  var pendingBookings = getPendingBookings();

  async function addSpot(){
    if(!newSpot.name.trim()){setNewSpotErr("Podaj numer miejsca.");return;}
    if(!newSpot.phone.trim()&&!newSpot.email.trim()){setNewSpotErr("Podaj numer telefonu lub adres e-mail.");return;}
    setNewSpotErr("");
    try{
      await sb.from("spots").insert({id:f.genId(),group_id:groupId,name:newSpot.name.trim(),desc:newSpot.desc,owner:newSpot.owner,owner_uid:user.uid,phone:newSpot.phone,email:newSpot.email,note:newSpot.note,type:newSpot.type,spot_visibility:newSpot.spotVisibility});
      setNewSpot({name:"",desc:"",owner:user.guest?"":user.name,phone:"",email:"",note:"",type:"underground",spotVisibility:"private"});
      setShowAdd(false); showToast("Miejsce dodane!"); loadAll();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

//////////////////////////////////////////////////////////////////////////////nowe funkcje \\\\\\\\\\\\\\\\\\\\\\\\\\\\\
  function getPendingBookings(){
  return spots.filter(isOwner).flatMap(function(sp){
    return slotsForSpot(sp.id).filter(function(sl){return sl.booked&&f.canCancel(sl.booked_at);}).map(function(sl){return {...sl,spotName:sp.name};});
  });
}
var pendingBookings = getPendingBookings();

  function getMyBookings(){
  var todayKey = f.dateKey(today);
  return spots.flatMap(function(sp){
    return slotsForSpot(sp.id).filter(function(sl){
      return sl.booked && sl.booked_by_uid === user.uid && sl.date >= todayKey;
    }).map(function(sl){ return {...sl, spot: sp}; });
  }).sort(function(a,b){
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return f.timeToMin(a.from_time) - f.timeToMin(b.from_time);
  });
}
var myBookings = getMyBookings();


  async function updateField(spotId,field,val){
    try{await sb.from("spots").update({[field]:val},"?id=eq."+spotId);loadAll();}catch(e){}
  }

  async function saveEditedSpot(spotId, data) {
    try {
      await sb.from("spots").update({
        name: data.name,
        desc: data.desc,
        owner: data.owner,
        phone: data.phone,
        email: data.email,
        note: data.note,
        type: data.type,
        spot_visibility: data.spotVisibility
      }, "?id=eq."+spotId);
      setEditSpotModal(null);
      showToast("Miejsce zaktualizowane!");
      loadAll();
    } catch(e){ showToast("Błąd: "+e.message,"error"); }
  }

  async function removeSpot(spotId,spotName){
    confirm("Czy na pewno chcesz usunąć miejsce nr "+spotName+"? Ta akcja usunie również wszystkie terminy.", async function(){
      try{
        var ss = slotsForSpot(spotId);
        for(var i=0;i<ss.length;i++) await sb.from("slots").delete("?id=eq."+ss[i].id);
        await sb.from("spots").delete("?id=eq."+spotId);
        showToast("Miejsce usunięte.","warn"); loadAll();
      }catch(e){showToast("Błąd: "+e.message,"error");}
    });
  }

  async function addSlots(spotId){
    if(!multiDates.length||!spotId) return;
    var conflicts=multiDates.filter(function(d){return hasConflict(spotId,d,slotForm);});
    if(conflicts.length>0){showToast("Wybrany termin już istnieje dla tego miejsca.","error");return;}
    var price = parseFloat(slotForm.price)||0;
    try{
      var rows = multiDates.map(function(d){return {id:f.genId(),spot_id:spotId,date:d,all_day:slotForm.allDay,from_time:slotForm.allDay?"00:00":slotForm.from,to_time:slotForm.allDay?"24:00":slotForm.to,price};});
      await sb.from("slots").insert(rows);
      setMultiDates([]); showToast("Dodano "+multiDates.length+" terminów!"); loadAll();
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function removeSlot(id){
    confirm("Czy na pewno chcesz usunąć ten termin?", async function(){
      try{await sb.from("slots").delete("?id=eq."+id);loadAll();}catch(e){}
    });
  }

  async function cancelBooking(id){
    confirm("Czy na pewno chcesz anulować tę rezerwację?", async function(){
      try{
        await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},"?id=eq."+id);
        showToast("Rezerwacja anulowana.","warn"); loadAll();
      }catch(e){}
    });
  }

  async function acceptBooking(id) {
    try {
      await sb.from("slots").update({booked_at: Date.now() - CANCEL_WINDOW_MS}, "?id=eq." + id);
      showToast("Rezerwacja zatwierdzona!", "success");
      loadAll();
    } catch(e) { showToast("Błąd: " + e.message, "error"); }
  }

  async function cancelBookingDirect(id){
    try{
      await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},"?id=eq."+id);
      showToast("Rezerwacja anulowana.","warn"); loadAll();
    }catch(e){}
  }

  async function doConfirmBook(){
    if(!bookerName.trim()) return;
    var slotId = bookModal.slotId;
    try{
      await sb.from("slots").update({booked:true,booked_by:bookerName,booker_phone:bookerPhone,booked_at:Date.now(),booked_by_uid:user.uid},"?id=eq."+slotId);
      setBookModal(null); setBookerName(user.guest?"":user.name); setBookerPhone(""); showToast("Rezerwacja potwierdzona!"); loadAll();
      // Powiadom właściciela miejsca (fire-and-forget, nie blokuje UI)
      sb.invoke("send-push", { slot_id: slotId }).catch(function(e){ console.error("push notify:", e); });
    }catch(e){showToast("Błąd: "+e.message,"error");}
  }

  async function saveEditedSlot(slotId, data) {
    try {
      await sb.from("slots").update({
        all_day: data.allDay,
        from_time: data.allDay ? "00:00" : data.from,
        to_time: data.allDay ? "24:00" : data.to,
        price: parseFloat(data.price) || 0
      }, "?id=eq." + slotId);
      setEditSlotModal(null);
      showToast("Termin zaktualizowany!");
      loadAll();
    } catch(e) { showToast("Błąd: " + e.message, "error"); }
  }

  function SlotCal({ spotId }) {
    var dim=f.daysInMonth(calY,calM), first=f.firstDay(calY,calM);
    var cells=[...Array(first).fill(null),...Array.from({length:dim},function(_,i){return i+1;})];
    var editSlots = spotId ? slotsForSpot(spotId) : [];
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <button style={{...c.arrow,width:28,height:28,fontSize:15}} onClick={function(){calM===0?(setCalY(function(y){return y-1;}),setCalM(11)):setCalM(function(m){return m-1;});}}>{"<"}</button>
          <span style={{fontSize:13,fontWeight:600,color:"#c4b5fd"}}>{MONTHS_FULL[calM]} {calY}</span>
          <button style={{...c.arrow,width:28,height:28,fontSize:15}} onClick={function(){calM===11?(setCalY(function(y){return y+1;}),setCalM(0)):setCalM(function(m){return m+1;});}}>{">"}</button>
        </div>
        <div style={c.calGrid}>
          {DAYS_SHORT.map(function(d){return <div key={d} style={{textAlign:"center",fontSize:10,color:"#4b5563",padding:"3px 0"}}>{d}</div>;})}
          {cells.map(function(day,i){
            if(!day) return <div key={"e"+i}/>;
            var k=calY+"-"+String(calM+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
            var past=new Date(calY,calM,day)<today;
            var sel=multiDates.includes(k);
            var has=editSlots.some(function(sl){return sl.date===k;});
            var conflict=spotId&&!sel&&hasConflict(spotId,k,slotForm);
            var blockClick=conflict&&slotForm.allDay;
            return <div key={k} style={c.calCell(has,past,sel,blockClick)} title={blockClick?"Ten dzień już ma termin całodniowy":""} onClick={function(){if(!past&&!blockClick) toggleMulti(k);}}>{day}</div>;
          })}
        </div>
        {multiDates.length>0&&<div style={{fontSize:11,color:"#a78bfa",marginTop:8}}>Zaznaczono {multiDates.length} dni</div>}
        <div style={{fontSize:11,color:"#4b5563",marginTop:6}}>Czerwone dni — istniejący termin (konflikt)</div>
      </div>
    );
  }

  if(loading||!group) return <div style={{...c.app,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  if(view==="account") return <AccountSettingsView user={user} onBack={function(){setView("browse");}} onLogout={onLogout}/>;
  if(view==="admin" && isAdmin) return <AdminPanel groupId={groupId} user={user} spots={spots} slots={slots} onBack={function(){setView("browse");}} onDataChange={loadAll}/>;

  var isToday = f.isSameDay(selDate,today);
  var browseSpots = spots.map(function(sp){return {...sp,todaySlots:slotsOn(sp.id,dk)};}).filter(function(sp){return sp.todaySlots.length>0;});

  return (
    <div style={c.app}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={isMobile?c.hdrMobile:c.hdr}>
        <GroupSwitcher
          groupId={groupId}
          groupName={group.name}
          user={user}
          isAdmin={isAdmin}
          onJoin={onSwitchGroup}
          onNew={onNew}
          onInvite={function(){setShowInvite(true);}}
          onOpenAdmin={function(){setView("admin");}}
        />
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {!isMobile && (
            <>
              <button style={c.navBtn(view==="browse")} onClick={function(){setView("browse");setSelDate(new Date(today));setWeekOffset(0);}}>Przeglądaj</button>
              <button style={{...c.navBtn(view==="mybookings"),position:"relative"}} onClick={function(){setView("mybookings");}}>
  Moje rezerwacje
  {myBookings.length>0&&<span style={{...c.newBadge,position:"absolute",top:-6,right:-6,padding:"1px 5px",fontSize:10,background:"#7c3aed"}}>{myBookings.length}</span>}
</button>
              {!user.guest&&(
                <button style={{...c.navBtn(view==="myspots"),position:"relative"}} onClick={function(){setView("myspots");}}>
                  Moje miejsca
                  {pendingBookings.length>0&&<span style={{...c.newBadge,position:"absolute",top:-6,right:-6,padding:"1px 5px",fontSize:10}}>!</span>}
                </button>
              )}
            </>
          )}
  <UserMenu
  user={user}
  onOpenSettings={function(){setView("account");}}
  onOpenHelp={onOpenHelp}
  onLogout={onLogout}
/>
        </div>
      </div>

      <div style={isMobile?c.wrapMobile:c.wrap}>
        {view==="browse"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <button style={{...c.arrow,width:30,height:30,fontSize:15,flexShrink:0}} onClick={function(){setWeekOffset(function(o){return Math.max(0,o-1);});}} disabled={weekOffset===0}>{"<"}</button>
              <div style={{...c.weekBar,flex:1,marginBottom:0}}>
                {weekDays.map(function(d,i){
                  var cnt=spotsAvailOn(f.dateKey(d)), act=f.isSameDay(d,selDate);
                  return (
                    <div key={i} style={c.weekCell(act,cnt)} onClick={function(){setSelDate(new Date(d));}}>
                      <div style={{fontSize:10,color:act?"#e8eaf0":"#6b7280",marginBottom:2}}>{f.isSameDay(d,today)?"Dziś":DAYS_SHORT[(d.getDay()+6)%7]}</div>
                      <div style={{fontSize:13,fontWeight:600,color:act?"#fff":"#9ca3af"}}>{d.getDate()}</div>
                      {cnt>0&&<div style={{fontSize:10,color:act?"#c4b5fd":"#6ee7b7",marginTop:2}}>{cnt} wol.</div>}
                    </div>
                  );
                })}
              </div>
              <button style={{...c.arrow,width:30,height:30,fontSize:15,flexShrink:0}} onClick={function(){setWeekOffset(function(o){return o+1;});}}>{">"}</button>
            </div>
            <div style={c.dayNav}>
              <button style={c.arrow} onClick={function(){setSelDate(function(d){return f.addDays(d,-1);});}}>{"<"}</button>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{isToday?"Dzisiaj":DAYS_PL[selDate.getDay()]}</div>
                <div style={{fontSize:12,color:"#6b7280"}}>{f.fmtDate(selDate)}</div>
              </div>
              <button style={c.arrow} onClick={function(){setSelDate(function(d){return f.addDays(d,1);});}}>{">"}</button>
            </div>
            {user.guest&&<div style={{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#6b7280"}}>Przeglądasz jako gość. <span style={{color:"#a78bfa",cursor:"pointer"}} onClick={onLogout}>Zaloguj się</span>, aby dodawać miejsca.</div>}
            {browseSpots.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{marginBottom:16,display:"flex",justifyContent:"center"}}><ParkLogo size={48}/></div>
                <div style={{fontSize:14,fontWeight:500,color:"#6b7280"}}>Brak wolnych miejsc tego dnia</div>
                <div style={{fontSize:12,color:"#374151",marginTop:6}}>Spróbuj innego dnia lub wróć później</div>
              </div>
            ):browseSpots.map(function(sp){return(
              <div key={sp.id} style={c.card(false)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:20}}>{sp.type==="outdoor"?"🌤":"🏗"}</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{sp.type==="outdoor"?"Miejsce naziemne":"Garaż podziemny"}</div>
                        <div style={{fontSize:12,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sp.desc}</div>
                      </div>
                    </div>
                    <div style={{fontSize:11,color:"#4b5563"}}>Właściciel: {sp.owner||"—"}</div>
                  </div>
                  <button style={{...c.btn("primary"),padding:"6px 12px",fontSize:12,flexShrink:0}} onClick={function(){setContactModal(sp);}}>Kontakt</button>
                </div>
                {sp.note&&<div style={c.noteBubble}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:3}}>Notatka</span>{sp.note}</div>}
                <div style={c.divider}/>
                {sp.todaySlots.map(function(sl){return(
                  <div key={sl.id} style={{...c.slotRow,opacity:sl.booked?0.55:1}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:sl.booked?"#818cf8":"#e8eaf0"}}>{sl.all_day?"Cały dzień":sl.from_time+" – "+sl.to_time}</div>
                      <div style={{fontSize:12,color:sl.price===0?"#6ee7b7":"#a78bfa",marginTop:2}}>{sl.booked?"Zarezerwowane: "+sl.booked_by:sl.price===0?"Bezpłatnie":sl.price+" zł"}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {!sl.booked&&<button style={{...c.btn("ghost"),padding:"7px 14px",fontSize:13,border:"1px solid #2a2d3e"}} onClick={function(){setBookModal({spotId:sp.id,slotId:sl.id,sl,sp,dk});}}>Zarezerwuj</button>}
                      {sl.booked&&sl.booked_by_uid===user.uid&&f.canCancel(sl.booked_at)&&(
                        <button style={{...c.btn("warn"),padding:"7px 12px",fontSize:13}} onClick={function(){confirm("Czy na pewno chcesz anulować swoją rezerwację?",async function(){await cancelBookingDirect(sl.id);});}}>Anuluj</button>
                      )}
                    </div>
                  </div>
                );})}
              </div>
            );})}
          </div>
        )}

        {view==="mybookings"&&(
  <div>
    <div style={{fontSize:18,fontWeight:600,color:"#e8eaf0",marginBottom:4}}>Moje rezerwacje</div>
    <div style={{fontSize:13,color:"#6b7280",marginBottom:16}}>Twoje aktywne i nadchodzące rezerwacje</div>

    {myBookings.length === 0 ? (
      <div style={{textAlign:"center",padding:"40px 20px",color:"#6b7280"}}>
        <div style={{fontSize:48,marginBottom:12}}>📋</div>
        <div style={{fontSize:14,marginBottom:16}}>Nie masz aktywnych rezerwacji</div>
        <button style={c.btn("primary")} onClick={function(){setView("browse");setSelDate(new Date(today));setWeekOffset(0);}}>Przejdź do kalendarza</button>
      </div>
    ) : (
      myBookings.map(function(b){
        var canCancel = f.canCancel(b.booked_at);
        var when = b.all_day ? "Cały dzień" : (b.from_time + " – " + b.to_time);
        var dateObj = f.parseDate(b.date);
        return (
          <div key={b.id} style={{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:2}}>{b.spot.name}</div>
                <div style={{fontSize:12,color:"#9ca3af"}}>{f.fmtDate(dateObj)} · {when}</div>
              </div>
              <div style={{fontSize:11,fontWeight:600,padding:"3px 8px",borderRadius:6,background:canCancel?"#3f1d1d":"#1e3a2a",color:canCancel?"#fca5a5":"#6ee7b7",flexShrink:0}}>
                {canCancel ? "⏳ Oczekuje" : "✓ Zaakceptowane"}
              </div>
            </div>

            <div style={{fontSize:13,color:b.price===0?"#6ee7b7":"#a78bfa",marginBottom:8}}>
              {b.price===0 ? "Bezpłatnie" : (b.price + " zł")}
            </div>

            <div style={{borderTop:"1px solid #22253a",paddingTop:8,fontSize:12,color:"#9ca3af"}}>
              <div style={{marginBottom:4}}>Właściciel: <span style={{color:"#e8eaf0"}}>{b.spot.owner||"—"}</span></div>
              {b.spot.phone && <div style={{marginBottom:4}}>📞 <a href={"tel:"+b.spot.phone} style={{color:"#a78bfa",textDecoration:"none"}}>{b.spot.phone}</a></div>}
              {b.spot.email && <div style={{marginBottom:4}}>✉ <a href={"mailto:"+b.spot.email} style={{color:"#a78bfa",textDecoration:"none"}}>{b.spot.email}</a></div>}
              {b.spot.note && <div style={{marginTop:6,padding:8,background:"#0f1117",borderRadius:6,color:"#d1d5db",lineHeight:1.5}}>{b.spot.note}</div>}
            </div>

            {canCancel && (
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #22253a"}}>
                <div style={{fontSize:11,color:"#fbbf24",marginBottom:6}}>Możesz anulować bez konsekwencji jeszcze przez {f.timeLeft(b.booked_at)}</div>
                <button style={{...c.btn("ghost"),width:"100%",border:"1px solid #7f1d1d",color:"#fca5a5"}} onClick={function(){confirm("Czy na pewno anulować tę rezerwację?", async function(){
                  try {
                    await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},"?id=eq."+b.id);
                    showToast("Rezerwacja anulowana");
                    loadAll();
                  } catch(e) { showToast("Błąd: "+e.message,"error"); }
                });}}>Anuluj rezerwację</button>
              </div>
            )}
          </div>
        );
      })
    )}
  </div>
)}

        {view==="myspots"&&!user.guest&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:600,color:"#c4b5fd"}}>Moje miejsca parkingowe</div>
              <button style={c.btn("primary")} onClick={function(){setShowAdd(function(v){return !v;});}}>+ Dodaj</button>
            </div>

            {pendingBookings.length>0&&(
              <div style={{background:"#1c1200",border:"1px solid #fbbf24",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:"#fbbf24",marginBottom:8}}>Nowe rezerwacje oczekujące ({pendingBookings.length})</div>
                {pendingBookings.map(function(sl){return(
                  <div key={sl.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #2a1800",gap:8,flexWrap:"wrap"}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:12,color:"#e8eaf0"}}>Miejsce nr {sl.spotName} · {f.fmtDate(f.parseDate(sl.date))}</div>
                      <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{sl.booked_by}{sl.booker_phone?" · "+sl.booker_phone:""} · pozostało {f.timeLeft(sl.booked_at)}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button style={{...c.btn("success"),padding:"5px 10px",fontSize:11}} onClick={function(){acceptBooking(sl.id);}}>Zatwierdź</button>
                      <button style={{...c.btn("danger"),padding:"5px 10px",fontSize:11}} onClick={function(){cancelBooking(sl.id);}}>Anuluj</button>
                    </div>
                  </div>
                );})}
                <div style={{fontSize:11,color:"#6b7280",marginTop:8}}>Jeśli nie anulujesz w ciągu godziny, rezerwacja zostanie automatycznie zatwierdzona.</div>
              </div>
            )}

            {showAdd&&(
              <div style={{...c.card(true),marginBottom:20}}>
                <div style={{fontSize:13,fontWeight:600,color:"#c4b5fd",marginBottom:14}}>Nowe miejsce</div>
                {[["name","Numer miejsca","np. A-15"],["desc","Opis (opcjonalnie)","np. poziom -1"],["owner","Imię i nazwisko (opcjonalnie)","np. Jan Kowalski"]].map(function(row){
                  var fld=row[0],l=row[1],p=row[2];
                  return <div key={fld} style={{marginBottom:10}}><label style={c.label}>{l}</label><input style={c.input} placeholder={p} value={newSpot[fld]} onChange={function(e){var v=e.target.value;setNewSpot(function(prev){return {...prev,[fld]:v};});setNewSpotErr("");}}/></div>;
                })}
                <div style={{marginBottom:10}}><label style={c.label}>Telefon *</label>{phoneInput(newSpot.phone,function(v){setNewSpot(function(p){return {...p,phone:v};});setNewSpotErr("");})}</div>
                <div style={{marginBottom:10}}><label style={c.label}>E-mail (opcjonalnie)</label><input style={c.input} placeholder="np. jan@email.com" value={newSpot.email} onChange={function(e){var v=e.target.value;setNewSpot(function(prev){return {...prev,email:v};});setNewSpotErr("");}}/></div>
                {newSpotErr&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{newSpotErr}</div>}
                <div style={{marginBottom:10}}>
                  <label style={c.label}>Rodzaj miejsca</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["underground","Garaż podziemny"],["outdoor","Naziemne"]].map(function(row){return <button key={row[0]} style={{...c.btn(newSpot.type===row[0]?"primary":"default"),flex:1,fontSize:12}} onClick={function(){setNewSpot(function(p){return {...p,type:row[0]};});}}>{row[1]}</button>;})}
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={c.label}>Widoczność numeru miejsca</label>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...c.btn(newSpot.spotVisibility==="public"?"primary":"default"),flex:1,fontSize:12}} onClick={function(){setNewSpot(function(p){return {...p,spotVisibility:"public"};});}}>Jawne (od razu)</button>
                    <button style={{...c.btn(newSpot.spotVisibility==="private"?"primary":"default"),flex:1,fontSize:12}} onClick={function(){setNewSpot(function(p){return {...p,spotVisibility:"private"};});}}>Ukryte (po zatwierdzeniu)</button>
                  </div>
                </div>
                <div style={{marginBottom:14}}><label style={c.label}>Notatka / płatność</label><textarea style={c.textarea} placeholder="np. Preferuję BLIK..." value={newSpot.note} onChange={function(e){var v=e.target.value;setNewSpot(function(p){return {...p,note:v};});}}/></div>
                <div style={{display:"flex",gap:8}}><button style={c.btn("primary")} onClick={addSpot}>Dodaj</button><button style={c.btn()} onClick={function(){setShowAdd(false);}}>Anuluj</button></div>
              </div>
            )}

            {spots.filter(isOwner).length===0&&!showAdd&&<div style={{textAlign:"center",padding:"30px 0",color:"#4b5563",fontSize:13}}>Nie masz jeszcze żadnych miejsc.</div>}

            {spots.filter(isOwner).map(function(sp){
              var spSlots = slotsForSpot(sp.id);
              var hasPending = spSlots.some(function(sl){return sl.booked&&f.canCancel(sl.booked_at);});
              return (
                <div key={sp.id} style={{...c.card(editingSpotId===sp.id||hasPending),marginBottom:16,cursor:"default",borderColor:hasPending?"#fbbf24":editingSpotId===sp.id?"#7c3aed":"#2a2d3e"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8,flexWrap:"wrap"}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>{sp.type==="outdoor"?"🌤 Naziemne":"🏗 Garaż"} · nr {sp.name}</div>
                        {hasPending&&<span style={c.newBadge}>! Nowa</span>}
                      </div>
                      <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{sp.desc||"Brak opisu"}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button style={c.btn(editingSpotId===sp.id?"ghost":"primary")} onClick={function(){var newId=editingSpotId===sp.id?null:sp.id;setEditingSpotId(newId);setMultiDates([]);setCalY(today.getFullYear());setCalM(today.getMonth());}}>
                        {editingSpotId===sp.id?"Zamknij":"+ Termin"}
                      </button>
                      <button style={c.btn("default")} onClick={function(){setEditSpotModal({id:sp.id,name:sp.name||"",desc:sp.desc||"",owner:sp.owner||"",phone:sp.phone||"",email:sp.email||"",note:sp.note||"",type:sp.type||"underground",spotVisibility:sp.spot_visibility||"private"});}}>Edytuj</button>
                      <button style={c.btn("danger")} onClick={function(){removeSpot(sp.id,sp.name);}}>Usuń</button>
                    </div>
                  </div>

                  {editingSpotId===sp.id&&(
                    <div style={{background:"#0f1117",borderRadius:10,padding:14,marginBottom:14}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#a78bfa",marginBottom:12}}>Wybierz dni dostępności</div>
                      <SlotCal spotId={sp.id}/>
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
                      <button style={{...c.btn("primary"),marginTop:14,width:"100%",opacity:multiDates.length?1:0.4}} onClick={function(){addSlots(sp.id);}} disabled={!multiDates.length}>
                        Dodaj {multiDates.length>0?(multiDates.length+" terminów"):"terminy"}
                      </button>
                    </div>
                  )}

                  {spSlots.length>0&&(
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Terminy</div>
                      {(function(){
                        var todayKey = f.dateKey(today);
                        var activeSlots = spSlots.filter(function(sl){return sl.date>=todayKey;}).sort(function(a,b){return a.date.localeCompare(b.date);});
                        if(activeSlots.length===0) return <div style={{fontSize:12,color:"#374151",textAlign:"center",padding:"10px 0"}}>Brak aktywnych terminów</div>;
                        return activeSlots.map(function(sl){
                        var canCancel = sl.booked&&f.canCancel(sl.booked_at);
                        return (
                          <div key={sl.id} style={{...c.slotRow,background:canCancel?"#1c1200":"#0f1117",border:canCancel?"1px solid #fbbf2444":"none"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:500,color:"#e8eaf0"}}>{f.fmtDate(f.parseDate(sl.date))}</div>
                              <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{sl.all_day?"Cały dzień":(sl.from_time+"–"+sl.to_time)} · {sl.price===0?"Bezpłatnie":(sl.price+" zł")}</div>
                              {sl.booked&&(
                                <div style={{fontSize:11,color:canCancel?"#fbbf24":"#818cf8",marginTop:2}}>
                                  {sl.booked_by}{sl.booker_phone?" · "+sl.booker_phone:""}
                                  {canCancel?<span> · oczekuje ({f.timeLeft(sl.booked_at)})</span>:<span style={{color:"#4b5563"}}> · zaakceptowane</span>}
                                </div>
                              )}
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                              {canCancel&&<button style={{...c.btn("success"),padding:"5px 10px",fontSize:11}} onClick={function(){acceptBooking(sl.id);}}>Zatwierdź</button>}
                              {canCancel&&<button style={{...c.btn("warn"),padding:"5px 10px",fontSize:11}} onClick={function(){cancelBooking(sl.id);}}>Anuluj</button>}
                              {!sl.booked&&<button style={{...c.btn("default"),padding:"5px 10px",fontSize:11}} onClick={function(){
                                setEditSlotModal({id:sl.id,allDay:sl.all_day,from:sl.from_time,to:sl.to_time,price:String(sl.price)});
                              }}>Edytuj</button>}
                              <button style={{...c.btn("danger"),padding:"5px 10px",fontSize:11}} onClick={function(){removeSlot(sl.id);}}>Usuń</button>
                            </div>
                          </div>
                        );
                      });
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom nav (mobile only) */}
{isMobile && (view==="browse" || view==="myspots" || view==="mybookings") && (
  <BottomNav view={view} setView={setView} pendingCount={pendingBookings.length} myBookingsCount={myBookings.length} isGuest={user.guest}/>
)}

      {!isMobile && (
        <div style={{textAlign:"center",padding:"24px 0 8px",borderTop:"1px solid #1a1d2e"}}>
          <div style={{fontSize:11,color:"#374151"}}>
            {"v0.27 · "}
            <a href="mailto:kontakt@parkshare.pl" style={{color:"#4b5563",textDecoration:"none"}}>kontakt@parkshare.pl</a>
          </div>
        </div>
      )}

      {contactModal&&(
        <div style={c.overlay} onClick={function(){setContactModal(null);}}>
          <div style={modalStyle} onClick={function(e){e.stopPropagation();}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:8}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:16,fontWeight:600,color:"#e8eaf0"}}>{contactModal.type==="outdoor"?"Miejsce naziemne":"Garaż podziemny"}</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{contactModal.desc}</div>
              </div>
              <button style={{...c.btn(),padding:"4px 10px",fontSize:12,flexShrink:0}} onClick={function(){setContactModal(null);}}>X</button>
            </div>
            <div style={{background:"#0f1117",borderRadius:10,padding:12,marginBottom:12}}>
              {[{label:"Imię i nazwisko",val:contactModal.owner},{label:"Telefon",val:contactModal.phone},{label:"E-mail",val:contactModal.email}].map(function(row){return(
                <div key={row.label} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #1f2230"}}>
                  <div style={{...c.avatar,width:28,height:28,fontSize:12,background:"#1a1d2e"}}>i</div>
                  <div style={{minWidth:0}}><div style={{fontSize:11,color:"#4b5563"}}>{row.label}</div><div style={{fontSize:13,color:row.val?"#e8eaf0":"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.val||"Nie podano"}</div></div>
                </div>
              );})}
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0"}}>
                <div style={{...c.avatar,width:28,height:28,fontSize:12,background:"#1a1d2e"}}>P</div>
                <div>
                  <div style={{fontSize:11,color:"#4b5563"}}>Numer miejsca</div>
                  {(function(){
                    var isPublic = contactModal.spot_visibility==="public";
                    var mySlot = slots.find(function(sl){return sl.spot_id===contactModal.id&&sl.booked&&sl.booked_by_uid===user.uid&&!f.canCancel(sl.booked_at);});
                    var showImmediate = !user.guest&&(isOwner(contactModal)||isAdmin||isPublic);
                    if(showImmediate) return <div style={{fontSize:15,fontWeight:700,color:"#a78bfa"}}>{contactModal.name||"Nie podano"}</div>;
                    if(mySlot) return <div style={{fontSize:15,fontWeight:700,color:"#a78bfa"}}>{contactModal.name||"Nie podano"}</div>;
                    if(isPublic) return <div style={{fontSize:12,color:"#6b7280"}}>Widoczny po dokonaniu rezerwacji</div>;
                    return <div><div style={{fontSize:12,color:"#374151",marginBottom:4}}>Numer jest ukryty — pojawi się po zatwierdzeniu rezerwacji.</div>{contactModal.phone&&<div style={{fontSize:12,color:"#6b7280",marginTop:4}}>Możesz zapytać właściciela: <span style={{color:"#a78bfa"}}>{contactModal.phone}</span></div>}</div>;
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
          <div style={modalStyle} onClick={function(e){e.stopPropagation();}}>
            <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:6}}>Zarezerwuj miejsce</div>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:12}}>
              {bookModal.sp.type==="outdoor"?"Naziemne":"Garaż"} · {f.fmtDate(f.parseDate(bookModal.dk))}<br/>
              {bookModal.sl.all_day?"Cały dzień":(bookModal.sl.from_time+"–"+bookModal.sl.to_time)} · {bookModal.sl.price===0?"Bezpłatnie":(bookModal.sl.price+" zł")}
            </div>
            {bookModal.sp.note&&<div style={{...c.noteBubble,marginBottom:14}}><span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:3}}>Notatka właściciela</span>{bookModal.sp.note}</div>}
            <div style={{background:"#0d2a1e",border:"1px solid #065f46",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#6ee7b7",marginBottom:14}}>Właściciel ma 1 godzinę na anulowanie. Po tym czasie rezerwacja jest zatwierdzona.</div>
            <div style={{marginBottom:10}}><label style={c.label}>Twoje imię i nazwisko</label><input style={c.input} value={bookerName} onChange={function(e){setBookerName(e.target.value);}} placeholder="np. Marek Nowak"/></div>
            <div style={{marginBottom:16}}><label style={c.label}>Telefon (opcjonalnie)</label>{phoneInput(bookerPhone,setBookerPhone)}</div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...c.btn("primary"),flex:1}} onClick={function(){confirm("Czy na pewno chcesz zarezerwować to miejsce?",doConfirmBook);}}>Zarezerwuj</button>
              <button style={{...c.btn(),flex:1}} onClick={function(){setBookModal(null);}}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {editSpotModal&&(
        <div style={c.overlay} onClick={function(){setEditSpotModal(null);}}>
          <div style={modalStyle} onClick={function(e){e.stopPropagation();}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>Edytuj miejsce</div>
              <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={function(){setEditSpotModal(null);}}>X</button>
            </div>
            {[["name","Numer miejsca","np. A-15"],["desc","Opis","np. poziom -1"],["owner","Imię i nazwisko","np. Jan Kowalski"],["email","E-mail","np. jan@email.com"]].map(function(row){
              var fld=row[0],l=row[1],p=row[2];
              return <div key={fld} style={{marginBottom:10}}><label style={c.label}>{l}</label><input style={c.input} placeholder={p} value={editSpotModal[fld]} onChange={function(e){var v=e.target.value;setEditSpotModal(function(prev){return {...prev,[fld]:v};});}}/></div>;
            })}
            <div style={{marginBottom:10}}><label style={c.label}>Telefon</label><input style={c.input} placeholder="np. +48 600 123 456" value={editSpotModal.phone} onChange={function(e){var v=e.target.value.replace(/[^0-9+\s\-]/g,"");setEditSpotModal(function(p){return {...p,phone:v};});}}/></div>
            <div style={{marginBottom:10}}>
              <label style={c.label}>Rodzaj miejsca</label>
              <div style={{display:"flex",gap:8}}>
                {[["underground","Garaż podziemny"],["outdoor","Naziemne"]].map(function(row){return <button key={row[0]} style={{...c.btn(editSpotModal.type===row[0]?"primary":"default"),flex:1,fontSize:12}} onClick={function(){setEditSpotModal(function(p){return {...p,type:row[0]};});}}>{row[1]}</button>;})}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <label style={c.label}>Widoczność numeru</label>
              <div style={{display:"flex",gap:8}}>
                {[["public","Jawne"],["private","Ukryte"]].map(function(row){return <button key={row[0]} style={{...c.btn(editSpotModal.spotVisibility===row[0]?"primary":"default"),flex:1,fontSize:12}} onClick={function(){setEditSpotModal(function(p){return {...p,spotVisibility:row[0]};});}}>{row[1]}</button>;})}
              </div>
            </div>
            <div style={{marginBottom:16}}><label style={c.label}>Notatka / płatność</label><textarea style={c.textarea} placeholder="np. Preferuję BLIK..." value={editSpotModal.note} onChange={function(e){var v=e.target.value;setEditSpotModal(function(p){return {...p,note:v};});}}/></div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...c.btn("primary"),flex:1}} onClick={function(){saveEditedSpot(editSpotModal.id,editSpotModal);}}>Zapisz zmiany</button>
              <button style={c.btn()} onClick={function(){setEditSpotModal(null);}}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {editSlotModal&&(
        <div style={c.overlay} onClick={function(){setEditSlotModal(null);}}>
          <div style={modalStyle} onClick={function(e){e.stopPropagation();}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0"}}>Edytuj termin</div>
              <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={function(){setEditSlotModal(null);}}>X</button>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#9ca3af",cursor:"pointer"}}>
                <input type="checkbox" checked={editSlotModal.allDay} onChange={function(e){var v=e.target.checked;setEditSlotModal(function(p){return {...p,allDay:v};});}} style={{accentColor:"#7c3aed"}}/>
                Cały dzień
              </label>
            </div>
            {!editSlotModal.allDay&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div><label style={c.label}>Od</label><input type="time" style={c.input} value={editSlotModal.from} onChange={function(e){var v=e.target.value;setEditSlotModal(function(p){return {...p,from:v};});}}/></div>
                <div><label style={c.label}>Do</label><input type="time" style={c.input} value={editSlotModal.to} onChange={function(e){var v=e.target.value;setEditSlotModal(function(p){return {...p,to:v};});}}/></div>
              </div>
            )}
            <div style={{marginBottom:16}}>
              <label style={c.label}>Cena (zł), 0 = bezpłatnie</label>
              <input type="number" min="0" style={c.input} value={editSlotModal.price} onChange={function(e){var v=e.target.value;setEditSlotModal(function(p){return {...p,price:v};});}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...c.btn("primary"),flex:1}} onClick={function(){saveEditedSlot(editSlotModal.id,editSlotModal);}}>Zapisz</button>
              <button style={c.btn()} onClick={function(){setEditSlotModal(null);}}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog&&<ConfirmDialog msg={confirmDialog.msg} onConfirm={function(){confirmDialog.onConfirm();setConfirmDialog(null);}} onCancel={function(){setConfirmDialog(null);}}/>}
      {showInvite&&<InviteModal group={group} onClose={function(){setShowInvite(false);}} isMobile={isMobile}/>}
      {toast&&<div style={c.toast(toast.type)}>{toast.msg}</div>}
    </div>
  );
}