import type { PlumbingPoint } from '@adatechnology/game-floorplan-structure';

import { DRAIN_BORE } from '../construction-stages/installations-stage.js';
import { routingPlanOf, wallDrop } from '../construction-stages/installation-routes.js';
import type { RoutingPlan } from '../construction-stages/installation-routes.js';
import type { Hex, HouseRecord, Kernel, KernelUtilitiesDrains, Shared } from '../kernel-types.js';
import { cutRun, holdersOf, solidsOf } from './segments.js';
import type { Span, Vec3 } from './segments.js';
import { pipeMass } from './water.js';

/** The white PVC of the sewer's drains (the colour the rough-in stage lays it in). */
const SEWER_COLOR = 0xe8e4dc;
/** Height over its storey's floor where each fixture's drain leaves the fixture, metres: a toilet at the floor, a shower in it, a basin's trap and a machine's standpipe higher up. */
const MOUTH_HEIGHT: Readonly<Record<string, number>> = { flush: 0.18, shower: 0.03, tap: 0.5, tub: 0.45, machine: 0.5 };
/** How far under the top of a slab the drain crosses it, metres: through the middle of its thickness. */
const SLAB_MIDDLE = 0.065;
/** The nearest wall or pillar a downpipe is clamped to lies within this of it, metres. */
const CLAMP_REACH = 0.3;
/** The clamp ring of a downpipe's stretch: its top this far under the stretch's top end (never on the end's plane), its height, metres. It shares the pipe's mesh: no draw call of its own. */
const CLAMP_DROP = 0.06;
const CLAMP_HEIGHT = 0.03;
/** How far (m) the cap of a stretch cut at a face of the solid it lies in is drawn off that face. */
const CAP_SINK = 0.002;
const CLAMPED_ROLES = new Set(['wall', 'partition', 'column']);

/** The run of one fixture's drain from its mouth into the wall nearest it, then down inside that wall (and through each slab into the wall of the storey below) to the foot of the ground floor's wall, where the buried branch of the sewer takes it. */
export function drainRoute(plan: RoutingPlan, point: PlumbingPoint): Vec3[] | null {
  const floor = point.floor;
  if (floor < 0) return null;
  const drop = wallDrop(plan, floor, point.u, point.v);
  if (!drop) return null;
  const onCentre = (at: { u: number; v: number; wall: { axis: 'u' | 'v'; u0: number; v0: number } }): [number, number] => (at.wall.axis === 'u' ? [at.u, at.wall.v0] : [at.wall.u0, at.v]);
  const mouth = (plan.floors[floor]?.y0 ?? 0) + (MOUTH_HEIGHT[point.kind] ?? 0.3);
  let at = onCentre(drop);
  const points: Vec3[] = [[point.u, mouth, point.v], [at[0], mouth, at[1]]];
  for (let storey = floor; storey > 0; storey--) {
    const slabY = (plan.floors[storey]?.y0 ?? 0) - SLAB_MIDDLE;
    points.push([at[0], slabY, at[1]]);
    const below = wallDrop(plan, storey - 1, at[0], at[1]);
    if (!below) continue;
    at = onCentre(below);
    points.push([at[0], slabY, at[1]]);
  }
  points.push([at[0], plan.floors[0]?.y0 ?? 0, at[1]]);
  return points;
}

export function installUtilitiesDrains(K: Kernel, shared: Shared): void {
  const { part, pipe, cylBase } = K;
  const sh = (...a: Parameters<Kernel['sh']>): ReturnType<Kernel['sh']> => K.sh(...a);

  /**
   * Where a stretch is drawn from and to: its ends are cut at the faces of the slabs and walls, and a cap lying on a face of the wall it ends in fights it, so a stretch in a solid
   * is drawn `CAP_SINK` short of its cut and the stretch in the open beside it goes `CAP_SINK` into the solid: every cap lies inside the solid, none on its plane.
   */
  function drawnEnds(span: Span, previous: Span | undefined, next: Span | undefined): [Vec3, Vec3] {
    const along: Vec3 = [(span.b[0] - span.a[0]) / span.length, (span.b[1] - span.a[1]) / span.length, (span.b[2] - span.a[2]) / span.length];
    const shift = (neighbour: Span | undefined): number => (span.host !== null ? -CAP_SINK : neighbour && neighbour.host !== null ? CAP_SINK : 0);
    const move = (end: Vec3, amount: number): Vec3 => [end[0] + along[0] * amount, end[1] + along[1] * amount, end[2] + along[2] * amount];
    return span.length > 4 * CAP_SINK ? [move(span.a, -shift(previous)), move(span.b, shift(next))] : [span.a, span.b];
  }

  /** What a run is: its id, the points it passes, its bore and colour, the group it is drawn in, the longest stretch it detaches in, and (a downpipe) the wall it is clamped to. */
  type Run = { readonly id: string; readonly points: readonly Vec3[]; readonly diameter: number; readonly color: Hex; readonly group: string; readonly limit: number; readonly clampedTo?: string; readonly clampEvery?: number };

  /** The pieces of a run: each stretch between cuts (at each slab or wall it crosses, none longer than the limit) is a part of its own, held by the solid it lies in or by the stretch beside it, and joined to the stretches next to it. */
  function layRun(run: Run): void {
    const spans = cutRun(run.points, run.limit, solidsOf(shared.ctx.structureIndex));
    if (!spans.length) return;
    const pieceId = (index: number): string => (spans.length > 1 ? `drain:${run.id}:${index}` : `drain:${run.id}`);
    const holders = run.clampedTo ? spans.map(() => run.clampedTo) : holdersOf(spans, pieceId);
    spans.forEach((span: Span, index: number) => {
      const holder = holders[index] ?? 'ground';
      const hosted = run.clampedTo ?? span.host ?? undefined;
      const neighbours = [index - 1].filter((next) => next >= 0 && holder !== pieceId(next) && holders[next] !== pieceId(index)).map(pieceId);
      const meta = { id: pieceId(index), run: run.id, hidden: hosted !== undefined && !run.clampedTo, mass: pipeMass(run.diameter, span.length), holder, ...(hosted ? { hostedIn: hosted } : {}), chain: neighbours };
      const [from, to] = drawnEnds(span, spans[index - 1], spans[index + 1]);
      part('drain_pipe', [0, 0, 0], () => {
        pipe(from, to, run.diameter, run.color);
        if (run.clampEvery && Math.abs(span.a[1] - span.b[1]) > span.length * 0.9) cylBase('plain', span.a[0], span.a[1] - CLAMP_DROP, span.a[2], run.diameter * 0.62, CLAMP_HEIGHT, sh(run.color, 0.7));
      }, meta, run.group);
    });
  }

  /** The sewer's drains of the finished house: each fixture's run inside the walls and slabs, hidden there until a hole opens where it runs. */
  function sewerDrains(): void {
    const H = (shared.ctx.r as HouseRecord).utilities?.plumbing;
    if (!H) return;
    const plan = routingPlanOf(shared.ctx.r as HouseRecord);
    for (const point of H.points) {
      const bore = DRAIN_BORE[point.kind];
      const points = bore === undefined ? null : drainRoute(plan, point);
      if (!points || bore === undefined) continue;
      layRun({ id: `sewer_${point.id}`, points, diameter: bore, color: SEWER_COLOR, group: `f${Math.max(0, point.floor)}`, limit: shared.ctx.segmentLimits.pipe });
    }
  }

  /** The wall or pillar a downpipe at (x, z) runs down: the nearest of its storey's whose box the pipe's axis is within reach of. */
  function wallOf(x: number, z: number, y: number): string | undefined {
    let best: { id: string; distance: number } | undefined;
    for (const part of Object.values(shared.ctx.structureIndex)) {
      if (!CLAMPED_ROLES.has(part.role) || y < part.y0 || y > part.y1) continue;
      const distance = Math.hypot(Math.max(part.aabb[0] - x, 0, x - part.aabb[2]), Math.max(part.aabb[1] - z, 0, z - part.aabb[3]));
      if (distance <= CLAMP_REACH && (!best || distance < best.distance)) best = { id: part.id, distance };
    }
    return best?.id;
  }

  /** The round downpipes the gutters hung: the run down the wall and the shoe, in stretches between clamps, each held by the wall it is clamped to. */
  function downpipes(): void {
    const runs = shared.ctx.gutterInfo?.runs ?? [];
    runs.forEach((run, index) => {
      const top = run.points[0]!;
      const points = run.points.map((p): Vec3 => [p[0]!, p[1]!, p[2]!]);
      const clampedTo = wallOf(top[0]!, top[2]!, top[1]! - 0.5);
      const limit = Number.isFinite(shared.ctx.segmentLimits.pipe) ? Math.min(shared.ctx.segmentLimits.pipe, run.clampEvery) : Infinity;
      layRun({ id: `downpipe_${index}`, points, diameter: run.radius * 2, color: run.color, group: `f${run.f}`, limit, ...(clampedTo ? { clampedTo } : {}), clampEvery: run.clampEvery });
    });
  }

  /** Both networks of the finished house; the team's scene (every `visor*` flag) draws neither. */
  function drainPipes(): void {
    if (shared.ctx.visorScene) return;
    sewerDrains();
    downpipes();
  }

  const defined: KernelUtilitiesDrains = { drainPipes };
  Object.assign(K, defined);
}
