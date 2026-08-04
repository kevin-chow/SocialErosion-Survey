-- Update constraints for the 32-vignette / 8-per-participant / 500-slot design.
-- Existing rows from the earlier 6-vignette design violate the new order-size
-- check, so clear study data before tightening constraints.

begin;

-- Dependent responses first (FK to participants).
delete from public.vignette_responses;
delete from public.participants;

alter table public.participants
  drop constraint if exists participants_vignette_order_size;

alter table public.participants
  add constraint participants_vignette_order_size
    check (vignette_order is null or cardinality(vignette_order) = 8);

alter table public.participants
  drop constraint if exists participants_assignment_slot_range;

alter table public.participants
  add constraint participants_assignment_slot_range
    check (assignment_slot is null or assignment_slot between 1 and 500);

alter table public.vignette_responses
  drop constraint if exists vignette_responses_vignette_number_check;

alter table public.vignette_responses
  add constraint vignette_responses_vignette_number_check
    check (vignette_number between 1 and 32);

create or replace function public.register_participant(
  participant_pid text,
  counterbalance_orders jsonb
)
returns table (
  pid text,
  assignment_slot integer,
  vignette_order text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_slot integer;
  selected_order text[];
  existing_unassigned boolean;
begin
  if participant_pid !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' then
    raise check_violation using message = 'Invalid participant ID.';
  end if;

  if jsonb_typeof(counterbalance_orders) <> 'array'
     or jsonb_array_length(counterbalance_orders) < 1 then
    raise check_violation using message = 'Invalid counterbalance table.';
  end if;

  perform pg_advisory_xact_lock(20260715135000);

  select exists (
    select 1
    from public.participants p
    where p.pid = participant_pid and p.assignment_slot is null
  )
  into existing_unassigned;

  if exists (
    select 1
    from public.participants p
    where p.pid = participant_pid and p.assignment_slot is not null
  ) then
    raise unique_violation using message = 'Participant ID already exists.';
  end if;

  select coalesce(max(p.assignment_slot), 0) + 1
  into next_slot
  from public.participants p;

  if next_slot > jsonb_array_length(counterbalance_orders) then
    raise check_violation using message = 'All assignment slots are filled.';
  end if;

  select array_agg(item.value order by item.ordinality)
  into selected_order
  from jsonb_array_elements_text(
    counterbalance_orders -> (next_slot - 1)
  ) with ordinality as item(value, ordinality);

  if cardinality(selected_order) <> 8 then
    raise check_violation using message = 'Invalid assigned vignette order.';
  end if;

  if existing_unassigned then
    update public.participants p
    set assignment_slot = next_slot,
        vignette_order = selected_order
    where p.pid = participant_pid;
  else
    insert into public.participants (
      pid,
      assignment_slot,
      vignette_order
    )
    values (
      participant_pid,
      next_slot,
      selected_order
    );
  end if;

  return query
  select p.pid, p.assignment_slot, p.vignette_order
  from public.participants p
  where p.pid = participant_pid;
end;
$$;

commit;
