-- ============================================================================
-- Plany grup (demo / trial / paid) — domknięcie bezpieczeństwa
--
-- CZĘŚĆ A jest addytywna i można ją wdrożyć od razu na działającą aplikację.
-- CZĘŚĆ B jest ZMIANĄ ŁAMIĄCĄ — wdrożyć DOPIERO po wypuszczeniu frontendu,
--         który dołącza do grupy przez join_group() zamiast surowego upserta.
-- ============================================================================


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ CZĘŚĆ A — bezpieczne do wdrożenia natychmiast                            │
-- └──────────────────────────────────────────────────────────────────────────┘

-- ── A1. join_group() ────────────────────────────────────────────────────────
-- Egzekwuje limit 10 użytkowników wersji demo po stronie bazy.
-- SECURITY DEFINER, bo musi policzyć WSZYSTKICH członków grupy — pod RLS
-- klient widzi tylko własne wiersze.
-- Zwraca status zamiast rzucać wyjątkiem, żeby frontend pokazał czytelny
-- komunikat zamiast surowej treści błędu z Postgresa.

create or replace function public.join_group(
  p_group_id   text,
  p_user_name  text,
  p_user_email text
)
returns table (status text, current_members integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid       uuid := auth.uid();
  v_group     groups%rowtype;
  v_effective text;
  v_count     int;
begin
  if v_uid is null then
    raise exception 'Musisz być zalogowany aby dołączyć do grupy';
  end if;

  -- Blokada wiersza grupy serializuje równoległe dołączenia do tej samej
  -- grupy. Bez niej dwa jednoczesne żądania przy 9 członkach mogą oba
  -- przejść walidację i zrobić 11.
  select * into v_group from groups where id = p_group_id for update;
  if not found then
    return query select 'not_found'::text, 0;
    return;
  end if;

  select count(*)::int into v_count from user_groups where group_id = p_group_id;

  -- Ponowne dołączenie istniejącego członka nie podlega limitowi.
  if exists (select 1 from user_groups
             where group_id = p_group_id and user_id = v_uid) then
    return query select 'already_member'::text, v_count;
    return;
  end if;

  -- Ta sama degradacja planu co w check_group_status(): wygasły trial/paid
  -- liczy się jako demo, więc po wygaśnięciu nowi już nie dołączą.
  v_effective := v_group.plan;
  if v_group.plan in ('trial','paid') and v_group.plan_expires_at < now() then
    v_effective := 'demo';
  end if;

  if v_effective = 'demo' and v_count >= 10 then
    return query select 'full'::text, v_count;
    return;
  end if;

  insert into user_groups (user_id, group_id, role, user_name, user_email)
  values (v_uid, p_group_id, 'member', p_user_name, p_user_email)
  on conflict (user_id, group_id) do nothing;

  return query select 'joined'::text, v_count + 1;
end;
$$;

revoke all    on function public.join_group(text, text, text) from public, anon;
grant  execute on function public.join_group(text, text, text) to authenticated;


-- ── A2. groups: zablokowanie samodzielnego nadania sobie planu ──────────────
-- Polityka "admin can update group" nie ma WITH CHECK, więc przy UPDATE
-- Postgres używa wyrażenia z USING także dla nowego wiersza — a ono nadal
-- przechodzi (admin dalej jest adminem). W połączeniu z domyślnym grantem
-- UPDATE na wszystkie kolumny admin mógł ustawić sobie plan='paid' jednym
-- PATCH-em przez REST.
--
-- RLS i uprawnienia kolumnowe działają niezależnie — oba muszą przejść.
-- Odbieramy UPDATE na poziomie tabeli i oddajemy wyłącznie kolumnę name
-- (potrzebną AdminPanelowi do zmiany nazwy grupy).
-- activate_code() jako SECURITY DEFINER biegnie jako właściciel funkcji,
-- więc dalej może zapisywać plan i plan_expires_at.

revoke update on public.groups from anon, authenticated;
grant  update (name) on public.groups to authenticated;


-- ── A3. activate_code(): blokada wiersza kodu ───────────────────────────────
-- Bez FOR UPDATE dwa równoległe wywołania z tym samym kodem mogą oba
-- zobaczyć used_at IS NULL i wykorzystać go dwukrotnie. Reszta ciała bez
-- zmian względem stanu z 2026-07-30.

create or replace function public.activate_code(p_code text, p_group_id text)
returns table(activated_plan text, expires_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid;
  v_code activation_codes%rowtype;
  v_new_plan text;
  v_new_expires timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Musisz być zalogowany'; end if;

  if not exists (select 1 from user_groups where group_id = p_group_id and user_id = v_uid and role = 'admin') then
    raise exception 'Tylko admin grupy może aktywować kod';
  end if;

  select * into v_code from activation_codes where code = p_code for update;
  if not found then raise exception 'Nieprawidłowy kod aktywacyjny'; end if;
  if v_code.used_at is not null then raise exception 'Ten kod został już wykorzystany'; end if;
  if v_code.group_id != p_group_id then raise exception 'Ten kod nie jest przypisany do tej grupy'; end if;

  v_new_plan := case when v_code.plan_type = 'trial' then 'trial' else 'paid' end;

  select case
    when g.plan in ('trial', 'paid') and g.plan_expires_at > now()
      then g.plan_expires_at + (v_code.duration_days || ' days')::interval
    else now() + (v_code.duration_days || ' days')::interval
  end into v_new_expires from groups g where g.id = p_group_id;

  update groups set plan = v_new_plan, plan_expires_at = v_new_expires where id = p_group_id;
  update activation_codes set used_at = now(), used_by = v_uid where code = p_code;

  return query select v_new_plan, v_new_expires;
end;
$$;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ CZĘŚĆ B — ZMIANA ŁAMIĄCA. Wdrożyć DOPIERO po deployu frontendu.          │
-- │                                                                          │
-- │ Polityka "insert as member only" pozwala każdemu z kluczem anon wstawić  │
-- │ dowolne członkostwo (brak sprawdzenia user_id = auth.uid(), brak         │
-- │ klauzuli TO), co całkowicie omija limit demo.                            │
-- │                                                                          │
-- │ Po jej usunięciu jedyną drogą do user_groups są funkcje SECURITY         │
-- │ DEFINER: join_group() i create_group(). Dopóki App.jsx:93 oraz           │
-- │ GroupSwitcher.jsx:35 robią surowy upsert, dołączanie przestanie działać. │
-- └──────────────────────────────────────────────────────────────────────────┘

-- drop policy if exists "insert as member only" on public.user_groups;


-- ── Weryfikacja ─────────────────────────────────────────────────────────────
-- Po wdrożeniu części A sprawdź, że admin nie przestawi już planu:
--
--   update groups set plan = 'paid' where id = 'twoja-grupa';
--   -- oczekiwane: ERROR: permission denied for table groups
--
-- oraz że limit działa (na grupie demo z 10 członkami, z konta 11. usera):
--
--   select * from join_group('twoja-grupa', 'Test', 'test@example.com');
--   -- oczekiwane: status = 'full'
