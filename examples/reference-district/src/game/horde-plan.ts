import type { PlanRect } from '@adatechnology/game-urban'

import type { HordeZone } from './site'

export type SpawnPoint = { readonly x: number; readonly z: number }

/** How many of `total` zombies each zone gets, by its share of the horde; the shares need not add up to 1 (the rest of the zombies goes to the zones in order). */
export function zoneCounts(zones: readonly HordeZone[], total: number): ReadonlyMap<string, number> {
  const weight = zones.reduce((sum, zone) => sum + zone.share, 0)
  const counts = new Map<string, number>()
  let given = 0
  for (const zone of zones) {
    const count = Math.floor((total * zone.share) / weight)
    counts.set(zone.id, count)
    given += count
  }
  // the integer rest, one each from the first zone on, so the sum is exactly `total`
  for (let index = 0; given < total && zones.length > 0; index = (index + 1) % zones.length, given++) {
    const id = (zones[index] as HordeZone).id
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** `count` points of a rectangle, from the given stream (the crowd's own, so the same seed gives the same horde); `isFree` drops a point that falls on a wall. */
export function pointsIn({ rect, count, random, isFree }: { readonly rect: PlanRect; readonly count: number; readonly random: () => number; readonly isFree: (x: number, z: number) => boolean }): SpawnPoint[] {
  const points: SpawnPoint[] = []
  for (let tries = 0; points.length < count && tries < count * 20; tries++) {
    const x = rect[0] + random() * (rect[2] - rect[0])
    const z = rect[1] + random() * (rect[3] - rect[1])
    if (isFree(x, z)) points.push({ x, z })
  }
  return points
}
