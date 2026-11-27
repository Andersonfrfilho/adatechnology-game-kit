import { WORKER_KIND_DEFAULTS, WORKER_KIND_ID } from '@adatechnology/game-contracts'
import type { TaskKind } from '@adatechnology/game-contracts'

import { newHullPlan, planDivision } from './hull-plan'
import { hullOf } from './vehicle-hulls'
import type { CutNode } from './hull-split'

/** One thin piece of the intact car, named by its key: its triangles in the frame of the colliders. */
export interface HullPlanPiece {
  readonly key: string
  readonly vertices: Float64Array
  readonly indices: Uint32Array
}

/** What the division of a car's pieces needs: the thin pieces, the pieces of the solid parts (one entry per piece, `key` the part: each part gets one hull of all its pieces) and the hulls the model may have besides the solid parts. */
export interface HullPlanJob {
  readonly pieces: readonly HullPlanPiece[]
  readonly solids: readonly HullPlanPiece[]
  readonly maxHulls: number
}

/** The one hull of a solid part (empty `points` when it has none), named by the part. */
export interface HullPlanSolid {
  readonly key: string
  readonly points: Float32Array
}

/** A hull the division made: the piece it is from (`unit`, with `~n` for a protrusion), the cuts that lead to it, its points and the drawn vertices it was made from. */
export interface HullPlanLeaf {
  readonly unit: string
  readonly path: string
  readonly points: Float32Array
  readonly vertices: Float64Array
}

/** The plan of a car, as plain data (no `Map`, so two results compare byte for byte): the cuts and the protrusions taken off each piece, and the hulls they make. */
export interface HullPlanResult {
  readonly cuts: ReadonlyArray<readonly [string, CutNode]>
  readonly taken: ReadonlyArray<readonly [string, readonly number[]]>
  readonly leaves: readonly HullPlanLeaf[]
  readonly solids: readonly HullPlanSolid[]
}

/** The hull of each solid part: its pieces together, in the order the parts first appear. */
const solidHullsOf = (pieces: readonly HullPlanPiece[]): HullPlanSolid[] => {
  const parts = new Map<string, { vertices: number[]; indices: number[] }>()
  for (const piece of pieces) {
    let part = parts.get(piece.key)
    if (!part) parts.set(piece.key, (part = { vertices: [], indices: [] }))
    const offset = part.vertices.length / 3
    for (const value of piece.vertices) part.vertices.push(value)
    for (const index of piece.indices) part.indices.push(index + offset)
  }
  return [...parts].map(([key, soup]) => ({ key, points: new Float32Array(hullOf(soup) ?? []) }))
}

/** The whole division of an intact car (design 10.3): a pure function of the job, the same on the main thread and in a worker. */
export const planHulls = (job: HullPlanJob): HullPlanResult => {
  const plan = newHullPlan()
  const leaves = planDivision(job.pieces.map((piece) => ({ key: piece.key, soup: { vertices: Array.from(piece.vertices), indices: Array.from(piece.indices) } })), plan, job.maxHulls)
  return {
    cuts: [...plan.cuts],
    taken: [...plan.taken].map(([unit, numbers]) => [unit, [...numbers]] as const),
    solids: solidHullsOf(job.solids),
    leaves: leaves.flatMap((leaf) => (leaf.points ? [{ unit: leaf.unit, path: leaf.path, points: new Float32Array(leaf.points), vertices: Float64Array.from(leaf.soup.vertices) }] : [])),
  }
}

const WARMUP: HullPlanJob = {
  pieces: [{ key: 'roof#1', vertices: Float64Array.of(0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0.5, 1.4, 0.5), indices: Uint32Array.of(0, 1, 2, 0, 2, 3, 0, 1, 4) }],
  solids: [{ key: 'engine', vertices: Float64Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1), indices: Uint32Array.of(0, 1, 2, 0, 1, 3) }],
  maxHulls: 8,
}

/**
 * The division of a car's hulls as a task kind of the worker coordinator (`vehicles.hull-plan`, lane `build`, CLAUDE.md §14): the pieces of the intact car in (their buffers handed over, not copied: a car whose worker fails makes the job again), the plan and the hulls
 * out, the buffers transferred back. It is made once per model and kept by `createHullPlanCache`; until it arrives the car collides as the pieces' boxes. A game's worker file lists it in
 * `installWorkerHost`.
 */
export const hullPlanKind: TaskKind<HullPlanJob, HullPlanResult> = Object.freeze({
  id: WORKER_KIND_ID.VEHICLE_HULL_PLAN,
  kind: 'task' as const,
  ...WORKER_KIND_DEFAULTS[WORKER_KIND_ID.VEHICLE_HULL_PLAN],
  run: planHulls,
  transferInput: (job: HullPlanJob): ArrayBuffer[] => [...job.pieces, ...job.solids].flatMap((piece) => [piece.vertices.buffer as ArrayBuffer, piece.indices.buffer as ArrayBuffer]),
  transferOutput: (result: HullPlanResult): ArrayBuffer[] => [...result.leaves.flatMap((leaf) => [leaf.points.buffer as ArrayBuffer, leaf.vertices.buffer as ArrayBuffer]), ...result.solids.map((solid) => solid.points.buffer as ArrayBuffer)],
  warmup: WARMUP,
})
