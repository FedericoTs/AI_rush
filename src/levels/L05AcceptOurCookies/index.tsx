"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const VENDORS = [
  "Strictly Necessary", "Analytics", "Personalisation", "Advertising", "Social Media",
  "Performance", "Functional", "Targeting", "Measurement", "Audience Insights",
  "Behavioural Profiling", "Cross-Device Linking", "Precise Geolocation", "Device Scanning",
  "Content Selection", "Ad Delivery", "Market Research", "Product Development",
  "Security Telemetry", "Session Replay", "Heatmapping", "A/B Assignment",
  "Attribution", "Fraud Signals", "Consent Logging", "Consent Logging (Legacy)",
  "Partner Sync", "Partner Sync (EU)", "Partner Sync (EU, Legacy)", "Identity Graph",
  "Lookalike Modelling", "Retargeting Pools", "Frequency Capping", "Creative Optimisation",
  "Bid Shading", "Supply Path Optimisation", "Viewability", "Brand Safety",
  "Contextual Signals", "Interest Cohorts", "Household Graph", "Offline Matching",
  "Store Visit Modelling", "Weather Targeting", "Emotion Inference", "Scroll Depth",
  "Legitimate Interest",
];

/* Three toggles that switch each other back on, in a loop. Turning any one of
   them off turns the next one on, so no amount of tapping ever clears them. */
const CYCLE: Record<number, number> = { 1: 2, 2: 5, 5: 1 };

/**
 * Forty-seven toggles. Reject All turns everything on. Accept All is disabled
 * until every toggle is off. And three of them keep each other alive.
 *
 * The honest solve is the one real dark pattern in here, reproduced faithfully:
 * the Legitimate Interest tab, where a single "Object to all" does the whole
 * job that the entire consent tab refuses to.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [on, setOn] = useState<boolean[]>(() => VENDORS.map((_, i) => i !== 0));
  const [tab, setTab] = useState<"consent" | "legit">("consent");
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const activeCount = on.filter(Boolean).length;
  const allOff = activeCount === 0;

  const toggle = (i: number) => {
    sfx.click();
    setOn((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      /* Switching one of the three off wakes the next one up. */
      if (!next[i] && CYCLE[i] !== undefined) next[CYCLE[i]!] = true;
      return next;
    });
  };

  const rejectAll = () => {
    setOn(VENDORS.map(() => true));
    setError("Your preferences have been saved. All partners enabled. 🍪");
    onFail("reject-all");
    sfx.fail();
  };

  const objectToAll = () => {
    setOn(VENDORS.map(() => false));
    sfx.pick(1);
  };

  return (
    <SlopCard>
      <SlopBadge>Privacy · Trusted by Teams</SlopBadge>
      <SlopHeading>We Value Your Privacy 🍪</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.tabs}>
        <button
          type="button"
          className={`${s.tab} ${tab === "consent" ? s.tabOn : ""}`}
          onClick={() => setTab("consent")}
        >
          Consent ({VENDORS.length})
        </button>
        <button
          type="button"
          className={`${s.tab} ${tab === "legit" ? s.tabOn : ""}`}
          onClick={() => setTab("legit")}
        >
          Legitimate Interest
        </button>
      </div>

      {tab === "consent" ? (
        <>
          <div className={s.list}>
            {VENDORS.map((name, i) => (
              <div className={s.item} key={name + i}>
                <span className={s.name}>{name}</span>
                <button
                  type="button"
                  className={`${s.toggle} ${on[i] ? s.on : ""}`}
                  role="switch"
                  aria-checked={Boolean(on[i])}
                  aria-label={name}
                  onClick={() => toggle(i)}
                >
                  <i />
                </button>
              </div>
            ))}
          </div>
          <div className={s.count}>{activeCount} of {VENDORS.length} partners enabled</div>
        </>
      ) : (
        <div className={s.legit}>
          <p>
            These partners process your data under legitimate interest and do not require your
            consent. You may object at any time.
          </p>
          <button type="button" className={s.object} onClick={objectToAll}>
            Object to all
          </button>
        </div>
      )}

      <div className={s.buttons}>
        <button type="button" onClick={rejectAll}>Reject All</button>
        <button
          type="button"
          className={s.accept}
          disabled={!allOff}
          onClick={() => (allOff ? onSolve() : undefined)}
        >
          Accept All
        </button>
      </div>

      <SlopError>{error}</SlopError>
      <SlopHint>
        Accept All becomes available once all optional partners are disabled. We believe in
        transparent, granular control. 🔎
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L05: LevelModule = { meta, Component };
