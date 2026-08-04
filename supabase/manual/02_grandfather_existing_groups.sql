-- ============================================================================
-- Grandfathering: wszystkie grupy istniejące w momencie wprowadzenia modelu
-- płatnego dostają bezterminowo pełną wersję.
--
-- Limit 10 użytkowników wersji demo dotyczy wyłącznie grup zakładanych PO
-- wykonaniu tego skryptu (nowe grupy startują z groups.plan = 'demo' z DEFAULT).
--
-- WYKONAĆ PRZED DEPLOYEM FRONTENDU. Po deployu grupa z >10 członkami na planie
-- demo natychmiast odcina członków od 11. w górę od rezerwacji.
--
-- Dlaczego plan_expires_at = NULL oznacza "bez końca":
--   check_group_status() i join_group() degradują plan warunkiem
--     plan in ('trial','paid') and plan_expires_at < now()
--   Dla NULL porównanie daje NULL, więc cały AND jest fałszywy i plan zostaje
--   'paid'. PlanBanner nie pokazuje wtedy żadnego banera.
-- ============================================================================


-- ── Krok 1. Podgląd: co zostanie zmienione ─────────────────────────────────
-- Uruchom NAJPIERW samo to i zweryfikuj listę, zanim wykonasz UPDATE.

select id, name, plan, created_at,
       (select count(*) from user_groups ug where ug.group_id = g.id) as czlonkowie
from groups g
where plan = 'demo'
order by czlonkowie desc;


-- ── Krok 2. Nadanie bezterminowej pełnej wersji ────────────────────────────
-- UWAGA: wykonać jednorazowo. Ponowne uruchomienie objęłoby także grupy
-- założone już po wdrożeniu modelu płatnego, czyli rozdałoby pełną wersję
-- za darmo nowym klientom.

begin;

  update groups
  set plan = 'paid',
      plan_expires_at = null
  where plan = 'demo';

  -- Sprawdź liczbę zmienionych wierszy w wyniku, zanim zatwierdzisz.
  -- Powinna odpowiadać liczbie wierszy z kroku 1.

commit;


-- ── Krok 3. Weryfikacja ────────────────────────────────────────────────────
-- Wszystkie stare grupy mają być 'paid' z NULL, żadna nie powinna zostać na demo.

select plan, count(*) as ile, count(plan_expires_at) as z_data_wygasniecia
from groups
group by plan;


-- ── Znany przypadek brzegowy ───────────────────────────────────────────────
-- Jeśli admin grupy objętej grandfatheringiem aktywuje kiedyś kod aktywacyjny,
-- activate_code() policzy nową datę od now() (bo warunek plan_expires_at > now()
-- jest przy NULL fałszywy) i ZAMIENI plan bezterminowy na terminowy — czyli
-- pogorszy jego sytuację. Mało prawdopodobne, ale gdyby miało to znaczenie,
-- trzeba dodać w activate_code() zabezpieczenie:
--   if v_group.plan = 'paid' and v_group.plan_expires_at is null then
--     raise exception 'Ta grupa ma już bezterminową pełną wersję';
--   end if;
