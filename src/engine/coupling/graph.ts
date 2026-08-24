/**
 * The coupled-mechanism engine (LEVELS.md L37–L48).
 *
 * Twelve levels are one engine in twelve costumes: a small directed graph of
 * controls where changing one changes others. A gear-train PIN, ten faders
 * that scrub their neighbours, a tag field that evicts what you just added —
 * same machinery, different skin.
 *
 * The family rule, enforced here rather than trusted: **every coupled system
 * must be solvable by ordering.** There must exist a sequence in which each
 * move is final. A coupled system without one is a slot machine, and slot
 * machines are not funny.
 */

export type ControlId = string;

/**
 * `propagate`    — moving `from` moves `to` by `delta * ratio`. Gear trains,
 *                  neighbour-scrubbing faders, a date range that drags its own
 *                  far end along.
 * `evict`        — setting `from` removes the least-recently-set `to`. Tag
 *                  fields. Handled by the level, which owns the recency order;
 *                  the edge is here so the graph knows the relationship exists.
 * `redistribute` — whatever `from` gains, its targets give up, split in
 *                  proportion to what they currently hold. Three sliders that
 *                  sum to a constant.
 * `writeback`    — setting `from` *sets* `to` to `map(fromValue)`. A child that
 *                  helpfully overwrites its own parent: pick a city and the
 *                  country changes under you.
 *
 * `relayout` from `ARCHITECTURE.md` is deliberately still absent. It moves
 * pixels rather than values, and putting a scroll position into a graph of
 * numbers would be a category error — L48 owns its own layout cruelty.
 */
export type CouplingKind = "propagate" | "evict" | "redistribute" | "writeback";

export interface Coupling {
  from: ControlId;
  to: ControlId;
  kind: CouplingKind;
  /** For `propagate`. 1 = full, 0.5 = half, -1 = inverted. */
  ratio?: number;
  /**
   * For `writeback`: what the parent becomes when the child is set. Pure and
   * total — every value the child can hold must map to something.
   */
  map?: (fromValue: number) => number;
}

export interface ControlSpec {
  id: ControlId;
  min: number;
  max: number;
  /** Values wrap around instead of clamping. Dials wrap; faders don't. */
  wrap?: boolean;
}

export type ControlState = Readonly<Record<ControlId, number>>;

export class CouplingGraph {
  readonly controls: ReadonlyArray<ControlSpec>;
  readonly couplings: ReadonlyArray<Coupling>;
  private readonly byId: Map<ControlId, ControlSpec>;
  private readonly outgoing: Map<ControlId, Coupling[]>;

  constructor(controls: ControlSpec[], couplings: Coupling[]) {
    this.controls = controls;
    this.couplings = couplings;
    this.byId = new Map(controls.map((c) => [c.id, c]));
    this.outgoing = new Map();
    for (const c of couplings) {
      if (!this.byId.has(c.from) || !this.byId.has(c.to)) {
        throw new Error(`coupling references unknown control: ${c.from} -> ${c.to}`);
      }
      const list = this.outgoing.get(c.from) ?? [];
      list.push(c);
      this.outgoing.set(c.from, list);
    }
  }

  private confine(id: ControlId, value: number): number {
    const spec = this.byId.get(id)!;
    const span = spec.max - spec.min + 1;
    if (spec.wrap) return spec.min + (((value - spec.min) % span) + span) % span;
    return Math.max(spec.min, Math.min(spec.max, value));
  }

  /**
   * Apply a delta to one control and let it cascade. Propagation follows the
   * graph transitively, which is what makes a four-dial gear train behave like
   * a gear train rather than four independent dials.
   */
  apply(state: ControlState, id: ControlId, delta: number): ControlState {
    if (!this.byId.has(id)) throw new Error(`unknown control: ${id}`);
    const next: Record<ControlId, number> = { ...state };

    const visit = (from: ControlId, d: number, seen: Set<string>) => {
      const before = next[from] ?? 0;
      next[from] = this.confine(from, before + d);
      /* What the control *actually* moved, which is not what was asked for
         when it hit a stop. Everything downstream keys off the real change —
         a slider pinned at its maximum must not go on taking from its
         neighbours as if it were still climbing. */
      const applied = next[from] - before;

      for (const edge of this.outgoing.get(from) ?? []) {
        const key = `${edge.from}->${edge.to}`;
        if (seen.has(key)) continue; // cycles are caught by solveOrder; don't hang here

        if (edge.kind === "propagate") {
          const scaled = d * (edge.ratio ?? 1);
          const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
          if (rounded === 0) continue;
          visit(edge.to, rounded, new Set(seen).add(key));
        } else if (edge.kind === "writeback") {
          const want = edge.map ? edge.map(next[from]!) : next[from]!;
          next[edge.to] = this.confine(edge.to, want);
        }
      }

      /* Redistribution is settled across the whole target set at once rather
         than edge by edge: "the others give up what this one gained" is a
         statement about the group, and handling one edge at a time would let
         the first target absorb everything. */
      if (applied !== 0) {
        const targets = (this.outgoing.get(from) ?? [])
          .filter((e) => e.kind === "redistribute")
          .map((e) => e.to);
        if (targets.length > 0) {
          /* `share` returns the part of the pool it could not place. Whatever
             the others could not absorb, this control does not get to keep —
             otherwise a slider whose neighbours are already at zero would go
             on climbing and the "sums to a constant" the level is built on
             would quietly stop being true.

             `+ shortfall` rather than `-`: the pool is `-applied`, so an
             unplaced pool of −4 means four units of the gain were never paid
             for, and adding it back is what hands them in. */
          const shortfall = this.share(next, targets, -applied);
          if (shortfall !== 0) next[from] = this.confine(from, next[from]! + shortfall);
        }
      }
    };

    visit(id, delta, new Set());
    return next;
  }

  /**
   * Hand `pool` out across `targets` in proportion to what each already holds,
   * and return whatever could not be placed.
   *
   * Proportional-to-current is the property the level is actually about: it is
   * why nudging a small value barely moves a large one but not the reverse, and
   * therefore why approaching a target in descending order converges while
   * ascending order oscillates. That is a real consequence of the arithmetic
   * rather than a rule bolted on, which is what makes it findable by feel.
   *
   * Integers only, so it loops: proportional shares round, rounding leaves a
   * remainder, and a remainder silently dropped is a "constant" sum that
   * drifts. Each pass places what it can and the next one re-splits the rest
   * among whoever still has room.
   */
  private share(next: Record<ControlId, number>, targets: ControlId[], pool: number): number {
    for (let pass = 0; pass < 8 && pool !== 0; pass++) {
      const room = targets.map((t) => {
        const spec = this.byId.get(t)!;
        return pool > 0 ? spec.max - next[t]! : next[t]! - spec.min;
      });
      const total = room.reduce((a, b) => a + b, 0);
      if (total <= 0) break;

      /* Weight by holdings on the way down and by headroom on the way up —
         both reduce to "whoever has the most gives or takes the most". */
      const weights = targets.map((t, i) => (pool < 0 ? Math.max(0, next[t]!) : room[i]!));
      const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

      let placed = 0;
      for (let i = 0; i < targets.length && pool - placed !== 0; i++) {
        const remaining = pool - placed;
        const ideal = (pool * weights[i]!) / weightSum;
        /* Round toward zero so no single target overshoots the pool; the
           remainder is picked up by the next pass. */
        let give = Math.trunc(ideal);
        if (give === 0 && remaining !== 0 && room[i]! > 0) give = remaining > 0 ? 1 : -1;
        give = Math.max(-room[i]!, Math.min(room[i]!, give));
        if (Math.abs(give) > Math.abs(remaining)) give = remaining;
        next[targets[i]!] = this.confine(targets[i]!, next[targets[i]!]! + give);
        placed += give;
      }
      if (placed === 0) break;
      pool -= placed;
    }
    return pool;
  }

  /** Set a control to an exact value, cascading the implied delta. */
  set(state: ControlState, id: ControlId, value: number): ControlState {
    return this.apply(state, id, value - (state[id] ?? 0));
  }

  initial(fill = 0): ControlState {
    const s: Record<ControlId, number> = {};
    for (const c of this.controls) s[c.id] = this.confine(c.id, fill);
    return s;
  }
}
