import { inferJoints } from '@adatechnology/game-destruction'
import type { JointSpec, PartSpec } from '@adatechnology/game-destruction'

/** Furthest (m) a part the builder drew a little apart from the piece is from what holds it: the pleats of a curtain under its rings, the knobs over a hob. */
export const HOLD_REACH = 0.05
/** How close (m) to the back of the piece a part must be to be screwed to the wall behind it (a shower head, a range hood, a curtain rod). */
const BACK_TOUCH = 0.02
/** What is not screwed to a wall: it hangs from what is (the pleats of a curtain from its rings). */
const SOFT = new Set(['fabric', 'paper', 'foliage'])

/** A part's box in the space of the piece. */
export interface PartBox {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

export interface HoldLooseParams {
  readonly parts: PartSpec[]
  readonly joints: JointSpec[]
  readonly boxOf: (partId: string) => PartBox
}

const gapOf = (a: PartBox, b: PartBox): number => Math.max(0, ...[0, 1, 2].map((k) => Math.max(a.min[k]! - b.max[k]!, b.min[k]! - a.max[k]!)))

/** Groups of parts held together by `joints`, each a list of part ids. */
function groupsOf(parts: readonly PartSpec[], joints: readonly JointSpec[]): string[][] {
  const root = new Map(parts.map((part) => [part.id, part.id]))
  const find = (id: string): string => {
    let at = id
    while (root.get(at) !== at) at = root.get(at) as string
    root.set(id, at)
    return at
  }
  for (const joint of joints) root.set(find(joint.a), find(joint.b))
  const groups = new Map<string, string[]>()
  for (const part of parts) {
    const at = find(part.id)
    groups.set(at, [...(groups.get(at) ?? []), part.id])
  }
  return [...groups.values()]
}

/** The joint between the nearest pair of parts of `loose` and `held` within `reach`, of the kind `inferJoints` gives their materials, or null. */
function nearestJoint(loose: readonly PartSpec[], held: readonly PartSpec[], boxOf: HoldLooseParams['boxOf'], reach: number): JointSpec | null {
  let best: { gap: number; a: PartSpec; b: PartSpec } | null = null
  for (const a of loose) {
    for (const b of held) {
      const gap = gapOf(boxOf(a.id), boxOf(b.id))
      if (gap <= reach && (!best || gap < best.gap)) best = { gap, a, b }
    }
  }
  if (!best) return null
  // the destruction world measures turned parts by their own box, a little wider than the drawn one
  const [joint] = inferJoints([best.a, best.b], best.gap + 0.05)
  return joint ? { ...joint, id: `${best.a.id}~${best.b.id}` } : null
}

/** How low (m) a part's bottom is to stand on the floor. */
const FLOOR_TOUCH = 0.005
/** A group stands on the floor by itself when its feet are at least this share of its height apart both ways (a stool beside a counter); narrower, it is part of the piece. */
const STANDS_ALONE = 0.3

/** Whether `group` stands on the floor by itself: it has feet, and they are wide enough for its height. */
function standsAlone(group: readonly PartSpec[], boxOf: HoldLooseParams['boxOf']): boolean {
  const feet = group.map((part) => boxOf(part.id)).filter((box) => box.min[1] <= FLOOR_TOUCH)
  if (feet.length === 0) return false
  const height = Math.max(...group.map((part) => boxOf(part.id).max[1]))
  const across = (k: 0 | 2): number => Math.max(...feet.map((box) => box.max[k])) - Math.min(...feet.map((box) => box.min[k]))
  return Math.min(across(0), across(2)) >= STANDS_ALONE * height
}

/** Joins every group but the biggest to the nearest part of it, unless it stands on the floor by itself: a pool's ladder, a wall bracket are the piece; a stool is not. */
function joinBodies({ parts, joints, boxOf }: HoldLooseParams, byId: ReadonlyMap<string, PartSpec>): void {
  const groups = groupsOf(parts, joints).map((ids) => ids.map((id) => byId.get(id) as PartSpec)).sort((a, b) => b.length - a.length)
  const [main, ...rest] = groups
  if (!main) return
  for (const group of rest) {
    if (standsAlone(group, boxOf)) continue
    const joint = nearestJoint(group, main, boxOf, Infinity)
    if (joint) joints.push(joint)
  }
}

/**
 * Nothing of a piece of furniture is left hanging in the air when it is laid: every group of parts the joints leave apart from what stands on the floor is held by
 * what holds it in a house. A group drawn a little apart (within `HOLD_REACH`) is joined to the nearest part that stands; one at the back of the piece is screwed to
 * the wall behind it (its parts there are anchored, as a wall-mounted cabinet is); what still hangs was drawn without what holds it (the stem of a fruit) and is
 * joined to the nearest part that stands. Last, one piece is one body: what is still apart is joined to it, but a group that stands on the floor by itself (a stool
 * beside a counter). Changes `parts` and `joints` in place.
 */
export function holdLooseGroups(params: HoldLooseParams): void {
  const byId = new Map(params.parts.map((part) => [part.id, part]))
  holdHanging(params, byId)
  joinBodies(params, byId)
}

function holdHanging({ parts, joints, boxOf }: HoldLooseParams, byId: ReadonlyMap<string, PartSpec>): void {
  const back = Math.min(...parts.map((part) => boxOf(part.id).min[2]))
  for (let pass = 0; pass < parts.length; pass++) {
    const groups = groupsOf(parts, joints).map((ids) => ids.map((id) => byId.get(id) as PartSpec))
    const held = groups.filter((group) => group.some((part) => part.anchored)).flat()
    const loose = groups.filter((group) => !group.some((part) => part.anchored))
    if (loose.length === 0) return
    let changed = false
    for (const group of loose) {
      const joint = nearestJoint(group, held, boxOf, HOLD_REACH)
      if (joint) {
        joints.push(joint)
        changed = true
        continue
      }
      const onWall = group.filter((part) => !SOFT.has(part.material) && boxOf(part.id).min[2] <= back + BACK_TOUCH)
      if (onWall.length === 0) continue
      for (const part of onWall) part.anchored = true
      changed = true
    }
    if (changed) continue
    // what the builder drew without the piece that holds it (the stem of a fruit, the fork under a handlebar) hangs on the nearest part that stands
    for (const group of loose) {
      const joint = nearestJoint(group, held, boxOf, Infinity)
      if (joint) joints.push(joint)
    }
    return
  }
}
