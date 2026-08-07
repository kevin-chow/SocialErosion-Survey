"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StartStudyButton } from "@/components/StartStudyButton";
import { loadStoredProlificParams } from "@/lib/prolific";
import styles from "@/app/start.module.css";

export default function ParticipantPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fromProlific, setFromProlific] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("vignette-study:consent") !== "true") {
      router.replace("/");
      return;
    }
    setFromProlific(Boolean(loadStoredProlificParams().prolificPid));
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.entryIntro}>
            <h1>Checking consent…</h1>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.entryIntro}>
          <p className={styles.eyebrow}>Workplace AI research</p>
          <h1>{fromProlific ? "Starting the study" : "Welcome to the study"}</h1>
          <p>
            {fromProlific
              ? "Your Prolific ID was captured from the study link. Continuing to the study background…"
              : "Enter the participant ID provided by the research team. You will review the study background on the next page before beginning the scenarios."}
          </p>
        </div>
        <div className={styles.actions}>
          <StartStudyButton />
        </div>
      </section>
    </main>
  );
}
