import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  buildResponseRow,
  PID_PATTERN,
  SubmissionValidationError,
} from "@/lib/submission";

type ParticipantAssignment = {
  vignette_order: string[];
  introduction_completed_at: string | null;
};

export async function POST(request: Request) {
  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const submittedPid =
    typeof requestBody === "object" &&
    requestBody !== null &&
    "pid" in requestBody &&
    typeof requestBody.pid === "string"
      ? requestBody.pid.trim()
      : "";
  if (!PID_PATTERN.test(submittedPid)) {
    return NextResponse.json(
      { error: "Invalid participant ID." },
      { status: 400 },
    );
  }

  let participant: ParticipantAssignment | undefined;
  try {
    const result = await query<ParticipantAssignment>(
      `select vignette_order, introduction_completed_at
       from public.participants
       where pid = $1`,
      [submittedPid],
    );
    participant = result.rows[0];
  } catch (error) {
    console.error("Unable to load participant assignment", error);
    return NextResponse.json(
      { error: "The response could not be saved. Please try again." },
      { status: 503 },
    );
  }

  if (
    !participant ||
    !Array.isArray(participant.vignette_order) ||
    participant.vignette_order.length !== 8
  ) {
    return NextResponse.json(
      { error: "Participant assignment was not found." },
      { status: 400 },
    );
  }
  if (!participant.introduction_completed_at) {
    return NextResponse.json(
      { error: "Complete the introduction before answering scenarios." },
      { status: 400 },
    );
  }

  let row: ReturnType<typeof buildResponseRow>;
  try {
    row = buildResponseRow(requestBody, participant.vignette_order);
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    await query(
      `insert into public.vignette_responses (
         pid, vignette_id, vignette_number, is_practice,
         task_type, task_type_jitter_v,
         directedness, directedness_jitter_v,
         data_access, data_access_jitter_v,
         visibility, visibility_jitter_v,
         teammate_name, question_order,
         full_vignette_text,
         q1_value_feedback, q2_seek_feedback, q3_incorporate_feedback,
         q4_comfortable_feedback, q5_express_frustrations, q6_rather_work_without,
         time_spent_ms, started_at, submitted_at
       ) values (
         $1, $2, $3, $4,
         $5, $6,
         $7, $8,
         $9, $10,
         $11, $12,
         $13, $14,
         $15,
         $16, $17, $18,
         $19, $20, $21,
         $22, $23, $24
       )
       on conflict (pid, vignette_number) do update set
         vignette_id = excluded.vignette_id,
         is_practice = excluded.is_practice,
         task_type = excluded.task_type,
         task_type_jitter_v = excluded.task_type_jitter_v,
         directedness = excluded.directedness,
         directedness_jitter_v = excluded.directedness_jitter_v,
         data_access = excluded.data_access,
         data_access_jitter_v = excluded.data_access_jitter_v,
         visibility = excluded.visibility,
         visibility_jitter_v = excluded.visibility_jitter_v,
         teammate_name = excluded.teammate_name,
         question_order = excluded.question_order,
         full_vignette_text = excluded.full_vignette_text,
         q1_value_feedback = excluded.q1_value_feedback,
         q2_seek_feedback = excluded.q2_seek_feedback,
         q3_incorporate_feedback = excluded.q3_incorporate_feedback,
         q4_comfortable_feedback = excluded.q4_comfortable_feedback,
         q5_express_frustrations = excluded.q5_express_frustrations,
         q6_rather_work_without = excluded.q6_rather_work_without,
         time_spent_ms = excluded.time_spent_ms,
         started_at = excluded.started_at,
         submitted_at = excluded.submitted_at`,
      [
        row.pid,
        row.vignette_id,
        row.vignette_number,
        row.is_practice,
        row.task_type,
        row.task_type_jitter_v,
        row.directedness,
        row.directedness_jitter_v,
        row.data_access,
        row.data_access_jitter_v,
        row.visibility,
        row.visibility_jitter_v,
        row.teammate_name,
        row.question_order,
        row.full_vignette_text,
        row.q1_value_feedback,
        row.q2_seek_feedback,
        row.q3_incorporate_feedback,
        row.q4_comfortable_feedback,
        row.q5_express_frustrations,
        row.q6_rather_work_without,
        row.time_spent_ms,
        row.started_at,
        row.submitted_at,
      ],
    );

    const countResult = await query<{ count: string }>(
      `select count(*)::text as count
       from public.vignette_responses
       where pid = $1 and is_practice = false`,
      [row.pid],
    );
    const count = Number(countResult.rows[0]?.count ?? 0);
    const completed = count === participant.vignette_order.length;

    if (completed) {
      await query(
        `update public.participants
         set completed_at = now()
         where pid = $1`,
        [row.pid],
      );
    }

    return NextResponse.json({ saved: true, completed }, { status: 200 });
  } catch (error) {
    console.error("Unable to save vignette response", error);
    return NextResponse.json(
      { error: "The response could not be saved. Please try again." },
      { status: 503 },
    );
  }
}
