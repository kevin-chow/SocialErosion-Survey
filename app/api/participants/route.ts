import { NextResponse } from "next/server";
import { isPostgresError, query } from "@/lib/db";
import { normalizeProlificValue } from "@/lib/prolific";
import { counterbalanceConfig, studySettings } from "@/lib/studyConfig";
import { PID_PATTERN } from "@/lib/submission";

type AssignmentRow = {
  pid: string;
  assignment_slot: number;
  vignette_order: string[];
};

function readOptionalString(body: object, key: string): string | null {
  if (!(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? normalizeProlificValue(value) : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pid =
    typeof body === "object" &&
    body !== null &&
    "pid" in body &&
    typeof body.pid === "string"
      ? body.pid.trim()
      : "";

  if (!PID_PATTERN.test(pid)) {
    return NextResponse.json(
      {
        error:
          "Participant ID must be 1–64 characters using letters, numbers, hyphens, or underscores.",
      },
      { status: 400 },
    );
  }

  const prolificStudyId =
    typeof body === "object" && body !== null
      ? readOptionalString(body, "prolificStudyId")
      : null;
  const prolificSessionId =
    typeof body === "object" && body !== null
      ? readOptionalString(body, "prolificSessionId")
      : null;

  try {
    const result = await query<AssignmentRow>(
      `select * from public.register_participant($1::text, $2::jsonb)`,
      [
        pid,
        JSON.stringify(
          counterbalanceConfig.orders.map((order) => order.vignetteIds),
        ),
      ],
    );

    const assignment = result.rows[0];
    if (
      !assignment ||
      !Array.isArray(assignment.vignette_order) ||
      assignment.vignette_order.length !==
        studySettings.aiVignettesPerParticipant
    ) {
      throw new Error("Counterbalance assignment was not returned.");
    }

    await query(
      `update public.participants
       set prolific_study_id = coalesce($2, prolific_study_id),
           prolific_session_id = coalesce($3, prolific_session_id)
       where pid = $1`,
      [pid, prolificStudyId, prolificSessionId],
    );

    return NextResponse.json(
      {
        pid,
        assignmentSlot: assignment.assignment_slot,
        vignetteOrder: assignment.vignette_order,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isPostgresError(error) && error.code === "23505") {
      return NextResponse.json(
        { error: "This participant ID has already been used." },
        { status: 409 },
      );
    }
    if (isPostgresError(error) && error.code === "23514") {
      return NextResponse.json(
        { error: "No participant assignment slots remain." },
        { status: 409 },
      );
    }
    console.error("Unable to create participant", error);
    return NextResponse.json(
      { error: "The study database is unavailable." },
      { status: 503 },
    );
  }
}
