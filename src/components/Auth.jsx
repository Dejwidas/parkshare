import { useState } from "react";
import { c } from "../styles.js";
import { sb, setAuthToken, saveSession } from "../supabase.js";
import { f } from "../constants.js";
import { ParkLogo, Footer } from "./UI.jsx";

export function AuthScreen({ onAuth }) {
  var [mode,setMode] = useState("choose");
  var [name,setName] = useState(""); var [email,setEmail] = useState(""); var [pass,setPass] = useState("");
  var [err,setErr] = useState(""); var [loading,setLoading] = useState(false); var [verifyMsg,setVerifyMsg] = useState(false);

  async function register() {
    if(!name.trim()||!email.trim()||!pass.trim()){setErr("Uzupelnij wszystkie pola.");return;}
    if(pass.length<6){setErr("Haslo musi miec co najmniej 6 znakow.");return;}
    setLoading(true);setErr("");
    try{await sb.auth.signUp(email.trim(),pass,name.trim());setVerifyMsg(true);}
    catch(e){setErr("Blad rejestracji: "+e.message);}finally{setLoading(false);}
  }

  async function login() {
    if(!email.trim()||!pass.trim()){setErr("Uzupelnij pola.");return;}
    setLoading(true);setErr("");
    try{
      var data = await sb.auth.signIn(email.trim(),pass);
      setAuthToken(data.access_token);
      var uname = (data.user&&data.user.user_metadata&&data.user.user_metadata.name)||email;
      var u = {uid:data.user.id,name:uname,email:data.user.email,guest:false,token:data.access_token};
      saveSession(u,data.access_token);
      onAuth(u);
    }catch(e){
      var msg=e.message;
      if(msg.includes("Email not confirmed")) msg="Potwierdz swoj adres e-mail przed logowaniem.";
      if(msg.includes("Invalid login")) msg="Nieprawidlowy e-mail lub haslo.";
      setErr(msg);
    }finally{setLoading(false);}
  }

  async function sendReset() {
  if(!email.trim()){setErr("Podaj adres e-mail.");return;}
  setLoading(true);setErr("");
  try{
    await fetch("https://rbpnmvzggshgytzascqz.supabase.co/auth/v1/recover",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicG5tdnpnZ3NoZ3l0emFzY3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzE2MDAsImV4cCI6MjA5MzA0NzYwMH0.ahtUVzG2CDbagn8PtO4keBrey1NtbIKVcZHDQsq8vjc"},
      body:JSON.stringify({email:email.trim()})
    });
    setMode("reset-sent");
  }catch(e){setErr("Blad: "+e.message);}
  finally{setLoading(false);}
}

  if(verifyMsg) return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{marginBottom:16}}><ParkLogo size={56}/></div>
      <div style={{...c.card(true),maxWidth:360,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:16,fontWeight:600,color:"#e8eaf0",marginBottom:8}}>Sprawdz swoja skrzynke!</div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:16,lineHeight:1.6}}>
          Wyslalismy link weryfikacyjny na adres<br/>
          <span style={{color:"#a78bfa"}}>{email}</span><br/><br/>
          Kliknij w link w e-mailu a nastepnie zaloguj sie.
        </div>
        <button style={{...c.btn("primary"),width:"100%"}} onClick={function(){setVerifyMsg(false);setMode("login");}}>Przejdz do logowania</button>
      </div>
      <Footer/>
    </div>
  );

  if(mode==="choose") return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{marginBottom:8}}><ParkLogo size={56}/></div>
      <div style={{fontSize:24,fontWeight:600,color:"#a78bfa",marginBottom:4}}>ParkShare</div>
      <div style={{fontSize:13,color:"#4b5563",marginBottom:40}}>Wynajem miejsc parkingowych na osiedlu</div>
      <div style={{width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:10}}>
        <button style={{...c.btn("primary"),width:"100%",padding:"12px"}} onClick={function(){setMode("register");}}>Utworz konto</button>
        <button style={{...c.btn("default"),width:"100%",padding:"12px"}} onClick={function(){setMode("login");}}>Zaloguj sie</button>
        <button style={{...c.btn("ghost"),width:"100%",padding:"12px",border:"1px solid #2a2d3e"}} onClick={function(){onAuth({uid:"guest-"+f.genId(),name:"Gosc",email:"",guest:true});}}>Kontynuuj jako gosc</button>
        <div style={{fontSize:11,color:"#374151",textAlign:"center",marginTop:4}}>Goscie moga przegladac i rezerwowac, ale nie moga zarzadzac miejscami.</div>
      </div>
      <Footer/>
    </div>
  );

  if(mode==="reset") return (
  <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{width:"100%",maxWidth:340}}>
      <button style={{...c.btn("ghost"),paddingLeft:0,marginBottom:20,fontSize:13}} onClick={function(){setMode("login");setErr("");}}>← Wróc</button>
      <div style={c.card(true)}>
        <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:6}}>Resetowanie hasła</div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:16}}>Wyślemy Ci link do ustawienia nowego hasła.</div>
        <input style={{...c.input,marginBottom:10}} type="email" placeholder="Twój adres e-mail" value={email} onChange={function(e){setEmail(e.target.value);}}/>
        {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{err}</div>}
        <button style={{...c.btn("primary"),width:"100%",opacity:loading?0.6:1}} onClick={sendReset} disabled={loading}>
          {loading?"Wysyłanie...":"Wyślij link resetujący"}
        </button>
      </div>
    </div>
    <Footer/>
  </div>
);

if(mode==="reset-sent") return (
  <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{marginBottom:16,fontSize:40}}>📬</div>
    <div style={{...c.card(true),maxWidth:360,width:"100%",textAlign:"center"}}>
      <div style={{fontSize:16,fontWeight:600,color:"#e8eaf0",marginBottom:8}}>Sprawdź skrzynkę!</div>
      <div style={{fontSize:13,color:"#6b7280",marginBottom:16,lineHeight:1.6}}>
        Wysłaliśmy link do resetowania hasła na adres<br/>
        <span style={{color:"#a78bfa"}}>{email}</span>
      </div>
      <button style={{...c.btn("primary"),width:"100%"}} onClick={function(){setMode("login");}}>Wróć do logowania</button>
    </div>
    <Footer/>
  </div>
);

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:340}}>
        <button style={{...c.btn("ghost"),paddingLeft:0,marginBottom:20,fontSize:13}} onClick={function(){setMode("choose");setErr("");}}>Wróc</button>
        <div style={c.card(true)}>
          <div style={{fontSize:15,fontWeight:600,color:"#e8eaf0",marginBottom:16}}>{mode==="register"?"Utworz konto":"Zaloguj sie"}</div>
          {mode==="register"&&<input style={{...c.input,marginBottom:10}} placeholder="Imie i nazwisko" value={name} onChange={function(e){setName(e.target.value);}}/>}
          <input style={{...c.input,marginBottom:10}} type="email" placeholder="E-mail" value={email} onChange={function(e){setEmail(e.target.value);}}/>
          <input style={{...c.input,marginBottom:10}} type="password" placeholder="Haslo (min. 6 znakow)" value={pass} onChange={function(e){setPass(e.target.value);}}/>
          {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{err}</div>}
          <button style={{...c.btn("primary"),width:"100%",opacity:loading?0.6:1}} onClick={mode==="register"?register:login} disabled={loading}>
            {loading?"Ladowanie...":mode==="register"?"Zarejestruj sie":"Zaloguj"}
          </button>
          <div style={{fontSize:12,color:"#4b5563",textAlign:"center",marginTop:12,cursor:"pointer"}}
  onClick={function(){setMode(mode==="register"?"login":"register");setErr("");}}>
  {mode==="register"?"Masz juz konto? Zaloguj sie":"Nie masz konta? Zarejestruj sie"}
</div>
{mode==="login"&&(
  <div style={{fontSize:12,color:"#6b7280",textAlign:"center",marginTop:8,cursor:"pointer"}}
    onClick={function(){setMode("reset");setErr("");}}>
    Nie pamiętam hasła
  </div>
)}
        </div>
      </div>
      <Footer/>
    </div>
  );
}
