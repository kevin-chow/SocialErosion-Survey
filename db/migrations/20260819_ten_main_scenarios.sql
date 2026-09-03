-- Ten displayed scenarios stored as vignette_number 0 (practice non-AI)
-- and 1–9 (main scenarios, including the second non-AI).

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
set
  is_practice = case
    when vignette_number = 0 then true
    when vignette_id ~ '^p[0-9]{2}$' then false
    else is_practice
  end,
  vignette_number = case
    when vignette_number = -1 then 0
    else vignette_number
  end
where vignette_number = -1
   or (is_practice = true and vignette_number <> 0);

alter table public.vignette_responses
  drop constraint if exists vignette_responses_vignette_number_check;

alter table public.vignette_responses
  add constraint vignette_responses_vignette_number_check
    check (
      (is_practice = true and vignette_number = 0)
      or (is_practice = false and vignette_number between 1 and 9)
    );
