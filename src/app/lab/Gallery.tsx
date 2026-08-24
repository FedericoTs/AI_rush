"use client";

import { useState } from "react";
import Link from "next/link";
import { Handle } from "@/ui/Handle";
import { ballotId, rememberVote, useVoted } from "@/lib/ballot";
import type { LabCard } from "@/lib/db";
import s from "./gallery.module.css";

/**
 * The gallery.
 *
 * Every word on these cards was typed by a stranger and is rendered as text —
 * never as HTML, never anywhere near a code generator. That is the security
 * boundary in `COMMUNITY_LEVELS.md` §5, and React's default escaping is doing
 * the enforcing, so nothing in here may ever grow a `dangerouslySetInnerHTML`.
 *
 * The cards deliberately show the *mechanic* in full. This is the one surface
 * in the whole product that spoils levels on purpose: a gallery that hid what
 * the ideas were would be a voting booth with the ballot papers face down.
 */
export function Gallery({ cards, sort }: { cards: LabCard[]; sort: string }) {
  if (cards.length === 0) {
    return (
      <p className={s.empty}>
        {sort === "shipped"
          ? "Nothing from the Lab has shipped yet. The first one will have somebody's handle on it."
          : "Nothing approved yet. The queue is read on Fridays — yours could be the first card here."}
      </p>
    );
  }

  return (
    <div className={s.grid}>
      {cards.map((card) => (
        <Card card={card} key={card.id} />
      ))}
    </div>
  );
}

function Card({ card }: { card: LabCard }) {
  const voted = useVoted();
  const [votes, setVotes] = useState(card.votes);
  const [mine, setMine] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  /* `voted` is empty until the effect runs, so the button reads from the
     server's row on first paint and corrects itself after mount. `mine`
     overrides both once this browser has actually pressed it. */
  const isMine = mine ?? voted.has(card.id);
  const votable = card.status === "approved" || card.status === "shipped";

  async function toggle() {
    const ballot = ballotId();
    if (!ballot || busy) return;
    setBusy(true);
    const next = !isMine;
    try {
      const res = await fetch("/api/lab/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, ballot, remove: !next }),
      });
      const data = (await res.json()) as { ok: boolean; votes?: number };
      if (data.ok) {
        /* The count comes back from a recount in Postgres rather than being
           incremented here, so a double tap or a retry cannot leave the number
           on screen disagreeing with the number in the table. */
        if (typeof data.votes === "number") setVotes(data.votes);
        setMine(next);
        rememberVote(card.id, next);
      }
    } catch {
      /* Leave the button as it was. A vote is not worth an error dialog. */
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={s.card} data-status={card.status}>
      <header className={s.head}>
        <Handle handle={card.x_handle} size={22} />
        <span className={s.sp} />
        {card.status === "shipped" && card.shipped_level_id && (
          <Link className={s.shipped} href={`/levels/${card.shipped_level_id}`}>
            SHIPPED · {card.shipped_level_id}
          </Link>
        )}
        {card.status === "rejected" && <span className={s.notShipping}>NOT SHIPPING</span>}
      </header>

      <h3 className={s.title}>{card.title}</h3>
      <p className={s.parodies}>{card.parodies}</p>
      <p className={s.mechanic}>{card.mechanic}</p>

      {card.inputs.length > 0 && (
        <div className={s.inputs}>
          {card.inputs.map((i) => (
            <span key={i}>{i}</span>
          ))}
        </div>
      )}

      {/*
        * The public no.
        *
        * `COMMUNITY_LEVELS.md`: silently ignoring the top-voted idea is how
        * community programs lose trust. So a rejection is a card with the
        * reason on it, in the same list as everything else — not a deletion.
        */}
      {card.status === "rejected" && card.rejection_note && (
        <p className={s.note}>
          <b>Why not:</b> {card.rejection_note}
        </p>
      )}

      <footer className={s.foot}>
        {votable ? (
          <button
            className={`${s.vote} ${isMine ? s.voted : ""}`}
            onClick={toggle}
            disabled={busy}
            aria-pressed={isMine}
            data-testid={`vote-${card.id}`}
          >
            <span className={s.arrow} aria-hidden="true">
              ▲
            </span>
            <span className={s.count}>{votes}</span>
            <span className={s.voteLabel}>{isMine ? "voted" : "build this"}</span>
          </button>
        ) : (
          <span className={s.deadCount}>{votes} votes before we said no</span>
        )}

        <span className={s.sp} />

        {reporting ? (
          <Report id={card.id} onDone={() => setReporting(false)} />
        ) : (
          <button className={s.report} onClick={() => setReporting(true)}>
            not my handle
          </button>
        )}
      </footer>
    </article>
  );
}

/**
 * The takedown.
 *
 * Handles are typed and never verified, which is what keeps the intake
 * frictionless — and this is the bill for that choice. It is one field and one
 * button because the person using it is annoyed and should not have to fill in
 * a form to get their name off somebody else's paragraph.
 */
function Report({ id, onDone }: { id: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function send() {
    setState("sending");
    try {
      const res = await fetch("/api/lab/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason }),
      });
      const data = (await res.json()) as { ok: boolean };
      setState(data.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className={s.reportDone}>Hidden. A human will look at it.</span>;
  }

  return (
    <span className={s.reportBox}>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional: what's wrong?"
        aria-label="Why this should come down"
        maxLength={600}
      />
      <button onClick={send} disabled={state === "sending"}>
        {state === "error" ? "Try again" : "Take it down"}
      </button>
      <button className={s.cancel} onClick={onDone}>
        cancel
      </button>
    </span>
  );
}
