-- Store Prolific STUDY_ID and SESSION_ID alongside participant pid (PROLIFIC_PID).
-- Apply in Cloud SQL Studio or:
--   psql "$DATABASE_URL" -f db/migrations/20260807_prolific_ids.sql

alter table public.participants
  add column if not exists prolific_study_id text,
  add column if not exists prolific_session_id text;

alter table public.participants
  drop constraint if exists participants_prolific_study_id_format;

alter table public.participants
  add constraint participants_prolific_study_id_format
  check (
    prolific_study_id is null
    or prolific_study_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
  );

alter table public.participants
  drop constraint if exists participants_prolific_session_id_format;

alter table public.participants
  add constraint participants_prolific_session_id_format
  check (
    prolific_session_id is null
    or prolific_session_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
  );

drop view if exists public.analysis_responses;

create view public.analysis_responses as
select
  r.pid as "Participant ID",
  p.prolific_study_id as "Prolific Study ID",
  p.prolific_session_id as "Prolific Session ID",
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
