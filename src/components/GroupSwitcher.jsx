import { useState, useEffect } from "react";
import { c } from "../styles.js";
import { sb } from "../supabase.js";
import { ParkLogo } from "./UI.jsx";

export function GroupSwitcher({ groupId, groupName, user, onJoin, onNew }) {
  var [open,setOpen] = useState(false);
  var [myGroups,setMyGroups] = useState([]);
  var [showJoinForm,setShowJoinForm] = useState(false);
  var [showNewForm,setShowNewForm] = useState(false);
  var [code,setCode] = useState("");
  var [newName,setNewName] = useState("");
  var [err,setErr] = useState("");

  useEffect(function(){
    if(user.guest) return;
    (async function(){
      try{
        var ugs = await sb.from("user_groups").select("group_id","&user_id=eq."+user.uid);
        if(!ugs.length) return;
        var ids = ugs.map(function(r){return r.group_id;});
        var groups = await sb.from("groups").select("*","&id=in.("+ids.join(",")+")");
        setMyGroups(groups);
      }catch(e){}
    })();
  },[open]);

  async function join(){
    var t = code.trim();
    try{
      var rows = await sb.from("groups").select("*","&id=eq."+t);
      if(!rows.length){setErr("Nie znaleziono grupy.");return;}
      await sb.from("user_groups").upsert({user_id:user.uid,group_id:t,role:"member",user_name:user.name,user_email:user.email},"user_id,group_id");
      setOpen(false);setShowJoinForm(false);setCode("");setErr("");
      onJoin(t);
    }catch(e){setErr("Blad: "+e.message);}
  }

  async function createNew(){
    if(!newName.trim()) return;
    setOpen(false);setShowNewForm(false);setNewName("");
    onNew(newName.trim());
  }

  var dropdownStyle = {position:"absolute",top:"calc(100% + 10px)",left:0,background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,padding:12,minWidth:280,zIndex:200,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"};

  return (
    <div style={{position:"relative"}}>
      <div style={{cursor:"pointer",display:"flex",alignItems:"center",gap:6}} onClick={function(){setOpen(function(o){return !o;});setShowJoinForm(false);setShowNewForm(false);}}>
        <div>
          <div style={{fontSize:16,fontWeight:600,color:"#a78bfa",display:"flex",alignItems:"center",gap:8}}>
            <ParkLogo size={22}/>
            <span>ParkShare</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:11,color:"#6b7280"}}>{groupName}</span>
            <span style={{fontSize:9,color:"#4b5563"}}>v</span>
          </div>
        </div>
      </div>

      {open&&(
        <div style={dropdownStyle}>
          {myGroups.length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>Twoje grupy</div>
              {myGroups.map(function(g){
                var isActive = g.id===groupId;
                return (
                  <div key={g.id}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:8,marginBottom:4,background:isActive?"#2a1f5e":"transparent",cursor:isActive?"default":"pointer"}}
                    onClick={function(){if(!isActive){setOpen(false);onJoin(g.id);}}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:isActive?"#a78bfa":"#e8eaf0"}}>{g.name}</div>
                      <div style={{fontSize:11,color:"#4b5563"}}>{g.id}</div>
                    </div>
                    {isActive&&<span style={{fontSize:11,color:"#a78bfa"}}>aktywna</span>}
                  </div>
                );
              })}
              <div style={{borderTop:"1px solid #2a2d3e",margin:"8px 0"}}/>
            </div>
          )}
          {!showJoinForm&&!showNewForm&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button style={{...c.btn("ghost"),width:"100%",fontSize:12,padding:"8px"}} onClick={function(){setShowJoinForm(true);}}>+ Dolacz do grupy (kod)</button>
              <button style={{...c.btn("default"),width:"100%",fontSize:12,padding:"8px"}} onClick={function(){setShowNewForm(true);}}>+ Utworz nowa grupe</button>
            </div>
          )}
          {showJoinForm&&(
            <div>
              <input style={{...c.input,marginBottom:6,fontSize:13}} placeholder="Wpisz kod grupy" value={code} onChange={function(e){setCode(e.target.value.trim());}}/>
              {err&&<div style={{fontSize:11,color:"#f87171",marginBottom:6}}>{err}</div>}
              <div style={{display:"flex",gap:6}}>
                <button style={{...c.btn("primary"),flex:1,fontSize:12,padding:"7px"}} onClick={join}>Dolacz</button>
                <button style={{...c.btn("default"),fontSize:12,padding:"7px"}} onClick={function(){setShowJoinForm(false);setErr("");setCode("");}}>Anuluj</button>
              </div>
            </div>
          )}
          {showNewForm&&(
            <div>
              <input style={{...c.input,marginBottom:6,fontSize:13}} placeholder="Nazwa osiedla" value={newName} onChange={function(e){setNewName(e.target.value);}}/>
              <div style={{display:"flex",gap:6}}>
                <button style={{...c.btn("primary"),flex:1,fontSize:12,padding:"7px"}} onClick={createNew}>Utworz</button>
                <button style={{...c.btn("default"),fontSize:12,padding:"7px"}} onClick={function(){setShowNewForm(false);setNewName("");}}>Anuluj</button>
              </div>
            </div>
          )}
        </div>
      )}
      {open&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:199}} onClick={function(){setOpen(false);setShowJoinForm(false);setShowNewForm(false);}}/>}
    </div>
  );
}
