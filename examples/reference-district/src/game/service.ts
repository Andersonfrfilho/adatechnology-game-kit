import type { FloorplanResult } from '@adatechnology/game-floorplan'
import type { StructuredResult } from '@adatechnology/game-floorplan-structure'
import type { PlanRect } from '@adatechnology/game-urban'

import { SIDEWALK_WIDTH } from './ground'
import type { HousePlacement } from './placement'
import type { PolePoint } from './roads'

/** The height (metres) where a house's service drop leaves the street pole: the low-voltage rack under the lamp's arm. */
export const SERVICE_DROP_HEIGHT = 6.8
/** The longest service drop a utility runs (metres): a lot farther than this from every street pole (one on no street of the plan) gets none. */
export const SERVICE_DROP_MAX = 30
/** A pole keeps this clear (metres) of each side of a door or a gate it would stand in front of. */
const ENTRANCE_MARGIN = 0.5

/** A plan placed on its lot: what the streets need of a house before it is drawn. */
export type PlannedHouse = { readonly plan: FloorplanResult; readonly placement: HousePlacement }

/** A point of the house's frame (`u` along its width, `v` into its depth) in the world, as the assembler turns and moves the house (rotation about y). */
export function toWorld(placement: HousePlacement, u: number, v: number): readonly [number, number] {
  const cos = Math.round(Math.cos(placement.ry))
  const sin = Math.round(Math.sin(placement.ry))
  return [placement.x + u * cos + v * sin, placement.z - u * sin + v * cos]
}

/** A point of the world in the house's frame: the inverse of `toWorld`. */
export function toHouseFrame(placement: HousePlacement, x: number, z: number): readonly [number, number] {
  const cos = Math.round(Math.cos(placement.ry))
  const sin = Math.round(Math.sin(placement.ry))
  const [dx, dz] = [x - placement.x, z - placement.z]
  return [dx * cos - dz * sin, dx * sin + dz * cos]
}

/** The doors and gates of a plan's front, as spans of `u` (metres): the openings a street pole must not stand in front of. */
export function frontOpeningsOf(plan: FloorplanResult): Array<readonly [number, number]> {
  const doors = plan.doors.filter((door) => door.floor === 0 && door.exterior && door.side === 'front').map((door) => [door.at - door.width / 2, door.at + door.width / 2] as const)
  const gates = (plan.lot?.gates ?? []).filter((gate) => gate.side === 'front').map((gate) => [gate.u - gate.width / 2, gate.u + gate.width / 2] as const)
  return [...doors, ...gates]
}

/** Where a house's entrance post stands in the world (the plan's `serviceEntrance.pole`), or `undefined` when the street's drop lands on its facade. */
export function entrancePostOf({ plan, placement }: PlannedHouse): readonly [number, number] | undefined {
  const post = (plan as StructuredResult).utilities?.electrical.serviceEntrance?.pole
  return post ? toWorld(placement, post.u, post.v) : undefined
}

/** Where no street pole may stand: in front of every door and gate of the placed houses (from the facade out over the sidewalk to the curb) and within `gap` of an entrance post. */
export function keepOutOf(houses: readonly PlannedHouse[], gap: number): PlanRect[] {
  const posts = houses.flatMap((house) => {
    const post = entrancePostOf(house)
    return post ? [[post[0] - gap, post[1] - gap, post[0] + gap, post[1] + gap] as PlanRect] : []
  })
  return [...posts, ...entranceRectsOf(houses)]
}

/** The ground in front of every door and gate of the placed houses, from the facade out over the sidewalk to the curb. */
export function entranceRectsOf(houses: readonly PlannedHouse[]): PlanRect[] {
  return houses.flatMap(({ plan, placement }) => {
    const front = plan.lot?.rect[1] ?? 0
    return frontOpeningsOf(plan).map(([from, to]): PlanRect => {
      const a = toWorld(placement, from - ENTRANCE_MARGIN, 0)
      const b = toWorld(placement, to + ENTRANCE_MARGIN, front - SIDEWALK_WIDTH - ENTRANCE_MARGIN)
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]
    })
  })
}

/** A house's service drop: from the nearest street pole (`from`, world) to where the plan's entrance takes it (`to`, world: the post's head or the facade meter), and `from` in the house's frame. */
export type ServiceDrop = { readonly from: readonly [number, number, number]; readonly to: readonly [number, number, number]; readonly fromInHouse: readonly [number, number, number] }

/** The service drop of a placed house from the nearest of the street's poles; `undefined` when the plan has no entrance or no pole is within `SERVICE_DROP_MAX`. */
export function serviceDropOf(house: PlannedHouse, poles: readonly PolePoint[]): ServiceDrop | undefined {
  const landing = (house.plan as StructuredResult).utilities?.electrical.serviceEntrance?.drop[0]
  if (!landing) return undefined
  const [x, z] = toWorld(house.placement, landing[0], landing[1])
  const nearest = poles.reduce<PolePoint | undefined>((best, pole) => (best === undefined || Math.hypot(pole.x - x, pole.z - z) < Math.hypot(best.x - x, best.z - z) ? pole : best), undefined)
  if (!nearest || Math.hypot(nearest.x - x, nearest.z - z) > SERVICE_DROP_MAX) return undefined
  const [u, v] = toHouseFrame(house.placement, nearest.x, nearest.z)
  return { from: [nearest.x, SERVICE_DROP_HEIGHT, nearest.z], to: [x, landing[2], z], fromInHouse: [u, SERVICE_DROP_HEIGHT, v] }
}
