import React from "react";
import { c } from "../styles.js";

export function Footer() {
  return (
    <div style={{textAlign:"center",padding:"20px 0 8px"}}>
      <div style={{fontSize:11,color:"#374151",marginBottom:4}}>
        <a href="mailto:kontakt@parkshare.pl" style={{color:"#4b5563",textDecoration:"none"}}>kontakt@parkshare.pl</a>
      </div>
      <div style={{fontSize:10,color:"#374151"}}>
        <a href="/regulamin.html" target="_blank" rel="noopener noreferrer" style={{color:"#6b7280",textDecoration:"underline"}}>Regulamin</a>
        {" · "}
        <a href="/polityka-prywatnosci.html" target="_blank" rel="noopener noreferrer" style={{color:"#6b7280",textDecoration:"underline"}}>Polityka prywatności</a>
      </div>
    </div>
  );
}

export function ParkLogo({ size = 32 }) {
  return (
    <div style={{width:size,height:size,borderRadius:Math.round(size*0.22),background:"#7c3aed",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <span style={{fontSize:Math.round(size*0.58),fontWeight:800,color:"#fff",fontFamily:"system-ui,sans-serif",lineHeight:1}}>P</span>
    </div>
  );
}

export function ConfirmDialog({ msg, onConfirm, onCancel }) {
  return (
    <div style={{...c.overlay,zIndex:300}} onClick={onCancel}>
      <div style={{...c.modal,maxWidth:320}} onClick={function(e){e.stopPropagation();}}>
        <div style={{fontSize:14,color:"#e8eaf0",marginBottom:20,lineHeight:1.5}}>{msg}</div>
        <div style={{display:"flex",gap:8}}>
          <button style={{...c.btn("primary"),flex:1}} onClick={onConfirm}>Tak</button>
          <button style={{...c.btn("default"),flex:1}} onClick={onCancel}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={c.spinner} />
    </>
  );
}
