-- Save the first randomly assigned non-AI scenario as a practice row,
-- record teammate name and question display order, and flag practice clearly.
-- Practice is stored with vignette_number = 0 and is_practice = true so it
-- can be filtered out of the main 1–8 counterbalanced scenarios.

alter table public.vignette_responses
  add column if not exists is_practice boolean not null default false;

alter table public.vignette_responses
  add column if not exists teammate_name text;

alter table public.vignette_responses
  add column if not exists question_order text[];

alter table public.vignette_responses
  drop constraint if exists vignette_responses_vignette_number_check;

alter table public.vignette_responses
  add constraint vignette_responses_vignette_number_check
    check (
      (is_practice = true and vignette_number = 0)
      or (is_practice = false and vignette_number between 1 and 32)
    );

drop view if exists public.analysis_responses;

create view public.analysis_responses as
select
  r.pid as "Participant ID",
  p.prolific_study_id as "Prolific Study ID",
  p.prolific_session_id as "Prolific Session ID",
  p.assignment_slot as "Counterbalance Assignment Slot",
  p.introduction_reading_time_ms as "Introduction Reading Time (ms)",
  r.is_practice as "Is Practice Scenario",
  r.vignette_number as "Vignette Position",
  r.vignette_id as "Vignette ID",
  r.teammate_name as "Teammate Name",
  r.question_order as "Question Display Order",
  r.task_type as "Task Type",
  r.task_type_jitter_v as "Task Type Jitter Version",
  r.directedness as "Directedness",
  r.directedness_jitter_v as "Directedness Jitter Version",
  r.data_access as "Data Access",
  r.data_access_jitter_v as "Data Access Jitter Version",
  r.visibility as "Visibility",
  r.visibility_jitter_v as "Visibility Jitter Version",
  r.full_vignette_text as "Full Vignette Text",
  r.q1_value_feedback as "Q1 - Value Teammate's Feedback",
  r.q2_seek_feedback as "Q2 - Seek Teammate's Feedback",
  r.q3_incorporate_feedback as "Q3 - Incorporate Teammate's Feedback",
  r.q4_comfortable_feedback as "Q4 - Comfortable Involving Teammate",
  r.q5_express_frustrations as "Q5 - Express Frustrations to Teammate",
  r.q6_rather_work_without as "Q6 - Rather Work Without Teammate",
  r.time_spent_ms as "Vignette Reading and Response Time (ms)",
  r.submitted_at as "Vignette Submitted At"
from public.vignette_responses r
join public.participants p on p.pid = r.pid
order by r.pid, r.is_practice desc, r.vignette_number;
