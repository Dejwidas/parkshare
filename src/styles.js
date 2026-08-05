import { useState, useEffect } from "react";

export var MOBILE_BREAKPOINT = 640;

export function useIsMobile() {
  var [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(function(){
    function onResize(){ setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); }
    window.addEventListener("resize", onResize);
    return function(){ window.removeEventListener("resize", onResize); };
  }, []);
  return isMobile;
}

// ── Motywy kolorystyczne ────────────────────────────────────────────────────
// Wersje do porównania. Przełączanie: dopisz ?theme=sky do adresu (wybór
// zapamiętuje się w localStorage) albo użyj przełącznika w rogu — widocznego
// wyłącznie w trybie deweloperskim.
//
// Kolory semantyczne (zielony = wolne, bursztyn = oczekuje, czerwony = błąd)
// celowo NIE są częścią motywu — znaczą to samo niezależnie od wariantu.
export var THEMES = {
  // obecny wygląd, punkt odniesienia
  violet: {
    brand:"#7c3aed", accent:"#a78bfa", accentSoft:"#c4b5fd", booked:"#818cf8",
    brandDim:"#2a1f5e", adminBg:"#1e1b4b", adminBorder:"#4338ca",
    bannerBg:"#4a1a8c", bannerBorder:"#5b21b6", bannerFg:"#e0d4ff"
  },
  // kolor pojawia się rzadko — akcentem jest biel, nie barwa
  graphite: {
    brand:"#0891b2", accent:"#e8eaf0", accentSoft:"#9ca3af", booked:"#9ca3af",
    brandDim:"#1f2230", adminBg:"#1f2230", adminBorder:"#0891b2",
    bannerBg:"#1a1d2e", bannerBorder:"#0891b2", bannerFg:"#cbd5e1"
  },
  sky: {
    brand:"#0369a1", accent:"#38bdf8", accentSoft:"#7dd3fc", booked:"#7dd3fc",
    brandDim:"#0c3a56", adminBg:"#0c2a3d", adminBorder:"#0284c7",
    bannerBg:"#075985", bannerBorder:"#0369a1", bannerFg:"#e0f2fe"
  },
  teal: {
    brand:"#0f766e", accent:"#2dd4bf", accentSoft:"#5eead4", booked:"#5eead4",
    brandDim:"#134e4a", adminBg:"#134e4a", adminBorder:"#0d9488",
    bannerBg:"#134e4a", bannerBorder:"#0f766e", bannerFg:"#ccfbf1"
  }
};

export var THEME_LABELS = { violet:"Fiolet (obecny)", graphite:"Grafit", sky:"Błękit", teal:"Morska" };

function pickTheme() {
  try {
    var fromUrl = new URLSearchParams(window.location.search).get("theme");
    if (fromUrl && THEMES[fromUrl]) { localStorage.setItem("ps_theme", fromUrl); return fromUrl; }
    var saved = localStorage.getItem("ps_theme");
    if (saved && THEMES[saved]) return saved;
  } catch { /* brak localStorage (tryb prywatny) — zostajemy przy domyślnym */ }
  return "violet";
}

export var themeName = pickTheme();
export var p = THEMES[themeName];

export var c = {
  app:{fontFamily:"system-ui,sans-serif",minHeight:"100vh",background:"#0f1117",color:"#e8eaf0"},
  hdr:{background:"#1a1d2e",borderBottom:"1px solid #2a2d3e",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  hdrMobile:{background:"#1a1d2e",borderBottom:"1px solid #2a2d3e",padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8},
  wrap:{maxWidth:680,margin:"0 auto",padding:"20px 16px 60px"},
  wrapMobile:{maxWidth:680,margin:"0 auto",padding:"16px 12px 90px"},
  navBtn:function(a){return{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:a?p.brand:"transparent",color:a?"#fff":"#9ca3af"};},
  card:function(hi){return{background:"#1a1d2e",border:"1px solid "+(hi?p.brand:"#2a2d3e"),borderRadius:12,padding:16,marginBottom:12};},
  btn:function(v){var m={primary:[p.brand,"#fff"],ghost:["transparent",p.brand],danger:["#3b0d0d","#f87171"],success:["#064e3b","#6ee7b7"],warn:["#451a03","#fbbf24"],admin:[p.adminBg,p.accent],default:["#1f2230","#9ca3af"]}[v||"default"];return{padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:m[0],color:m[1]};},
  // fontSize 16 na inputach żeby iOS nie zoomował przy focusie
  input:{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #2a2d3e",background:"#0f1117",color:"#e8eaf0",fontSize:16,boxSizing:"border-box"},
  textarea:{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #2a2d3e",background:"#0f1117",color:"#e8eaf0",fontSize:16,boxSizing:"border-box",resize:"vertical",minHeight:72,fontFamily:"inherit"},
  label:{fontSize:12,color:"#9ca3af",marginBottom:5,display:"block"},
  arrow:{background:"none",border:"1px solid #2a2d3e",borderRadius:8,color:p.accent,cursor:"pointer",fontSize:18,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"},
  weekBar:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:16},
  weekCell:function(act,cnt){return{borderRadius:8,padding:"6px 4px",textAlign:"center",cursor:"pointer",background:act?p.brand:cnt>0?"#0d2a1e":"#1a1d2e",border:"1px solid "+(act?p.brand:"#2a2d3e")};},
  dayNav:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,padding:"12px 16px",marginBottom:16},
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  modal:{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:14,padding:24,width:"100%",maxWidth:400,maxHeight:"90vh",overflowY:"auto"},
  modalMobile:{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:14,padding:18,width:"100%",maxWidth:"100%",maxHeight:"92vh",overflowY:"auto"},
  toast:function(t){return{position:"fixed",bottom:84,left:"50%",transform:"translateX(-50%)",background:t==="success"?"#065f46":t==="warn"?"#451a03":"#7f1d1d",color:t==="success"?"#6ee7b7":t==="warn"?"#fbbf24":"#fca5a5",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:500,zIndex:999};},
  calGrid:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4},
  calCell:function(has,past,sel,conflict){return{borderRadius:6,aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,cursor:past||conflict?"default":"pointer",opacity:past?0.3:1,background:sel?p.brand:conflict?"#2d1515":has?"#065f46":"transparent",color:sel?"#fff":conflict?"#f87171":has?"#6ee7b7":"#4b5563",border:"1px solid "+(sel?p.brand:conflict?"#7f1d1d":has?"#065f46":"#1f2230")};},
  slotRow:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f1117",borderRadius:8,padding:"8px 12px",marginBottom:6,gap:8,flexWrap:"wrap"},
  noteBubble:{background:"#12151f",border:"1px solid #2a2d3e",borderRadius:8,padding:"10px 12px",fontSize:13,color:p.accentSoft,lineHeight:1.5,marginTop:10},
  divider:{borderTop:"1px solid #1f2230",margin:"12px 0"},
  linkBox:{background:"#0f1117",border:"1px solid #2a2d3e",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#6b7280",wordBreak:"break-all",display:"flex",alignItems:"center",gap:10},
  avatar:{width:30,height:30,borderRadius:"50%",background:p.brand,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0},
  spinner:{width:32,height:32,border:"3px solid #2a2d3e",borderTop:"3px solid "+p.brand,borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  memberRow:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f1117",borderRadius:8,padding:"10px 12px",marginBottom:6,gap:8,flexWrap:"wrap"},
  roleBadge:function(r){return{display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:r==="admin"?p.adminBg:"#1a1d2e",color:r==="admin"?p.accent:"#6b7280",border:"1px solid "+(r==="admin"?p.adminBorder:"#2a2d3e")};},
  newBadge:{background:"#451a03",color:"#fbbf24",borderRadius:20,fontSize:11,fontWeight:700,padding:"2px 8px",marginLeft:6},

  // ============ BOTTOM NAVIGATION (mobile only) ============
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#1a1d2e",borderTop:"1px solid #2a2d3e",display:"flex",zIndex:90,paddingBottom:"env(safe-area-inset-bottom)"},
  bottomNavBtn:function(active){return{flex:1,background:"transparent",border:"none",cursor:"pointer",padding:"10px 4px 12px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:active?p.accent:"#6b7280",fontSize:11,fontWeight:500,position:"relative"};},
  bottomNavIcon:{fontSize:22,lineHeight:1},
};
