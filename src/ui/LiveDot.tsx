import s from "./livedot.module.css";

/**
 * How busy the place is right now.
 *
 * "Playing now" counts runs opened in the last six minutes that never
 * finished. A run is five minutes long, so that window is either someone
 * mid-run or someone who walked away seconds ago — close enough to be true,
 * and it never inflates the way a naive session count would.
 *
 * When it is zero it says so rather than hiding, because "0 playing" on a new
 * game is honest and "be the first" is a better invitation than a blank space.
 *
 * The other two only ever go up. "Runs today" used to sit between them and was
 * a rolling twenty-four hours of *finished* runs, so it read zero almost all
 * the time — a counter whose job is to say the place is alive, reporting that
 * it is not. A total cannot do that: three stats, one live and two cumulative,
 * and none of them decay overnight.
 *
 * "Runs played" means played, not opened: a run counts once it reaches the end
 * or leaves mid-run and says so. A row exists from the moment the play page
 * loads, and counting those would make a bounce look like a game.
 */
export function LiveDot({
  playingNow,
  runs,
  players,
}: {
  playingNow: number;
  runs: number;
  players: number;
}) {
  return (
    <div className={s.wrap}>
      <span className={`${s.stat} ${playingNow > 0 ? s.live : ""}`}>
        <span className={s.dot} aria-hidden="true" />
        <b>{playingNow.toLocaleString()}</b> playing now
      </span>
      <span className={s.stat}>
        <b>{runs.toLocaleString()}</b> runs played
      </span>
      <span className={s.stat}>
        <b>{players.toLocaleString()}</b> on the board
      </span>
    </div>
  );
}
