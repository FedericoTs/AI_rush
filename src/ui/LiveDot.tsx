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
 */
export function LiveDot({
  playingNow,
  runsToday,
  players,
}: {
  playingNow: number;
  runsToday: number;
  players: number;
}) {
  return (
    <div className={s.wrap}>
      <span className={`${s.stat} ${playingNow > 0 ? s.live : ""}`}>
        <span className={s.dot} aria-hidden="true" />
        <b>{playingNow.toLocaleString()}</b> playing now
      </span>
      <span className={s.stat}>
        <b>{runsToday.toLocaleString()}</b> runs today
      </span>
      <span className={s.stat}>
        <b>{players.toLocaleString()}</b> on the board
      </span>
    </div>
  );
}
