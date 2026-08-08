import { useState } from "react";
import { p } from "../styles.js";

// ============ TREŚĆ FAQ ============
// Edytuj swobodnie — kategorie i pytania trzymane są tutaj.

var FAQ = [
  {
    title: `Pierwsze kroki`,
    items: [
      {
        q: `Czym jest ParkShare?`,
        a: `ParkShare to aplikacja do dzielenia się miejscami parkingowymi w obrębie zamkniętej grupy — np. na osiedlu, w bloku albo w firmie. Osoby, które aktualnie nie korzystają ze swojego miejsca, mogą udostępnić je sąsiadom za darmo lub za drobną opłatą. Reszta grupy widzi wolne miejsca w kalendarzu i może je rezerwować.`
      },
      {
        q: `Czym różni się konto od trybu gościa?`,
        a: `Tryb gościa pozwala szybko zarezerwować miejsce, ale nie można w nim dodawać własnych miejsc parkingowych, zarządzać grupą ani włączyć powiadomień. Pełne konto (e-mail + hasło) daje dostęp do wszystkich funkcji, a Twoje dane są zachowane między urządzeniami i sesjami.`
      },
      {
        q: `Jak utworzyć konto?`,
        a: `Na ekranie startowym kliknij „Utwórz konto", podaj imię, e-mail i hasło (min. 6 znaków). Otrzymasz e-mail z linkiem weryfikacyjnym — kliknij go, a potem wróć do aplikacji i zaloguj się.`
      },
      {
        q: `Nie pamiętam hasła. Co teraz?`,
        a: `Na ekranie logowania kliknij „Nie pamiętam hasła", podaj swój e-mail i wyślij link resetujący. Otworzysz go z poczty, ustawisz nowe hasło i zalogujesz się ponownie.`
      }
    ]
  },
  {
    title: `Grupy`,
    items: [
      {
        q: `Co to jest grupa i po co mi ona?`,
        a: `Grupa to zamknięta przestrzeń — np. Twoje osiedle albo blok — w której tylko jej członkowie widzą i rezerwują miejsca. Każdy użytkownik może należeć do kilku grup i przełączać się między nimi.`
      },
      {
        q: `Jak utworzyć nową grupę?`,
        a: `Po zalogowaniu na ekranie wyboru grupy kliknij „Utwórz grupę", podaj jej nazwę i zatwierdź. Stajesz się jej administratorem i możesz od razu zacząć dodawać miejsca parkingowe oraz zapraszać innych.`
      },
      {
        q: `Jak dołączyć do istniejącej grupy?`,
        a: `Potrzebujesz linku zaproszenia od kogoś, kto już jest w grupie (najczęściej od administratora). Wystarczy, że klikniesz link na telefonie lub komputerze — aplikacja otworzy się na ekranie dołączania do tej konkretnej grupy.`
      },
      {
        q: `Jak zaprosić kogoś do grupy?`,
        a: `Po wejściu do grupy, w menu znajdziesz opcję „Zaproś do grupy" — wygeneruje link, który możesz wysłać znajomemu np. przez wiadomość, e-mail albo komunikator. Każdy, kto otrzyma ten link, może dołączyć do Twojej grupy.`
      },
      {
        q: `Jaka jest różnica między adminem a członkiem grupy?`,
        a: `Admin może zarządzać grupą — np. zmieniać jej nazwę, usuwać użytkowników, decydować o ustawieniach. Zwykły członek może dodawać własne miejsca, rezerwować, udostępniać terminy, ale nie ma uprawnień administracyjnych. Pierwsza osoba zakładająca grupę zostaje jej adminem.`
      }
    ]
  },
  {
    title: `Twoje miejsce parkingowe`,
    items: [
      {
        q: `Jak dodać moje miejsce parkingowe?`,
        a: `W zakładce „Moje miejsca" kliknij „Dodaj miejsce" i podaj jego nazwę (np. „Miejsce 47" albo „Pod altanką"). Możesz też dodać numer telefonu, pod którym osoby rezerwujące będą mogły się z Tobą skontaktować.`
      },
      {
        q: `Czym różni się miejsce z jawnym numerem od ukrytego?`,
        a: `Przy dodawaniu miejsca możesz zdecydować, czy chcesz pokazywać jego numer publicznie. Jawny numer (np. „Miejsce 47") jest widoczny dla wszystkich w grupie od razu w kalendarzu — to wygodne, gdy osoba rezerwująca ma od razu wiedzieć, gdzie zaparkować. Numer ukryty oznacza, że w kalendarzu widać tylko ogólną informację (np. „Wolne miejsce"), a konkretny numer rezerwujący pozna dopiero po zaakceptowaniu rezerwacji. Wybierz drugą opcję, jeśli zależy Ci na większej prywatności.`
      },
      {
        q: `Jak udostępnić termin na moim miejscu?`,
        a: `W kalendarzu obok swojego miejsca kliknij dzień, w którym chcesz je udostępnić, i wybierz „Cały dzień" albo podaj konkretne godziny (od–do). Możesz dodać kilka terminów na ten sam dzień, jeśli np. rano i wieczorem Cię nie ma.`
      },
      {
        q: `Jak ustawić cenę albo udostępnić za darmo?`,
        a: `Przy dodawaniu terminu wpisz kwotę w złotówkach lub pozostaw 0, żeby udostępnić bezpłatnie. Cena jest informacyjna — aplikacja nie obsługuje płatności, rozliczacie się między sobą poza systemem.`
      },
      {
        q: `Jak edytować lub usunąć udostępniony termin?`,
        a: `Wejdź w „Moje miejsca", znajdź dany termin w kalendarzu i kliknij go — pojawi się opcja edycji godzin i ceny albo usunięcia terminu. Jeśli termin został już zarezerwowany przez kogoś innego, najpierw musisz tę rezerwację anulować.`
      }
    ]
  },
  {
    title: `Rezerwacje`,
    items: [
      {
        q: `Jak zarezerwować cudze miejsce?`,
        a: `W zakładce „Kalendarz" wybierz dzień i znajdź wolne terminy. Kliknij „Zarezerwuj" przy tym, który Ci pasuje, podaj swoje imię (jeśli korzystasz jako gość) i ewentualnie telefon kontaktowy, a następnie potwierdź.`
      },
      {
        q: `Co to jest okno anulowania 1 godziny?`,
        a: `Po dokonaniu rezerwacji właściciel miejsca ma godzinę na zaakceptowanie bądź odrzucenie rezerwacji. w przypadku braku reakcji ze strony właściciela, rezerwacja zostaje potwierdzona po godzinie, a osoba chcącą skorzytać z miejsca otrzymuje numer miejsca (w przypadku gdy ten był ukryty)`
      },
      {
        q: `Jak skontaktować się z właścicielem miejsca?`,
        a: `Po dokonaniu rezerwacji znajdziesz dane kontaktowe właściciela (jeśli je podał) w szczegółach rezerwacji. Możesz też kliknąć ikonkę kontaktu przy miejscu w kalendarzu.`
      },
      {
        q: `Co jeśli właściciel chce anulować moją rezerwację?`,
        a: `Właściciel może anulować rezerwację, jeśli zmieni mu się sytuacja. W takim przypadku miejsce wraca jako wolne i będziesz musiał poszukać innego.`
      }
    ]
  },
  {
    title: `Powiadomienia`,
    items: [
      {
        q: `Po co włączać powiadomienia?`,
        a: `Powiadomienia push informują Cię natychmiast, gdy ktoś zarezerwuje Twoje miejsce — nie musisz co chwilę sprawdzać apki. To szczególnie pomocne, jeśli udostępniasz swoje miejsce regularnie.`
      },
      {
        q: `Jak włączyć powiadomienia?`,
        a: `Wejdź w „Ustawienia konta" (z menu Twojego awatara w prawym górnym rogu), znajdź sekcję „Powiadomienia push" i kliknij „Włącz powiadomienia". Przeglądarka albo system poprosi Cię o zgodę — zaakceptuj ją.`
      },
      {
        q: `Włączyłem powiadomienia na komputerze, ale na telefonie nie przychodzą.`,
        a: `Powiadomienia są przypisane do konkretnego urządzenia i przeglądarki, a nie do Twojego konta. Musisz włączyć je osobno na każdym sprzęcie, którego używasz — na komputerze, na telefonie, w PWA itd.`
      },
      {
        q: `Mam iPhone'a i nie widzę opcji powiadomień.`,
        a: `Na iOS powiadomienia push działają tylko w aplikacji dodanej do ekranu głównego (PWA), nie w zwykłym Safari. Otwórz ParkShare w Safari, kliknij ikonę udostępniania (kwadrat ze strzałką), wybierz „Dodaj do ekranu głównego", a potem włącz powiadomienia uruchamiając apkę z tej ikony.`
      },
      {
        q: `Powiadomienia nie przychodzą mimo że są włączone (Android).`,
        a: `Najczęstsza przyczyna na Androidzie to oszczędzanie baterii. Wejdź w Ustawienia → Aplikacje → ParkShare → Bateria i wybierz „Bez ograniczeń". Na Samsungu sprawdź też „Pielęgnacja urządzenia → Bateria → Aplikacje uśpione" i usuń stamtąd ParkShare jeśli się tam znajduje.`
      }
    ]
  },
  {
    title: `Aplikacja na telefon`,
    items: [
      {
        q: `Jak dodać apkę do ekranu głównego na Androidzie?`,
        a: `Otwórz ParkShare w przeglądarce Chrome, dotknij menu (trzy kropki w prawym górnym rogu) i wybierz „Zainstaluj aplikację" albo „Dodaj do ekranu głównego". Ikonka pojawi się obok pozostałych aplikacji i będzie się otwierać jak natywna aplikacja.`
      },
      {
        q: `Jak dodać apkę do ekranu głównego na iPhone?`,
        a: `Otwórz ParkShare w Safari (nie Chrome!), kliknij ikonę udostępniania (kwadrat ze strzałką w górę) na dolnym pasku, przewiń listę i wybierz „Dodaj do ekranu głównego". Potwierdź nazwę i gotowe.`
      },
      {
        q: `Czy aplikacja działa offline?`,
        a: `Częściowo — ekrany i wcześniej wczytane dane będą widoczne, ale rezerwowanie, dodawanie miejsc i synchronizacja kalendarza wymagają połączenia z internetem.`
      }
    ]
  },
  {
    title: `Konto i prywatność`,
    items: [
      {
        q: `Jak zresetować hasło?`,
        a: `Wyloguj się, na ekranie logowania kliknij „Nie pamiętam hasła", podaj swój e-mail. Dostaniesz wiadomość z linkiem — po kliknięciu w niego ustawisz nowe hasło i zalogujesz się ponownie.`
      },
      {
        q: `Jak usunąć konto?`,
        a: `Wejdź w „Ustawienia konta" → na dole znajdziesz „Strefę niebezpieczną" z opcją usunięcia konta. Aplikacja pokaże Ci, ile masz aktywnych rezerwacji, i poprosi o ostateczne potwierdzenie wpisując słowo „USUŃ".`
      },
      {
        q: `Co się stanie z moimi danymi po usunięciu konta?`,
        a: `Skasujemy Twoje konto, wszystkie Twoje miejsca parkingowe, udostępnione terminy, rezerwacje i członkostwa w grupach. Operacja jest nieodwracalna. Osoby, których dotyczyły Twoje rezerwacje, nie zostaną automatycznie powiadomione.`
      }
    ]
  }
];

// ============ EKRAN POMOCY ============
export function HelpScreen({ onBack }) {
  var [openKey, setOpenKey] = useState(null);

  function toggle(key) {
    setOpenKey(function(cur){ return cur === key ? null : key; });
  }

  return (
    <div style={{minHeight:"100vh",background:"#0f1117",padding:"20px 16px"}}>
      <div style={{maxWidth:640,margin:"0 auto"}}>
        <button onClick={onBack} style={{background:"transparent",color:"#9ca3af",border:"none",padding:0,fontSize:13,cursor:"pointer",marginBottom:16}}>← Wróć</button>

        <h2 style={{color:"#e8eaf0",fontSize:22,fontWeight:700,margin:"0 0 4px"}}>Pomoc</h2>
        <div style={{color:"#6b7280",fontSize:13,marginBottom:24}}>Najczęściej zadawane pytania i instrukcje</div>

        {FAQ.map(function(cat, ci) {
          return (
            <div key={ci} style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:600,color:p.accent,textTransform:"uppercase",letterSpacing:0.5,marginBottom:10,paddingLeft:4}}>
                {cat.title}
              </div>
              <div style={{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,overflow:"hidden"}}>
                {cat.items.map(function(item, ii) {
                  var key = ci + "-" + ii;
                  var isOpen = openKey === key;
                  var isLast = ii === cat.items.length - 1;
                  return (
                    <div key={ii} style={{borderBottom: isLast ? "none" : "1px solid #22253a"}}>
                      <button
                        onClick={function(){ toggle(key); }}
                        style={{
                          display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,
                          width:"100%",textAlign:"left",background:"transparent",border:"none",
                          padding:"14px 14px",cursor:"pointer",color:"#e8eaf0",fontSize:14,fontWeight:500
                        }}
                      >
                        <span style={{flex:1,lineHeight:1.4}}>{item.q}</span>
                        <span style={{fontSize:11,color:"#6b7280",flexShrink:0,transform: isOpen ? "rotate(180deg)" : "none", transition:"transform 0.15s"}}>▾</span>
                      </button>
                      {isOpen && (
                        <div style={{padding:"0 14px 14px",fontSize:13,color:"#9ca3af",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{background:"#1a1d2e",border:"1px solid #2a2d3e",borderRadius:12,padding:16,marginTop:16,textAlign:"center"}}>
          <div style={{fontSize:13,color:"#9ca3af",lineHeight:1.6}}>
            Nie znalazłeś odpowiedzi?<br/>
            Napisz do nas: <a href="mailto:kontakt@parkshare.pl" style={{color:p.accent,textDecoration:"none"}}>kontakt@parkshare.pl</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAŁA IKONA POMOCY (do nagłówków) ============
export function HelpButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Pomoc"
      style={{
        display:"inline-flex",alignItems:"center",justifyContent:"center",
        width:32,height:32,background:"#1a1d2e",border:"1px solid #2a2d3e",
        borderRadius:"50%",cursor:"pointer",color:p.accent,fontSize:14,fontWeight:700
      }}
    >?</button>
  );
}
