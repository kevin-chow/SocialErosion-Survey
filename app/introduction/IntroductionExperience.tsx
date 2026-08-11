"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackgroundContent } from "@/components/BackgroundContent";
import background from "@/config/background.json";
import instructions from "@/config/instructions.json";
import redirects from "@/config/redirects.json";
import styles from "@/app/start.module.css";

type BackgroundCheck = (typeof background.checks)[number];
type IntroStep =
  | { kind: "page"; pageId: string }
  | { kind: "check"; check: BackgroundCheck }
  | { kind: "instructions" };

const MAX_CHECK_FAILURES = 3;

function buildStepOrder(): IntroStep[] {
  const steps: IntroStep[] = [];
  for (const page of background.pages) {
    steps.push({ kind: "page", pageId: page.id });
    const check = background.checks.find((item) => item.afterPageId === page.id);
    if (check) {
      steps.push({ kind: "check", check });
    }
  }
  steps.push({ kind: "instructions" });
  return steps;
}

const STEP_ORDER = buildStepOrder();

export function IntroductionExperience() {
  const router = useRouter();
  const [pid, setPid] = useState("");
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [checkAnswer, setCheckAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showRetryNotice, setShowRetryNotice] = useState(false);
  const [showSessionEndedNotice, setShowSessionEndedNotice] = useState(false);
  const activeTimeMsRef = useRef(0);
  const visibleSinceRef = useRef<number | null>(null);

  const step = STEP_ORDER[stepIndex];
  const progressPercent = ((stepIndex + 1) / STEP_ORDER.length) * 100;
  const backgroundPageCount = background.pages.length;
  const currentPageNumber =
    step.kind === "page"
      ? background.pages.findIndex((page) => page.id === step.pageId) + 1
      : null;

  useEffect(() => {
    if (sessionStorage.getItem("vignette-study:consent") !== "true") {
      router.replace("/");
      return;
    }

    const storedPid = sessionStorage.getItem("vignette-study:pid");
    const storedOrder = storedPid
      ? sessionStorage.getItem(`vignette-study:order:${storedPid}`)
      : null;
    if (!storedPid || !storedOrder) {
      router.replace("/");
      return;
    }

    setPid(storedPid);
    setReady(true);

    function updateVisibilityTimer() {
      if (document.visibilityState === "visible") {
        if (visibleSinceRef.current === null) {
          visibleSinceRef.current = performance.now();
        }
      } else if (visibleSinceRef.current !== null) {
        activeTimeMsRef.current +=
          performance.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      }
    }

    updateVisibilityTimer();
    document.addEventListener("visibilitychange", updateVisibilityTimer);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibilityTimer);
      if (visibleSinceRef.current !== null) {
        activeTimeMsRef.current +=
          performance.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      }
    };
  }, [router]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setCheckAnswer("");
    setError("");
  }, [stepIndex]);

  function goToNextStep() {
    setError("");
    setStepIndex((current) => Math.min(current + 1, STEP_ORDER.length - 1));
  }

  async function finishIntroduction() {
    if (visibleSinceRef.current !== null) {
      activeTimeMsRef.current += performance.now() - visibleSinceRef.current;
      visibleSinceRef.current = null;
    }
    const readingTimeMs = Math.min(
      Math.round(activeTimeMsRef.current),
      86_400_000,
    );

    const response = await fetch("/api/introduction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, readingTimeMs }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(result.error || "Unable to save reading time.");
    }

    sessionStorage.setItem(
      `vignette-study:introduction-complete:${pid}`,
      "true",
    );
    sessionStorage.setItem(`vignette-study:attention-check:${pid}`, "passed");
  }

  async function submitCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "check") return;
    setError("");

    if (checkAnswer !== step.check.correctValue) {
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);
      if (nextFailures >= MAX_CHECK_FAILURES) {
        sessionStorage.setItem(
          `vignette-study:attention-check:${pid}`,
          "failed",
        );
        setShowSessionEndedNotice(true);
        return;
      }
      setShowRetryNotice(true);
      return;
    }

    const isLastCheck =
      STEP_ORDER.slice(stepIndex + 1).find((item) => item.kind === "check") ===
      undefined;

    if (!isLastCheck) {
      goToNextStep();
      return;
    }

    setSubmitting(true);
    try {
      await finishIntroduction();
      goToNextStep();
      setSubmitting(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to save reading time.",
      );
      if (document.visibilityState === "visible") {
        visibleSinceRef.current = performance.now();
      }
      setSubmitting(false);
    }
  }

  function reviewAndRetry() {
    setShowRetryNotice(false);
    setCheckAnswer("");
    setError("");
    // Return to the background page that precedes this question.
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function endSession() {
    window.location.assign(redirects.attentionFailProlificUrl);
  }

  function continueToStudy() {
    router.push("/study");
  }

  if (!ready || !step) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.entryIntro}>
            <h1>Preparing background information…</h1>
          </div>
        </section>
      </main>
    );
  }

  const progressLabel =
    step.kind === "instructions"
      ? "Instructions"
      : step.kind === "check"
        ? "Quick question"
        : `Background ${currentPageNumber} of ${backgroundPageCount}`;

  return (
    <main className={styles.page}>
      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className={styles.progressLabel}>{progressLabel}</p>

      <section className={styles.card}>
        {step.kind === "page" && (
          <>
            <BackgroundContent pageId={step.pageId} />
            <div className={styles.introductionActions}>
              <p className={styles.timerNote}>
                Continue after you have carefully read this section.
              </p>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <button
                className={styles.button}
                type="button"
                onClick={goToNextStep}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step.kind === "check" && (
          <div className={styles.entryIntro}>
            <p className={styles.eyebrow}>{step.check.title}</p>
            <h1>{step.check.lead}</h1>
            <form className={styles.pidForm} onSubmit={submitCheck}>
              <fieldset className={styles.attentionFieldset}>
                <legend className={styles.label}>{step.check.prompt}</legend>
                <div className={styles.attentionOptions}>
                  {step.check.options.map((option) => (
                    <label className={styles.attentionOption} key={option.value}>
                      <input
                        type="radio"
                        name={step.check.id}
                        value={option.value}
                        checked={checkAnswer === option.value}
                        onChange={() => setCheckAnswer(option.value)}
                        required
                        disabled={submitting}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <div className={styles.consentActions}>
                <button
                  className={styles.button}
                  type="submit"
                  disabled={submitting || !checkAnswer}
                >
                  {submitting ? "Saving…" : "Continue"}
                </button>
              </div>
            </form>
          </div>
        )}

        {step.kind === "instructions" && (
          <div className={styles.entryIntro}>
            <p className={styles.eyebrow}>{instructions.eyebrow}</p>
            <h1>{instructions.title}</h1>
            <p>{instructions.lead}</p>
            <ul className={styles.instructionList}>
              {instructions.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className={styles.consentActions}>
              <button
                className={styles.button}
                type="button"
                onClick={continueToStudy}
              >
                {instructions.continueLabel}
              </button>
            </div>
          </div>
        )}
      </section>

      {showRetryNotice && (
        <div className={styles.noticeBackdrop} role="presentation">
          <section
            className={styles.retryNotice}
            role="dialog"
            aria-modal="true"
            aria-labelledby="retry-notice-title"
          >
            <h2 id="retry-notice-title" className={styles.retryNoticeTitle}>
              <span className={styles.retryNoticeIcon} aria-hidden="true">
                ✕
              </span>
              1 or more of your answers was incorrect
            </h2>
            <p>
              To ensure you have understood all study instructions, you&apos;ll
              need to answer all correctly before starting the task.
            </p>
            <p>
              Click <strong>Continue</strong> to{" "}
              <strong>review the background information</strong> and retry the
              question. You have{" "}
              <strong>
                {MAX_CHECK_FAILURES - failedAttempts} attempt
                {MAX_CHECK_FAILURES - failedAttempts === 1 ? "" : "s"}
              </strong>{" "}
              remaining.
            </p>
            <div className={styles.retryNoticeActions}>
              <button
                className={styles.button}
                type="button"
                onClick={reviewAndRetry}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      )}

      {showSessionEndedNotice && (
        <div className={styles.noticeBackdrop} role="presentation">
          <section
            className={styles.retryNotice}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-ended-title"
          >
            <h2 id="session-ended-title" className={styles.retryNoticeTitle}>
              <span className={styles.retryNoticeIcon} aria-hidden="true">
                ✕
              </span>
              Unable to continue
            </h2>
            <p>
              You answered incorrectly 3 times. To ensure participants
              understand the study instructions, this session cannot continue.
            </p>
            <p>
              Click <strong>End session</strong> to return to Prolific.
            </p>
            <div className={styles.retryNoticeActions}>
              <button
                className={styles.button}
                type="button"
                onClick={endSession}
              >
                End session
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
