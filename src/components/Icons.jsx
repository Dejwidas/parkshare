import {
  Settings, HelpCircle, LogIn, LogOut, AlertTriangle, Bell, BellOff,
  Sun, Building2, Car, ShieldCheck, MailCheck, Send, Sparkles,
  CalendarDays, ClipboardList, Clock, Check, Phone, Mail
} from "lucide-react";

// Centralne mapowanie ikon na role w interfejsie.
//
// Powód istnienia tego pliku: wcześniej ikonami były emoji, które każdy system
// renderuje inaczej (🗓 na Windowsie wygląda zupełnie inaczej niż na iOS) i na
// które nie da się nałożyć koloru ani spójnego rozmiaru. Nazwy semantyczne
// zamiast bezpośrednich importów pozwalają wymienić zestaw w jednym miejscu.
//
// Domyślne strokeWidth 1.75 — lucide daje 2, co przy małych rozmiarach na
// ciemnym tle wygląda ciężko.

// Nieeksportowane celowo — plik ma eksportować wyłącznie komponent,
// inaczej Fast Refresh przestaje działać dla całego modułu.
var Ico = {
  settings: Settings,
  help: HelpCircle,
  login: LogIn,
  logout: LogOut,
  warning: AlertTriangle,
  bellOn: Bell,
  bellOff: BellOff,
  outdoor: Sun,          // miejsce naziemne
  garage: Building2,     // garaż podziemny
  mySpots: Car,
  admin: ShieldCheck,
  mailSent: MailCheck,
  invite: Send,
  plan: Sparkles,
  browse: CalendarDays,
  bookings: ClipboardList,
  pending: Clock,
  accepted: Check,
  phone: Phone,
  email: Mail
};

// Użycie: <I n="browse" size={18}/>  albo  <I n="outdoor" size={20} color={p.accent}/>
export function I({ n, size, color, strokeWidth, style }) {
  var Cmp = Ico[n];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size || 16}
      color={color || "currentColor"}
      strokeWidth={strokeWidth || 1.75}
      style={{ flexShrink: 0, verticalAlign: "middle", ...(style || {}) }}
      aria-hidden="true"
    />
  );
}
