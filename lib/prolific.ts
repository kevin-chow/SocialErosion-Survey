export const PROLIFIC_STORAGE = {
  pid: "vignette-study:prolific-pid",
  studyId: "vignette-study:prolific-study-id",
  sessionId: "vignette-study:prolific-session-id",
} as const;

/** Prolific IDs are alphanumeric; allow same shape as our participant IDs. */
export const PROLIFIC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type ProlificParams = {
  prolificPid: string | null;
  studyId: string | null;
  sessionId: string | null;
};

function looksLikeTemplatePlaceholder(value: string): boolean {
  return (
    value.includes("{{") ||
    value.includes("%PROLIFIC") ||
    value.includes("%STUDY") ||
    value.includes("%SESSION")
  );
}

export function normalizeProlificValue(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || looksLikeTemplatePlaceholder(trimmed)) return null;
  if (!PROLIFIC_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function readProlificParamsFromSearch(
  search: string | URLSearchParams,
): ProlificParams {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;

  return {
    prolificPid: normalizeProlificValue(params.get("PROLIFIC_PID")),
    studyId: normalizeProlificValue(params.get("STUDY_ID")),
    sessionId: normalizeProlificValue(params.get("SESSION_ID")),
  };
}

export function persistProlificParams(params: ProlificParams): void {
  if (typeof window === "undefined") return;

  if (params.prolificPid) {
    sessionStorage.setItem(PROLIFIC_STORAGE.pid, params.prolificPid);
  }
  if (params.studyId) {
    sessionStorage.setItem(PROLIFIC_STORAGE.studyId, params.studyId);
  }
  if (params.sessionId) {
    sessionStorage.setItem(PROLIFIC_STORAGE.sessionId, params.sessionId);
  }
}

export function loadStoredProlificParams(): ProlificParams {
  if (typeof window === "undefined") {
    return { prolificPid: null, studyId: null, sessionId: null };
  }

  return {
    prolificPid: normalizeProlificValue(
      sessionStorage.getItem(PROLIFIC_STORAGE.pid),
    ),
    studyId: normalizeProlificValue(
      sessionStorage.getItem(PROLIFIC_STORAGE.studyId),
    ),
    sessionId: normalizeProlificValue(
      sessionStorage.getItem(PROLIFIC_STORAGE.sessionId),
    ),
  };
}

/** Prefer stored Prolific PID; fall back to the study participant ID. */
export function resolveProlificPid(fallbackPid?: string | null): string | null {
  const stored = loadStoredProlificParams().prolificPid;
  if (stored) return stored;
  return normalizeProlificValue(fallbackPid) ?? (fallbackPid?.trim() || null);
}

export function buildCompletionQualtricsUrl(
  baseUrl: string,
  fallbackPid?: string | null,
): string {
  const stored = loadStoredProlificParams();
  const prolificPid = resolveProlificPid(fallbackPid);
  const url = new URL(baseUrl);

  if (prolificPid) {
    url.searchParams.set("PROLIFIC_PID", prolificPid);
  }
  if (stored.studyId) {
    url.searchParams.set("STUDY_ID", stored.studyId);
  }
  if (stored.sessionId) {
    url.searchParams.set("SESSION_ID", stored.sessionId);
  }

  return url.toString();
}
