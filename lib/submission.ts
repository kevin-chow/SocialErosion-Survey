import { getVignetteById, questionConfig } from "@/lib/studyConfig";

export const PID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export class SubmissionValidationError extends Error {}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SubmissionValidationError("Invalid submission.");
  }
  return value as Record<string, unknown>;
}

function displayFactor(
  value: unknown,
  labels: Record<string, string>,
): string {
  if (typeof value !== "string" || !labels[value]) {
    throw new SubmissionValidationError("Vignette metadata is incomplete.");
  }
  return labels[value];
}

function optionalMetadata(
  metadata: Record<string, string | number | boolean> | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return value === undefined ? null : String(value);
}

export function buildResponseRow(
  input: unknown,
  expectedVignetteOrder: readonly string[],
) {
  const body = requireObject(input);
  const pid = typeof body.pid === "string" ? body.pid.trim() : "";
  const vignetteId =
    typeof body.vignetteId === "string" ? body.vignetteId : "";
  const position = body.position;
  const timeSpentMs = body.timeSpentMs;
  const answers = requireObject(body.answers);

  if (!PID_PATTERN.test(pid)) {
    throw new SubmissionValidationError("Invalid participant ID.");
  }
  if (
    typeof position !== "number" ||
    !Number.isInteger(position) ||
    position < 1 ||
    position > expectedVignetteOrder.length ||
    expectedVignetteOrder[position - 1] !== vignetteId
  ) {
    throw new SubmissionValidationError("Invalid vignette position.");
  }
  if (
    typeof timeSpentMs !== "number" ||
    !Number.isInteger(timeSpentMs) ||
    timeSpentMs < 0 ||
    timeSpentMs > 86_400_000
  ) {
    throw new SubmissionValidationError("Invalid response time.");
  }

  const allowedValues = new Set(
    questionConfig.scale.map((option) => String(option.value)),
  );
  const responseValues: Record<string, string> = {};
  for (const question of questionConfig.questions) {
    const answer = answers[question.id];
    if (typeof answer !== "string" || !allowedValues.has(answer)) {
      throw new SubmissionValidationError(
        "Every question requires a valid response.",
      );
    }
    responseValues[question.responseColumn] = answer;
  }

  const vignette = getVignetteById(vignetteId);
  if (!vignette) {
    throw new SubmissionValidationError("Unknown vignette.");
  }
  const metadata = vignette.metadata;
  const now = Date.now();

  return {
    pid,
    vignette_id: vignette.id,
    vignette_number: position,
    task_type: displayFactor(metadata?.task_type, {
      "information-seeking": "Information Seeking",
      brainstorming: "Brainstorming",
      feedback: "Feedback",
      validation: "Validation",
    }),
    task_type_jitter_v: optionalMetadata(metadata, "task_type_jitter_v"),
    directedness: displayFactor(metadata?.ai_role, {
      supporting: "Supporting",
      executing: "Executing",
    }),
    directedness_jitter_v: optionalMetadata(
      metadata,
      "directedness_jitter_v",
    ),
    data_access: displayFactor(metadata?.knowledge_type, {
      generic: "Generic",
      "org-specific": "Org-Specific",
    }),
    data_access_jitter_v: optionalMetadata(metadata, "data_access_jitter_v"),
    visibility: displayFactor(metadata?.impact_level, {
      personal: "Personal",
      "team-level": "Team",
    }),
    visibility_jitter_v: optionalMetadata(metadata, "visibility_jitter_v"),
    full_vignette_text: vignette.body,
    q1_value_feedback: responseValues.q1_value_feedback,
    q2_seek_feedback: responseValues.q2_seek_feedback,
    q3_incorporate_feedback: responseValues.q3_incorporate_feedback,
    q4_comfortable_feedback: responseValues.q4_comfortable_feedback,
    q5_express_frustrations: responseValues.q5_express_frustrations,
    q6_rather_work_without: responseValues.q6_rather_work_without,
    time_spent_ms: timeSpentMs,
    started_at: new Date(now - timeSpentMs).toISOString(),
    submitted_at: new Date(now).toISOString(),
  };
}
