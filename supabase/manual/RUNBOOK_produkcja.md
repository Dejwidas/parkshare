# Runbook wdrożenia — plany grup (demo / trial / paid)

Stan na 2026-08-05. Dokument roboczy wdrożenia, nie ogólna instrukcja.

## Mapa środowisk

| Środowisko | Baza | Deploy | Zmienne |
|---|---|---|---|
| Produkcja | Supabase konto #1, `rbpnmvzggshgytzascqz` | Vercel Production, branch `main`, parkshare.pl | panel Vercel, sekcja Production |
| Staging | Supabase konto #2 | Vercel Preview, branch `staging` | panel Vercel, sekcja Preview |
| Lokalnie | **produkcja** (`.env.local`) | `npm run dev` | `.env.local`, niewersjonowany |

`.env.local` wskazuje na produkcję i nie trafia na Vercel (jest w `.gitignore`).
Lokalny `npm run dev` łączy się więc z produkcją — nie używaj go do testów
zmieniających dane.

---

## Status

| Faza | Co | Staging | Produkcja |
|---|---|---|---|
| 1.1 | `01_group_plans_security.sql` — część A | ✅ | ✅ |
| 1.2 | Weryfikacja `permission denied` | ✅ | ✅ |
| 1.3 | `03_activation_code_duration_check.sql` | ✅ | ✅ |
| 1.4 | `02_grandfather_existing_groups.sql` | pominięte celowo | ✅ |
| 2 | Merge do `main` + deploy | — | ✅ `e574e22` |
| 2.1 | Smoke test | ✅ | ✅ |
| 3 | Część B — `drop policy` | ✅ | ✅ |

Grandfathering idzie wyłącznie na produkcję. Na stagingu grupy zostają na
`demo`, żeby było co testować.

**Wdrożenie zakończone 2026-08-05.** Zweryfikowano na produkcji: limit demo
zwraca `status='full'` przy przekroczeniu, blokada `plan='paid'` dla roli
`authenticated` działa, dołączanie i przełączanie między grupami sprawne po
usunięciu polityki.

---

## Wykonana faza 3 — do wglądu

```sql
drop policy if exists "insert as member only" on public.user_groups;
```

### Dlaczego dopiero na końcu

To **pierwszy nieodwracalny krok**. Po nim jedyną drogą do `user_groups` są
`join_group()` i `create_group()` — obie `SECURITY DEFINER`, więc RLS ich nie
dotyczy. Stary frontend, który wstawiał członkostwo bezpośrednio, przestanie
działać.

Odczekanie dotyczy wyłącznie użytkowników z otwartą kartą na starym bundlu.
Service worker serwuje nawigację network-first, a Vite hashuje nazwy plików,
więc odświeżenie strony wystarcza — ale otwarta karta może chodzić na starym
kodzie dowolnie długo.

Gdyby ktoś zgłosił „nie mogę dołączyć do grupy" w najbliższych dniach:
pierwsze pytanie brzmi, czy odświeżył stronę. Stary bundle robi surowy upsert,
który od teraz odbija się o RLS.

### Weryfikacja po wykonaniu

Wszystkie trzy ścieżki dołączania muszą działać:

1. ekran startowy — formularz „mam kod grupy" (`Landing.jsx`)
2. menu grupy w aplikacji — „Dołącz do grupy (kod)" (`GroupSwitcher.jsx`)
3. przełączenie na grupę z listy „Twoje grupy"

Oraz:

```sql
select count(*) from pg_policies
where schemaname='public' and tablename='user_groups' and cmd='INSERT';
-- oczekiwane: 0
```

### Wycofanie awaryjne

```sql
create policy "insert as member only" on public.user_groups
  for insert with check (role = 'member');
```

Przywraca dołączanie kosztem ponownego otwarcia dziury — na chwilę, nie
docelowo. Po odtworzeniu polityki limit demo znów da się obejść bezpośrednim
`POST /rest/v1/user_groups` z kluczem anon.

---

## Smoke test produkcji

Na parkshare.pl, kontem admina istniejącej grupy:

- [ ] **żaden baner** i **żaden cennik** — wszystkie stare grupy są po
      grandfatheringu na `paid` z `plan_expires_at = null`
- [ ] dołączanie do grupy działa (wszystkie trzy ścieżki wyżej)
- [ ] rezerwacja i anulowanie działają
- [ ] menu grupy → „⭐ Plan grupy" pokazuje „Pełna wersja", bez daty wygaśnięcia
- [ ] nowa grupa testowa → baner „Wersja demo · 1/10" i widoczny cennik

Ostatni punkt potwierdza, że limit demo obowiązuje **tylko** grupy zakładane
po grandfatheringu — o to w nim chodziło.

---

## Rollback frontendu

Vercel → Deployments → poprzedni działający deploy → **Promote to Production**.

Powrót do starego frontendu jest bezpieczny **dopóki nie wykonasz fazy 3**:

- stary kod nie woła `join_group` ani nie czyta `plan`
- `revoke update on groups` go nie dotyka — `AdminPanel` zmienia tylko `name`,
  a tę kolumnę zostawiliśmy nadaną
- polityka `insert as member only` wciąż istnieje, więc stare dołączanie działa

Po fazie 3 ta właściwość znika — stary frontend nie dołączy już do grupy.

---

## Dodawanie kodów aktywacyjnych

```sql
insert into activation_codes (code, group_id, plan_type, duration_days, note)
values ('TRIAL-NAZWA-DDMM', 'id-grupy', 'trial', 90, 'kto, kontakt, data');
```

| Cel | `plan_type` | `duration_days` |
|---|---|---|
| Okres próbny | `trial` | dowolne (14 / 30 / 90) |
| Abonament miesięczny | `paid_monthly` | `30` — wymuszone constraintem |
| Abonament roczny | `paid_yearly` | `365` — wymuszone constraintem |

Długość bierze się **wyłącznie** z `duration_days`; `plan_type` decyduje tylko
o nazwie planu (`trial` albo `paid`). Constraint z pliku 03 pilnuje zgodności
dla wariantów płatnych.

### Przypadek brzegowy po grandfatheringu

Grupa z `plan='paid'` i `plan_expires_at = null` (czyli każda obecna grupa
produkcyjna) po aktywacji kodu **straci bezterminowość** — `activate_code`
policzy datę od `now()`, bo warunek `plan_expires_at > now()` jest przy `NULL`
fałszywy. „Na zawsze" zamieni się w „90 dni".

Gotowy guard jest w komentarzu na końcu `02_grandfather_existing_groups.sql`.

---

## Świadomie odłożone

Nie blokują wdrożenia, ale są znane:

- **Ciche awarie AdminPanelu.** `setRole` (`AdminPanel.jsx:27`), `removeMember`
  (`:31`) i `cancelBookingAdmin` (`:44`) nie mają pasujących polityk RLS.
  PostgREST przy `PATCH`/`DELETE`, który nie trafi w żaden wiersz, zwraca
  200/204 z pustą tablicą — więc **pokazują toast o sukcesie, nic nie robiąc**.
- **`cancelBookingDirect`** (`ParkApp.jsx`) — brak polityki UPDATE na `slots`;
  przycisk „Anuluj" w widoku Przeglądaj nic nie robi (pusty `catch`).
  Powinien używać istniejącego RPC `cancel_my_booking`.
- **`"select own membership" USING (true)`** — mimo nazwy udostępnia wszystkie
  członkostwa wszystkich grup (z `user_name`, `user_email`) każdemu z kluczem
  anon. Zawężenie wymaga funkcji `is_group_member()`, bo polityka na
  `user_groups` odwołująca się do `user_groups` zapętla RLS.
- **Zaszyte dane produkcyjne** w `Auth.jsx:47`, `AuthScreen.jsx:43`
  i `public/reset-password.html:68` — URL, klucz anon i domena `redirect_to`.
  Reset hasła na Preview uderza w produkcję.
- **Goście nie liczą się do limitu** — `check_group_status` zwraca dla nich
  `i_am_active = true` (brak `auth.uid()`), więc w grupie demo po wyczerpaniu
  limitu gość nadal może rezerwować.
