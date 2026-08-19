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

const FACTOR_TONE: Record<string, string> = {
  task_type: styles.tagToneTask,
  ai_role: styles.tagToneRole,
  knowledge_type: styles.tagToneKnowledge,
  impact_level: styles.tagToneVisibility,
};

/** Bolded phrases from the scenario text, colored by factor category. */
const HIGHLIGHT_PATTERNS: { regex: RegExp; className: string }[] = [
  {
    regex:
      /where you need to search for recent products launched by NextGen's competitors|proposing ideas for new products or features that NextGen could develop in response to recent industry trends|explaining the implications of recent industry trends for NextGen|but think there may be ways to improve it|you begin to second-guess whether your perspective on what happened during the project is reasonable/g,
    className: styles.markTask,
  },
  {
    regex:
      /OpenAssist, the general-purpose version of Assist|CorpAssist, the company-specific version of Assist|OpenAssist|CorpAssist/g,
    className: styles.markKnowledge,
  },
  {
    regex:
      /individually on your own computer|in the team's shared workspace|the team's shared workspace/g,
    className: styles.markVisibility,
  },
  {
    regex:
      /You prepare your section of the presentation yourself, using its output to support your preparation|prepare your section of the presentation yourself|revise your section of the presentation yourself accordingly|decide for yourself whether your interpretation is reasonable|prepare your section of the presentation for you by identifying and synthesizing recent products by NextGen's competitors|prepare your section of the presentation for you by researching recent industry trends, generating ideas, and developing them into proposals for new products or features for NextGen|revise your draft for you to improve its clarity, organization, and completeness|You rely on its assessment as you continue preparing your section|you search company websites and other publicly available sources to identify recent products launched by competing companies and other relevant competitors to examine\. You review the information you find and use it to continue preparing your section of the presentation|you brainstorm possible ideas for new products or features that NextGen could develop\. You consider the ideas you generate, consider which ones to develop, and continue preparing your section of the presentation|you review your initial draft, considering its clarity, organization, and completeness\. You identify potential revisions based on your review and continue preparing your section of the presentation|you revisit the project materials and think through which takeaways are most important\. You use this review to consider which takeaways to include and continue preparing your section of the presentation/g,
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
      aria-labelledby="scenario-heading"
    >
      <div className={styles.scenarioBar}>
        <p className={styles.scenarioBarLabel}>
          Scenario {currentPosition}/{total}
        </p>
        <BackgroundDialog variant="onDark" />
      </div>

      <div className={styles.vignetteMain}>
        <h1 id="scenario-heading" className={styles.srOnly}>
          {title}
        </h1>

        <div className={styles.vignetteBody}>
          {renderHighlightedBody(body)}
        </div>

        {tags.length > 0 && (
          <ul
            className={`${styles.tagGrid} ${
              tags.length === 1 ? styles.tagGridSingle : ""
            }`}
            aria-label="Scenario factors"
          >
            {tags.map((tag) => (
              <li
                className={styles.tagCard}
                key={`${tag.factor}-${tag.value}`}
              >
                <span
                  className={`${styles.tagLevelPill} ${
                    FACTOR_TONE[tag.factor] ?? ""
                  }`}
                >
                  {tag.label}
                </span>
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
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
