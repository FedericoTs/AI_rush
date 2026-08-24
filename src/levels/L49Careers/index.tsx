"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopCard } from "@/ui/slop/Slop";
import s from "./styles.module.css";

interface Question {
  id: string;
  ask: string;
  options: readonly string[];
  answer: number;
  /** Shown after the answer, whichever way it went. */
  because: string;
}

/**
 * Three questions. Each one is a level you have already survived.
 *
 * Not a trick between them — this is the exam, and the exam is fair. Somebody
 * who reached this screen has been taught all three answers by the game
 * itself, which is the entire joke: the qualification for designing hostile
 * interfaces is having been through enough of them.
 */
const QUESTIONS: readonly Question[] = [
  {
    id: "dialog",
    ask: "A dialog offers a large green “Cancel” on the left and a red “⚠ Continue” on the right. The user wants to continue. Which button do they press?",
    options: ["The green one on the left", "The red one on the right", "Neither — it is a trick"],
    answer: 1,
    because: "The colour is decoration. The label is the contract.",
  },
  {
    id: "terms",
    ask: "A terms document grows by a fifth every time the reader passes 80%. How does the reader accept?",
    options: [
      "Keep scrolling; it must end eventually",
      "Press End to jump to the bottom",
      "Read the body text and find the line that says they already agreed",
    ],
    answer: 2,
    because: "It never ends. It was never a scrolling problem.",
  },
  {
    id: "pricing",
    ask: "A pricing page has three paid plans and a free one. Where is the free one?",
    options: [
      "In the comparison table",
      "Eight grey pixels below the fold",
      "There isn't one; that is why it is not shown",
    ],
    answer: 1,
    because: "It has to exist. It does not have to be found.",
  },
];

/**
 * The level that is not in the catalogue.
 *
 * There is no way to reach this from a menu. It opens when somebody clicks the
 * second "Careers" in the footer — the duplicate that has been sitting in the
 * phrase bank since the first level shipped, looking exactly like the kind of
 * mistake the thing generating these pages would make.
 *
 * So the reward for reading the slop is a job offer from the people who write
 * it, and the interview is three questions about the levels that taught you to
 * read it. It is the only completely honest form in the game apart from L36:
 * real labels, real focus rings, no lies anywhere, and a wrong answer costs
 * nothing but the truth about why it was wrong.
 *
 * It is a forbidden-tier level worth forbidden-tier points and no more,
 * exactly like every other one. Finding it is the prize.
 */
function Component({ onSolve, onFail, sfx }: LevelProps) {
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);

  const answered = QUESTIONS.every((q) => picked[q.id] !== undefined);
  const correct = QUESTIONS.filter((q) => picked[q.id] === q.answer).length;

  const submit = () => {
    setChecked(true);
    if (correct === QUESTIONS.length) {
      sfx.solve();
      onSolve();
      return;
    }
    sfx.fail();
    onFail("failed-interview");
  };

  return (
    <SlopCard plain>
      <div className={s.mast}>
        <span className={s.dept}>Careers</span>
        <span className={s.role}>Interface Designer · Remote</span>
      </div>

      <p className={s.lede}>
        You found this by reading a footer. That is most of the job.
      </p>
      <p className={s.sub}>
        Three questions. You have already been taught all three answers, by us, at some length.
      </p>

      <ol className={s.questions}>
        {QUESTIONS.map((q, n) => {
          const choice = picked[q.id];
          const right = choice === q.answer;
          return (
            <li className={s.q} key={q.id} data-question={q.id}>
              <p className={s.ask}>
                <span className={s.n}>{n + 1}</span>
                {q.ask}
              </p>
              <div className={s.options}>
                {q.options.map((opt, i) => (
                  <button
                    type="button"
                    key={opt}
                    className={`${s.opt} ${choice === i ? s.optOn : ""} ${
                      checked && choice === i ? (right ? s.optRight : s.optWrong) : ""
                    }`}
                    aria-pressed={choice === i}
                    onClick={() => {
                      setPicked((p) => ({ ...p, [q.id]: i }));
                      setChecked(false);
                      sfx.click();
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {checked && choice !== undefined && (
                <p className={`${s.because} ${right ? s.becauseOk : ""}`}>
                  {right ? "✓ " : "✕ "}
                  {q.because}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <button type="button" className={s.cta} disabled={!answered} onClick={submit}>
        {answered ? "Submit application" : "Answer all three"}
      </button>

      {checked && correct < QUESTIONS.length && (
        <p className={s.verdict} role="status">
          {correct} of {QUESTIONS.length}. Have another go — we are not in a hurry, and you have
          seen all of this before.
        </p>
      )}

      <p className={s.fine}>
        AI RUSH is not hiring. There is no company. There is a person who made this and a
        footer with two Careers links in it.
      </p>
    </SlopCard>
  );
}

export const L49: LevelModule = { meta, Component };
