"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackgroundContent } from "@/components/BackgroundContent";
import background from "@/config/background.json";
import instructions from "@/config/instructions.json";
import redirects from "@/config/redirects.json";
import styles from "@/app/start.module.css";

type IntroStep = "team" | "assist" | "attention" | "instructions";

const STEP_ORDER: IntroStep[] = ["team", "assist", "attention", "instructions"];

export function IntroductionExperience() {
  const router = useRouter();
  const [pid, setPid] = useState("");
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<IntroStep>("team");
  const [attentionAnswer, setAttentionAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const activeTimeMsRef = useRef(0);
  const visibleSinceRef = useRef<number | null>(null);

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
      router.replace("/participant");
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
  }, [step]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progressPercent = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  function goToNextBackgroundPage() {
    setError("");
    setShowSavedNotice(true);
  }

  function confirmAndAdvance() {
    setShowSavedNotice(false);
    if (step === "team") {
      setStep("assist");
      return;
    }
    if (step === "assist") {
      setStep("attention");
    }
  }

  async function submitAttentionCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (attentionAnswer !== background.attentionCheck.correctValue) {
      sessionStorage.setItem(
        `vignette-study:attention-check:${pid}`,
        "failed",
      );
      window.location.assign(redirects.attentionFailProlificUrl);
      return;
    }

    setSubmitting(true);

    if (visibleSinceRef.current !== null) {
      activeTimeMsRef.current += performance.now() - visibleSinceRef.current;
      visibleSinceRef.current = null;
    }
    const readingTimeMs = Math.min(
      Math.round(activeTimeMsRef.current),
      86_400_000,
    );

    try {
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
      sessionStorage.setItem(
        `vignette-study:attention-check:${pid}`,
        "passed",
      );
      setStep("instructions");
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

  function continueToStudy() {
    router.push("/study");
  }

  if (!ready) {
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
    step === "instructions"
      ? "Instructions"
      : step === "attention"
        ? "Attention check"
        : `Background ${stepIndex + 1} of 2`;

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
        {step === "team" && <BackgroundContent pageId="team" />}
        {step === "assist" && (
          <BackgroundContent pageId="assist" showImage={false} />
        )}
        {step === "attention" && (
          <div className={styles.entryIntro}>
            <p className={styles.eyebrow}>Attention check</p>
            <h1>Please answer this question</h1>
            <p>
              This helps us confirm that you carefully read the background
              information.
            </p>
            <form className={styles.pidForm} onSubmit={submitAttentionCheck}>
              <fieldset className={styles.attentionFieldset}>
                <legend className={styles.label}>
                  {background.attentionCheck.prompt}
                </legend>
                <div className={styles.attentionOptions}>
                  {background.attentionCheck.options.map((option) => (
                    <label className={styles.attentionOption} key={option.value}>
                      <input
                        type="radio"
                        name="attention-check"
                        value={option.value}
                        checked={attentionAnswer === option.value}
                        onChange={() => setAttentionAnswer(option.value)}
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
                  disabled={submitting || !attentionAnswer}
                >
                  {submitting ? "Saving…" : "Continue"}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "instructions" && (
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

        {(step === "team" || step === "assist") && (
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
              onClick={goToNextBackgroundPage}
            >
              {step === "team" ? "Continue" : "Continue to attention check"}
            </button>
          </div>
        )}
      </section>

      {showSavedNotice && (
        <div className={styles.noticeBackdrop} role="presentation">
          <section
            className={styles.noticeDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-section-complete-title"
          >
            <h2 id="intro-section-complete-title">Section complete</h2>
            <p>This section is complete. Continue to the next page.</p>
            <button
              className={styles.button}
              type="button"
              onClick={confirmAndAdvance}
            >
              Next page
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
