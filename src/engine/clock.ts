/**
 * The run clock.
 *
 * P4: the chrome lies about everything except this. One clock, one source of
 * truth, never paused mid-run — not for permission prompts, not for popups.
 *
 * Time and scheduling are injected so tests can drive a run in microseconds
 * without a rAF loop, and so a headless agent harness (AGENT_ARENA.md) can
 * step it deterministically.
 */

export type Now = () => number;
export type Scheduler = (cb: (t: number) => void) => number;
export type Canceller = (handle: number) => void;

export interface ClockOptions {
  durationMs: number;
  now?: Now;
  schedule?: Scheduler | null;
  cancel?: Canceller;
}

export class GameClock {
  readonly durationMs: number;
  private readonly now: Now;
  private readonly schedule: Scheduler | null;
  private readonly cancel: Canceller;

  private startedAt = 0;
  private elapsed = 0;
  private penalties = 0;
  private running = false;
  private handle: number | null = null;

  private tickCbs = new Set<(remainingMs: number) => void>();
  private expireCbs = new Set<() => void>();

  constructor(opts: ClockOptions) {
    this.durationMs = opts.durationMs;
    this.now = opts.now ?? (() => performance.now());
    this.schedule =
      opts.schedule === undefined
        ? typeof requestAnimationFrame === "function"
          ? (cb) => requestAnimationFrame(cb)
          : null
        : opts.schedule;
    this.cancel =
      opts.cancel ??
      (typeof cancelAnimationFrame === "function" ? (h) => cancelAnimationFrame(h) : () => {});
  }

  get remainingMs(): number {
    return Math.max(0, this.durationMs - this.elapsedMs);
  }

  get elapsedMs(): number {
    const live = this.running ? this.now() - this.startedAt : 0;
    return this.elapsed + live + this.penalties;
  }

  get expired(): boolean {
    return this.remainingMs <= 0;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = this.now();
    this.loop();
  }

  stop(): void {
    if (!this.running) return;
    this.elapsed += this.now() - this.startedAt;
    this.running = false;
    if (this.handle !== null) {
      this.cancel(this.handle);
      this.handle = null;
    }
  }

  /** Skipping costs ten seconds. Nothing else moves the clock. */
  penalize(ms: number): void {
    this.penalties += ms;
    this.emit();
  }

  onTick(cb: (remainingMs: number) => void): () => void {
    this.tickCbs.add(cb);
    return () => this.tickCbs.delete(cb);
  }

  onExpire(cb: () => void): () => void {
    this.expireCbs.add(cb);
    return () => this.expireCbs.delete(cb);
  }

  /** Manual step, for tests and headless harnesses. */
  advance(ms: number): void {
    this.elapsed += ms;
    this.emit();
  }

  private loop(): void {
    if (!this.schedule) return;
    const step = () => {
      if (!this.running) return;
      this.emit();
      if (this.running) this.handle = this.schedule!(step);
    };
    this.handle = this.schedule(step);
  }

  private emit(): void {
    const remaining = this.remainingMs;
    for (const cb of this.tickCbs) cb(remaining);
    if (remaining <= 0 && this.running) {
      this.stop();
      for (const cb of this.expireCbs) cb();
    } else if (remaining <= 0) {
      for (const cb of this.expireCbs) cb();
    }
  }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
