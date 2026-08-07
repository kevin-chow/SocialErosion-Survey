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

const CATEGORY_META: Record<string, { label: string; toneClass: string }> = {
  task_type: {
    label: "AI Usage Type",
    toneClass: styles.tagToneTask,
  },
  ai_role: {
    label: "AI Role",
    toneClass: styles.tagToneRole,
  },
  knowledge_type: {
    label: "AI Specialization",
    toneClass: styles.tagToneKnowledge,
  },
  impact_level: {
    label: "AI Usage Visibility",
    toneClass: styles.tagToneVisibility,
  },
};

/** Bolded phrases from the vignette set PDF, colored by factor category. */
const HIGHLIGHT_PATTERNS: { regex: RegExp; className: string }[] = [
  // AI Usage Type
  {
    regex:
      /summarizes recent products launched by NextGen's competitors|proposing ideas for new products or features that NextGen could develop in response to recent industry trends|explaining the implications of recent industry trends for NextGen|You have already prepared an initial draft of your section|you begin to feel uncertain about whether you have captured the most important takeaways/g,
    className: styles.markTask,
  },
  // AI Specialization
  {
    regex: /OpenAssist|CorpAssist/g,
    className: styles.markKnowledge,
  },
  // AI Usage Visibility
  {
    regex:
      /individually on your own computer|in the team's shared workspace|the team's shared workspace/g,
    className: styles.markVisibility,
  },
  // AI Role
  {
    regex:
      /You review the information it provides and use it to prepare your section of the presentation|You use its suggestions as a starting point, decide which ideas to develop, and prepare your section of the presentation|You review its feedback, decide which changes to make, and revise your section of the presentation accordingly|You consider its response and continue preparing your section of the presentation|to use that information to prepare your section of the presentation for you|You review the section it prepares before adding it to the presentation|determine which ideas are most promising, develop them, and prepare your section of the presentation|revise your draft for you to improve its clarity, organization, and completeness|You review the revised section before adding it to the presentation|You also ask it to determine how the task should be approached and prepare your section of the presentation/g,
    className: styles.markRole,
  },
];

function renderHighlightedBody(body: string) {
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);

  return paragraphs.map((paragraph) => {
    type Piece = { text: string; className?: string };
    let pieces: Piece[] = [{ text: paragraph }];

    for (const { regex, className } of HIGHLIGHT_PATTERNS) {
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
      <p key={paragraph}>
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
  tags = [],
  currentPosition,
  total,
  panelRef,
}: VignettePanelProps) {
  return (
    <section
      ref={panelRef}
      className={styles.vignettePanel}
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
          {renderHighlightedBody(body)}
        </div>

        {tags.length > 0 && (
          <ul className={styles.tagGrid} aria-label="Scenario factors">
            {tags.map((tag) => {
              const category = CATEGORY_META[tag.factor];
              return (
                <li
                  className={styles.tagCard}
                  key={`${tag.factor}-${tag.value}`}
                >
                  <span
                    className={`${styles.tagPill} ${category?.toneClass ?? ""}`}
                  >
                    {category?.label ?? tag.factor}
                  </span>
                  <span className={styles.tagLevel}>{tag.label}</span>
                  <span className={styles.tagIconWrap}>
                    <Image
                      className={styles.tagGridIcon}
                      src={tag.icon}
                      alt=""
                      width={140}
                      height={140}
                      unoptimized
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
