"use client";

import { FormEvent, UIEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import consent from "@/config/consent.json";
import {
  loadStoredProlificParams,
  persistProlificParams,
  readProlificParamsFromSearch,
} from "@/lib/prolific";
import { registerParticipantSession } from "@/lib/registerParticipant";
import styles from "@/app/start.module.css";

const SCROLL_END_THRESHOLD_PX = 24;

export function ConsentForm() {
  const router = useRouter();
  const documentRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const node = documentRef.current;
    if (!node) return;

    function checkFitsWithoutScroll() {
      if (!node) return;
      if (node.scrollHeight <= node.clientHeight + SCROLL_END_THRESHOLD_PX) {
        setHasScrolledToEnd(true);
      }
    }

    checkFitsWithoutScroll();

    const observer = new ResizeObserver(checkFitsWithoutScroll);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function handleDocumentScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    const remaining =
      node.scrollHeight - node.scrollTop - node.clientHeight;

    if (remaining <= SCROLL_END_THRESHOLD_PX) {
      setHasScrolledToEnd(true);
    }
  }

  async function continueAfterConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!hasScrolledToEnd) {
      setError("Please scroll through the entire consent form before continuing.");
      return;
    }

    if (!agreed) {
      setError("Please confirm your consent before continuing.");
      return;
    }

    sessionStorage.setItem("vignette-study:consent", "true");

    // Re-capture from the current URL in case sessionStorage was cleared.
    persistProlificParams(readProlificParamsFromSearch(window.location.search));
    const prolific = loadStoredProlificParams();
    if (!prolific.prolificPid) {
      router.push("/participant");
      return;
    }

    setLoading(true);
    try {
      const registration = await registerParticipantSession(prolific.prolificPid);
      router.push(registration.nextPath);
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "Unable to begin the study.",
      );
      setLoading(false);
    }
  }

  return (
    <form className={styles.consentForm} onSubmit={continueAfterConsent}>
      <div
        ref={documentRef}
        className={styles.consentDocument}
        tabIndex={0}
        role="region"
        aria-label="Full informed consent form"
        onScroll={handleDocumentScroll}
      >
        <h2 className={styles.consentDocumentTitle}>{consent.documentTitle}</h2>
        <ul className={styles.consentDocumentMeta}>
          {consent.documentMeta.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {consent.sections.map((section) => (
          <section key={section.heading} className={styles.consentSection}>
            <h3>{section.heading}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {"list" in section && section.list ? (
              <ol>
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : null}
          </section>
        ))}
      </div>

      <p
        className={
          hasScrolledToEnd
            ? styles.consentScrollHintComplete
            : styles.consentScrollHint
        }
        aria-live="polite"
      >
        {hasScrolledToEnd ? consent.scrollCompleteHint : consent.scrollHint}
      </p>

      <label
        className={`${styles.consentCheckbox} ${
          hasScrolledToEnd ? "" : styles.consentCheckboxLocked
        }`}
      >
        <input
          type="checkbox"
          checked={agreed}
          disabled={!hasScrolledToEnd || loading}
          onChange={(event) => {
            setAgreed(event.target.checked);
            if (event.target.checked) setError("");
          }}
          required
          aria-describedby={
            hasScrolledToEnd ? undefined : "consent-checkbox-locked-hint"
          }
        />
        <span>
          <strong>{consent.checkboxLabel}</strong>
          {!hasScrolledToEnd ? (
            <span id="consent-checkbox-locked-hint" className={styles.consentLockedNote}>
              {consent.checkboxLockedHint}
            </span>
          ) : null}
        </span>
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <p className={styles.consentLinkRow}>
        <a
          className={styles.consentLink}
          href={consent.consentFormHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {consent.consentFormLabel}
        </a>
      </p>

      <div className={styles.consentActions}>
        <button
          className={styles.button}
          type="submit"
          disabled={!hasScrolledToEnd || !agreed || loading}
        >
          {loading ? "Starting study…" : consent.continueLabel}
        </button>
      </div>
    </form>
  );
}
