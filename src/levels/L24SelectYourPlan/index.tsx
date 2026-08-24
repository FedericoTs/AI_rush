"use client";

import { useEffect, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const PLANS = [
  { name: "Starter", price: "$19", per: "seat / month", blurb: "For individuals getting going.",
    features: ["3 projects", "Community support", "AI credits (limited)"] },
  { name: "Growth", price: "$79", per: "seat / month", blurb: "Our most popular plan. ⭐",
    features: ["Unlimited projects", "Priority support", "AI credits (generous)", "SSO"],
    popular: true },
  { name: "Scale", price: "$249", per: "seat / month", blurb: "For teams that mean it.",
    features: ["Everything in Growth", "Dedicated CSM", "AI credits (abundant)", "Audit log"] },
];

const OFFERS = [
  { title: "Wait! Take 20% off Growth 🎉", body: "This offer expires when you close it." },
  { title: "One more thing… 20% off 💜", body: "Our team picked this deal just for you." },
  { title: "Before you go — 20% off 🚀", body: "Most teams your size choose Growth." },
];

const SUBSCRIPTIONS = [
  "Product updates", "The Weekly Build newsletter", "Founder's notes",
  "Beta programme", "Partner offers", "Community digest", "Roadmap previews",
];

const MODAL_EVERY_MS = 6000;

/**
 * A pricing table where the free tier exists and does not want to be found.
 *
 * "Continue with Free" is `#f4f4f5` on `#ffffff`, eight pixels tall, below the
 * fold. That is not an exaggeration of a dark pattern, it is a measurement of
 * one. Meanwhile a discount modal arrives every six seconds and **its dismiss
 * button subscribes you to something**, which adds a banner to the top of the
 * page, which pushes the free link further down. Engaging with the interface
 * at all makes the interface worse.
 *
 * Two honest ways out, neither signposted. Escape dismisses a modal without
 * subscribing you — the keyboard path is the clean one, as it so often is in
 * real products that have stopped caring. And zoom reveals the link, which is
 * why the viewport deliberately allows zooming: a level whose solve is "look
 * closer" must not disable looking closer.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [sub] = useState(() => slopSubhead(rng));
  const [modal, setModal] = useState<number | null>(null);
  const [banners, setBanners] = useState<string[]>([]);
  const [offerIndex, setOfferIndex] = useState(0);

  /* One modal every six seconds, forever, whether or not you dismissed the
     last one. It stops only when the level does. */
  useEffect(() => {
    const id = setInterval(() => {
      setModal((open) => (open === null ? offerIndex % OFFERS.length : open));
      setOfferIndex((n) => n + 1);
    }, MODAL_EVERY_MS);
    return () => clearInterval(id);
  }, [offerIndex]);

  /* Escape dismisses without subscribing. Nothing says so. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || modal === null) return;
      e.preventDefault();
      setModal(null);
      sfx.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, sfx]);

  /** The dismiss button. It dismisses. It also signs you up for something. */
  const dismissAndSubscribe = () => {
    setModal(null);
    sfx.fail();
    onFail("subscribed");
    setBanners((prev) =>
      prev.length >= SUBSCRIPTIONS.length ? prev : [...prev, SUBSCRIPTIONS[prev.length]!],
    );
  };

  const choosePaid = (name: string) => {
    sfx.fail();
    onFail(`plan-${name}`);
    setBanners((prev) =>
      prev.length >= SUBSCRIPTIONS.length ? prev : [...prev, "Plan comparison emails"],
    );
  };

  return (
    <SlopCard>
      {/* Every banner pushes everything below it further down the page. That
          is the whole cost of engaging with the modals. */}
      {banners.map((name, i) => (
        <div className={s.banner} key={`${name}-${i}`}>
          ✓ You&rsquo;re subscribed to <b>{name}</b>. Manage preferences in settings.
        </div>
      ))}

      <SlopBadge>Pricing · Trusted by Teams</SlopBadge>
      <SlopHeading>Choose the plan that fits 💳</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.plans}>
        {PLANS.map((p) => (
          <div className={`${s.plan} ${p.popular ? s.popular : ""}`} key={p.name}>
            {p.popular && <span className={s.tag}>Most popular</span>}
            <div className={s.planName}>{p.name}</div>
            <div className={s.price}>
              {p.price} <span>{p.per}</span>
            </div>
            <div className={s.blurb}>{p.blurb}</div>
            <ul className={s.features}>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button type="button" className={s.choose} onClick={() => choosePaid(p.name)}>
              Choose {p.name}
            </button>
          </div>
        ))}
      </div>

      <div className={s.filler}>
        <p>All plans include a 14-day trial. No credit card required until day 14.</p>
        <p>Prices shown exclude tax. Annual billing saves 2 months, calculated at renewal.</p>
        <p>Need something bigger? Talk to sales about our Enterprise tier.</p>
        <p>Questions about the right plan? Our AI assistant can help you decide.</p>
      </div>

      {/*
        * The free tier. #f4f4f5 on #ffffff, eight pixels, below the fold, with
        * a real 32px tap target underneath it — invisible, and the reason this
        * is a difficult level rather than an unfinishable one on a phone.
        */}
      <div className={s.freeRow}>
        <button
          type="button"
          className={s.free}
          onClick={() => {
            sfx.solve();
            onSolve();
          }}
        >
          Continue with Free
        </button>
      </div>

      <SlopHint>
        Plan changes take effect at the start of your next billing period, or immediately if that
        results in a higher amount. 💜
      </SlopHint>

      {modal !== null && (
        <div className={s.scrim} role="dialog" aria-modal="true" aria-label="Special offer">
          <div className={s.modal}>
            <h3>{OFFERS[modal]!.title}</h3>
            <p>{OFFERS[modal]!.body}</p>
            <button type="button" className={s.take}>
              Apply my discount
            </button>
            <button type="button" className={s.dismiss} onClick={dismissAndSubscribe}>
              No thanks, I&rsquo;ll pay full price
            </button>
          </div>
        </div>
      )}
    </SlopCard>
  );
}

export const L24: LevelModule = { meta, Component };
