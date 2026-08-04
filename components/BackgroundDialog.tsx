"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BackgroundContent } from "./BackgroundContent";
import styles from "./background.module.css";

interface BackgroundDialogProps {
  variant?: "default" | "onDark";
}

export function BackgroundDialog({
  variant = "default",
}: BackgroundDialogProps) {
  const [open, setOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeDialog = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, open]);

  return (
    <>
      <button
        ref={triggerButtonRef}
        className={
          variant === "onDark" ? styles.triggerOnDark : styles.trigger
        }
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Review background information"
        title="Review background information"
      >
        <span className={styles.triggerIcon} aria-hidden="true">
          🏠
        </span>
        <span className={styles.triggerLabel}>Background</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.backdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDialog();
            }}
          >
            <section
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="background-dialog-title"
            >
              <button
                ref={closeButtonRef}
                className={styles.close}
                type="button"
                onClick={closeDialog}
                aria-label="Close background information"
              >
                ×
              </button>
              <BackgroundContent headingId="background-dialog-title" />
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
