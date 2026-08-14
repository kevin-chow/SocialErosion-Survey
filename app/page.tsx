import Image from "next/image";
import consent from "@/config/consent.json";
import { ConsentForm } from "@/components/ConsentForm";
import styles from "./start.module.css";

export default function ConsentPage() {
  const durationParagraph = consent.paragraphs[1];
  const [beforeDuration, afterDuration] = durationParagraph.split(
    consent.durationEmphasis,
  );

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.consentHeader}>
          <Image
            className={styles.consentHeaderLogo}
            src="/nyu-banner-4x.png"
            alt="New York University"
            width={1024}
            height={56}
            priority
            unoptimized
          />
        </header>
        <div className={styles.entryIntro}>
          <p className={styles.eyebrow}>Research study</p>
          <h1>{consent.title}</h1>
          <p>{consent.paragraphs[0]}</p>
          <p>
            {beforeDuration}
            <strong>{consent.durationEmphasis}</strong>
            {afterDuration}
          </p>
          <p>{consent.paragraphs[2]}</p>
        </div>
        <div className={styles.actions}>
          <ConsentForm />
        </div>
      </section>
    </main>
  );
}
