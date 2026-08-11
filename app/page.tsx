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
        <div className={styles.brandBar}>
          <Image
            className={styles.brandLogo}
            src="/nyu-tandon-logo.png"
            alt="NYU Tandon School of Engineering"
            width={320}
            height={72}
            priority
          />
        </div>
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
