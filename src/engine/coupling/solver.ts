/**
 * Proving a coupled level is beatable.
 *
 * Brute force is not an option — ten faders of ten values is 10^10 states.
 * But the family rule gives us something much better than search: if the
 * propagation graph is acyclic, a topological order exists in which every
 * control only disturbs controls that come *later*. Setting them in that order
 * means each move is final, and the solve is a proof rather than a hunt.
 *
 * That is exactly the discovery the player is making. L37's is left-to-right;
 * L12's is right-to-left. Same theorem, different graph.
 */

import type { ControlId, ControlState, CouplingGraph } from "./graph";

export interface SolvePlan {
  order: ControlId[];
  moves: Array<{ id: ControlId; to: number }>;
}

/**
 * Topological order of the propagation graph: a control appears before
 * everything it disturbs. Returns null if the graph has a cycle, which means
 * no ordering makes moves final and the level is unshippable.
 */
export function solveOrder(graph: CouplingGraph): ControlId[] | null {
  const indegree = new Map<ControlId, number>();
  const edges = new Map<ControlId, ControlId[]>();
  for (const c of graph.controls) {
    indegree.set(c.id, 0);
    edges.set(c.id, []);
  }
  /*
   * Which edges constrain the order.
   *
   * `propagate` and `writeback` both mean "moving this one moves that one", so
   * both are real ordering constraints: set the cause before the effect and the
   * effect is still yours to set afterwards.
   *
   * `redistribute` is deliberately in here too, and it is what makes L44
   * correctly report as *not* orderable. Those edges are declared in both
   * directions — each slider takes from the others — so they form a cycle, and
   * a cycle is exactly the truth: no sequence of moves is final when every
   * control moves every other one. That level converges instead, and proves
   * itself that way. Leaving redistribute out would have produced a topological
   * order that looked valid and silently wasn't.
   *
   * `evict` is excluded: the level owns recency, not the graph.
   */
  for (const e of graph.couplings) {
    if (e.kind === "evict") continue;
    edges.get(e.from)!.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }

  /* Deterministic tie-breaking: declaration order. A stable plan matters —
     tests and the agent harness both compare plans across runs. */
  const ready = graph.controls.filter((c) => indegree.get(c.id) === 0).map((c) => c.id);
  const order: ControlId[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const to of edges.get(id) ?? []) {
      const d = (indegree.get(to) ?? 0) - 1;
      indegree.set(to, d);
      if (d === 0) ready.push(to);
    }
  }

  return order.length === graph.controls.length ? order : null;
}

/**
 * Construct the honest solve and verify it lands on the target. This is the
 * check that runs over thousands of seeds in CI: shipping an unsolvable start
 * state turns the joke into a bug report.
 */
export function proveSolvable(
  graph: CouplingGraph,
  start: ControlState,
  target: ControlState,
): { solvable: boolean; plan: SolvePlan | null; reason?: string } {
  const order = solveOrder(graph);
  if (!order) return { solvable: false, plan: null, reason: "propagation graph has a cycle" };

  let state = start;
  const moves: SolvePlan["moves"] = [];
  for (const id of order) {
    const want = target[id];
    if (want === undefined) continue;
    if (state[id] !== want) {
      state = graph.set(state, id, want);
      moves.push({ id, to: want });
    }
  }

  for (const id of order) {
    const want = target[id];
    if (want !== undefined && state[id] !== want) {
      return { solvable: false, plan: null, reason: `control ${id} could not be settled` };
    }
  }

  return { solvable: true, plan: { order, moves } };
}

/**
 * Generate a start state by walking N legal moves back from the solved state.
 * Never shuffle: a shuffled start is not guaranteed reachable, and that is how
 * an unsolvable seed reaches production.
 */
export function scrambleFrom(
  graph: CouplingGraph,
  solved: ControlState,
  moves: number,
  rng: () => number,
): ControlState {
  let state = solved;
  for (let i = 0; i < moves; i++) {
    const control = graph.controls[Math.floor(rng() * graph.controls.length)]!;
    const span = control.max - control.min;
    const delta = 1 + Math.floor(rng() * span);
    state = graph.apply(state, control.id, rng() < 0.5 ? delta : -delta);
  }
  return state;
}
