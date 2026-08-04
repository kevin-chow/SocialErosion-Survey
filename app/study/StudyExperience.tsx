"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VignettePanel } from "@/components/VignettePanel";
import type {
  SharedQuestionConfig,
  VignetteCondition,
} from "@/types/study";
import styles from "./study.module.css";

interface StudyExperienceProps {
  vignettes: VignetteCondition[];
  questionConfig: SharedQuestionConfig;
}

export function StudyExperience({
  vignettes,
  questionConfig,
}: StudyExperienceProps) {
  const router = useRouter();
  const [pid, setPid] = useState("");
  const [assignedVignettes, setAssignedVignettes] = useState<
    VignetteCondition[]
  >([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const startedAtRef = useRef(Date.now());
  const questionsPanelRef = useRef<HTMLElement>(null);
  const vignettePanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem("vignette-study:consent") !== "true") {
      router.replace("/");
      return;
    }

    const storedPid = sessionStorage.getItem("vignette-study:pid");
    if (!storedPid) {
      router.replace("/participant");
      return;
    }
    if (
      sessionStorage.getItem(
        `vignette-study:introduction-complete:${storedPid}`,
      ) !== "true"
    ) {
      router.replace("/introduction");
      return;
    }

    let vignetteOrder: unknown;
    try {
      vignetteOrder = JSON.parse(
        sessionStorage.getItem(`vignette-study:order:${storedPid}`) ?? "",
      );
    } catch {
      vignetteOrder = null;
    }
    if (
      !Array.isArray(vignetteOrder) ||
      vignetteOrder.length !== 8 ||
      vignetteOrder.some((id) => typeof id !== "string")
    ) {
      sessionStorage.removeItem("vignette-study:pid");
      router.replace("/participant");
      return;
    }

    const assigned = vignetteOrder.map((id) =>
      vignettes.find((vignette) => vignette.id === id),
    );
    if (assigned.some((vignette) => !vignette)) {
      sessionStorage.removeItem("vignette-study:pid");
      router.replace("/participant");
      return;
    }

    const storedPosition = Number(
      sessionStorage.getItem(`vignette-study:position:${storedPid}`),
    );
    if (
      Number.isInteger(storedPosition) &&
      storedPosition >= 0 &&
      storedPosition < assigned.length
    ) {
      setActiveIndex(storedPosition);
    }
    setPid(storedPid);
    setAssignedVignettes(assigned as VignetteCondition[]);
    startedAtRef.current = Date.now();
    setReady(true);
  }, [router, vignettes]);

  // Block browser back during the study so participants cannot revisit vignettes.
  useEffect(() => {
    if (!ready || completed) return;

    const lockToken = `vignette-study-forward-${Date.now()}`;
    window.history.pushState({ vignetteLock: lockToken }, "");

    function preventBack() {
      window.history.pushState({ vignetteLock: lockToken }, "");
    }

    window.addEventListener("popstate", preventBack);
    return () => window.removeEventListener("popstate", preventBack);
  }, [completed, ready]);

  function scrollStudyToTop() {
    window.scrollTo({ top: 0, behavior: "auto" });
    questionsPanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
    vignettePanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    if (!ready || completed || showSavedNotice) return;
    scrollStudyToTop();
  }, [activeIndex, completed, ready, showSavedNotice]);

  async function submitResponses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          vignetteId: activeVignette.id,
          position: activeIndex + 1,
          answers,
          timeSpentMs: Math.min(
            Date.now() - startedAtRef.current,
            86_400_000,
          ),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        completed?: boolean;
      };
      if (!response.ok) {
        throw new Error(result.error || "The response could not be saved.");
      }

      if (result.completed) {
        sessionStorage.removeItem("vignette-study:pid");
        sessionStorage.removeItem(`vignette-study:position:${pid}`);
        sessionStorage.removeItem(`vignette-study:order:${pid}`);
        sessionStorage.removeItem(
          `vignette-study:introduction-complete:${pid}`,
        );
        sessionStorage.removeItem(`vignette-study:attention-check:${pid}`);
        setPendingComplete(true);
        setShowSavedNotice(true);
        return;
      }

      const nextIndex = activeIndex + 1;
      sessionStorage.setItem(
        `vignette-study:position:${pid}`,
        String(nextIndex),
      );
      setPendingComplete(false);
      setShowSavedNotice(true);
      // Advance index only after the participant acknowledges the notice.
      sessionStorage.setItem("vignette-study:pending-next", String(nextIndex));
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The response could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function acknowledgeSavedNotice() {
    setShowSavedNotice(false);
    if (pendingComplete) {
      setCompleted(true);
      return;
    }

    const nextIndex = Number(
      sessionStorage.getItem("vignette-study:pending-next"),
    );
    sessionStorage.removeItem("vignette-study:pending-next");
    if (Number.isInteger(nextIndex) && nextIndex > activeIndex) {
      setActiveIndex(nextIndex);
      setAnswers({});
      startedAtRef.current = Date.now();
    }
  }

  if (!ready) {
    return (
      <main className={styles.statePage}>
        <section className={styles.stateCard}>
          <h1>Preparing study…</h1>
          <p>Checking your participant session.</p>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className={styles.statePage}>
        <section className={styles.stateCard}>
          <h1>Study complete</h1>
          <p>Your responses have been saved. You may now close this window.</p>
        </section>
      </main>
    );
  }

  const activeVignette = assignedVignettes[activeIndex];
  const progressPercent =
    ((activeIndex + 1) / assignedVignettes.length) * 100;

  return (
    <main className={styles.studyPage}>
      <div className={styles.topProgress} aria-hidden="true">
        <div
          className={styles.topProgressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className={styles.studyShell}>
        <VignettePanel
          panelRef={vignettePanelRef}
          title={activeVignette.title}
          body={activeVignette.body}
          assist={activeVignette.assist}
          tags={activeVignette.tags}
          currentPosition={activeIndex + 1}
          total={assignedVignettes.length}
        />
        <section
          ref={questionsPanelRef}
          className={styles.questionsPanel}
          aria-labelledby="survey-questions-heading"
        >
          <h2 id="survey-questions-heading" className={styles.srOnly}>
            Questions about this scenario
          </h2>
          {questionConfig.instruction && (
            <p className={styles.questionInstruction}>
              <strong>
                <u>{questionConfig.instruction}</u>
              </strong>
            </p>
          )}
          <p className={styles.requiredNote}>All questions are required</p>

          <form onSubmit={submitResponses}>
            <div className={styles.questionList}>
              {questionConfig.questions.map((question, index) => (
                <fieldset className={styles.question} key={question.id}>
                  <legend>
                    {index + 1}. {question.text}
                  </legend>
                  <div className={styles.options}>
                    {questionConfig.scale.map((option) => {
                      const optionValue = String(option.value);
                      return (
                        <label className={styles.option} key={optionValue}>
                          <input
                            type="radio"
                            name={question.id}
                            value={optionValue}
                            checked={answers[question.id] === optionValue}
                            onChange={() =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: optionValue,
                              }))
                            }
                            required={question.required}
                            disabled={submitting || showSavedNotice}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>

            {error && (
              <p className={styles.submitError} role="alert">
                {error}
              </p>
            )}

            <div className={styles.submitRow}>
              <p aria-live="polite">
                Responses are saved when you continue.
              </p>
              <button
                className={styles.nextButton}
                type="submit"
                disabled={submitting || showSavedNotice}
              >
                {submitting
                  ? "Saving…"
                  : activeIndex === assignedVignettes.length - 1
                    ? "Submit final responses"
                    : "Save and continue"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {showSavedNotice && (
        <div className={styles.noticeBackdrop} role="presentation">
          <section
            className={styles.noticeDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="response-saved-title"
          >
            <h2 id="response-saved-title">
              {pendingComplete ? "Study submitted" : "Response saved"}
            </h2>
            <p>
              {pendingComplete
                ? "Thank you. All of your responses have been recorded."
                : `Scenario ${activeIndex + 1} of ${assignedVignettes.length} is complete. Continue to the next scenario.`}
            </p>
            <button
              className={styles.nextButton}
              type="button"
              onClick={acknowledgeSavedNotice}
            >
              {pendingComplete ? "Finish" : "Continue to next scenario"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
