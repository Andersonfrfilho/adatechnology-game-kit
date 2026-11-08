import type { DestructibleSpec, JointKind, JointSpec, PartSpec } from '@adatechnology/game-contracts'

/** What `slabsOffSupport` reads of a world's state: which parts still stand and which joints opened (`world.state(id)` of `game-destruction`). */
export interface RestingState {
  readonly parts: ReadonlyArray<{ readonly id: string; readonly status?: string }>
  readonly joints: ReadonlyArray<{ readonly id: string; readonly open?: boolean }>
}

/** Joints that take a moment: a slab held by one of them does not need its centre over its supports (a cantilevered balcony on its rebar). */
const FIXED_JOINTS: ReadonlySet<JointKind> = new Set<JointKind>(['rebar', 'fused', 'weld'])
const FALLEN = new Set(['broken', 'collapsed'])
const WALL_ROLES = new Set(['wall', 'partition'])

export interface SlabsOffSupportOptions {
  /**
   * Count a tie to a wall right under the slab (in contact, overlapping it in plan) that the spec declares as carrying nothing (`bears: false`, the ledger of a lean-to porch roof) as an edge the slab rests on.
   * The building as built rests on its ledger; the world leaves it out of the load path so the roof drops with its posts (it holds such a roof as designed).
   */
  readonly ledgers?: boolean
}

interface Box {
  readonly min: readonly number[]
  readonly max: readonly number[]
}

const boxOf = (part: PartSpec): Box => {
  const size = part.shape.kind === 'box' ? part.shape.size : [0, 0, 0]
  return { min: part.position.map((v, k) => v - size[k]! / 2), max: part.position.map((v, k) => v + size[k]! / 2) }
}

/** Contact tolerance (metres) between the underside of a slab and the top of a wall it is tied to. */
const LEDGER_GAP = 0.05

/** The wall is under the slab: their boxes overlap in plan and the top of the wall meets the underside of the slab. */
function bearsUnder(slab: PartSpec, wall: PartSpec): boolean {
  const a = boxOf(slab)
  const b = boxOf(wall)
  const overlaps = (k: number): boolean => Math.min(a.max[k]!, b.max[k]!) - Math.max(a.min[k]!, b.min[k]!) > 0
  return !wall.rotation && overlaps(0) && overlaps(2) && Math.abs(b.max[1]! - a.min[1]!) <= LEDGER_GAP
}

/**
 * Standing horizontal slabs and roofs that only rest on what is under them (no joint that takes a moment) whose centre is outside the box of where they still
 * bear: a slab on one edge, that a real one would slide or tip off. Without a state every part stands and no joint is open (the building as built).
 * A joint with fixity holds the slab whatever the supports: it is not checked.
 */
export function slabsOffSupport(spec: DestructibleSpec, state?: RestingState, options: SlabsOffSupportOptions = {}): string[] {
  const byId = new Map(spec.parts.map((part) => [part.id, part]))
  const statusOf = new Map(state?.parts.map((part) => [part.id, part.status]) ?? [])
  const openJoints = new Set(state?.joints.filter((joint) => joint.open).map((joint) => joint.id) ?? [])
  const stands = (id: string): boolean => (state ? statusOf.has(id) && !FALLEN.has(statusOf.get(id) ?? '') : byId.has(id))
  const out: string[] = []
  for (const part of spec.parts) {
    const role = part.structure?.role
    if ((role !== 'slab' && role !== 'roof') || part.shape.kind !== 'box' || part.rotation || !stands(part.id)) continue
    const size = part.shape.size
    if (size[1] > Math.min(size[0], size[2])) continue
    const isLedger = (joint: JointSpec): boolean => {
      const wall = byId.get(joint.b)
      return options.ledgers === true && joint.bears === false && wall !== undefined && WALL_ROLES.has(wall.structure?.role ?? '') && bearsUnder(part, wall)
    }
    const supports = (spec.joints ?? []).filter((joint) => joint.a === part.id && (joint.bears === 'a_on_b' || isLedger(joint)) && stands(joint.b) && !openJoints.has(joint.id ?? `${joint.a}~${joint.b}`))
    if (supports.length === 0 || supports.some((joint) => FIXED_JOINTS.has(joint.kind))) continue
    const mine = boxOf(part)
    let x0 = Infinity
    let x1 = -Infinity
    let z0 = Infinity
    let z1 = -Infinity
    for (const joint of supports) {
      const other = byId.get(joint.b)
      if (!other) continue
      const bearing = boxOf(other)
      x0 = Math.min(x0, Math.max(mine.min[0]!, bearing.min[0]!))
      x1 = Math.max(x1, Math.min(mine.max[0]!, bearing.max[0]!))
      z0 = Math.min(z0, Math.max(mine.min[2]!, bearing.min[2]!))
      z1 = Math.max(z1, Math.min(mine.max[2]!, bearing.max[2]!))
    }
    const [cx, , cz] = part.position
    if (!(cx > x0 && cx < x1 && cz > z0 && cz < z1)) out.push(part.id)
  }
  return out
}
