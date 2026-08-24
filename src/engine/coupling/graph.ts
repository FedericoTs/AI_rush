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
 * `propagate` — moving `from` moves `to` by `delta * ratio`. Gear trains,
 *               neighbour-scrubbing faders.
 * `evict`     — setting `from` removes the least-recently-set `to`. Tag fields.
 *
 * The remaining three kinds in ARCHITECTURE.md (`redistribute`, `writeback`,
 * `relayout`) land in Phase 5 alongside the levels that need them. They are
 * deliberately absent from this union rather than stubbed, so a level cannot
 * quietly depend on an unimplemented edge.
 */
export type CouplingKind = "propagate" | "evict";

export interface Coupling {
  from: ControlId;
  to: ControlId;
  kind: CouplingKind;
  /** For `propagate`. 1 = full, 0.5 = half, -1 = inverted. */
  ratio?: number;
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
      next[from] = this.confine(from, (next[from] ?? 0) + d);
      for (const edge of this.outgoing.get(from) ?? []) {
        if (edge.kind !== "propagate") continue;
        const key = `${edge.from}->${edge.to}`;
        if (seen.has(key)) continue; // cycles are caught by solveOrder; don't hang here
        const scaled = d * (edge.ratio ?? 1);
        const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
        if (rounded === 0) continue;
        visit(edge.to, rounded, new Set(seen).add(key));
      }
    };
    visit(id, delta, new Set());
    return next;
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
