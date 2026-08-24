import { test as base, expect } from "@playwright/test";

export const SENSOR_CHOICE_KEY = "ai-rush:sensors";

/**
 * A page that has already answered the calibration screen.
 *
 * Every run now starts by asking once whether it may use motion, microphone
 * and camera — a browser hands none of those over outside a user gesture, so
 * without that screen six levels could only ever render their fallbacks.
 *
 * Which means every test that opens `/play` would otherwise have to dismiss it
 * first, and a suite full of that is a suite where the incidental setup buries
 * the thing being tested. This answers "no sensors" before the page loads, so
 * a spec that says `goto("/play")` gets a run.
 *
 * Playwright grants no permissions by default, so declining is also the
 * honest default: it is exactly the state of a player who tapped the same
 * button, and it means the whole suite is continuously proving the hard rule
 * from GAME_DESIGN P5 — deny everything and still get a complete, fair five
 * minutes.
 *
 * Tests that are *about* the screen import `test` from `@playwright/test`
 * directly and get it unanswered.
 */
export const test = base.extend<{ skipCalibration: void }>({
  skipCalibration: [
    async ({ page }, use) => {
      await page.addInitScript(
        ([key, value]) => {
          try {
            window.localStorage.setItem(key!, value!);
          } catch {
            /* Storage blocked. The screen appears; a test that cares says so. */
          }
        },
        [SENSOR_CHOICE_KEY, "declined"],
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect };
