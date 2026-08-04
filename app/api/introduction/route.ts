import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PID_PATTERN } from "@/lib/submission";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const pid = typeof payload.pid === "string" ? payload.pid.trim() : "";
  const readingTimeMs = payload.readingTimeMs;

  if (
    !PID_PATTERN.test(pid) ||
    typeof readingTimeMs !== "number" ||
    !Number.isInteger(readingTimeMs) ||
    readingTimeMs < 0 ||
    readingTimeMs > 86_400_000
  ) {
    return NextResponse.json(
      { error: "Invalid introduction timing submission." },
      { status: 400 },
    );
  }

  try {
    const result = await query<{ pid: string }>(
      `update public.participants
       set introduction_reading_time_ms = $1,
           introduction_completed_at = now()
       where pid = $2
       returning pid`,
      [readingTimeMs, pid],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Participant assignment was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unable to save introduction timing", error);
    return NextResponse.json(
      { error: "The introduction timing could not be saved. Please retry." },
      { status: 503 },
    );
  }
}
