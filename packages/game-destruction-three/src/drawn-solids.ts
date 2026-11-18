import type * as THREE_NS from 'three'

import type { WorkerCoordinator } from '@adatechnology/game-contracts'

import type { StaticSolid } from './engine-statics'
import type { MeshVis } from './internal'
import { measureStaticPart } from './static-part-job'
import type { StaticPartJob } from './static-part-job'
import type { Visuals } from './visual'
import { staticCollidersKind } from './worker-kinds'

type Points = ArrayLike<number>

/** What was made of a part and what it was made from: the same source at the same versions is the same vertices, so nothing is measured (or read) twice. */
interface Made {
  readonly matrix: readonly number[]
  readonly from: number
  readonly to: number
  /** The positions' source (`Visuals.positionsOf`) by number, so a source replaced is not kept alive by what was made of it. */
  readonly source: number
  readonly version: number
  readonly shapeVersion: number
  readonly solids: StaticSolid[]
}

const made = new WeakMap<MeshVis, Made>()
/** A part handed to the workers (`MeasureBudget.workers`) and not answered yet: the same numbers are not handed again. */
const pending = new WeakMap<MeshVis, Omit<Made, 'solids'>>()
const sourceIds = new WeakMap<object, number>()
let lastSourceId = 0
const sourceIdOf = (source: object): number => {
  let id = sourceIds.get(source)
  if (id === undefined) {
    id = ++lastSourceId
    sourceIds.set(source, id)
  }
  return id
}
/** The triangles of each range of a merged mesh, by the index buffer they were found in (one pass over the buffer for all the parts of the host). */
const triangles = new WeakMap<object, Map<number, number[]>>()

/** What a part costs besides its vertices (in vertices) to measure from scratch. */
const PART_COST = 24

/** How many vertices may be measured from scratch in one call (a part whose numbers did not change is not measured at all); `incomplete` is set when a part had to wait. */
export interface MeasureBudget {
  left: number
  incomplete: boolean
  /**
   * The meshes whose world matrix this call has brought up to date: every part of a merged house shares its host mesh, and bringing it up to date walks its parents
   * again. Nothing moves while a call measures, so once per mesh is the same matrix.
   */
  readonly updated?: Set<object>
  /**
   * The game's worker coordinator (CLAUDE.md §14): a part measured from scratch is a `destruction.static-colliders` job (lane `build`) and its object waits, as a part
   * out of turns does (`incomplete`), until the answer comes; a later call takes the part from it. Without it every part is measured here, as before.
   */
  readonly workers?: WorkerCoordinator | null
}

/** The part's vertices out of the mesh's positions, with what another drawing collapses there collapsed as drawn (each range to its first vertex). */
const readPoints = (array: Points, from: number, to: number, collapsed: ReadonlyArray<readonly [number, number]> = []): Float64Array => {
  const points = new Float64Array((to - from) * 3)
  for (let i = 0; i < points.length; i++) points[i] = array[from * 3 + i]
  for (const [v0, v1] of collapsed) {
    for (let k = Math.max(v0 + 1, from); k < Math.min(v1, to); k++) {
      for (let c = 0; c < 3; c++) points[(k - from) * 3 + c] = array[v0 * 3 + c]
    }
  }
  return points
}

/**
 * What a fixed drawn part collides as, in world space, for an engine: one box turned as drawn where a box fits it (every corner has a vertex within `FIT`), else the
 * triangles as drawn (`mesh`, static only). A part drawn by a range of a merged mesh (a wall of the house) is its own vertices only. Nothing is drawn where a part is
 * collapsed to a point, so nothing is made there (`CLAUDE.md` §12). `key` names the part for the engine. The same part in the same place with the same vertices gives the very same list back,
 * told by the versions of its positions (every write counts), not by reading them: a part that did not change costs no pass over its vertices.
 */
export const drawnSolidsOf = (THREE: typeof THREE_NS, visuals: Visuals, mv: MeshVis, key: string, budget: MeasureBudget): StaticSolid[] => {
  const local = visuals.positionsOf(mv)
  if (!local || local.to <= local.from) return []
  if (!budget.updated?.has(mv.mesh)) {
    mv.mesh.updateWorldMatrix(true, false)
    budget.updated?.add(mv.mesh)
  }
  const matrix = mv.mesh.matrixWorld.elements
  const source = sourceIdOf(local.source)
  const known = made.get(mv)
  if (
    known &&
    known.source === source &&
    known.version === local.version &&
    known.shapeVersion === mv.shapeVersion &&
    known.from === local.from &&
    known.to === local.to &&
    known.matrix.every((v, k) => v === matrix[k])
  )
    return known.solids
  const sig = { matrix: [...matrix], from: local.from, to: local.to, source, version: local.version, shapeVersion: mv.shapeVersion }
  const waiting = budget.workers ? pending.get(mv) : undefined
  if (waiting && sameSig(waiting, sig)) {
    budget.incomplete = true
    return known?.solids ?? []
  }
  // out of turns: what was made before stays (its body is kept), a part never made waits for the next call
  if (budget.left <= 0) {
    budget.incomplete = true
    return known?.solids ?? []
  }
  budget.left -= local.to - local.from + PART_COST
  const job = jobOf(THREE, mv, readPoints(local.array, local.from, local.to, local.collapsed), matrix, local)
  const workers = budget.workers
  if (workers) {
    pending.set(mv, sig)
    budget.incomplete = true
    workers.run(staticCollidersKind, job).then(
      (solids) => {
        if (pending.get(mv) !== sig) return
        pending.delete(mv)
        made.set(mv, { ...sig, solids: solids.map((solid) => ({ ...solid, key })) })
      },
      () => {
        if (pending.get(mv) === sig) pending.delete(mv)
      },
    )
    return known?.solids ?? []
  }
  const solids = measureStaticPart(job).map((solid) => ({ ...solid, key }))
  made.set(mv, { ...sig, solids })
  return solids
}

const sameSig = (a: Omit<Made, 'solids'>, b: Omit<Made, 'solids'>): boolean =>
  a.source === b.source && a.version === b.version && a.shapeVersion === b.shapeVersion && a.from === b.from && a.to === b.to && a.matrix.every((v, k) => v === b.matrix[k])

/** The job of a part (`measureStaticPart`): its vertices, the triangles that start in its range and the mesh's world matrix with three's decomposition of it. */
const jobOf = (THREE: typeof THREE_NS, mv: MeshVis, points: Float64Array, matrix: readonly number[], local: { readonly from: number; readonly to: number }): StaticPartJob => {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  mv.mesh.matrixWorld.decompose(pos, quat, scale)
  return {
    points,
    matrix: Float64Array.from(matrix),
    position: [pos.x, pos.y, pos.z],
    quaternion: [quat.x, quat.y, quat.z, quat.w],
    scale: [scale.x, scale.y, scale.z],
    found: Uint32Array.from(trianglesOfPart(mv, local)),
    from: local.from,
  }
}

/** The triangles of each range of the host's index buffer, found in one pass for all of them (the parts of a merged mesh are many, its buffer is one). */
const trianglesOfRanges = (mv: MeshVis, ranges: ReadonlyArray<readonly [number, number]>): Map<number, number[]> => {
  const index = mv.mesh.geometry.getIndex()
  const key = (index?.array ?? mv.mesh.geometry) as object
  const known = triangles.get(key)
  if (known) return known
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const owner = (vertex: number): number => {
    let lo = 0
    let hi = sorted.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (vertex < sorted[mid][0]) hi = mid - 1
      else if (vertex >= sorted[mid][1]) lo = mid + 1
      else return sorted[mid][0]
    }
    return -1
  }
  const out = new Map<number, number[]>()
  const array = index?.array
  const count = index ? index.count : (mv.mesh.geometry.getAttribute('position')?.count ?? 0)
  for (let i = 0; i + 2 < count; i += 3) {
    const a = array ? array[i] : i
    const from = owner(a)
    if (from < 0) continue
    let list = out.get(from)
    if (!list) {
      list = []
      out.set(from, list)
    }
    if (array) list.push(a, array[i + 1], array[i + 2])
    else list.push(i, i + 1, i + 2)
  }
  triangles.set(key, out)
  return out
}

/** The triangles that start in the part's range of its host, as vertex numbers of the host (three each). */
const trianglesOfPart = (mv: MeshVis, local: { readonly from: number; readonly to: number }): number[] =>
  mv.host
    ? trianglesOfRanges(mv, mv.host.sharers.filter((s) => s.range && !s.loose).map((s) => s.range as [number, number])).get(local.from) ?? []
    : trianglesOfRanges(mv, [[0, local.to]]).get(0) ?? []
