import { useState } from "react";
import { p } from "../styles.js";
import { subscribePush } from "../push.js";
import { I } from "./Icons.jsx";

export function PushPromptModal({ user, onClose, showToast }) {
  var [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      await subscribePush(user && user.uid);
      if (showToast) showToast("Powiadomienia włączone!", "success");
      onClose();
    } catch(e) {
      if (showToast) showToast(e.message || "Nie udało się włączyć powiadomień", "error");
      setBusy(false);
    }
  }

  var overlay = {position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16};
  var modal = {background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:14,padding:24,maxWidth:380,width:"100%"};
  var title = {fontSize:18,fontWeight:700,color:"#e8eaf0",textAlign:"center",marginBottom:10};
  var text = {fontSize:13,color:"#9ca3af",lineHeight:1.6,marginBottom:20,textAlign:"center"};
  var primaryBtn = {width:"100%",background:p.brand,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:14,fontWeight:600,cursor:busy?"wait":"pointer",marginBottom:8,opacity:busy?0.6:1};
  var ghostBtn = {width:"100%",background:"transparent",color:"#9ca3af",border:"1px solid #2a2d3e",borderRadius:8,padding:"12px",fontSize:14,cursor:"pointer"};

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={function(e){e.stopPropagation();}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:8,color:p.accent}}><I n="bellOn" size={40} strokeWidth={1.25}/></div>
        <div style={title}>Włączyć powiadomienia?</div>
        <div style={text}>
          Twoje miejsce parkingowe jest gotowe! Włącz powiadomienia, żeby od razu wiedzieć, gdy ktoś je zarezerwuje — nie musisz wtedy sprawdzać apki co kilka godzin.
        </div>
        <button style={primaryBtn} disabled={busy} onClick={enable}>
          {busy ? "..." : "Włącz powiadomienia"}
        </button>
        <button style={ghostBtn} onClick={onClose} disabled={busy}>Może później</button>
      </div>
    </div>
  );
}
