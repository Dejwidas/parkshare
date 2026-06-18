import { useState, useEffect } from "react";
import { sb, setAuthToken, loadSession, clearSession, ensureValidSession } from "./supabase.js";
import { f } from "./constants.js";
import { AuthScreen } from "./components/Auth.jsx";
import { Landing, NewGroup } from "./components/Landing.jsx";
import { ParkApp } from "./components/ParkApp.jsx";
import { HelpScreen } from "./components/Help.jsx";


export default function Root() {
var saved = loadSession();
var [screen,setScreen] = useState(saved ? "loading" : "auth");
var [user,setUser] = useState(saved ? saved.user : null);
var [activeGroupId,setActiveGroupId] = useState(null);
var [helpReturnTo,setHelpReturnTo] = useState(null);


  if(saved) setAuthToken(saved.token);

useEffect(function(){
  ensureValidSession().then(async function(s){
    if (!s) {
      clearSession();
      setUser(null);
      setScreen("auth");
      return;
    }
    // Spróbuj przywrócić ostatnio przeglądaną grupę
    if (!s.user.guest) {
      var lastId = loadLastGroup(s.user.uid);
      if (lastId) {
        var ok = await checkMembership(s.user.uid, lastId);
        if (ok) {
          setActiveGroupId(lastId);
          setScreen("app");
          return;
        }
        clearLastGroup(s.user.uid);
      }
    }
    setScreen("landing");
  });
}, []);

async function handleAuth(u) {
  setAuthToken(u.token||null);
  setUser(u);
  if (!u.guest) {
    var lastId = loadLastGroup(u.uid);
    if (lastId) {
      var ok = await checkMembership(u.uid, lastId);
      if (ok) {
        setActiveGroupId(lastId);
        setScreen("app");
        return;
      }
      clearLastGroup(u.uid);
    }
  }
  setScreen("landing");
}

  function openHelp() {
  setHelpReturnTo(screen);
  setScreen("help");
}
function closeHelp() {
  setScreen(helpReturnTo || "landing");
  setHelpReturnTo(null);
}

function saveLastGroup(uid, gid) {
  try { localStorage.setItem("ps_last_group_" + uid, gid); } catch(e) {}
}
function loadLastGroup(uid) {
  try { return localStorage.getItem("ps_last_group_" + uid); } catch(e) { return null; }
}
function clearLastGroup(uid) {
  try { localStorage.removeItem("ps_last_group_" + uid); } catch(e) {}
}
async function checkMembership(uid, gid) {
  try {
    var rows = await sb.from("user_groups").select("user_id", "&user_id=eq." + uid + "&group_id=eq." + gid);
    return rows && rows.length > 0;
  } catch(e) { return false; }
}

async function handleJoin(id) {
  if(user&&!user.guest) {
    try { await sb.from("user_groups").upsert({user_id:user.uid,group_id:id,role:"member",user_name:user.name,user_email:user.email},"user_id,group_id"); } catch(e) {}
    saveLastGroup(user.uid, id);
  }
  setActiveGroupId(id);
  setScreen("app");
}
async function handleNew(name) {
  var slug = name.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").slice(0,20);
  var id = slug+"-"+f.genId();
  try {
    await sb.from("groups").insert({id,name});
    if(user&&!user.guest) {
      await sb.from("user_groups").upsert({user_id:user.uid,group_id:id,role:"admin",user_name:user.name,user_email:user.email},"user_id,group_id");
      saveLastGroup(user.uid, id);
    }
    setActiveGroupId(id);
    setScreen("app");
  } catch(e) { console.error(e); }
}

  async function handleLogout() {
    try { await sb.auth.signOut(); } catch(e) {}
    clearSession();
    setUser(null);
    setActiveGroupId(null);
    setScreen("auth");
  }

  if(screen==="auth") return <AuthScreen onAuth={handleAuth}/>;
  if(screen==="landing") return <Landing user={user} onJoin={handleJoin} onNew={function(){setScreen("newgroup");}} onLogout={handleLogout} onOpenHelp={openHelp}/>;
  if(screen==="newgroup") return <NewGroup onBack={function(){setScreen("landing");}} onCreate={handleNew}/>;
  if(screen==="app"&&activeGroupId) return <ParkApp groupId={activeGroupId} user={user} onLeave={function(){setScreen("landing");}} onLogout={handleLogout} onSwitchGroup={handleJoin} onNew={handleNew} onOpenHelp={openHelp}/>;
  if(screen==="help") return <HelpScreen onBack={closeHelp}/>;
  if(screen==="loading") return <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",alignItems:"center",justifyContent:"center",color:"#6b7280",fontSize:13}}>Ładowanie...</div>;


  return null;
}