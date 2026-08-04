-- Migrate existing Cloud SQL databases from the 5-question schema to 6 questions.
-- Safe to run when vignette_responses has no production rows you need to keep.
-- If you have rows to preserve, export them first.

drop view if exists public.analysis_responses;

alter table public.vignette_responses
  drop column if exists q1_seek_input,
  drop column if exists q2_incorporate,
  drop column if exists q3_future_input_seeking,
  drop column if exists q4_future_reliance,
  drop column if exists q5_positive_relationship;

alter table public.vignette_responses
  add column if not exists q1_value_feedback text,
  add column if not exists q2_seek_feedback text,
  add column if not exists q3_incorporate_feedback text,
  add column if not exists q4_comfortable_feedback text,
  add column if not exists q5_express_frustrations text,
  add column if not exists q6_rather_work_without text;

-- Enforce NOT NULL for new installs / emptied tables.
-- If leftover rows exist without answers, delete them before setting NOT NULL.
delete from public.vignette_responses
where q1_value_feedback is null
   or q2_seek_feedback is null
   or q3_incorporate_feedback is null
   or q4_comfortable_feedback is null
   or q5_express_frustrations is null
   or q6_rather_work_without is null;

alter table public.vignette_responses
  alter column q1_value_feedback set not null,
  alter column q2_seek_feedback set not null,
  alter column q3_incorporate_feedback set not null,
  alter column q4_comfortable_feedback set not null,
  alter column q5_express_frustrations set not null,
  alter column q6_rather_work_without set not null;

create or replace view public.analysis_responses as
select
  r.pid as "Participant ID",
  p.assignment_slot as "Counterbalance Assignment Slot",
  p.introduction_reading_time_ms as "Introduction Reading Time (ms)",
  r.vignette_number as "Vignette Position",
  r.vignette_id as "Vignette ID",
  r.task_type as "Task Type",
  r.task_type_jitter_v as "Task Type Jitter Version",
  r.directedness as "Directedness",
  r.directedness_jitter_v as "Directedness Jitter Version",
  r.data_access as "Data Access",
  r.data_access_jitter_v as "Data Access Jitter Version",
  r.visibility as "Visibility",
  r.visibility_jitter_v as "Visibility Jitter Version",
  r.full_vignette_text as "Full Vignette Text",
  r.q1_value_feedback as "Q1 - Value Sam's Feedback",
  r.q2_seek_feedback as "Q2 - Seek Sam's Feedback",
  r.q3_incorporate_feedback as "Q3 - Incorporate Sam's Feedback",
  r.q4_comfortable_feedback as "Q4 - Comfortable with Sam's Feedback",
  r.q5_express_frustrations as "Q5 - Express Frustrations to Sam",
  r.q6_rather_work_without as "Q6 - Rather Work Without Sam",
  r.time_spent_ms as "Vignette Reading and Response Time (ms)",
  r.submitted_at as "Vignette Submitted At"
from public.vignette_responses r
join public.participants p on p.pid = r.pid
order by r.pid, r.vignette_number;
