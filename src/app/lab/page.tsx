import Link from "next/link";
import { LabForm } from "./LabForm";
import s from "./lab.module.css";

export const metadata = {
  title: "The Lab",
  description:
    "Describe a level. If it gets built, your handle goes on it — in the game and on the share card of everyone it destroys.",
};

/**
 * Where the next levels come from.
 *
 * Fourteen levels is about nine runs before repetition shows. This game dies
 * of content starvation unless the expensive, creative part — the ideas —
 * comes from the people playing it.
 */
export default function Lab() {
  return (
    <main className={s.shell}>
      <div className={s.head}>
        <h1>
          The <i>Lab</i>
        </h1>
        <div className={s.sp} />
        <Link className={s.back} href="/">
          ← back
        </Link>
      </div>

      <p className={s.lede}>
        You think you can do worse? Describe a level. If it gets built, your handle goes on it —
        in the game, in the index, and on the share card of everyone it destroys.
      </p>

      <p className={s.aside}>
        We made this form usable on purpose, so you would actually finish it.
      </p>

      <LabForm />

      <ul className={s.rules}>
        <li>
          <b>It has to look normal first.</b> A screenshot of the first second should look like a
          boring form. Weird from frame one is a puzzle, not a joke.
        </li>
        <li>
          <b>It has to be beatable.</b> Under a minute, with an escape a player can actually find.
          A level nobody can solve is not cruel, it is broken.
        </li>
        <li>
          <b>Someone has to be able to name what went wrong.</b> &ldquo;It made me ___.&rdquo; If
          the failure is just &ldquo;it was confusing&rdquo;, there is nothing to post about.
        </li>
        <li>
          A human reads these on Fridays. Approved ideas appear here with your name on them;
          rejected ones say why, because quietly ignoring a good idea is how this stops working.
        </li>
      </ul>
    </main>
  );
}
