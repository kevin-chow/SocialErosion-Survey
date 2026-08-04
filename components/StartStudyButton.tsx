"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/start.module.css";

export function StartStudyButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pid, setPid] = useState("");
  const [error, setError] = useState("");

  async function beginStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const normalizedPid = pid.trim();
    if (
      sessionStorage.getItem("vignette-study:pid") === normalizedPid &&
      sessionStorage.getItem(`vignette-study:order:${normalizedPid}`)
    ) {
      if (sessionStorage.getItem("vignette-study:consent") !== "true") {
        sessionStorage.setItem("vignette-study:consent", "true");
      }
      const introductionComplete =
        sessionStorage.getItem(
          `vignette-study:introduction-complete:${normalizedPid}`,
        ) === "true";
      router.push(introductionComplete ? "/study" : "/introduction");
      return;
    }

    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: normalizedPid }),
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
      sessionStorage.removeItem(
        `vignette-study:position:${normalizedPid}`,
      );
      sessionStorage.removeItem(
        `vignette-study:introduction-complete:${normalizedPid}`,
      );
      router.push("/introduction");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to begin the study.",
      );
      setLoading(false);
    }
  }

  return (
    <form className={styles.pidForm} onSubmit={beginStudy}>
      <label className={styles.label} htmlFor="participant-id">
        Participant ID
      </label>
      <p className={styles.hint} id="participant-id-hint">
        Enter the ID provided by the research team. Do not enter your name.
      </p>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          id="participant-id"
          name="participantId"
          value={pid}
          onChange={(event) => setPid(event.target.value)}
          aria-describedby="participant-id-hint participant-id-error"
          pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,63}"
          maxLength={64}
          autoComplete="off"
          required
          disabled={loading}
        />
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "Preparing study…" : "Continue"}
        </button>
      </div>
      {error && (
        <p className={styles.error} id="participant-id-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
