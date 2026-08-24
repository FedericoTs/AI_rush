# Architecture

## 1. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 15**, App Router | Server-rendered OG images for share cards is the single highest-leverage feature for X virality. Nothing else gives us that for free. |
| UI | **React 19** + TypeScript (strict) | Level authoring is component authoring. |
| Styling | **Tailwind v4** + CSS custom properties | Chaos modifiers are implemented as CSS variable overrides on a wrapper — no per-level styling work. |
| Run state | **Zustand** | Levels must never touch the router or fetch. One store, imperative actions, trivially mockable in tests. |
| Animation | **Framer Motion** | The leaderboard slam and tally are the two moments that need real motion design. |
| Audio | **WebAudio** via a thin `SfxManager` | Needs preloading, a gesture-unlock, and per-level buses. `<audio>` tags won't cut it. |
| Backend | **Supabase** (Postgres + Edge Functions) | Leaderboard, submissions, score validation. See `BACKEND.md`. |
| Hosting | **Vercel** | Edge routes near the player; `ImageResponse` for OG cards. |
| Analytics | **PostHog** | We need per-level skip rate and solve time to balance. This is not optional — see §8. |
| Tests | **Vitest** + Testing Library, **Playwright** for the run loop | |

## 2. Directory layout

```
src/
  app/
    page.tsx                    # title screen
    play/page.tsx               # the run
    board/page.tsx              # leaderboard
    lab/page.tsx                # community submissions
    r/[seed]/page.tsx           # seeded challenge entry point
    api/
      run/start/route.ts        # issues a signed run token
      run/event/route.ts        # solve/skip/fail events
      run/finish/route.ts       # server-side score, leaderboard insert
      og/route.tsx              # dynamic share card (ImageResponse)
  engine/
    store.ts                    # Zustand run state
    deck.ts                     # seeded deck construction + constraints
    rng.ts                      # mulberry32 seeded RNG
    scoring.ts                  # pure functions, shared with the server
    clock.ts                    # the one honest thing
    chaos/
      ChaosProvider.tsx
      modifiers.ts
  input/
    useInput.ts                 # unified registry (see §4)
    adapters/
      pointer.ts  keyboard.ts  motion.ts
      audioIn.ts  camera.ts    haptics.ts
      orientation.ts  gamepad.ts
    capabilities.ts             # detection + permission choreography
  levels/
    registry.ts                 # id -> LevelModule, the only import surface
    L01ContinueToYourAccount/
      index.tsx
      meta.ts
      fallback.tsx              # degraded path, when it differs structurally
      L01.test.ts
    ...
  ui/
    slop/                       # the AI-slop design system (see §7)
    Leaderboard/  Tally/  ShareCard/
```

**Rule:** `levels/*` may import from `input/`, `ui/slop/`, and `engine/types`.
It may **not** import the store, the router, or anything in `app/`. A level is a
pure function of its props. This is what makes 36 of them tractable.

## 3. The level contract

```ts
export type Tier = 'annoying' | 'cursed' | 'unhinged' | 'forbidden'

export type InputCapability =
  | 'pointer' | 'keyboard' | 'touch' | 'multitouch'
  | 'motion'  | 'orientation'
  | 'audioIn' | 'audioOut' | 'camera' | 'haptics'
  | 'clipboard' | 'gamepad'

export interface LevelMeta {
  id: string                    // 'L11'
  slug: string                  // 'choose-a-secure-password'
  title: string                 // 'Choose A Secure Password 🦖'
  tier: Tier
  parSeconds: number
  /** Hard requirements. If unavailable, `fallback` is used. */
  requires: InputCapability[]
  /** Modifiers that must never be applied to this level. */
  incompatibleModifiers: ModifierId[]
  /** Credit line for community-designed levels. */
  creator?: { handle: string; submissionId: string }
}

export interface LevelProps {
  /** Call once. Extra calls are ignored by the engine. */
  onSolve(): void
  /** Level-internal reset. Costs no clock time. */
  onFail(reason?: string): void
  /** Deterministic per (runSeed, levelId). Never use Math.random in a level. */
  rng: Rng
  /** Active modifiers, for levels that want to acknowledge them. Most ignore this. */
  chaos: readonly ModifierId[]
  /** True when running the degraded path. */
  degraded: boolean
  input: InputHandle
  sfx: SfxHandle
}

export interface LevelModule {
  meta: LevelMeta
  Component: React.FC<LevelProps>
  /** Rendered instead of Component when a required capability is missing. */
  Fallback?: React.FC<LevelProps>
}
```

Notes:

- **`onSkip` is not in the contract.** Skip is chrome, owned by the engine, and
  a level must not be able to intercept it. (Level 36's joke depends on skip
  being genuinely reliable.)
- **No `Math.random()` in `levels/`.** Enforced by an ESLint rule. Seeds must
  reproduce runs exactly or the share mechanic is a lie.
- **No `setTimeout` for game logic** — levels get `rng` and a `useGameClock()`
  hook driven by a single `requestAnimationFrame` loop, so pausing, testing, and
  time-scaling all work.

## 4. The input abstraction layer

This is the load-bearing subsystem. It exists for three reasons:

1. **Testability.** Playwright cannot shake a phone. Every adapter is
   swappable for a scripted mock, so `L13` (gyro) is tested by feeding a
   recorded tilt trace.
2. **Capability gating.** The deck builder needs to know, *before dealing*, what
   this device can do — so a run on a desktop without a gyro never contains
   three fallback levels in a row.
3. **The mobile path.** When we wrap in Capacitor (§6), native sensor plugins
   replace web adapters at this seam and **no level code changes**.

```ts
const input = useInput({ motion: true, pointer: true })

input.motion.subscribe(({ beta, gamma, alpha }) => { ... })
input.pointer.subscribe(({ x, y, id, phase }) => { ... })   // unified mouse+touch
input.audioIn.rms()                                          // 0..1, smoothed
input.haptics.pattern([100, 50, 300])                        // no-ops safely
```

### Capability detection

Runs once at Calibration, cached in the store:

| Capability | Detection | Notes |
| --- | --- | --- |
| `motion` | `DeviceMotionEvent` present **and** a permission grant | iOS 13+ requires `requestPermission()` from a user gesture — this is why Calibration exists |
| `audioIn` | `getUserMedia({audio})` resolves **and** RMS > 0 within 4s | A granted-but-dead mic is common; treat as unavailable |
| `camera` | `getUserMedia({video})` resolves | |
| `haptics` | `'vibrate' in navigator` | **False on all iOS Safari.** Level 26's fallback is the majority path |
| `multitouch` | `navigator.maxTouchPoints >= 3` | |
| `audioOut` | Always assumed; unlock on first gesture | Muted-device detection is unreliable; we ship the visual fallback for #29 regardless |
| `gamepad` | `getGamepads()` | Bonus content only, never required |

### Permission choreography (Calibration / Level 0)

The clock does not start until Calibration completes. Calibration is styled as a
"System Compatibility Check ✨" with a fake progress bar, and it:

1. Unlocks WebAudio on the first tap.
2. Requests motion permission (iOS) behind a big obvious button.
3. Requests mic **only if** the run's dealt deck contains a mic level.
4. Requests camera **only if** the dealt deck contains a camera level.
5. Teaches SOLVE vs SKIP with a two-button demo.

Denials are non-events: the deck is re-dealt with fallbacks, no nagging, no
second prompt. **A player who denies everything gets a complete, fair,
5-minute run.** This is a hard requirement, not a nice-to-have.

## 5. Determinism and the seed

```
seed (uint32) → mulberry32 → deck order
                            → per-level rng streams (rng(seed ^ hash(levelId)))
                            → modifier schedule
```

Given the same seed and the same **capability profile**, two players get the
same run. Capability profile is part of the seed URL:
`/r/8F2A1C-M` where the suffix encodes which capability classes were available
(`M` = motion, `A` = audio-in, `C` = camera). This means "beat my run" links
work honestly across a desktop and a phone: the desktop player gets the
fallback variants of the same levels, in the same order, at the same par.

## 6. Mobile

**Phase A — PWA (Phase 7 in the roadmap).**

- `manifest.json`, installable, `display: fullscreen`
- Screen Wake Lock during a run
- Orientation lock to portrait (except #33, which unlocks it deliberately)
- `viewport-fit=cover` + safe-area insets — several levels put UI in the corners
  on purpose and must not collide with the notch
- Service worker caches level bundles so a run never stalls mid-level

**Phase B — Capacitor wrapper.**

Chosen over React Native / Expo because the entire game *is* DOM and CSS —
rewriting 36 levels in RN primitives is not a port, it's a second product.
Capacitor gives us:

- `@capacitor/haptics` → real haptics on iOS, unblocking Level 26's primary path
- `@capacitor/motion` → accelerometer without the permission dance
- Native audio session control (no autoplay restrictions, real "big sounds")
- Store presence, which for a game like this is most of the distribution

All four land at the **adapter seam** in `input/adapters/`. Estimated port cost
if the seam is respected: 2–3 days. Estimated cost if it isn't: weeks. This is
the main reason the input layer is built in Phase 1 rather than bolted on.

## 7. The slop design system

`ui/slop/` is a real design system that produces deliberately bad output. It is
*not* ad-hoc per level — consistency is what sells the "one AI generated all of
this" premise.

```
<SlopCard>        gradient border, three corner radii, glass over opaque
<SlopButton>      variant: 'primary' | 'destructive' | 'ghost' | 'decoy'
<SlopHeading>     auto-inserts a contextually-wrong emoji
<SlopMicrocopy>   over-explains; pulls from a phrase bank
<SlopFooter>      links to Privacy, Terms, Careers, Careers
<SlopSpinner>     never resolves
<SlopBadge>       "AI-Powered", "Enterprise-Grade", "SOC2 (pending)"
```

The phrase bank is seeded from the run RNG so microcopy varies between runs but
is reproducible from a seed.

## 8. Telemetry (and why it's load-bearing)

We cannot balance 36 levels by intuition. Per level, per run we record:

- `attempts`, `solveMs`, `failCount`, `skipped`
- which discoverable escape was used (each level reports its solve path)
- capability profile and degraded-path usage

Two questions this must answer weekly:

1. **Which levels are skipped >60%?** Those aren't hard, they're unreadable —
   the honest solve isn't discoverable in par. Fix or cut.
2. **Which levels are solved >95% first-try in under 5s?** Those are free
   points; move them down a tier or add a twist.

Events are pseudonymous (hashed run id, no handle linkage until the player
opts in by submitting a score).

## 9. Performance budget

Mobile web, mid-tier Android, is the constraint.

- Initial JS ≤ 180KB gzipped for title + engine. Levels are **route-independent
  dynamic imports**, prefetched one level ahead during the current level.
- Every level must hold 60fps on a 2021 mid-range Android. #11 (runner) and the
  particle modifiers are the risk cases; both get canvas rendering, not DOM.
- No level may allocate in its rAF loop. Object pools for particles and letters.
- Camera/mic streams are torn down the instant the level unmounts. A run that
  leaves the mic hot is a bug we will hear about publicly.

## 10. Open technical questions

| Question | Owner | Needed by |
| --- | --- | --- |
| Does iOS Safari's motion permission survive a PWA install, or re-prompt? | — | Phase 4 |
| Web Speech API coverage is poor on Android Firefox — do we cut #14's speech variant? | — | Phase 4 |
| Canvas vs WebGL for #11 at 60fps on low-end Android | — | Phase 2 |
| Can `ImageResponse` render the runner-dino share card, or do we pre-bake sprites? | — | Phase 3 |
