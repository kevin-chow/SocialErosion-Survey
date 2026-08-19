-- Ten main scenarios: first non-AI (practice), second AI, and a second
-- non-AI inserted randomly among scenarios 3–10.

delete from public.vignette_responses legacy
where legacy.is_practice = true
  and legacy.vignette_number = -1
  and exists (
    select 1
    from public.vignette_responses current
    where current.pid = legacy.pid
      and current.is_practice = true
      and current.vignette_number = 0
  );

update public.vignette_responses
set vignette_number = 0
where is_practice = true
  and vignette_number = -1;

alter table public.vignette_responses
  drop constraint if exists vignette_responses_vignette_number_check;

alter table public.vignette_responses
  add constraint vignette_responses_vignette_number_check
    check (
      (is_practice = true and vignette_number = 0)
      or (is_practice = false and vignette_number between 1 and 9)
    );
