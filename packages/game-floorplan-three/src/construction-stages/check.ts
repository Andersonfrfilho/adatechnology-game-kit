import type * as THREE_NS from 'three'

import type { Three } from '../kernel-types.js'
import { CONSTRUCTION_LEVEL_MAX } from './apply-level.js'
import { coplanarOverlaps } from './coplanar.js'
import { SPOIL_HEAP } from './installations-stage.js'

/** What `checkConstructionStages` needs of a house built with `constructionStages: true`. */
export interface StagedHouseView {
  readonly group: THREE_NS.Object3D
  readonly house: THREE_NS.Object3D
  readonly groups: Readonly<Record<string, THREE_NS.Object3D>>
  setConstructionLevel?(level: number, options?: { waterLayer?: boolean; roofLayer?: boolean; lotLayer?: boolean }): number
  readonly r?: unknown
  readonly constructionLevel?: number
}

/** One thing a staged house does wrong: a stable code, the level it shows at (or -1) and what, in words. */
export interface StageProblem {
  readonly code: StageProblemCode
  readonly level: number
  readonly detail: string
}

export const STAGE_PROBLEM = {
  /** Two faces of different materials on one plane, facing the same way, overlapping: they flicker. */
  COPLANAR: 'coplanar_faces',
  /** A lintel or sill beam hangs in the frame stage, before the masonry it bears on. */
  LINTEL_IN_FRAME: 'lintel_in_frame',
  /** A pillar of the frame does not stand on a footing or ground beam. */
  PILLAR_UNSUPPORTED: 'pillar_unsupported',
  /** A beam or pillar under a slab does not reach into it. */
  SLAB_UNSEATED: 'slab_unseated',
  /** A sewer pipe or box stands over the ground (a box's lid only flush with it). */
  SEWER_ABOVE_GROUND: 'sewer_above_ground',
  /** A face of the house lies on the ground's plane, facing up: it flickers with the ground under it. */
  ON_GROUND_PLANE: 'on_ground_plane',
  /** An embedded pipe or conduit moves, doubles or is gone after the rough-in stage. */
  NETWORK_CHANGES: 'network_changes',
  /** A run crosses a room in the air (not inside a wall, not over the ceiling slab). */
  NETWORK_IN_AIR: 'network_in_air',
  /** A part hidden by default (a tap's water, a lamp off) shows. */
  HIDDEN_SHOWN: 'hidden_part_shown',
  /** A piece of the roof's timber frame stands out of the tiles. */
  FRAMING_THROUGH_TILES: 'framing_through_tiles',
  /** The water tank's lid stands out of the roof. */
  TANK_THROUGH_ROOF: 'tank_through_roof',
  /** The tank (its pillars, sleepers or itself) bears on a slab panel instead of a beam, pillar or wall. */
  TANK_ON_PANEL: 'tank_on_panel',
  /** The tank's castle lacks a wall, a bond beam or its roof. */
  CASTLE_INCOMPLETE: 'castle_incomplete',
} as const
export type StageProblemCode = (typeof STAGE_PROBLEM)[keyof typeof STAGE_PROBLEM]

/** three's AlwaysDepth. */
const ALWAYS_DEPTH = 1
const STAGE_GROUPS = new Set(['stage:1:foundation', 'stage:1:starter_bars', 'stage:2:frame', 'stage:3:masonry', 'stage:4:installations', 'stage:7:roof_framing'])
const isLintel = (id: string): boolean => /lintel|sillbeam|sill_beam/.test(id)
const isSlabPanel = (id: string): boolean => /slab/.test(id) && !/_b\d+$/.test(id) && !id.startsWith('tank_')
const partOf = (o: THREE_NS.Object3D): string => String(o.userData.structurePartId ?? '')
const shown = (o: THREE_NS.Object3D): boolean => {
  for (let p: THREE_NS.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}
const inStage = (mesh: THREE_NS.Object3D): boolean => {
  // drawn over the depth of what is under it (the excavation's earth): it cannot fight
  const material = (mesh as THREE_NS.Mesh).material as THREE_NS.Material | undefined
  if (material && !Array.isArray(material) && material.depthFunc === ALWAYS_DEPTH) return false
  for (let p: THREE_NS.Object3D | null = mesh; p; p = p.parent) if (STAGE_GROUPS.has(p.name)) return true
  return false
}

type Plan = {
  readonly structure?: { readonly parts: readonly { id: string; role: string }[]; readonly supports: readonly { part: string; on: string }[] }
  readonly walls?: readonly { floor: number; axis: string; u0: number; v0: number; u1: number; v1: number }[]
  readonly floors?: readonly { y0: number; ceiling: number }[]
  readonly waterTank?: { place: string; u: number; v: number; w: number; d: number; y: number; h: number; castle?: unknown } | null
}

/** The tank bears on beams, pillars or walls all the way down (a slab only as the platform it stands on); a castle has its four walls, bond beams and roof. */
function checkTankSupport(plan: Plan, out: StageProblem[]): void {
  const structure = plan.structure, tank = plan.waterTank
  if (!structure || !tank || (tank.place !== 'raised_slab' && tank.place !== 'attic')) return
  const role = new Map(structure.parts.map((p) => [p.id, p.role]))
  for (const s of structure.supports) {
    if (!/^(tank_column_|tank_sleeper_|water_tank$)/.test(s.part)) continue
    if (role.get(s.on) === 'slab' && s.on !== 'tank_slab') out.push({ code: STAGE_PROBLEM.TANK_ON_PANEL, level: 2, detail: `${s.part} on ${s.on}` })
  }
  if (!tank.castle) return
  for (const id of ['castle_wall_north', 'castle_wall_south', 'castle_wall_west', 'castle_wall_east', 'castle_bond_beam_north', 'castle_bond_beam_south', 'castle_bond_beam_west', 'castle_bond_beam_east', 'castle_roof']) {
    if (!role.has(id)) out.push({ code: STAGE_PROBLEM.CASTLE_INCOMPLETE, level: 2, detail: id })
  }
}

function checkFrame(T: Three, h: StagedHouseView, out: StageProblem[]): void {
  const frame = h.groups['stage:2:frame'], foundation = h.groups['stage:1:foundation']
  if (!frame || !foundation) return
  const box = (o: THREE_NS.Object3D): THREE_NS.Box3 => new T.Box3().setFromObject(o)
  for (const c of frame.children) if (isLintel(partOf(c))) out.push({ code: STAGE_PROBLEM.LINTEL_IN_FRAME, level: 2, detail: partOf(c) })
  const footings = foundation.children.map(box).filter((b) => b.max.y >= -0.001 && b.min.y < 0)
  const slabs = frame.children.filter((c) => isSlabPanel(partOf(c))).map(box)
  for (const c of frame.children) {
    const id = partOf(c)
    if (!id || isSlabPanel(id) || id.startsWith('tank_')) continue
    const b = box(c)
    if (/column/.test(id) && b.min.y < 0.1 && !footings.some((f) => f.min.x < b.max.x && f.max.x > b.min.x && f.min.z < b.max.z && f.max.z > b.min.z)) {
      out.push({ code: STAGE_PROBLEM.PILLAR_UNSUPPORTED, level: 2, detail: id })
    }
    for (const s of slabs) {
      const under = s.min.x < b.max.x - 1e-3 && s.max.x > b.min.x + 1e-3 && s.min.z < b.max.z - 1e-3 && s.max.z > b.min.z + 1e-3 && b.max.y > s.min.y - 0.05 && b.max.y < s.max.y - 0.005 && b.min.y < s.min.y
      if (under && (b.max.y <= s.min.y || b.max.y >= s.max.y - 0.02)) out.push({ code: STAGE_PROBLEM.SLAB_UNSEATED, level: 2, detail: `${id} top ${b.max.y.toFixed(3)} under a slab ${s.min.y.toFixed(3)}-${s.max.y.toFixed(3)}` })
    }
  }
}

/** A box's lid: flush with the ground, at most this much over it. */
const LID_FLUSH = 0.01

function checkSewer(T: Three, h: StagedHouseView, out: StageProblem[]): void {
  for (const name of ['stage:4:installations', 'stage:4:sewer_boxes']) {
    h.groups[name]?.traverse((o) => {
      if (!(o as THREE_NS.Mesh).isMesh || o.name === SPOIL_HEAP || o.name === 'excavation:opening') return
      const top = new T.Box3().setFromObject(o).max.y
      if (top > (o.name === 'sewer:lid' ? LID_FLUSH : 1e-4)) out.push({ code: STAGE_PROBLEM.SEWER_ABOVE_GROUND, level: 4, detail: `${o.name || o.type} top ${top.toFixed(3)}` })
    })
  }
}

/** Faces of the house that lie on the ground's plane (y 0) facing up, where the ground the house stands on would fight them. */
function checkGroundPlane(h: StagedHouseView, level: number, out: StageProblem[]): void {
  const at = new Map<string, number>()
  h.house.updateMatrixWorld(true)
  h.house.traverse((o) => {
    const mesh = o as THREE_NS.Mesh
    if (!mesh.isMesh || !shown(mesh) || /^excavation:/.test(mesh.name)) return
    const material = mesh.material as THREE_NS.Material
    if (Array.isArray(material) || material.colorWrite === false) return
    const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal'), index = mesh.geometry.getIndex()
    if (!normal) return
    const count = index ? index.count : position.count
    const e = mesh.matrixWorld.elements
    for (let i = 0; i < count; i += 3) {
      let flat = true
      for (let k = 0; k < 3 && flat; k++) {
        const v = index ? index.getX(i + k) : i + k
        const y = e[1]! * position.getX(v) + e[5]! * position.getY(v) + e[9]! * position.getZ(v) + e[13]!
        if (Math.abs(y) > 0.0015 || normal.getY(v) < 0.99) flat = false
      }
      if (flat) at.set(mesh.name || mesh.type, (at.get(mesh.name || mesh.type) ?? 0) + 1)
    }
  })
  for (const [name, n] of at) out.push({ code: STAGE_PROBLEM.ON_GROUND_PLANE, level, detail: `${name}: ${n} triangles at y 0` })
}

function checkNetwork(T: Three, h: StagedHouseView, plan: Plan, set: (level: number) => void, out: StageProblem[]): void {
  const runs: THREE_NS.Object3D[] = []
  h.group.traverse((o) => {
    if ((o.userData.part === 'wall_pipe' || o.userData.part === 'wall_conduit') && o.userData.pivot === true) runs.push(o)
  })
  const ids = runs.map((o) => String(o.userData.id))
  if (new Set(ids).size !== ids.length) out.push({ code: STAGE_PROBLEM.NETWORK_CHANGES, level: -1, detail: 'a run is laid twice' })
  const snapshot = (): string => runs.map((o) => { const b = new T.Box3().setFromObject(o); return [...b.min.toArray(), ...b.max.toArray()].map((v) => v.toFixed(3)).join(',') }).join('|')
  set(4)
  const at4 = snapshot()
  for (const o of runs) if (!shown(o)) out.push({ code: STAGE_PROBLEM.NETWORK_CHANGES, level: 4, detail: `${String(o.userData.id)} not shown in the rough-in` })
  for (const level of [5, 8]) {
    set(level)
    if (snapshot() !== at4) out.push({ code: STAGE_PROBLEM.NETWORK_CHANGES, level, detail: 'the runs moved' })
    // under the render the run is still there, where it runs: the render covers it, nothing hides it (a wall broken open shows it)
    for (const o of runs) if (!shown(o)) out.push({ code: STAGE_PROBLEM.NETWORK_CHANGES, level, detail: `${String(o.userData.id)} gone once the walls are rendered` })
  }
  const walls = plan.walls ?? []
  const top = plan.floors?.length ? plan.floors[plan.floors.length - 1]! : undefined
  const ceiling = top ? top.y0 + top.ceiling : 2.8
  for (const o of runs) {
    for (const route of (o.userData.routes as number[][][] | undefined) ?? []) {
      for (let i = 0; i + 1 < route.length; i++) {
        const a = route[i]!, b = route[i + 1]!
        if (a[1]! >= ceiling - 1e-6 && b[1]! >= ceiling - 1e-6) continue
        if (a[1]! < 0 && b[1]! < 0) continue // buried
        const mu = (a[0]! + b[0]!) / 2, mv = (a[2]! + b[2]!) / 2
        const inWall = walls.some((w) => (w.axis === 'u' ? Math.abs(mv - w.v0) < 0.1 && mu >= w.u0 - 0.1 && mu <= w.u1 + 0.1 : Math.abs(mu - w.u0) < 0.1 && mv >= w.v0 - 0.1 && mv <= w.v1 + 0.1))
        if (!inWall) out.push({ code: STAGE_PROBLEM.NETWORK_IN_AIR, level: 4, detail: `${String(o.userData.id)} ${a.map((v) => v.toFixed(2))} -> ${b.map((v) => v.toFixed(2))}` })
      }
    }
  }
}

function checkRoof(T: Three, h: StagedHouseView, plan: Plan, set: (level: number) => void, out: StageProblem[]): void {
  const roof = h.groups.roof, framing = h.groups['stage:7:roof_framing']
  if (!roof) return
  set(CONSTRUCTION_LEVEL_MAX)
  h.group.updateMatrixWorld(true)
  const tiles: THREE_NS.Object3D[] = []
  roof.traverse((o) => (o as THREE_NS.Mesh).isMesh && tiles.push(o))
  const ray = new T.Raycaster()
  const down = new T.Vector3(0, -1, 0)
  const roofOver = (p: THREE_NS.Vector3, from: number): number | null => {
    ray.set(new T.Vector3(p.x, p.y + 30, p.z), down)
    const hit = ray.intersectObjects(tiles, false).find((x) => x.point.y > from)
    return hit ? hit.point.y : null
  }
  framing?.traverse((o) => {
    const mesh = o as THREE_NS.Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i += 7) {
      const p = new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
      const y = roofOver(p, p.y - 1)
      if (y !== null && y <= p.y) out.push({ code: STAGE_PROBLEM.FRAMING_THROUGH_TILES, level: 7, detail: `timber at ${p.toArray().map((v) => v.toFixed(2))}, tiles at ${y.toFixed(2)}` })
    }
  })
  const tank = plan.waterTank
  if (!tank || (tank.place !== 'raised_slab' && tank.place !== 'attic')) return
  const lid = tank.y + (tank.place === 'attic' ? 0.2 : 0) + tank.h + 0.12
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]] as const) {
    const p = new T.Vector3(tank.u + (a * tank.w) / 2, lid, tank.v + (b * tank.d) / 2).applyMatrix4(h.house.matrixWorld)
    const y = roofOver(p, -Infinity)
    if (y === null || y <= p.y) out.push({ code: STAGE_PROBLEM.TANK_THROUGH_ROOF, level: CONSTRUCTION_LEVEL_MAX, detail: `lid ${p.y.toFixed(2)} at ${a},${b}, roof ${y === null ? 'none' : y.toFixed(2)}` })
  }
}

/**
 * The construction tests of a house built by stages (CLAUDE.md §11), the same in the CI and in the test room's scenario: level by level, no two faces of
 * different materials fight on one plane; lintels come with the masonry; pillars stand on the foundation and beams reach into the slabs; the sewer is under
 * the ground; the pipes and conduits are one network, laid once, shown only in the rough-in, never across a room in the air; nothing hidden by default shows;
 * the roof's timber and the water tank stay under the tiles. Leaves the house at the level it found it.
 */
export function checkConstructionStages(T: Three, h: StagedHouseView, options: { readonly coplanar?: boolean } = {}): StageProblem[] {
  const out: StageProblem[] = []
  const setLevel = h.setConstructionLevel?.bind(h)
  if (!setLevel) return out
  const start = h.constructionLevel ?? CONSTRUCTION_LEVEL_MAX
  const set = (level: number): void => {
    setLevel(level, { roofLayer: true, lotLayer: false })
  }
  const plan = (h.r ?? {}) as Plan
  if (options.coplanar !== false) {
    for (let level = 1; level <= CONSTRUCTION_LEVEL_MAX; level++) {
      set(level)
      for (const o of coplanarOverlaps(T, h.group, { keep: inStage })) {
        out.push({ code: STAGE_PROBLEM.COPLANAR, level, detail: `${o.a.name || partOf(o.a)} / ${o.b.name || partOf(o.b)} ${o.area.toFixed(3)} m² at ${o.at.toArray().map((v) => v.toFixed(2))} facing ${o.normal.toArray().map((v) => v.toFixed(2))}` })
      }
    }
  }
  checkFrame(T, h, out)
  checkSewer(T, h, out)
  for (const level of [4, 5, 8]) {
    set(level)
    checkGroundPlane(h, level, out)
  }
  checkNetwork(T, h, plan, set, out)
  set(CONSTRUCTION_LEVEL_MAX)
  const hidden: string[] = []
  h.group.traverse((o) => {
    if (o.userData.hidden === true && o.userData.part !== 'wall_pipe' && o.userData.part !== 'wall_conduit' && o.userData.part !== 'electrical_box' && shown(o)) hidden.push(String(o.userData.part))
  })
  for (const part of hidden) out.push({ code: STAGE_PROBLEM.HIDDEN_SHOWN, level: CONSTRUCTION_LEVEL_MAX, detail: part })
  checkRoof(T, h, plan, set, out)
  checkTankSupport(plan, out)
  set(start)
  return out
}
