import { useState, useEffect } from "react";
import { c } from "../styles.js";
import { sb } from "../supabase.js";
import { ParkLogo, Footer, Spinner } from "./UI.jsx";

export function Landing({ user, onJoin, onNew, onLogout }) {
  var [code,setCode] = useState(""); var [err,setErr] = useState("");
  var [myGroups,setMyGroups] = useState([]); var [loading,setLoading] = useState(true); var [showJoin,setShowJoin] = useState(false);

  useEffect(function(){
    if(user.guest){setLoading(false);return;}
    (async function(){
      try{
        var ugs = await sb.from("user_groups").select("group_id","&user_id=eq."+user.uid);
        if(!ugs.length){setLoading(false);return;}
        var ids = ugs.map(function(r){return r.group_id;});
        var groups = await sb.from("groups").select("*","&id=in.("+ids.join(",")+")");
        setMyGroups(groups);
        if(groups.length===1) onJoin(groups[0].id);
      }catch(e){}finally{setLoading(false);}
    })();
  },[]);

  async function join(){
    var t = code.trim();
    try{
      var rows = await sb.from("groups").select("*","&id=eq."+t);
      if(!rows.length){setErr("Nie znaleziono grupy.");return;}
      if(!user.guest) await sb.from("user_groups").upsert({user_id:user.uid,group_id:t,role:"member",user_name:user.name,user_email:user.email},"user_id,group_id");
      setErr(""); onJoin(t);
    }catch(e){setErr("Blad: "+e.message);}
  }

  if(loading) return <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{marginBottom:8}}><ParkLogo size={56}/></div>
      <div style={{fontSize:24,fontWeight:600,color:"#a78bfa",marginBottom:2}}>ParkShare</div>
      <div style={{fontSize:12,color:"#6b7280",marginBottom:28}}>Zalogowany jako: <span style={{color:"#a78bfa"}}>{user.name}</span>{user.guest?" (gosc)":""}</div>
      <div style={{width:"100%",maxWidth:360}}>
        {myGroups.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Twoje grupy</div>
            {myGroups.map(function(g){return(
              <div key={g.id} style={{...c.card(false),marginBottom:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}} onClick={function(){onJoin(g.id);}}>
                <div><div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{g.name}</div><div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{g.id}</div></div>
                <span style={{fontSize:18,color:"#7c3aed"}}>&gt;</span>
              </div>
            );})}
            <div style={{borderTop:"1px solid #1f2230",margin:"16px 0"}}/>
          </div>
        )}
        {user.guest?(
          <div style={{...c.card(true),marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:12}}>Dolacz do grupy</div>
            <label style={c.label}>Kod grupy</label>
            <input style={{...c.input,marginBottom:err?6:12}} placeholder="np. zielone-abc123" value={code} onChange={function(e){setCode(e.target.value.trim());}}/>
            {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:8}}>{err}</div>}
            <button style={{...c.btn("primary"),width:"100%"}} onClick={join}>Dolacz</button>
          </div>
        ):!showJoin?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button style={{...c.btn("ghost"),width:"100%",border:"1px solid #2a2d3e",padding:"11px"}} onClick={function(){setShowJoin(true);}}>+ Dolacz do nowej grupy (kod)</button>
            <button style={{...c.btn("default"),width:"100%",padding:"11px"}} onClick={onNew}>Utworz nowa grupe</button>
          </div>
        ):(
          <div style={{...c.card(true),marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0",marginBottom:12}}>Dolacz do grupy</div>
            <label style={c.label}>Kod grupy</label>
            <input style={{...c.input,marginBottom:err?6:12}} placeholder="np. zielone-abc123" value={code} onChange={function(e){setCode(e.target.value.trim());}}/>
            {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:8}}>{err}</div>}
            <div style={{display:"flex",gap:8}}>
              <button style={{...c.btn("primary"),flex:1}} onClick={join}>Dolacz</button>
              {myGroups.length>0&&<button style={c.btn()} onClick={function(){setShowJoin(false);setErr("");}}>Anuluj</button>}
            </div>
            <div style={{borderTop:"1px solid #1f2230",margin:"14px 0 10px"}}/>
            <button style={{...c.btn("default"),width:"100%",fontSize:12}} onClick={onNew}>+ Utworz nowa grupe</button>
          </div>
        )}
        <button style={{...c.btn("default"),width:"100%",fontSize:12,marginTop:8}} onClick={onLogout}>Wyloguj / zmien konto</button>
      </div>
      <Footer/>
    </div>
  );
}

export function NewGroup({ onBack, onCreate }) {
  var [name,setName] = useState(""); var [loading,setLoading] = useState(false);
  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:360}}>
        <button style={{...c.btn("ghost"),paddingLeft:0,marginBottom:20,fontSize:13}} onClick={onBack}>Wróc</button>
        <div style={c.card(true)}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:4}}>Nowa grupa osiedlowa</div>
          <div style={{fontSize:12,color:"#6b7280",marginBottom:16}}>Wygenerujemy unikalny kod do udostepnienia sasiadom</div>
          <label style={c.label}>Nazwa osiedla</label>
          <input style={{...c.input,marginBottom:16}} placeholder="np. Osiedle Zielone" value={name} onChange={function(e){setName(e.target.value);}}/>
          <button style={{...c.btn("primary"),width:"100%",opacity:(name.trim()&&!loading)?1:0.4}} disabled={!name.trim()||loading}
            onClick={async function(){setLoading(true);await onCreate(name.trim());setLoading(false);}}>
            {loading?"Tworzenie...":"Utworz grupe"}
          </button>
        </div>
      </div>
      <Footer/>
    </div>
  );
}
