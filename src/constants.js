export var DAYS_SHORT = ["Pn","Wt","Sr","Cz","Pt","Sb","Nd"];
export var MONTHS = ["stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","wrzesnia","pazdziernika","listopada","grudnia"];
export var MONTHS_FULL = ["Styczen","Luty","Marzec","Kwiecien","Maj","Czerwiec","Lipiec","Sierpien","Wrzesien","Pazdziernik","Listopad","Grudzien"];
export var DAYS_PL = ["Niedziela","Poniedzialek","Wtorek","Sroda","Czwartek","Piatek","Sobota"];
export var CANCEL_WINDOW_MS = 60 * 60 * 1000;

// Klucz publiczny VAPID dla Web Push — bezpieczny do trzymania we frontendzie
export var VAPID_PUBLIC_KEY = "BB2YN7Uwzw3--yvZ2rlPMHyOEsiXIrZkvlmOxjTyehy9bMVUsXMitkwMq3M3oVJHDIFPIyQ6WLAO0Ez0i-nwUqI";

export var today = new Date();
today.setHours(0,0,0,0);

export var f = {
  dateKey: function(d) { return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); },
  addDays: function(d,n) { var r=new Date(d); r.setDate(r.getDate()+n); return r; },
  isSameDay: function(a,b) { return f.dateKey(a)===f.dateKey(b); },
  daysInMonth: function(y,m) { return new Date(y,m+1,0).getDate(); },
  firstDay: function(y,m) { return (new Date(y,m,1).getDay()+6)%7; },
  fmtDate: function(d) { return d.getDate()+" "+MONTHS[d.getMonth()]+" "+d.getFullYear(); },
  parseDate: function(str) { var p=str.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]); },
  genId: function() { return Math.random().toString(36).slice(2,10); },
  canCancel: function(at) { return at && (Date.now()-at)<CANCEL_WINDOW_MS; },
  timeLeft: function(at) { var ms=CANCEL_WINDOW_MS-(Date.now()-at); var m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000); return ms>0?(m+"m "+s+"s"):null; },
   timeToMin: function(t) { if(!t) return 0; var p=t.split(":").map(Number); return p[0]*60+p[1]; },
};
