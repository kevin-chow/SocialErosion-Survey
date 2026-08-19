-- Ten-scenario flow with non-AI rows stored at -1 and 0 (PR #1 numbering).

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

with ranked_non_ai as (
  select
    id,
    row_number() over (
      partition by pid
      order by
        case vignette_number when -1 then 0 when 0 then 1 else 2 end,
        vignette_number
    ) as non_ai_rank
  from public.vignette_responses
  where is_practice = true
     or vignette_id ~ '^p[0-9]{2}$'
)
update public.vignette_responses target
set
  is_practice = true,
  vignette_number = case ranked_non_ai.non_ai_rank when 1 then -1 else 0 end
from ranked_non_ai
where target.id = ranked_non_ai.id
  and ranked_non_ai.non_ai_rank <= 2;

alter table public.vignette_responses
  drop constraint if exists vignette_responses_vignette_number_check;

alter table public.vignette_responses
  add constraint vignette_responses_vignette_number_check
    check (
      (is_practice = true and vignette_number in (-1, 0))
      or (is_practice = false and vignette_number between 1 and 32)
    );
