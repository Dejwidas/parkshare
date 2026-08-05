import { THEMES, THEME_LABELS, themeName } from "../styles.js";

// Przełącznik motywów do porównania wariantów kolorystycznych.
// Renderowany wyłącznie w trybie deweloperskim (import.meta.env.DEV),
// więc nigdy nie trafia do buildu produkcyjnego.
//
// Motyw jest wybierany przy starcie modułu styles.js, a style są zwykłymi
// obiektami — dlatego zmiana wymaga przeładowania strony, a nie tylko
// przerysowania Reacta.
export function ThemeSwitcher() {
  if (!import.meta.env.DEV) return null;

  function pick(name) {
    try { localStorage.setItem("ps_theme", name); } catch { /* tryb prywatny */ }
    var url = new URL(window.location.href);
    url.searchParams.set("theme", name);
    window.location.assign(url.toString());
  }

  var wrap = {
    position:"fixed", left:10, bottom:10, zIndex:9999,
    background:"#11141c", border:"1px solid #2a2d3e", borderRadius:10,
    padding:8, display:"flex", flexDirection:"column", gap:4,
    boxShadow:"0 8px 24px rgba(0,0,0,0.5)", fontFamily:"system-ui,sans-serif"
  };

  return (
    <div style={wrap}>
      <div style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",letterSpacing:"0.5px",paddingLeft:2}}>Motyw (dev)</div>
      {Object.keys(THEMES).map(function(name){
        var active = name === themeName;
        var t = THEMES[name];
        return (
          <button key={name} onClick={function(){ pick(name); }}
            style={{
              display:"flex", alignItems:"center", gap:6, cursor:"pointer",
              background: active ? "#1f2230" : "transparent",
              border:"1px solid " + (active ? t.brand : "transparent"),
              borderRadius:6, padding:"4px 8px 4px 5px",
              color: active ? "#e8eaf0" : "#9ca3af", fontSize:11, textAlign:"left"
            }}>
            <span style={{width:10,height:10,borderRadius:"50%",background:t.brand,flexShrink:0,border:"1px solid "+t.accent}}/>
            {THEME_LABELS[name] || name}
          </button>
        );
      })}
    </div>
  );
}
