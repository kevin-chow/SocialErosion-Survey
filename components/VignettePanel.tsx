import Image from "next/image";
import type { Ref } from "react";
import styles from "@/app/study/study.module.css";
import { BackgroundDialog } from "@/components/BackgroundDialog";
import type { VignetteTag } from "@/types/study";

interface VignettePanelProps {
  title: string;
  body: string;
  assist?: "OpenAssist" | "CorpAssist";
  tags?: VignetteTag[];
  currentPosition: number;
  total: number;
  panelRef?: Ref<HTMLElement>;
}

const TAG_TONE: Record<string, string> = {
  task_type: styles.tagToneTask,
  ai_role: styles.tagToneRole,
  knowledge_type: styles.tagToneKnowledge,
  impact_level: styles.tagToneVisibility,
};

function renderHighlightedBody(body: string, assist?: string) {
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  const patterns: { regex: RegExp; className: string }[] = [
    { regex: /OpenAssist/g, className: styles.markOpenAssist },
    { regex: /CorpAssist/g, className: styles.markCorpAssist },
    {
      regex: /individually on your own computer/g,
      className: styles.markPersonal,
    },
    {
      regex: /the team's shared workspace/g,
      className: styles.markTeam,
    },
    {
      regex:
        /use (?:its|their) suggestions as a starting point|review the information it provides and use it|review its feedback, decide which changes|consider its response and continue|review the section it prepares|revise your draft for you|prepare your section of the presentation for you|determine how the task should be approached and prepare/g,
      className: styles.markRole,
    },
  ];

  return paragraphs.map((paragraph) => {
    type Piece = { text: string; className?: string };
    let pieces: Piece[] = [{ text: paragraph }];

    for (const { regex, className } of patterns) {
      const next: Piece[] = [];
      for (const piece of pieces) {
        if (piece.className) {
          next.push(piece);
          continue;
        }
        let lastIndex = 0;
        const localRegex = new RegExp(regex.source, regex.flags);
        let match: RegExpExecArray | null;
        while ((match = localRegex.exec(piece.text)) !== null) {
          if (match.index > lastIndex) {
            next.push({ text: piece.text.slice(lastIndex, match.index) });
          }
          next.push({ text: match[0], className });
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < piece.text.length) {
          next.push({ text: piece.text.slice(lastIndex) });
        }
      }
      pieces = next;
    }

    return (
      <p key={paragraph} data-assist={assist}>
        {pieces.map((piece, index) =>
          piece.className ? (
            <mark key={`${paragraph}-${index}`} className={piece.className}>
              {piece.text}
            </mark>
          ) : (
            <span key={`${paragraph}-${index}`}>{piece.text}</span>
          ),
        )}
      </p>
    );
  });
}

export function VignettePanel({
  title,
  body,
  assist,
  tags = [],
  currentPosition,
  total,
  panelRef,
}: VignettePanelProps) {
  return (
    <section
      ref={panelRef}
      className={`${styles.vignettePanel} ${
        assist === "CorpAssist"
          ? styles.assistCorp
          : assist === "OpenAssist"
            ? styles.assistOpen
            : ""
      }`}
      aria-labelledby="vignette-heading"
    >
      <div className={styles.scenarioBar}>
        <p className={styles.scenarioBarLabel}>
          Scenario {currentPosition}/{total}
        </p>
        <BackgroundDialog variant="onDark" />
      </div>

      <div className={styles.vignetteMain}>
        <h1 id="vignette-heading" className={styles.srOnly}>
          {title}
        </h1>

        <div className={styles.vignetteBody}>
          {renderHighlightedBody(body, assist)}
        </div>

        {tags.length > 0 && (
          <ul className={styles.tagGrid} aria-label="Scenario factors">
            {tags.map((tag) => (
              <li
                className={styles.tagCard}
                key={`${tag.factor}-${tag.value}`}
              >
                <span
                  className={`${styles.tagPill} ${TAG_TONE[tag.factor] ?? ""}`}
                >
                  {tag.label}
                </span>
                <span className={styles.tagIconWrap}>
                  <Image
                    className={styles.tagGridIcon}
                    src={tag.icon}
                    alt=""
                    width={120}
                    height={120}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
