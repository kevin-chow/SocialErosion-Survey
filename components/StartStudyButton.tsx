"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/start.module.css";
import { loadStoredProlificParams } from "@/lib/prolific";
import { registerParticipantSession } from "@/lib/registerParticipant";

/** Manual PID entry fallback when the study is opened without Prolific URL params. */
export function StartStudyButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [autoStarting, setAutoStarting] = useState(false);
  const [pid, setPid] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const prolific = loadStoredProlificParams();
    if (!prolific.prolificPid) return;

    let cancelled = false;
    setAutoStarting(true);
    setLoading(true);
    void (async () => {
      try {
        const registration = await registerParticipantSession(
          prolific.prolificPid,
        );
        if (!cancelled) {
          router.replace(registration.nextPath);
        }
      } catch (registrationError) {
        if (!cancelled) {
          setError(
            registrationError instanceof Error
              ? registrationError.message
              : "Unable to begin the study.",
          );
          setAutoStarting(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function beginStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (sessionStorage.getItem("vignette-study:consent") !== "true") {
        sessionStorage.setItem("vignette-study:consent", "true");
      }
      const registration = await registerParticipantSession(pid.trim());
      router.push(registration.nextPath);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to begin the study.",
      );
      setLoading(false);
    }
  }

  if (autoStarting && !error) {
    return (
      <p className={styles.hint} aria-live="polite">
        Starting study…
      </p>
    );
  }

  return (
    <form className={styles.pidForm} onSubmit={beginStudy}>
      <label className={styles.label} htmlFor="participant-id">
        Participant ID
      </label>
      <p className={styles.hint} id="participant-id-hint">
        Enter the ID provided by the research team (or your Prolific ID). Do not
        enter your name.
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
