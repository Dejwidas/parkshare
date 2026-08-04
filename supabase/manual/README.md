# Skrypty SQL wykonywane ręcznie

Te pliki **nie są migracjami Supabase CLI** i celowo nie leżą w `supabase/migrations/`.
Wykonuje się je przez wklejenie do **SQL Editora** w dashboardzie Supabase.

## Dlaczego nie jako migracje

1. Zawierają kroki interaktywne — zapytania podglądowe, które trzeba obejrzeć
   i ocenić przed wykonaniem części zmieniającej dane.
2. `02_grandfather_existing_groups.sql` **nie jest idempotentny**. Jego `UPDATE`
   obejmuje wszystkie grupy na planie `demo` w momencie uruchomienia, więc
   ponowne wykonanie rozdałoby bezterminową pełną wersję grupom założonym
   już po wprowadzeniu modelu płatnego.
3. Część zmian celowo różni się między środowiskami — grandfathering idzie
   wyłącznie na produkcję, na stagingu grupy zostają na `demo`, żeby było
   co testować.

Gdyby te pliki leżały w `supabase/migrations/`, `supabase db push` wykonałby
je wszystkie hurtem na podłączonym projekcie.

## Środowiska

Projekt ma dwie bazy na **osobnych kontach** Supabase:

| Środowisko | Projekt | Deploy |
|---|---|---|
| Produkcja | konto #1, `rbpnmvzggshgytzascqz` | Vercel Production, branch `main`, parkshare.pl |
| Staging | konto #2 | Vercel Preview, branch `staging` |

Supabase CLI jest podłączone **do produkcji**. Staging obsługujesz wyłącznie
przez dashboard tamtego konta.

## Kolejność

| # | Plik | Staging | Produkcja |
|---|---|---|---|
| 01 | `01_group_plans_security.sql` | ✅ | wymagane przed mergem do `main` |
| 02 | `02_grandfather_existing_groups.sql` | ❌ pominąć | ✅ przed mergem do `main` |
| 03 | `03_activation_code_duration_check.sql` | ✅ | ✅ |
| — | część B (w pliku 01, zakomentowana) | po teście frontendu | po deployu i smoke teście |

Każdy plik opisuje własne warunki wejścia i sposób weryfikacji w komentarzu
na górze.
