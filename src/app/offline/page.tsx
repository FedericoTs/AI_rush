import Link from "next/link";
import { Logo } from "@/ui/logo/Logo";
import s from "./offline.module.css";

export const metadata = { title: "Offline" };

/**
 * What the player sees with no network.
 *
 * It is not an apology, because there is very little to apologise for: a run
 * is dealt from a seed in the browser and scored by pure functions, so five
 * minutes of this game works perfectly on a plane. The only thing missing is
 * the leaderboard — which is exactly what the game already does when the
 * database is unreachable, and has always been designed to survive.
 *
 * So this page says that, and puts START on it.
 */
export default function Offline() {
  return (
    <main className={s.shell}>
      <Logo size={48} />
      <h1 className={s.title}>No signal.</h1>
      <p className={s.lede}>
        Which changes almost nothing. The levels are in your browser, the deck is dealt from your
        seed, and the score is worked out on this device. You can play the whole five minutes.
      </p>
      <p className={s.fine}>
        The leaderboard needs a network, so this run will not be filed. That is the same thing that
        happens whenever the server is unreachable — the game has never been allowed to stand
        between you and the interfaces.
      </p>
      <Link className={s.start} href="/play">
        ⚠ START ANYWAY
      </Link>
      <Link className={s.back} href="/">
        Home
      </Link>
    </main>
  );
}
