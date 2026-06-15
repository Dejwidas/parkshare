import { useState, useEffect } from "react";
import { c } from "../styles.js";
import { sb } from "../supabase.js";

export function AdminPanel({ groupId, user, spots, slots, onClose, onDataChange }) {
  var [members,setMembers] = useState([]); var [loading,setLoading] = useState(true);
  var [groupName,setGroupName] = useState(""); var [editingName,setEditingName] = useState(false); var [newName,setNewName] = useState("");
  var [toast,setToast] = useState(null); var [confirmModal,setConfirmModal] = useState(null);

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
    }catch(e){showToast("Błąd","error");}
  }
  async function cancelBookingAdmin(slotId){
    try{await sb.from("slots").update({booked:false,booked_by:null,booker_phone:null,booked_at:null,booked_by_uid:null},"?id=eq."+slotId);showToast("Rezerwacja anulowana","warn");onDataChange();}
    catch(e){showToast("Błąd","error");}
  }
  async function saveGroupName(){
    if(!newName.trim()) return;
    try{await sb.from("groups").update({name:newName.trim()},"?id=eq."+groupId);setGroupName(newName.trim());setEditingName(false);showToast("Nazwa zaktualizowana");onDataChange();}
    catch(e){showToast("Błąd","error");}
  }

  return (
    <div style={c.overlay} onClick={onClose}>
      <div style={{...c.modal,maxWidth:560,width:"100%"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:600,color:"#a78bfa"}}>Panel admina</div>
          <button style={{...c.btn(),padding:"4px 10px",fontSize:12}} onClick={onClose}>X</button>
        </div>

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

        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Członkowie ({members.length})</div>
          {loading?<div style={{textAlign:"center",color:"#4b5563",padding:"20px 0"}}>Ładowanie...</div>:members.map(function(m){
            var isSelf=m.user_id===user.uid;
            var mSpots=spots.filter(function(sp){return sp.owner_uid===m.user_id;});
            return (
              <div key={m.user_id} style={c.memberRow}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                  <div style={{...c.avatar,flexShrink:0}}>{(m.user_name||"?")[0].toUpperCase()}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:"#e8eaf0"}}>{m.user_name||"Nieznany"} {isSelf&&<span style={{fontSize:10,color:"#6b7280"}}>(Ty)</span>}</div>
                    <div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{m.user_email||""} · {mSpots.length} miejsc</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
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

        <div>
          <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Wszystkie miejsca ({spots.length})</div>
          {spots.length===0?<div style={{fontSize:12,color:"#374151",textAlign:"center",padding:"10px 0"}}>Brak miejsc w grupie</div>:spots.map(function(sp){
            var owner=members.find(function(m){return m.user_id===sp.owner_uid;});
            var spSlots=slots.filter(function(sl){return sl.spot_id===sp.id;});
            var bookedSlots=spSlots.filter(function(sl){return sl.booked;});
            return (
              <div key={sp.id} style={{background:"#0f1117",borderRadius:8,padding:"10px 12px",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:"#e8eaf0"}}>nr {sp.name}</div>
                    <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{owner?owner.user_name:sp.owner||"Nieznany"} · {spSlots.length} terminów · {bookedSlots.length} zarezerwowanych</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                    {bookedSlots.map(function(sl){return(
                      <button key={sl.id} style={{...c.btn("warn"),padding:"4px 8px",fontSize:11}} onClick={function(){setConfirmModal({label:"rezerwację ("+sl.booked_by+")",action:function(){cancelBookingAdmin(sl.id);}});}}>Anuluj rez.</button>
                    );})}
                    <button style={{...c.btn("danger"),padding:"4px 8px",fontSize:11}} onClick={function(){setConfirmModal({label:"miejsce nr "+sp.name,action:function(){removeSpotAdmin(sp.id);}});}}>Usuń</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {confirmModal&&(
          <div style={{...c.overlay,zIndex:200}} onClick={function(){setConfirmModal(null);}}>
            <div style={{...c.modal,maxWidth:320}} onClick={function(e){e.stopPropagation();}}>
              <div style={{fontSize:14,color:"#e8eaf0",marginBottom:20}}>Czy na pewno chcesz usunąć {confirmModal.label}?</div>
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
