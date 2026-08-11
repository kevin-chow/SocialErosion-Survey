import styles from "./background.module.css";

export function AssistVersionsDiagram() {
  return (
    <figure className={styles.diagram} aria-label="OpenAssist versus CorpAssist">
      <div className={styles.queryCard}>
        <div className={styles.queryMeta}>
          <span className={styles.avatar} aria-hidden="true">
            Y
          </span>
          <div>
            <strong>You</strong>
            <span className={styles.queryTime}>9:15 AM</span>
          </div>
        </div>
        <p>Can you explain what a product pilot is in two sentences?</p>
      </div>

      <div className={styles.branchHub} aria-hidden="true">
        <span className={styles.branchLine} />
        <div className={styles.hubPill}>
          NextGen employees can use either version of Assist
        </div>
        <div className={styles.branchFork}>
          <span className={styles.forkLeft} />
          <span className={styles.forkRight} />
        </div>
      </div>

      <div className={styles.compareGrid}>
        <article className={`${styles.compareCard} ${styles.openCard}`}>
          <header className={styles.compareHeader}>
            <span className={`${styles.assistBadge} ${styles.openBadge}`}>
              ✦
            </span>
            <div>
              <h3>OpenAssist</h3>
              <span className={`${styles.infoPill} ${styles.openPill}`}>
                Uses general information
              </span>
            </div>
          </header>
          <p>
            A product pilot is a small-scale trial used to see how a product
            works before a wider release. It allows a company to learn from a
            limited group of users before making it more broadly available.
          </p>
        </article>

        <article className={`${styles.compareCard} ${styles.corpCard}`}>
          <header className={styles.compareHeader}>
            <span className={`${styles.assistBadge} ${styles.corpBadge}`}>
              ✦
            </span>
            <div>
              <h3>CorpAssist</h3>
              <span className={`${styles.infoPill} ${styles.corpPill}`}>
                Uses NextGen-specific information
              </span>
            </div>
          </header>
          <p>
            A product pilot is a small-scale trial used to see how a product
            works before a wider release. At NextGen, the recent Atlas pilot
            tested a new feature with a limited group of users before a broader
            rollout.
          </p>
        </article>
      </div>
    </figure>
  );
}

function Sidebar({
  active,
}: {
  active: "channel" | "assist";
}) {
  return (
    <aside className={styles.workspaceSidebar} aria-hidden="true">
      <div className={styles.workspaceLogo}>
        <span className={styles.logoMark}>N</span>
        NextGen
      </div>
      <p className={styles.sideLabel}>Channels</p>
      <div className={styles.sideItem}># general</div>
      <div
        className={`${styles.sideItem} ${
          active === "channel" ? styles.sideItemActive : ""
        }`}
      >
        # project-orion
      </div>
      <div className={styles.sideItem}># marketing</div>
      <p className={styles.sideLabel}>Direct Messages</p>
      <div className={styles.sideItem}>Alex</div>
      <div className={styles.sideItem}>Jasmine</div>
      <div className={styles.sideItem}>Sam</div>
      <div
        className={`${styles.sideItem} ${
          active === "assist" ? styles.sideItemActive : ""
        }`}
      >
        Assist
      </div>
    </aside>
  );
}

export function WorkspaceDiagram() {
  return (
    <figure
      className={styles.diagram}
      aria-label="Shared workspace versus individual Assist use"
    >
      <div className={styles.workspaceGrid}>
        <article className={styles.workspaceCard}>
          <div className={styles.workspaceShell}>
            <Sidebar active="channel" />
            <div className={styles.workspaceMain}>
              <header className={styles.workspaceHeader}>
                <p className={styles.workspaceEyebrow}>Shared team workspace</p>
                <h3># project-orion</h3>
              </header>
              <div className={styles.chatThread}>
                <div className={styles.chatBubble}>
                  <strong>You</strong>
                  <p>Working on the strategic plan.</p>
                </div>
                <div className={styles.assistPanel}>
                  <div className={styles.assistPanelTop}>
                    <span>You → Assist</span>
                    <span className={styles.teamViewTag}>Team view</span>
                  </div>
                  <p className={styles.promptLine}>
                    Can you suggest three potential risks we should consider
                    before entering a new market?
                  </p>
                  <ul>
                    <li>Uncertain demand</li>
                    <li>Competitor response</li>
                    <li>Regulatory challenges</li>
                  </ul>
                </div>
                <div className={styles.chatBubble}>
                  <strong>Jasmine</strong>
                  <p>Great points—especially the regulatory risk.</p>
                </div>
                <div className={styles.chatBubble}>
                  <strong>Sam</strong>
                  <p>Agree. I can pull examples from similar markets.</p>
                </div>
              </div>
            </div>
          </div>
          <ul className={styles.callouts}>
            <li>AI conversations are visible to the whole team.</li>
            <li>Teammates can chime in at any time.</li>
          </ul>
        </article>

        <article className={styles.workspaceCard}>
          <div className={styles.workspaceShell}>
            <Sidebar active="assist" />
            <div className={styles.workspaceMain}>
              <header className={styles.workspaceHeader}>
                <p className={styles.workspaceEyebrow}>Individual use</p>
                <h3>
                  Assist <span className={styles.aiTag}>AI</span>
                </h3>
              </header>
              <div className={styles.chatThread}>
                <div className={styles.chatBubble}>
                  <strong>You</strong>
                  <p>
                    Working on the strategic plan. Can you suggest three
                    potential risks we should consider before entering a new
                    market?
                  </p>
                </div>
                <div className={styles.chatBubbleAssist}>
                  <strong>Assist</strong>
                  <ul>
                    <li>Uncertain demand</li>
                    <li>Competitor response</li>
                    <li>Regulatory challenges</li>
                  </ul>
                </div>
                <div className={styles.privateFade} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
          <ul className={styles.callouts}>
            <li>AI conversations are only visible to you.</li>
          </ul>
        </article>
      </div>
    </figure>
  );
}
