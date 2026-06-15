import { useState } from "react";
import { sb, setAuthToken, loadSession, clearSession } from "./supabase.js";
import { f } from "./constants.js";
import { AuthScreen } from "./components/Auth.jsx";
import { Landing, NewGroup } from "./components/Landing.jsx";
import { ParkApp } from "./components/ParkApp.jsx";

export default function Root() {
  var saved = loadSession();
  var [screen,setScreen] = useState(saved ? "landing" : "auth");
  var [user,setUser] = useState(saved ? saved.user : null);
  var [activeGroupId,setActiveGroupId] = useState(null);

  if(saved) setAuthToken(saved.token);

  function handleAuth(u) {
    setAuthToken(u.token||null);
    setUser(u);
    setScreen("landing");
  }

  async function handleJoin(id) {
    if(user&&!user.guest) {
      try { await sb.from("user_groups").upsert({user_id:user.uid,group_id:id,role:"member",user_name:user.name,user_email:user.email},"user_id,group_id"); } catch(e) {}
    }
    setActiveGroupId(id);
    setScreen("app");
  }

  async function handleNew(name) {
    var slug = name.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").slice(0,20);
    var id = slug+"-"+f.genId();
    try {
      await sb.from("groups").insert({id,name});
      if(user&&!user.guest) await sb.from("user_groups").upsert({user_id:user.uid,group_id:id,role:"admin",user_name:user.name,user_email:user.email},"user_id,group_id");
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
  if(screen==="landing") return <Landing user={user} onJoin={handleJoin} onNew={function(){setScreen("newgroup");}} onLogout={handleLogout}/>;
  if(screen==="newgroup") return <NewGroup onBack={function(){setScreen("landing");}} onCreate={handleNew}/>;
  if(screen==="app"&&activeGroupId) return <ParkApp groupId={activeGroupId} user={user} onLeave={function(){setScreen("landing");}} onLogout={handleLogout} onSwitchGroup={handleJoin} onNew={handleNew}/>;
  return null;
}
