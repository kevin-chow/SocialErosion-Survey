"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VignettePanel } from "@/components/VignettePanel";
import redirects from "@/config/redirects.json";
import { buildCompletionQualtricsUrl } from "@/lib/prolific";
import type {
  AttentionCheckQuestion,
  SharedQuestion,
  SharedQuestionConfig,
  VignetteCondition,
} from "@/types/study";
import styles from "./study.module.css";

interface StudyExperienceProps {
  vignettes: VignetteCondition[];
  practiceVignettes: VignetteCondition[];
  questionConfig: SharedQuestionConfig;
}

interface StudyStep {
  kind: "practice" | "main";
  vignette: VignetteCondition;
  /** 1–8 for main scenarios; omitted for practice. */
  apiPosition?: number;
  attentionCheck?: AttentionCheckQuestion;
  attentionInsertAt?: number;
}

type DisplayQuestion =
  | { kind: "survey"; question: SharedQuestion }
  | { kind: "attention"; question: AttentionCheckQuestion };

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number) {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPracticeVignette(
  pid: string,
  options: VignetteCondition[],
): VignetteCondition {
  const rng = createRng(hashSeed(`${pid}:practice`));
  return options[Math.floor(rng() * options.length)] ?? options[0];
}

function buildStudySteps(
  pid: string,
  assigned: VignetteCondition[],
  practiceOptions: VignetteCondition[],
  attentionChecks: AttentionCheckQuestion[],
  questionCount: number,
): StudyStep[] {
  const practice = pickPracticeVignette(pid, practiceOptions);
  const steps: StudyStep[] = [
    { kind: "practice", vignette: practice },
    ...assigned.map((vignette, index) => ({
      kind: "main" as const,
      vignette,
      apiPosition: index + 1,
    })),
  ];

  if (attentionChecks.length === 0 || assigned.length === 0) {
    return steps;
  }

  const rng = createRng(hashSeed(`${pid}:attention`));
  const slotIndexes = assigned.map((_, index) => index);
  for (let index = slotIndexes.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rng() * (index + 1));
    [slotIndexes[index], slotIndexes[swapWith]] = [
      slotIndexes[swapWith],
      slotIndexes[index],
    ];
  }

  const chosenSlots = slotIndexes
    .slice(0, Math.min(2, attentionChecks.length, assigned.length))
    .sort((left, right) => left - right);

  chosenSlots.forEach((assignedIndex, checkIndex) => {
    const step = steps[assignedIndex + 1];
    if (!step || step.kind !== "main") return;
    step.attentionCheck =
      attentionChecks[checkIndex % attentionChecks.length];
    step.attentionInsertAt = Math.floor(rng() * (questionCount + 1));
  });

  return steps;
}

function buildDisplayQuestions(
  step: StudyStep,
  surveyQuestions: SharedQuestion[],
): DisplayQuestion[] {
  const items: DisplayQuestion[] = surveyQuestions.map((question) => ({
    kind: "survey",
    question,
  }));
  if (
    step.attentionCheck &&
    typeof step.attentionInsertAt === "number"
  ) {
    const insertAt = Math.min(
      Math.max(step.attentionInsertAt, 0),
      items.length,
    );
    items.splice(insertAt, 0, {
      kind: "attention",
      question: step.attentionCheck,
    });
  }
  return items;
}

export function StudyExperience({
  vignettes,
  practiceVignettes,
  questionConfig,
}: StudyExperienceProps) {
  const router = useRouter();
  const [pid, setPid] = useState("");
  const [steps, setSteps] = useState<StudyStep[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
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

    const builtSteps = buildStudySteps(
      storedPid,
      assigned as VignetteCondition[],
      practiceVignettes,
      questionConfig.attentionChecks ?? [],
      questionConfig.questions.length,
    );

    const storedPosition = Number(
      sessionStorage.getItem(`vignette-study:position:${storedPid}`),
    );
    if (
      Number.isInteger(storedPosition) &&
      storedPosition >= 0 &&
      storedPosition < builtSteps.length
    ) {
      setActiveIndex(storedPosition);
    }

    setPid(storedPid);
    setSteps(builtSteps);
    startedAtRef.current = Date.now();
    setReady(true);
  }, [practiceVignettes, questionConfig, router, vignettes]);

  useEffect(() => {
    if (!ready || completed || sessionEnded) return;

    const lockToken = `vignette-study-forward-${Date.now()}`;
    window.history.pushState({ vignetteLock: lockToken }, "");

    function preventBack() {
      window.history.pushState({ vignetteLock: lockToken }, "");
    }

    window.addEventListener("popstate", preventBack);
    return () => window.removeEventListener("popstate", preventBack);
  }, [completed, ready, sessionEnded]);

  function scrollStudyToTop() {
    window.scrollTo({ top: 0, behavior: "auto" });
    questionsPanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
    vignettePanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    if (!ready || completed || showSavedNotice || sessionEnded) return;
    scrollStudyToTop();
  }, [activeIndex, completed, ready, sessionEnded, showSavedNotice]);

  const activeStep = steps[activeIndex];
  const displayQuestions = useMemo(
    () =>
      activeStep
        ? buildDisplayQuestions(activeStep, questionConfig.questions)
        : [],
    [activeStep, questionConfig.questions],
  );

  const mainScenarioCount = steps.filter((step) => step.kind === "main").length;

  function endFailedSession() {
    sessionStorage.setItem(`vignette-study:attention-check:${pid}`, "failed");
    sessionStorage.removeItem("vignette-study:pid");
    sessionStorage.removeItem(`vignette-study:position:${pid}`);
    sessionStorage.removeItem(`vignette-study:order:${pid}`);
    sessionStorage.removeItem(`vignette-study:introduction-complete:${pid}`);
    setSessionEnded(true);
  }

  async function submitResponses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeStep) return;
    setError("");
    setSubmitting(true);

    try {
      if (activeStep.attentionCheck) {
        const attentionAnswer = answers[activeStep.attentionCheck.id];
        if (attentionAnswer !== activeStep.attentionCheck.correctValue) {
          endFailedSession();
          return;
        }
      }

      if (activeStep.kind === "practice") {
        const nextIndex = activeIndex + 1;
        sessionStorage.setItem(
          `vignette-study:position:${pid}`,
          String(nextIndex),
        );
        setPendingComplete(false);
        setShowSavedNotice(true);
        sessionStorage.setItem(
          "vignette-study:pending-next",
          String(nextIndex),
        );
        return;
      }

      const surveyAnswers = Object.fromEntries(
        Object.entries(answers).filter(([questionId]) =>
          questionConfig.questions.some((question) => question.id === questionId),
        ),
      );

      const response = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          vignetteId: activeStep.vignette.id,
          position: activeStep.apiPosition,
          answers: surveyAnswers,
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
      window.location.assign(
        buildCompletionQualtricsUrl(redirects.completionQualtricsUrl, pid),
      );
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

  if (!ready || !activeStep) {
    return (
      <main className={styles.statePage}>
        <section className={styles.stateCard}>
          <h1>Preparing study…</h1>
          <p>Checking your participant session.</p>
        </section>
      </main>
    );
  }

  if (sessionEnded) {
    return (
      <main className={styles.statePage}>
        <section className={styles.stateCard}>
          <h1>Session ended</h1>
          <p>
            This session could not be continued. You will be redirected to
            complete your Prolific submission.
          </p>
          <button
            className={styles.nextButton}
            type="button"
            onClick={() =>
              window.location.assign(redirects.attentionFailProlificUrl)
            }
          >
            Continue
          </button>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className={styles.statePage}>
        <section className={styles.stateCard}>
          <h1>Redirecting…</h1>
          <p>Taking you to the post-study questionnaire.</p>
        </section>
      </main>
    );
  }

  const isPractice = activeStep.kind === "practice";
  const progressPercent = ((activeIndex + 1) / steps.length) * 100;

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
          title={activeStep.vignette.title}
          body={activeStep.vignette.body}
          assist={activeStep.vignette.assist}
          tags={activeStep.vignette.tags}
          currentPosition={activeStep.apiPosition ?? 1}
          total={mainScenarioCount}
          isPractice={isPractice}
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
              {displayQuestions.map((item, index) => {
                const question = item.question;
                return (
                  <fieldset className={styles.question} key={question.id}>
                    <legend className={styles.questionLegend}>
                      <span className={styles.questionNumber}>
                        {index + 1}.
                      </span>{" "}
                      {(
                        question.segments ?? [{ text: question.text ?? "" }]
                      ).map((segment, segmentIndex) =>
                        segment.bold ? (
                          <strong key={`${question.id}-${segmentIndex}`}>
                            {segment.text}
                          </strong>
                        ) : (
                          <span key={`${question.id}-${segmentIndex}`}>
                            {segment.text}
                          </span>
                        ),
                      )}
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
                );
              })}
            </div>

            {error && (
              <p className={styles.submitError} role="alert">
                {error}
              </p>
            )}

            <div className={styles.submitRow}>
              <p aria-live="polite">
                {isPractice
                  ? "Practice responses are not saved to the study data."
                  : "Responses are saved when you continue."}
              </p>
              <button
                className={styles.nextButton}
                type="submit"
                disabled={submitting || showSavedNotice}
              >
                {submitting
                  ? "Saving…"
                  : isPractice
                    ? "Continue to scenarios"
                    : activeIndex === steps.length - 1
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
              {pendingComplete
                ? "Study submitted"
                : isPractice
                  ? "Practice complete"
                  : "Response saved"}
            </h2>
            <p>
              {pendingComplete
                ? "Thank you. All of your responses have been recorded. Continue to the post-study questionnaire."
                : isPractice
                  ? "You can now begin the main scenarios. Continue when you are ready."
                  : `Scenario ${activeStep.apiPosition} of ${mainScenarioCount} is complete. Continue to the next scenario.`}
            </p>
            <button
              className={styles.nextButton}
              type="button"
              onClick={acknowledgeSavedNotice}
            >
              {pendingComplete
                ? "Continue to questionnaire"
                : isPractice
                  ? "Begin scenarios"
                  : "Continue to next scenario"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
