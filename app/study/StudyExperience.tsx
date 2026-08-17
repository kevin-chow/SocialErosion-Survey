"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VignettePanel } from "@/components/VignettePanel";
import redirects from "@/config/redirects.json";
import { buildCompletionQualtricsUrl } from "@/lib/prolific";
import {
  applyTeammateName,
  buildShuffledQuestionOrder,
  buildTeammateCycle,
  createRng,
  hashSeed,
  teammateConfig,
  teammateForStep,
} from "@/lib/studyRandomization";
import type {
  AttentionCheckQuestion,
  QuestionSegment,
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
  /** 0 for practice; 1–8 for main scenarios. */
  apiPosition: number;
  teammateName: string;
  attentionCheck?: AttentionCheckQuestion;
  attentionInsertAt?: number;
}

type DisplayQuestion =
  | { kind: "survey"; question: SharedQuestion }
  | { kind: "attention"; question: AttentionCheckQuestion };

function withTeammateText(text: string, teammateName: string): string {
  return applyTeammateName(text, teammateName);
}

function withTeammateSegments(
  segments: QuestionSegment[] | undefined,
  fallbackText: string | undefined,
  teammateName: string,
): QuestionSegment[] {
  return (segments ?? [{ text: fallbackText ?? "" }]).map((segment) => ({
    ...segment,
    text: applyTeammateName(segment.text, teammateName),
  }));
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
  const teammateCycle = buildTeammateCycle(pid);
  const steps: StudyStep[] = [
    {
      kind: "practice",
      vignette: practice,
      apiPosition: 0,
      teammateName: teammateForStep(teammateCycle, 0),
    },
    ...assigned.map((vignette, index) => ({
      kind: "main" as const,
      vignette,
      apiPosition: index + 1,
      teammateName: teammateForStep(teammateCycle, index + 1),
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
  const [questionOrder, setQuestionOrder] = useState<string[]>([]);
  const [showConstraintsNotice, setShowConstraintsNotice] = useState(false);
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
    const startingIndex =
      Number.isInteger(storedPosition) &&
      storedPosition >= 0 &&
      storedPosition < builtSteps.length
        ? storedPosition
        : 0;
    setActiveIndex(startingIndex);

    setPid(storedPid);
    setSteps(builtSteps);
    setQuestionOrder(
      buildShuffledQuestionOrder(
        storedPid,
        questionConfig.questions.map((question) => question.id),
      ),
    );
    setShowConstraintsNotice(
      startingIndex === 0 &&
        sessionStorage.getItem(
          `vignette-study:constraints-ack:${storedPid}`,
        ) !== "true",
    );
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
  const orderedSurveyQuestions = useMemo(() => {
    const byId = new Map(
      questionConfig.questions.map((question) => [question.id, question]),
    );
    const ordered = questionOrder
      .map((id) => byId.get(id))
      .filter((question): question is SharedQuestion => Boolean(question));
    return ordered.length === questionConfig.questions.length
      ? ordered
      : questionConfig.questions;
  }, [questionConfig.questions, questionOrder]);
  const displayQuestions = useMemo(
    () =>
      activeStep
        ? buildDisplayQuestions(activeStep, orderedSurveyQuestions)
        : [],
    [activeStep, orderedSurveyQuestions],
  );

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
          isPractice: activeStep.kind === "practice",
          teammateName: activeStep.teammateName,
          questionOrder,
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

  function acknowledgeConstraintsNotice() {
    sessionStorage.setItem(`vignette-study:constraints-ack:${pid}`, "true");
    setShowConstraintsNotice(false);
    startedAtRef.current = Date.now();
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
          body={withTeammateText(
            activeStep.vignette.body,
            activeStep.teammateName,
          )}
          assist={activeStep.vignette.assist}
          tags={activeStep.vignette.tags}
          currentPosition={activeIndex + 1}
          total={steps.length}
        />
        <section
          ref={questionsPanelRef}
          className={styles.questionsPanel}
          aria-labelledby="survey-questions-heading"
        >
          <h2 id="survey-questions-heading" className={styles.srOnly}>
            Questions about this scenario
          </h2>
          <p className={styles.constraintsReminder}>
            {teammateConfig.constraintsReminder}
          </p>
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
                      {withTeammateSegments(
                        question.segments,
                        question.text,
                        activeStep.teammateName,
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
                            disabled={
                              submitting ||
                              showSavedNotice ||
                              showConstraintsNotice
                            }
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
                Responses are saved when you continue.
              </p>
              <button
                className={styles.nextButton}
                type="submit"
                disabled={
                  submitting || showSavedNotice || showConstraintsNotice
                }
              >
                {submitting
                  ? "Saving…"
                  : activeIndex === steps.length - 1
                    ? "Submit final responses"
                    : "Save and continue"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {showConstraintsNotice && (
        <div className={styles.noticeBackdrop} role="presentation">
          <section
            className={`${styles.noticeDialog} ${styles.noticeDialogWide}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="constraints-title"
          >
            <h2 id="constraints-title">{teammateConfig.constraintsTitle}</h2>
            <p className={styles.constraintsIntro}>
              {teammateConfig.constraintsBody.intro}
            </p>
            <ul className={styles.constraintsList}>
              {teammateConfig.constraintsBody.items.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>
                  {item.detail && ` (${item.detail})`}
                </li>
              ))}
            </ul>
            <p className={styles.constraintsOutro}>
              {teammateConfig.constraintsBody.outro}
            </p>
            <button
              className={styles.nextButton}
              type="button"
              onClick={acknowledgeConstraintsNotice}
            >
              {teammateConfig.constraintsAcknowledgeLabel}
            </button>
          </section>
        </div>
      )}

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
                ? "Thank you. All of your responses have been recorded. Continue to the post-study questionnaire."
                : `Scenario ${activeIndex + 1} of ${steps.length} is complete. Continue to the next scenario.`}
            </p>
            <button
              className={styles.nextButton}
              type="button"
              onClick={acknowledgeSavedNotice}
            >
              {pendingComplete
                ? "Continue to questionnaire"
                : "Continue to next scenario"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
