# Level Catalog

36 designed levels across 4 tiers, plus the chaos modifier system.

Each entry gives the **bit** (what the player discovers), the **honest solve**
(the intended path, which must always exist and always be discoverable within
the par time), the **fail state**, and the **degraded path** for devices or
players that can't use the primary input.

Format:

> **NN · Title** — `tier` · inputs · par · *what real UI it parodies*

---

## Tier: ANNOYING (100 pts, par ≤ 20s)

Openers. The player should solve most of these, feel clever, and be completely
unprepared for what's coming.

### 01 · Continue To Your Account
`annoying` · pointer · par 10s · *any confirm/cancel dialog*

**The bit.** A perfectly normal dialog: *"Ready to get started? ✨"*. Two
buttons. On the **left**, a large friendly green button reading **Cancel**. On
the **right**, in destructive red with a warning triangle, **Continue**. Every
instinct in the player's hands is wrong.

**Honest solve.** Click the red one. That's it.

**Fail state.** Clicking Cancel restarts the level with the buttons swapped
back to normal — and *then* swapped again 400ms later, after you've committed.

**Degraded path.** None needed.

**Why it's first.** It teaches the entire game's thesis in four seconds and
costs nothing. It is the handshake.

---

### 02 · One-Time Passcode
`annoying` · pointer, keyboard · par 20s · *6-cell OTP input*

**The bit.** Six OTP cells. The code `4 8 1 5 1 6` is displayed above. Typing
inserts the **entire string into whichever single cell is focused** —
`481516` crammed into box 1, overflowing visibly past its border. Autofocus
never advances. Paste does the same thing but worse.

**Honest solve.** Click each cell individually and type one digit. Six clicks,
six keystrokes.

**Fail state.** Submitting with a stuffed cell shows *"Invalid code. Please try
again! 😊"* and clears **all** cells.

**Degraded path.** None needed. On mobile the number pad also covers cells 5–6,
which is not a bug, it is content.

---

### 03 · Select Your Country
`annoying` · pointer · par 18s · *country dropdown*

**The bit.** A dropdown with all 195 countries — sorted by **population,
descending**. No search field. The list auto-scrolls upward at ~1 item/second
whether you touch it or not.

**Honest solve.** Fight the scroll and click the target. Or notice that typing
the first letter *does* jump — a standard native behaviour that this custom
listbox accidentally kept.

**Fail state.** Picking the wrong country inserts 5 fictional decoy countries
adjacent to the correct one.

**Degraded path.** None needed.

---

### 04 · How Many?
`annoying` · pointer · par 15s · *quantity stepper*

**The bit.** *"How many licenses do you need? (1–10)"* — implemented as a
slider with a range of **0 to 10,000**, no snapping, no numeric entry. The
target is 3.

**Honest solve.** Drag to roughly the right pixel, then use arrow keys /
long-press on the handle for ±1 increments. The fine control exists and is
undiscoverable for about 8 seconds, which is the joke.

**Fail state.** Submitting the wrong number charges you nothing and just says
*"Are you sure? That's 4,412 licenses."* — and resets to 5,000.

**Degraded path.** Touch: two-finger pinch on the slider = fine mode.

---

### 05 · Accept Our Cookies
`annoying` · pointer · par 20s · *consent banner*

**The bit.** 47 category toggles. **Reject All** turns everything **on**.
**Accept All** is disabled until every toggle is **off**. Three of the toggles
re-enable each other in a cycle (Analytics → Personalization → Analytics).

**Honest solve.** Break the cycle: toggle Personalization off *first*, then
Analytics, then the rest. Or find the `Legitimate Interest` sub-tab, where a
single "Object to all" link does the whole job — a real dark pattern, faithfully
reproduced.

**Fail state.** No fail. It just doesn't submit, forever, until you break the
cycle. The pressure is the clock.

**Degraded path.** None needed.

---

### 06 · Password Requirements
`annoying` · keyboard · par 25s · *live-validating password field*

**The bit.** The classic, escalated. Rules appear as you satisfy them:

- ✅ At least 8 characters
- ✅ One uppercase
- ⬜ Must contain a prime number of vowels
- ⬜ Must not contain today's day of the week
- ⬜ Must be exactly as long as your remaining skip count
- ⬜ Must contain one emoji currently trending (a live-looking, fake list)

**Honest solve.** All rules are satisfiable simultaneously and the checklist is
honest. `Xy🚀aei` type constructions get there. The last rule pins the length,
which makes it a small constraint-satisfaction puzzle rather than guesswork.

**Fail state.** A satisfied rule can *un*-satisfy when a later keystroke breaks
it — normal behaviour, maddening in aggregate.

**Degraded path.** Mobile emoji keyboard is fine; a fallback emoji picker
button appears after 10s.

---

### 07 · Just Checking You're Human
`annoying` · pointer · par 15s · *image CAPTCHA*

**The bit.** *"Select all squares with traffic lights."* A 3×3 grid. The images
**shuffle positions every 800ms**. Selections stay bound to *cells*, not
images.

**Honest solve.** Selections are validated on submit against current contents —
so you can also just wait for the shuffle to land favourably and mash. Or
notice that a long-press pauses the shuffle (undocumented, discoverable).

**Fail state.** Wrong selection → *"Let's try another one!"* → new grid, this
time 4×4.

**Degraded path.** None needed.

---

### 08 · Your Date Of Birth
`annoying` · pointer · par 22s · *date picker*

**The bit.** Three slot-machine wheels — day, month, year — each with different
friction and momentum. The year wheel runs 1900–2099 and **accelerates** the
longer you flick it. It never quite stops on its own.

**Honest solve.** Short deliberate flicks; the wheel snaps if you release with
near-zero velocity. Tapping a wheel once hard-stops it — the discoverable
escape.

**Fail state.** Wrong date → *"You must be 18 or older. You entered: 2094."*

**Degraded path.** Keyboard: arrow keys step wheels one notch.

---

### 09 · Almost There!
`annoying` · pointer · par 12s · *interstitial ad*

**The bit.** An unskippable 5-second "sponsor message" for a fake AI product.
Two close buttons: a 32px `✕` in the top-right that **restarts the level**, and
a 6px `✕` in the top-*left* that actually closes it. The big one drifts 2px
toward your cursor.

**Honest solve.** Wait 5s, hit the tiny left one. Or: pressing `Escape` works
and is never mentioned.

**Fail state.** Hitting the big ✕ restarts the 5 seconds. Twice and the ad
becomes 8 seconds.

**Degraded path.** Touch target for the tiny ✕ is 24px of invisible padding —
it looks 6px, it taps at 24px. We are cruel to the eyes, not the thumbs.

---

### 10 · Scroll To Accept
`annoying` · pointer · par 20s · *EULA scroll gate*

**The bit.** Accept is disabled until you scroll to the bottom of the terms.
The document **grows by 20% every time you pass 80%**. It also has rubber-band
overscroll that throws you back up.

**Honest solve.** Buried at ~60% is a line of body text reading *"By continuing
to not read this, you agree anyway — click here."* It's a real link. Scrolling
is a trap; reading is the solve. This is the level that teaches players to
actually look at the slop text, which pays off in tiers 3 and 4.

**Fail state.** None. It just never ends if you keep scrolling.

**Degraded path.** `End` key jumps to bottom — and the doc grows. Consistent.

---

## Tier: CURSED (250 pts, par ≤ 25s)

Where the game reveals it's a game.

### 11 · Choose A Secure Password 🦖
`cursed` · pointer/keyboard/touch · par 25s · *password field* — **flagship**

**The bit.** A password field, a strength meter, and — occupying the bottom 60%
of the card where the "password tips" should be — a fully playable endless
runner. A small dinosaur. Cacti. Letters float past at jump height.

The field's placeholder reads `SUNSET7`. You must collect those seven
characters **in order** by jumping into them. Wrong letter → the field clears
and the runner resets to zero. Cactus → same.

**Honest solve.** Learn the jump arc, take the letters in order, ignore the
decoys. Decoys are always visually adjacent on a QWERTY keyboard to the correct
next letter, which is a nasty and completely intentional detail.

**Fail state.** Full reset of both the runner and the field. Runner speed does
*not* escalate on retry — P3 (cruel, never tedious).

**Degraded path.** Desktop: `Space`/`↑`. Touch: tap anywhere. Both are
equivalent; no advantage either way.

**Why it's the flagship.** It is the level in the trailer, the level in the
screenshot, and the level people will name in their share text.

---

### 12 · Enter Your Phone Number
`cursed` · pointer · par 25s · *phone input* — **flagship**

**The bit.** Ten digit slots. Each is filled by its **own horizontal slider**
running 0–9. The sliders are laid out in a row so tightly that dragging one
scrubs its neighbour. Slider 4 is **inverted**. Slider 7 has 400ms of momentum
and overshoots.

**Honest solve.** Work right-to-left (neighbour interference propagates left,
so this is strictly easier and never signposted). Slider 7 settles if you
release early and let it coast in.

**Fail state.** Submit with a wrong digit → *"We've sent a code to
(415) 555-0…9-2-4?"* and the three sliders adjacent to the error re-randomize.

**Degraded path.** Keyboard: `Tab` between sliders, arrows to adjust. Slower
than dragging but reliable — a legitimate strategy, not a cheat.

---

### 13 · Confirm With A Gesture
`cursed` · motion (gyro) · par 20s · *"shake to undo"*

**The bit.** *"Tilt your device to pour the verification digits into the
field."* A spirit-level bubble UI. Four digits sit in a tray; tilting slides
them toward slots. Tilt too far and they **fall out the bottom**.

**Honest solve.** Small tilts, one digit at a time. The tray has a lip you can
rest against.

**Fail state.** Digits spill; tray refills after 1s.

**Degraded path.** No gyro / permission denied → the device becomes an on-screen
draggable phone illustration you tilt with the mouse. Same physics, same par.
The fallback is *funnier on desktop*, which is why we ship it rather than
swapping the level out.

---

### 14 · Please Confirm Verbally
`cursed` · audio-in (mic) · par 20s · *voice verification*

**The bit.** A volume meter with a narrow green band about 65–75% of the way
up. *"Hold your voice in the safe zone for 3 seconds."* Below the band:
nothing happens. Above it: **"PLEASE DO NOT SHOUT AT THE FORM."** and reset.

**Honest solve.** A steady mid-volume hum. Sustained, not loud. Every player
who tries this in public is doing it for us.

**Fail state.** Meter resets, band narrows by 10% (floor at 3 attempts).

**Degraded path.** Mic denied → the meter becomes a slider you must hold with
a finger while it drifts. Detected-silent-mic (no signal for 4s) auto-swaps to
the same fallback with a toast: *"We couldn't hear you. That's okay. 💜"*

---

### 15 · Type Your Full Name
`cursed` · keyboard · par 22s · *text input with autocorrect*

**The bit.** An aggressive autocomplete replaces the current word with a wrong
one **300ms after you stop typing**. The target string is shown above. Fast
typing outruns it.

**Honest solve.** Type continuously without pausing — or exploit it: the
corrector only fires on the *last* word, so typing a decoy word after your real
one shields it, then delete the decoy in one motion.

**Fail state.** No hard fail; the field just fights you.

**Degraded path.** Mobile keyboards vary; the level uses a custom on-screen
keyboard on touch to keep behaviour identical across devices.

---

### 16 · Backspace Unavailable
`cursed` · keyboard · par 20s · *text field*

**The bit.** Backspace **inserts** a character (the last one you typed, again).
Delete does nothing. There's no clear button. You must produce an exact string.

**Honest solve.** Select-and-type-over works. So does select-and-drag the text
out of the field. Both are real browser behaviours that the "broken" field
forgot to break.

**Fail state.** The string grows until it overflows the card, comically.

**Degraded path.** Touch: long-press select works identically.

---

### 17 · Notification Settings
`cursed` · pointer · par 25s · *toast notification stack*

**The bit.** Toasts pile up over the Submit button. Each has a dismiss ✕.
Dismissing one spawns **1.5 more on average**. The stack grows faster than you
can clear it.

**Honest solve.** Don't play whack-a-mole. There's a small bell icon in the
level's header — the mute toggle — that stops generation entirely. It's been
visible the whole time.

**Fail state.** None; the button is simply unreachable until you mute.

**Degraded path.** None needed.

---

### 18 · Drag To Unlock
`cursed` · pointer · par 25s · *slide-to-confirm*

**The bit.** A slide-to-unlock handle, but the track is a **winding maze**.
Leaving the track resets the handle to start. The maze's last corner is a
180° hairpin.

**Honest solve.** Slow, deliberate dragging. The track is 3px wider than it
renders — a small mercy, deliberately included so the hairpin is beatable.

**Fail state.** Reset to start. No escalation.

**Degraded path.** Keyboard: arrow keys move the handle one cell at a time
through the maze. Slower, always winnable.

---

### 19 · Upload A Photo Of Yourself
`cursed` · camera · par 25s · *KYC selfie capture*

**The bit.** A face-outline overlay. *"Position your face in the frame."* The
outline is **upside down** and drifts. Capture is enabled only when brightness
in the frame changes at a plausible "blink" cadence — i.e. you must blink, or
wave a hand over the lens, seven times.

**Honest solve.** Blink at it, or just wave. We are not running face detection —
it's a brightness delta counter, which means covering the lens with a finger
works, and discovering that is a legitimately delightful moment.

**Fail state.** Counter resets if 4s pass with no delta.

**Degraded path.** Camera denied or unavailable → an ASCII-art face appears and
you click its eyes seven times. Explicitly, this is funnier, and we're fine
with players preferring it.

---

### 20 · Confirm You're Nearby
`cursed` · touch (multi-touch) · par 20s · *biometric prompt*

**The bit.** *"Place three fingers on the sensor and hold for 3 seconds."* The
whole screen is the sensor. A popup spawns **directly underneath wherever your
fingers land**, and popups steal the touch.

**Honest solve.** Land three fingers in the corners — popups spawn centered on
the touch point and are 200px wide, so corner touches push the popup mostly
off-screen where it can't intercept.

**Fail state.** Timer resets on any lifted finger.

**Degraded path.** Mouse/desktop → hold left click, right click, and press
space simultaneously. Same idea, three-input coordination.

---

### 21 · Rate Your Experience
`cursed` · pointer · par 18s · *5-star rating*

**The bit.** Five stars. You must give exactly 4. The stars have hover-fill,
but the fill lags 500ms behind the cursor, and the click registers against the
**lagged** position, not the real one.

**Honest solve.** Aim ahead of where you want — lead the target, like a
duck-hunting problem. Or hover, wait for the lag to settle, then click.

**Fail state.** *"Thanks for the 2 stars! We'll do better. 💔"* → reset.

**Degraded path.** Touch has no hover, so on touch the level uses a dragging
thumb with the same lag. Identical difficulty.

---

## Tier: UNHINGED (500 pts, par ≤ 45s)

The player has now accepted that nothing is sacred. Attack the frame itself.

### 22 · Loading Your Dashboard
`unhinged` · pointer · par 30s · *progress bar*

**The bit.** A progress bar climbs to 99%, pauses, and falls to 12%. Forever.
In the corner, in 9px grey, is the *real* progress readout: `0.00%`. It is a
draggable number.

**Honest solve.** Drag the tiny number up to 100. It has friction and fights
back near the top.

**Fail state.** Releasing below 100 lets it decay.

**Degraded path.** Keyboard: focus it with Tab, arrow keys ratchet it up.

---

### 23 · AI Is Generating Your Code
`unhinged` · pointer, keyboard · par 40s · *LLM streaming response*

**The bit.** A chat bubble streams a response containing your verification
code. Mid-sentence it hallucinates and confidently gives a different code. Then
a third. A **Regenerate** button re-rolls the whole thing.

**Honest solve.** Only one of the streamed codes appears in *both* the response
body and the tiny "Sources" citation footer at the bottom. Regenerating is a
trap — the answer is already on screen, cross-referenced. Rewards the player
who learned to read the slop in level 10.

**Fail state.** Wrong code → the assistant apologizes profusely (*"You're
absolutely right — I apologize for the confusion!"*) and streams three more.

**Degraded path.** None needed.

---

### 24 · Select Your Plan
`unhinged` · pointer · par 35s · *pricing table*

**The bit.** Three pricing cards. The "Continue with Free" link is
`#f4f4f5` on `#ffffff` at 8px, positioned below the fold. Meanwhile a modal
offering 20% off appears every 6 seconds, and **each modal's dismiss button
subscribes you** to something, adding a new banner to the top that pushes the
page down.

**Honest solve.** Dismiss modals with `Escape` (doesn't subscribe you). Scroll
down. Find the grey link. Zooming the browser also reveals it, and we allow
zoom deliberately.

**Fail state.** Enough banners and the free link is pushed off the bottom
entirely — recoverable only by Escape-dismissing and letting banners expire.

**Degraded path.** Touch: swipe-down on a modal dismisses without subscribing.

---

### 25 · Two Cursors
`unhinged` · pointer · par 35s · *any form*

**The bit.** A trivial 3-field form. Your input drives **two cursors** — one
real, one a mirrored decoy. Only the real one clicks. They swap which is real
every 5 seconds, announced only by a 200ms flicker.

**Honest solve.** Park both cursors over redundant targets and click through
the ambiguity, or watch for the flicker and time your clicks in the first
second of each 5s window.

**Fail state.** Wrong-cursor clicks land on decoy fields that fill with
garbage; a Clear button exists.

**Degraded path.** Touch → two touch-ripples, one of which is real. Same
mechanic.

---

### 26 · Emergency Verification
`unhinged` · haptics, pointer · par 35s · *2FA push prompt*

**The bit.** Your device buzzes a Morse-ish pattern (3 short, 2 long). *"Tap
the pattern back to confirm it was you."* The pattern replays only twice.

**Honest solve.** Tap short/long rhythm on the single big button. Tolerance is
generous (±150ms) because rhythm input is genuinely hard.

**Fail state.** Wrong pattern → a new, longer pattern.

**Degraded path.** No `navigator.vibrate` (all of iOS Safari) → the pattern is
delivered as **screen flashes and audio pulses** instead. Detected at level
entry, no player-visible difference in difficulty. This level's degraded path
is the *majority* path and must be built first.

---

### 27 · Confirm Your Address
`unhinged` · pointer, keyboard · par 40s · *address autocomplete*

**The bit.** An address autocomplete where the dropdown suggestions are ranked
by **Levenshtein distance descending** — the more you type, the worse the
suggestions get. At 0 characters it shows the correct address first.

**Honest solve.** Click the field, type nothing, take the first suggestion.
Every instinct says type. The level is a 40-second par because that realization
takes people about 35 seconds.

**Fail state.** None; it's a realization puzzle.

**Degraded path.** None needed.

---

### 28 · Are You Still There?
`unhinged` · pointer · par 30s · *idle timeout modal*

**The bit.** An "Are you still there?" modal with a 10-second countdown, and a
**Yes** button that flees the cursor. Cornering it works, but the corner it
flees to is the one your cursor is closest to.

**Honest solve.** Stop moving. After 2 seconds of a stationary cursor, the
button walks toward it and can be clicked. Alternatively `Tab`+`Enter`. Both
are discoverable; neither is signposted.

**Fail state.** Timeout → *"Session expired for your security"* → the same
modal, 8 seconds.

**Degraded path.** Touch: the button flees your last tap, and holding a finger
still on screen for 2s summons it.

---

### 29 · Adjust Your Volume
`unhinged` · audio-out, pointer · par 35s · *volume control*

**The bit.** The form's fields are **invisible**. Moving the pointer plays a
tone; pitch encodes vertical position, stereo pan encodes horizontal. You must
find and fill three fields by ear.

**Honest solve.** Sweep the pointer, note where the tone goes pure (a field
edge produces a clean sine, elsewhere it's noisy). Three fields, roughly
laid out like a normal form, so priors help enormously.

**Fail state.** None. Time is the pressure.

**Degraded path.** Muted / no audio output → fields become invisible but reveal
a 40px glow on proximity. Visually solvable. Also the automatic path for Mercy
Mode.

---

### 30 · Complete Your Profile
`unhinged` · pointer, keyboard · par 40s · *multi-step wizard*

**The bit.** A 4-step wizard. Step 4's **Back** button returns you to step 1
and clears steps 2–3. Step 2 has a field that only validates against a value
shown on step 3.

**Honest solve.** Steps are reachable via the progress dots at the top, which
navigate *without* clearing. Everyone uses Back. Nobody uses the dots.

**Fail state.** Data loss, repeatedly, until the dots are found.

**Degraded path.** None needed.

---

## Tier: FORBIDDEN (1000 pts, par ≤ 45s)

Rare. Late-run. These should make people put the phone down and pick it back up.

### 31 · Mirror
`forbidden` · pointer, keyboard · par 40s · *login form*

**The bit.** A completely ordinary email/password login. The entire viewport is
**mirrored horizontally**, including the cursor's motion. Text renders
backwards. Typing works fine; reading and aiming do not.

**Honest solve.** Just do it. Humans are more adaptable than they think, and the
recovery arc — 20 seconds of flailing, then sudden competence — is the point.

**Fail state.** None. Pure motor challenge.

**Degraded path.** Excluded in Mercy Mode.

---

### 32 · Network Conditions
`forbidden` · pointer, keyboard · par 45s · *any form*

**The bit.** 900ms of artificial input lag on **everything**: keystrokes,
clicks, hover, scroll. A four-field form becomes a study in patience and
prediction.

**Honest solve.** Batch your actions. Type the whole field blind and wait.
Players who trust the lag beat it; players who repeat inputs double-enter
everything.

**Fail state.** Double-entry from impatience is the real enemy.

**Degraded path.** Excluded in Mercy Mode.

---

### 33 · This Page Is Rotating
`forbidden` · pointer · par 40s · *checkout form*

**The bit.** The card rotates continuously at 6°/second. After 30 seconds it's
fully inverted. Hit areas rotate with it, correctly.

**Honest solve.** Work fast, or tilt your head. On mobile, physically rotating
the device to counteract it works and is enormously satisfying — the gyro is
read and the rotation is *relative to the device*, so this is a real strategy.

**Fail state.** None. Time pressure.

**Degraded path.** Excluded in Mercy Mode. Reduced-motion users get a static
30° tilt instead of continuous rotation.

---

### 34 · Level Failed To Generate
`forbidden` · pointer · par 45s · *a broken page*

**The bit.** A stack trace. `Error: could not render <VerificationForm />`. The
form's elements are strewn across the page — an unstyled input here, a label
upside-down there, a submit button 3000px down. **The elements are draggable.**

**Honest solve.** Assemble the form: label above input, button below, then fill
it. Snap targets exist and highlight on proximity. You are debugging the AI's
output by hand, which is the most honest level in the game.

**Fail state.** None. It's a construction puzzle.

**Degraded path.** Keyboard: Tab cycles elements, arrows move them.

---

### 35 · Please Stand Up
`forbidden` · motion (accelerometer) · par 40s · *"prove you're human"*

**The bit.** *"For your security, please stand up and rotate 360°."* It reads
the accelerometer and it **genuinely means it** — the magnitude and duration
required correspond to actually standing and turning around.

**Honest solve.** Stand up. Turn around. In public. This is the level people
film.

**Fail state.** Insufficient motion → *"We detected that you are still
seated. 🪑"*

**Degraded path.** No motion sensors → *"Your device cannot detect standing.
Please stand up anyway. We trust you."* with a 6-second honour-system timer and
a checkbox reading *"I stood up."* This is arguably the better version.

---

### 36 · Sign In
`forbidden` · keyboard, pointer · par 20s · *a login form*

**The bit.** There is no bit. It is a completely normal, functional,
well-designed login form. Email, password, sign in. It works perfectly. It has
good contrast, a sensible tab order, and a real focus ring.

**Honest solve.** Fill it in. Click the button.

**Observed behaviour.** Playtesters will spend 30+ seconds looking for the
trick, tilting their phone, screaming at it, dragging the logo. Median solve
time is expected to be **4× par**.

**Fail state.** None.

**Note.** Appears in 1 run in 8, never before 2:00. Worth 1000 points. It is
the best joke in the game and it costs almost nothing to build, so it should
ship in Phase 2 as a morale-boosting freebie.

---

## Chaos Modifiers

Applied from minute 2:00, up to **2 concurrent**, drawn from the run seed. They
compose over *any* level via a wrapper component and CSS variables — no level
implements a modifier itself.

| Modifier | Effect | Excluded in Mercy |
| --- | --- | --- |
| `Drift` | The level card slowly translates; must be dragged back into view | |
| `Confetti` | Continuous particle rain obscures 15% of the viewport | |
| `Rainbow` | Hue-rotates the whole level at 0.4 Hz (never faster — photosensitivity) | |
| `Shrink` | The card scales to 60% over 20s, then back | |
| `Comic` | Every font becomes Comic Sans; letter-spacing randomizes | |
| `Slippery` | All draggables get 0.9 inertia and overshoot | |
| `Popups` | A dismissible popup every 8s, spawned away from active elements | |
| `Whisper` | A synthesized voice reads the level's microcopy aloud, badly | |
| `Fleeing` | The primary CTA drifts away from the pointer (mild version of #28) | ✅ |
| `Lag` | 350ms input delay (mild version of #32) | ✅ |
| `Mirror` | Horizontal flip (mild version of #31 — layout only, not text) | ✅ |
| `Rotate` | Static 15° tilt | ✅ |

**Composition rules.** A modifier is never applied to a level whose core
mechanic it duplicates (no `Lag` on #32, no `Mirror` on #31, no `Fleeing` on
#28). The deck builder enforces this at deal time.

---

## Content budget

| Tier | Count | Build cost each | Notes |
| --- | --- | --- | --- |
| annoying | 10 | 0.5–1 day | Mostly CSS and state; #05 and #10 are copy-heavy |
| cursed | 11 | 1–2 days | #11 needs a small game loop; #14/#19 need the sensor layer |
| unhinged | 9 | 1.5–2 days | #29 needs WebAudio; #34 needs drag-and-drop |
| forbidden | 6 | 1–2 days | #31–33 are mostly modifier infrastructure reused at full strength |

Ship order is in `ROADMAP.md`. The first eight built are #01, #02, #11, #12,
#28, #36, #22, #05 — because those eight alone constitute a playable, funny,
recordable 5-minute run.
