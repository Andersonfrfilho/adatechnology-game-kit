import type { JointKind, MaterialId } from '@adatechnology/game-contracts'

import { distanceBetween, touches } from '../geometry'
import type { Rect, StructurePart } from '../types'
import type { BuildContext } from './context'

export interface JoistOptions {
  floor: number
  box: Rect
  thickness: number
  carriers: readonly StructurePart[]
  material: MaterialId
  joint: JointKind
  suffix?: string
}

const JOIST_PITCH = 0.6

/** Joists every 0.6 m under the floor of `floor`, each resting on what touches it from below (or the nearest carrier). */
export function addJoists(context: BuildContext, options: JoistOptions): StructurePart[] {
  const { floor, box, thickness, carriers, material, joint, suffix = '' } = options
  const length = box[2] - box[0]
  const depth = box[3] - box[1]
  const alongU = length >= depth
  const span = alongU ? length : depth
  const count = Math.max(2, Math.round(span / JOIST_PITCH) + 1)
  const top = context.level(floor) - thickness * 0.15
  const out: StructurePart[] = []
  for (let k = 0; k < count; k++) {
    const centre = (alongU ? box[0] : box[1]) + 0.05 + (k * (span - 0.1)) / (count - 1)
    const aabb: Rect = alongU ? [centre - 0.025, box[1], centre + 0.025, box[3]] : [box[0], centre - 0.025, box[2], centre + 0.025]
    const joist = context.builder.add({ id: `joist_${floor}${suffix}_${k}`, role: 'beam', material, aabb, y0: context.level(floor) - thickness, y1: top }, { floor, fill: 1, spacing: JOIST_PITCH })
    out.push(joist)
    const below = carriers.filter((carrier) => carrier.y0 <= top + 0.05)
    const touching = below.filter((carrier) => touches(aabb, carrier.aabb, 0.2))
    const pool = below.length ? below : carriers
    const chosen = touching.length ? touching : pool.slice().sort((a, b) => distanceBetween(aabb, a.aabb) - distanceBetween(aabb, b.aabb)).slice(0, 1)
    for (const carrier of chosen) context.builder.rest(joist, carrier, joint)
  }
  return out
}

/** The deck (floor boards, slab) of `floor` on its joists. */
export function addDeck(context: BuildContext, id: string, material: MaterialId, options: Pick<JoistOptions, 'floor' | 'box' | 'thickness' | 'joint'>, joists: readonly StructurePart[]): StructurePart {
  const { floor, box, thickness, joint } = options
  const deck = context.builder.add({ id, role: 'slab', material, aabb: box, y0: context.level(floor) - thickness * 0.15, y1: context.level(floor) }, { floor })
  for (const joist of joists) context.builder.rest(deck, joist, joint)
  return deck
}
