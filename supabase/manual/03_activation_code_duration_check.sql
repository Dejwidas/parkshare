-- ============================================================================
-- activation_codes: wymuszenie zgodności plan_type z duration_days
--
-- Powód: activate_code() liczy datę wygaśnięcia WYŁĄCZNIE z duration_days —
-- plan_type decyduje tylko o nazwie planu ('trial' albo 'paid'). Te dwie
-- kolumny mogły się dowolnie rozjechać i nic tego nie łapało.
--
-- W praktyce od razu do tego doszło: kod wstawiony jako 'paid_monthly'
-- z duration_days = 90 przedłużył pełną wersję o 90 dni zamiast o 30.
--
-- 'trial' zostaje celowo swobodny — okresy próbne sensownie bywają 14-, 30-
-- czy 90-dniowe. Ale paid_monthly inne niż 30 i paid_yearly inne niż 365
-- to zawsze pomyłka przy wpisywaniu.
--
-- Wykonać na OBU bazach (staging i produkcja).
-- ============================================================================


-- ── Krok 1. Podgląd wierszy, które łamią regułę ─────────────────────────────
-- Uruchom najpierw samo to. Jeśli coś zwróci, krok 2 jest wymagany —
-- inaczej ALTER TABLE w kroku 3 odrzuci constraint.

select code, plan_type, duration_days, used_at, note
from activation_codes
where (plan_type = 'paid_monthly' and duration_days <> 30)
   or (plan_type = 'paid_yearly'  and duration_days <> 365);


-- ── Krok 2. Naprawa istniejących danych ─────────────────────────────────────
-- UWAGA: to zmienia tylko definicję kodu na przyszłość. Grupy, które już
-- aktywowały wadliwy kod, mają zawyżone plan_expires_at — popraw je osobno:
--
--   update groups set plan_expires_at = plan_expires_at - interval '60 days'
--   where id = 'ID_GRUPY';

update activation_codes set duration_days = 30
where plan_type = 'paid_monthly' and duration_days <> 30;

update activation_codes set duration_days = 365
where plan_type = 'paid_yearly' and duration_days <> 365;


-- ── Krok 3. Constraint ──────────────────────────────────────────────────────

alter table public.activation_codes
drop constraint if exists activation_codes_duration_matches_plan;

alter table public.activation_codes
add constraint activation_codes_duration_matches_plan check (
     (plan_type = 'paid_monthly' and duration_days = 30)
  or (plan_type = 'paid_yearly'  and duration_days = 365)
  or (plan_type = 'trial')
);


-- ── Krok 4. Weryfikacja ─────────────────────────────────────────────────────
-- Powinno rzucić błędem "violates check constraint":
--
--   insert into activation_codes (code, group_id, plan_type, duration_days)
--   values ('TEST-BAD-0001', 'ISTNIEJACA_GRUPA', 'paid_monthly', 90);
--
-- A to powinno przejść:
--
--   insert into activation_codes (code, group_id, plan_type, duration_days)
--   values ('TEST-OK-0001', 'ISTNIEJACA_GRUPA', 'paid_monthly', 30);
--   delete from activation_codes where code = 'TEST-OK-0001';
