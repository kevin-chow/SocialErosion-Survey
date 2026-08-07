import { loadStoredProlificParams } from "@/lib/prolific";

export type ParticipantRegistration = {
  pid: string;
  vignetteOrder: string[];
  resumed: boolean;
  nextPath: "/introduction" | "/study";
};

/**
 * Registers (or resumes) a participant and writes sessionStorage keys.
 * Prefers an explicit pid; otherwise uses the stored Prolific PID.
 */
export async function registerParticipantSession(
  explicitPid?: string | null,
): Promise<ParticipantRegistration> {
  const prolific = loadStoredProlificParams();
  const normalizedPid = (explicitPid ?? prolific.prolificPid ?? "").trim();

  if (!normalizedPid) {
    throw new Error("Participant ID is missing.");
  }

  if (
    sessionStorage.getItem("vignette-study:pid") === normalizedPid &&
    sessionStorage.getItem(`vignette-study:order:${normalizedPid}`)
  ) {
    const introductionComplete =
      sessionStorage.getItem(
        `vignette-study:introduction-complete:${normalizedPid}`,
      ) === "true";
    const orderRaw = sessionStorage.getItem(
      `vignette-study:order:${normalizedPid}`,
    );
    const vignetteOrder = orderRaw ? (JSON.parse(orderRaw) as string[]) : [];
    return {
      pid: normalizedPid,
      vignetteOrder,
      resumed: true,
      nextPath: introductionComplete ? "/study" : "/introduction",
    };
  }

  const response = await fetch("/api/participants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pid: normalizedPid,
      prolificStudyId: prolific.studyId,
      prolificSessionId: prolific.sessionId,
    }),
  });
  const result = (await response.json()) as {
    error?: string;
    vignetteOrder?: string[];
  };
  if (!response.ok) {
    throw new Error(result.error || "Unable to begin the study.");
  }
  if (!result.vignetteOrder || result.vignetteOrder.length !== 8) {
    throw new Error("The vignette assignment could not be loaded.");
  }

  sessionStorage.setItem("vignette-study:pid", normalizedPid);
  sessionStorage.setItem(
    `vignette-study:order:${normalizedPid}`,
    JSON.stringify(result.vignetteOrder),
  );
  sessionStorage.removeItem(`vignette-study:position:${normalizedPid}`);
  sessionStorage.removeItem(
    `vignette-study:introduction-complete:${normalizedPid}`,
  );

  return {
    pid: normalizedPid,
    vignetteOrder: result.vignetteOrder,
    resumed: false,
    nextPath: "/introduction",
  };
}
