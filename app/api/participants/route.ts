import { NextResponse } from "next/server";
import { isPostgresError, query } from "@/lib/db";
import { counterbalanceConfig } from "@/lib/studyConfig";
import { PID_PATTERN } from "@/lib/submission";

type AssignmentRow = {
  pid: string;
  assignment_slot: number;
  vignette_order: string[];
};

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
        counterbalanceConfig.vignettesPerParticipant
    ) {
      throw new Error("Counterbalance assignment was not returned.");
    }

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
