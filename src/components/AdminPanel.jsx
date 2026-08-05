import { useState, useEffect } from "react";
import { c, useIsMobile, p } from "../styles.js";
import { sb } from "../supabase.js";
import { f, today } from "../constants.js";
import { I } from "./Icons.jsx";

export function AdminPanel({ groupId, user, spots, slots, onBack, onDataChange }) {
  var isMobile = useIsMobile();
  var [members,setMembers] = useState([]); var [loading,setLoading] = useState(true);
  var [groupName,setGroupName] = useState(""); var [editingName,setEditingName] = useState(false); var [newName,setNewName] = useState("");
  var [toast,setToast] = useState(null); var [confirmModal,setConfirmModal] = useState(null);
  var [selectedSpotId,setSelectedSpotId] = useState(null);
  var [showHistory,setShowHistory] = useState(false);

  function showToast(msg,type){setToast({msg,type:type||"success"});setTimeout(function(){setToast(null);},3000);}

  async function loadMembers(){
    try{var rows=await sb.from("user_groups").select("*","&group_id=eq."+groupId+"&order=role.desc");setMembers(rows);}
    catch(e){}finally{setLoading(false);}
  }
  async function loadGroup(){
    var g=await sb.from("groups").select("*","&id=eq."+groupId);
    if(g.length){setGroupName(g[0].name);setNewName(g[0].name);}
  }
  useEffect(function(){loadMembers();loadGroup();},[]);

  async function setRole(userId,role){
    try{await sb.from("user_groups").update({role},"?user_id=eq."+userId+"&group_id=eq."+groupId);showToast(role==="admin"?"Nadano admina":"Odebrano admina");loadMembers();}
    catch(e){showToast("Błąd","error");}
  }
  async function removeMember(userId,userName){
    try{await sb.from("user_groups").delete("?user_id=eq."+userId+"&group_id=eq."+groupId);showToast(userName+" usunięty","warn");loadMembers();onDataChange();}
    catch(e){showToast("Błąd","error");}
  }
  async function removeSpotAdmin(spotId){
    try{
      var ss=slots.filter(function(sl){return sl.spot_id===spotId;});
      for(var i=0;i<ss.length;i++) await sb.from("slots").delete("?id=eq."+ss[i].id);
      await sb.from("spots").delete("?id=eq."+spotId);
      showToast("Miejsce usunięte","warn");onDataChange();
      setSelectedSpotId(null);
    }catch(e){showToast("Błąd","error");}
  }
  async function cancelBookingAdmin(slotId){
    try{await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},"?id=eq."+slotId);showToast("Rezerwacja anulowana","warn");onDataChange();}
    catch(e){showToast("Błąd","error");}
  }
  async function removeSlotAdmin(slotId){
    try{await sb.from("slots").delete("?id=eq."+slotId);showToast("Termin usunięty","warn");onDataChange();}
    catch(e){showToast("Błąd","error");}
  }
  async function saveGroupName(){
    if(!newName.trim()) return;
    try{await sb.from("groups").update({name:newName.trim()},"?id=eq."+groupId);setGroupName(newName.trim());setEditingName(false);showToast("Nazwa zaktualizowana");onDataChange();}
    catch(e){showToast("Błąd","error");}
  }

  // YYYY-MM-DD dla porównania z polem date (text)
  var todayKey = f.dateKey(today);

  // ============ SZCZEGÓŁY MIEJSCA (drugi poziom) ============
  if(selectedSpotId !== null) {
    var sp = spots.find(function(s){return s.id===selectedSpotId;});
    if(!sp) {
      // miejsce zostało usunięte w międzyczasie
      setSelectedSpotId(null);
      return null;
    }
    var owner = members.find(function(m){return m.user_id===sp.owner_uid;});
    var spSlots = slots.filter(function(sl){return sl.spot_id===sp.id;}).sort(function(a,b){return a.date.localeCompare(b.date);});
    var activeSlots = spSlots.filter(function(sl){return sl.date>=todayKey;});
    var historicalSlots = spSlots.filter(function(sl){return sl.date<todayKey;});
    var bookedActive = activeSlots.filter(function(sl){return sl.booked;}).length;

    return (
      <div style={c.app}>
        <div style={isMobile?c.hdrMobile:c.hdr}>
          <button onClick={function(){setSelectedSpotId(null);setShowHistory(false);}} style={{background:"transparent",color:"#9ca3af",border:"none",padding:0,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            ← <span>Lista miejsc</span>
          </button>
          <div style={{fontSize:15,fontWeight:600,color:p.accent,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            <I n={sp.type==="outdoor"?"outdoor":"garage"} size={15}/> nr {sp.name}
          </div>
          <div style={{width:50}}/>
        </div>

        <div style={isMobile?c.wrapMobile:c.wrap}>
          {/* Info o miejscu */}
          <div style={{...c.card(false),marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Dane miejsca</div>
            <DataRow label="Typ" value={sp.type==="outdoor"?"Naziemne":"Garaż podziemny"}/>
            <DataRow label="Numer" value={sp.name||"—"}/>
            <DataRow label="Opis" value={sp.desc||"—"}/>
            <DataRow label="Właściciel" value={(owner&&owner.user_name)||sp.owner||"Nieznany"}/>
            <DataRow label="Telefon" value={sp.phone||"—"}/>
            <DataRow label="E-mail" value={sp.email||"—"}/>
            <DataRow label="Widoczność" value={sp.spot_visibility==="public"?"Jawne":"Ukryte"}/>
            {sp.note && (
              <div style={{marginTop:10,padding:"10px 12px",background:"#12151f",border:"1px solid #2a2d3e",borderRadius:8,fontSize:12,color:p.accentSoft,lineHeight:1.5}}>
                <span style={{fontSize:11,color:"#6b7280",display:"block",marginBottom:3}}>Notatka</span>
                {sp.note}
              </div>
            )}
            <button style={{...c.btn("danger"),width:"100%",marginTop:14}} onClick={function(){setConfirmModal({label:"miejsce nr "+sp.name+" wraz ze wszystkimi terminami",action:function(){removeSpotAdmin(sp.id);}});}}>
              Usuń miejsce
            </button>
          </div>

          {/* Aktywne terminy */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.5px"}}>
                Aktywne terminy ({activeSlots.length})
              </div>
              {bookedActive>0 && <div style={{fontSize:11,color:"#fbbf24"}}>{bookedActive} zarezerwowanych</div>}
            </div>

            {activeSlots.length===0 ? (
              <div style={{fontSize:12,color:"#374151",textAlign:"center",padding:"20px 0"}}>Brak aktywnych terminów</div>
            ) : activeSlots.map(function(sl){
              return <SlotRow key={sl.id} sl={sl} isHistorical={false} onCancel={function(){
                setConfirmModal({
                  label:"rezerwację "+sl.booked_by+" na "+f.fmtDate(f.parseDate(sl.date)),
                  action:function(){cancelBookingAdmin(sl.id);}
                });
              }} onDelete={function(){
                setConfirmModal({
                  label:"termin z "+f.fmtDate(f.parseDate(sl.date)),
                  action:function(){removeSlotAdmin(sl.id);}
                });
              }}/>;
            })}
          </div>

          {/* Historia */}
          {historicalSlots.length>0 && (
            <div>
              <button
                style={{background:"transparent",border:"1px solid #2a2d3e",borderRadius:8,padding:"8px 12px",color:"#6b7280",fontSize:12,cursor:"pointer",width:"100%",marginBottom:10}}
                onClick={function(){setShowHistory(function(v){return !v;});}}
              >
                {showHistory?"▾":"▸"} Historia ({historicalSlots.length} {historicalSlots.length===1?"termin":"terminów"})
              </button>
              {showHistory && historicalSlots.map(function(sl){
                return <SlotRow key={sl.id} sl={sl} isHistorical={true} onDelete={function(){
                  setConfirmModal({
                    label:"termin archiwalny z "+f.fmtDate(f.parseDate(sl.date)),
                    action:function(){removeSlotAdmin(sl.id);}
                  });
                }}/>;
              })}
            </div>
          )}
        </div>

        {confirmModal&&(
          <div style={{...c.overlay,zIndex:200}} onClick={function(){setConfirmModal(null);}}>
            <div style={{...(isMobile?c.modalMobile:c.modal),maxWidth:isMobile?"100%":380}} onClick={function(e){e.stopPropagation();}}>
              <div style={{fontSize:14,color:"#e8eaf0",marginBottom:20,lineHeight:1.5}}>Czy na pewno chcesz usunąć {confirmModal.label}?</div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...c.btn("danger"),flex:1}} onClick={function(){confirmModal.action();setConfirmModal(null);}}>Tak, usuń</button>
                <button style={{...c.btn(),flex:1}} onClick={function(){setConfirmModal(null);}}>Anuluj</button>
              </div>
            </div>
          </div>
        )}
        {toast&&<div style={c.toast(toast.type)}>{toast.msg}</div>}
      </div>
    );
  }

  // ============ LISTA MIEJSC + CZŁONKOWIE (pierwszy poziom) ============
  return (
    <div style={c.app}>
      <div style={isMobile?c.hdrMobile:c.hdr}>
        <button onClick={onBack} style={{background:"transparent",color:"#9ca3af",border:"none",padding:0,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          ← <span>Wróć</span>
        </button>
        <div style={{fontSize:15,fontWeight:600,color:p.accent,display:"flex",alignItems:"center",gap:8}}><I n="admin" size={17}/>Panel admina</div>
        <div style={{width:50}}/>
      </div>

      <div style={isMobile?c.wrapMobile:c.wrap}>
        {/* Nazwa grupy */}
        <div style={{...c.card(false),marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Nazwa grupy</div>
          {editingName?(
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input style={{...c.input,flex:1,minWidth:140}} value={newName} onChange={function(e){setNewName(e.target.value);}}/>
              <button style={c.btn("primary")} onClick={saveGroupName}>Zapisz</button>
              <button style={c.btn()} onClick={function(){setEditingName(false);setNewName(groupName);}}>Anuluj</button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{groupName}</div>
              <button style={{...c.btn("ghost"),padding:"5px 10px",fontSize:12,flexShrink:0}} onClick={function(){setEditingName(true);}}>Edytuj</button>
            </div>
          )}
        </div>

        {/* Członkowie */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Członkowie ({members.length})</div>
          {loading?<div style={{textAlign:"center",color:"#4b5563",padding:"20px 0"}}>Ładowanie...</div>:members.map(function(m){
            var isSelf=m.user_id===user.uid;
            var mSpots=spots.filter(function(sp){return sp.owner_uid===m.user_id;});
            return (
              <div key={m.user_id} style={c.memberRow}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:160}}>
                  <div style={{...c.avatar,flexShrink:0}}>{(m.user_name||"?")[0].toUpperCase()}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#e8eaf0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.user_name||"Nieznany"} {isSelf&&<span style={{fontSize:10,color:"#6b7280"}}>(Ty)</span>}</div>
                    <div style={{fontSize:11,color:"#4b5563",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.user_email||""} · {mSpots.length} miejsc</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                  <span style={c.roleBadge(m.role)}>{m.role==="admin"?"Admin":"Członek"}</span>
                  {!isSelf&&(
                    <div style={{display:"flex",gap:4}}>
                      <button style={{...c.btn(m.role==="admin"?"default":"admin"),padding:"4px 8px",fontSize:11}} onClick={function(){setRole(m.user_id,m.role==="admin"?"member":"admin");}}>
                        {m.role==="admin"?"Odbierz":"Nadaj admin"}
                      </button>
                      <button style={{...c.btn("danger"),padding:"4px 8px",fontSize:11}} onClick={function(){setConfirmModal({label:m.user_name||"tego użytkownika",action:function(){removeMember(m.user_id,m.user_name);}});}}>Usuń</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lista miejsc */}
        <div>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Wszystkie miejsca ({spots.length})</div>
          {spots.length===0?<div style={{fontSize:12,color:"#374151",textAlign:"center",padding:"10px 0"}}>Brak miejsc w grupie</div>:spots.map(function(sp){
            var owner=members.find(function(m){return m.user_id===sp.owner_uid;});
            var spSlots=slots.filter(function(sl){return sl.spot_id===sp.id;});
            var activeBooked=spSlots.filter(function(sl){return sl.booked&&sl.date>=todayKey;}).length;
            var activeSlotsCount=spSlots.filter(function(sl){return sl.date>=todayKey;}).length;
            return (
              <div key={sp.id}
                onClick={function(){setSelectedSpotId(sp.id);setShowHistory(false);}}
                style={{background:"#0f1117",borderRadius:8,padding:"12px",marginBottom:6,cursor:"pointer",border:"1px solid transparent",transition:"border-color 0.15s"}}
                onMouseEnter={function(e){e.currentTarget.style.borderColor="#2a2d3e";}}
                onMouseLeave={function(e){e.currentTarget.style.borderColor="transparent";}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{display:"flex",color:p.accent}}><I n={sp.type==="outdoor"?"outdoor":"garage"} size={16}/></span>
                      <span>nr {sp.name}</span>
                      {activeBooked>0 && <span style={c.newBadge}>{activeBooked} rez.</span>}
                    </div>
                    <div style={{fontSize:11,color:"#6b7280",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {(owner&&owner.user_name)||sp.owner||"Nieznany"} · {activeSlotsCount} aktywnych terminów
                    </div>
                  </div>
                  <span style={{fontSize:14,color:"#4b5563",flexShrink:0}}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmModal&&(
        <div style={{...c.overlay,zIndex:200}} onClick={function(){setConfirmModal(null);}}>
          <div style={{...(isMobile?c.modalMobile:c.modal),maxWidth:isMobile?"100%":380}} onClick={function(e){e.stopPropagation();}}>
            <div style={{fontSize:14,color:"#e8eaf0",marginBottom:20,lineHeight:1.5}}>Czy na pewno chcesz usunąć {confirmModal.label}?</div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...c.btn("danger"),flex:1}} onClick={function(){confirmModal.action();setConfirmModal(null);}}>Tak, usuń</button>
              <button style={{...c.btn(),flex:1}} onClick={function(){setConfirmModal(null);}}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
      {toast&&<div style={c.toast(toast.type)}>{toast.msg}</div>}
    </div>
  );
}

// ============ POMOCNICZE ============
function DataRow({ label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1f2230",gap:8}}>
      <span style={{fontSize:12,color:"#6b7280",flexShrink:0}}>{label}</span>
      <span style={{fontSize:13,color:"#e8eaf0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"right"}}>{value}</span>
    </div>
  );
}

function SlotRow({ sl, isHistorical, onCancel, onDelete }) {
  var bgColor = isHistorical ? "#0a0c12" : (sl.booked ? "#1c1200" : "#0f1117");
  var borderColor = isHistorical ? "#1f2230" : (sl.booked ? "#fbbf2444" : "transparent");
  var textOpacity = isHistorical ? 0.6 : 1;

  return (
    <div style={{background:bgColor,border:"1px solid "+borderColor,borderRadius:8,padding:"10px 12px",marginBottom:6,opacity:textOpacity}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:"#e8eaf0"}}>{f.fmtDate(f.parseDate(sl.date))}</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>
            {sl.all_day?"Cały dzień":(sl.from_time+"–"+sl.to_time)} · {sl.price===0?"Bezpłatnie":(sl.price+" zł")}
          </div>
          {sl.booked && (
            <div style={{fontSize:12,color:isHistorical?"#6b7280":"#fbbf24",marginTop:4,padding:"4px 8px",background:"rgba(0,0,0,0.3)",borderRadius:6,display:"inline-block"}}>
              {isHistorical?"Była rezerwacja: ":"Zarezerwowane: "}
              <strong>{sl.booked_by||"?"}</strong>
              {sl.booker_phone && <span> · {sl.booker_phone}</span>}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
          {!isHistorical && sl.booked && typeof onCancel === "function" && (
            <button style={{...c.btn("warn"),padding:"5px 10px",fontSize:11}} onClick={onCancel}>Anuluj rezerwację</button>
          )}
          {typeof onDelete === "function" && (
            <button style={{...c.btn("danger"),padding:"5px 10px",fontSize:11}} onClick={onDelete}>Usuń termin</button>
          )}
        </div>
      </div>
    </div>
  );
}
