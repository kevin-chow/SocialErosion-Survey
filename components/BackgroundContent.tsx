import Image from "next/image";
import background from "@/config/background.json";
import styles from "./background.module.css";

interface BackgroundContentProps {
  showImage?: boolean;
  headingId?: string;
  /** When set, only that background page is shown. Otherwise all pages. */
  pageId?: string;
}

interface RichSegment {
  text: string;
  bold?: boolean;
  underline?: boolean;
}

type BackgroundBlock =
  | { type: "paragraph"; segments: RichSegment[] }
  | { type: "ordered-list"; items: RichSegment[][] };

interface BackgroundPage {
  id: string;
  blocks: BackgroundBlock[];
}

function renderSegments(segments: RichSegment[]) {
  return segments.map((segment, index) => {
    let content: React.ReactNode = segment.text;
    if (segment.bold) content = <strong>{content}</strong>;
    if (segment.underline) content = <u>{content}</u>;
    return <span key={`${index}-${segment.text}`}>{content}</span>;
  });
}

function renderBlocks(blocks: BackgroundBlock[], keyPrefix: string) {
  return blocks.map((block, index) =>
    block.type === "ordered-list" ? (
      <ol key={`${keyPrefix}-list-${index}`} className={styles.versionList}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderSegments(item)}</li>
        ))}
      </ol>
    ) : (
      <p key={`${keyPrefix}-paragraph-${index}`}>
        {renderSegments(block.segments)}
      </p>
    ),
  );
}

export function BackgroundContent({
  showImage = true,
  headingId,
  pageId,
}: BackgroundContentProps) {
  const pages = background.pages as BackgroundPage[];
  const selectedPages = pageId
    ? pages.filter((page) => page.id === pageId)
    : pages;

  return (
    <div className={styles.content}>
      {showImage && (
        <Image
          className={styles.image}
          src={background.image}
          alt={background.imageAlt}
          width={1024}
          height={443}
          priority
        />
      )}
      <div className={styles.text}>
        <h1 id={headingId}>{background.title}</h1>
        {selectedPages.map((page) => (
          <div key={page.id} className={styles.pageSection}>
            {renderBlocks(page.blocks, page.id)}
          </div>
        ))}
      </div>
    </div>
  );
}
