-- Store two initial non-AI scenario responses per participant. The legacy
-- is_practice flag continues to distinguish these rows from main AI scenarios.
-- Positions -1 and 0 preserve their display order without changing the main
-- counterbalanced scenario positions (1-8).

alter table public.vignette_responses
  drop constraint if exists vignette_responses_vignette_number_check;

alter table public.vignette_responses
  add constraint vignette_responses_vignette_number_check
    check (
      (is_practice = true and vignette_number in (-1, 0))
      or (is_practice = false and vignette_number between 1 and 32)
    );
