import type { LevelMeta } from "@/engine/types";
import s from "./play.module.css";

/**
 * "None of this is real."
 *
 * Four levels wear a genuine-looking sign-in page or checkout, because pillar
 * P1 says a level has to look real for the first second and a half. That is the
 * joke and it is also the one place the joke can cost somebody something: a
 * convincing password field is convincing to a password manager too, and a
 * player two minutes into a five-minute panic is exactly the person who types a
 * real address without thinking about it.
 *
 * The notice lives in the **chrome**, never inside the level. That distinction
 * is the whole design of it: the card keeps its straight face, and the frame
 * around the card — which is unmistakably the game's own furniture, mono type,
 * hazard colour — is what says the quiet part. Somebody who is about to type
 * their email sees it; somebody enjoying the level is not interrupted by it.
 *
 * It says what does not happen rather than "this is fake", because the fear
 * worth answering is specific: *where does what I type go?* Nowhere. It never
 * leaves the tab.
 */
export function FakeNotice({ collects }: { collects: NonNullable<LevelMeta["collects"]> }) {
  const credentials = collects.includes("credentials");
  const payment = collects.includes("payment");

  return (
    <p className={s.fakeNotice} role="note">
      <b>Not a real {payment && !credentials ? "checkout" : "sign-in"}.</b>{" "}
      {payment && "No card is read and nothing is charged. "}
      {credentials && "There is no account and no password to get wrong. "}
      Nothing you type here is sent anywhere, saved, or seen by us — it never leaves this tab.
    </p>
  );
}
