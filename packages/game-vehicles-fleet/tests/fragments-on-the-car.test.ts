import { createDestruction } from '@adatechnology/game-destruction'
import type { Hit, PartSpec } from '@adatechnology/game-destruction'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { describe, expect, it } from 'vitest'

import { makeFleetKit } from './helpers/kit'

type Vec3 = [number, number, number]

/** The M67 of the arsenal: 200 kJ, 0.24 kg of TNT, a 190 g steel case in 1000 pieces round 180 g of Composition B. */
const M67 = { energy: 200000, radius: 15, charge: { tnt: 0.24, casing: { mass: 0.19, material: 'steel', fragments: 1000, chargeMass: 0.18, gurneyVelocity: 2700 } } }
/** Half the width of the sedan, metres. */
const HALF_WIDTH = 0.9

/** `count` directions spread evenly over the sphere (Fibonacci lattice). */
const evenDirections = (count: number): Vec3[] => {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count
    const ring = Math.sqrt(1 - y * y)
    return [Math.cos(golden * i) * ring, y, Math.sin(golden * i) * ring] as Vec3
  })
}

/** The radius of the sphere round a part's shape, as the destruction world bounds it. */
const boundOf = (part: PartSpec): number => (part.shape.kind === 'box' ? Math.hypot(...part.shape.size) / 2 : part.shape.kind === 'cylinder' ? Math.hypot(part.shape.radius, part.shape.height / 2) : part.shape.radius)

/** The share of the directions from `from` whose line meets the bounding sphere of one of the parts: the pieces of a case that qualify for the car. */
const shareOfSpheres = (from: Vec3, parts: readonly PartSpec[], directions: readonly Vec3[]): number => {
  const spheres = parts.map((part) => ({ centre: part.position as Vec3, radius: boundOf(part) }))
  const meets = (d: Vec3) => spheres.some(({ centre, radius }) => {
    const toward: Vec3 = [centre[0] - from[0], centre[1] - from[1], centre[2] - from[2]]
    const distance2 = toward[0] ** 2 + toward[1] ** 2 + toward[2] ** 2
    if (distance2 <= radius * radius) return true
    const along = toward[0] * d[0] + toward[1] * d[1] + toward[2] * d[2]
    return along > 0 && distance2 - along * along <= radius * radius
  })
  return directions.filter(meets).length / directions.length
}

/** The share of the directions from `from` whose line meets one of the parts' shapes (boxes by the slab test, round shapes by their sphere): the pieces that land on the car. */
const shareOfShapes = (from: Vec3, parts: readonly PartSpec[], directions: readonly Vec3[]): number => {
  const meetsBox = (d: Vec3, centre: Vec3, size: Vec3) => {
    let near = 0
    let far = Infinity
    for (let k = 0; k < 3; k++) {
      const lo = centre[k]! - size[k]! / 2 - from[k]!
      const hi = centre[k]! + size[k]! / 2 - from[k]!
      if (Math.abs(d[k]!) < 1e-12) {
        if (lo > 0 || hi < 0) return false
        continue
      }
      const a = lo / d[k]!, b = hi / d[k]!
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
    }
    return near <= far
  }
  const meets = (d: Vec3) => parts.some((part) => (part.shape.kind === 'box' ? meetsBox(d, part.position as Vec3, part.shape.size as Vec3) : shareOfSpheres(from, [part], [d]) > 0))
  return directions.filter(meets).length / directions.length
}

describe('the pieces of a hand grenade beside a parked sedan', () => {
  // The car is aimed at part by part: from 3 m off its side the sphere round the whole car (4.35 m) holds the charge, and aimed at as one sphere every one of the 1000
  // pieces qualified and the cap of 256 cut three in four of the ones that do fly at it. Part by part, the pieces that reach it are at most the ones whose line meets the
  // sphere of one of its parts, and the ones that land are the ones whose line meets a part's shape
  it('3 m from its side: the pieces that land on it are those the shapes of its parts cover, never more than their spheres let through, in every throw', () => {
    const pieces = M67.charge.casing.fragments
    for (const seed of [1, 2, 3, 4]) {
      const kit = makeFleetKit('en')
      const item = buildVehicleItem(kit, 'midsize_sedan')
      const d = createVehicleDestructible(kit, item.vehicle, { id: 'sedan', frame: item.root })
      const hits: Hit[] = []
      const hit = d.hit.bind(d)
      d.hit = (h) => {
        if (h.type === 'ballistic') hits.push(h)
        return hit(h)
      }
      const world = createDestruction({ seed })
      world.register(d)
      const [x, , z] = d.partWorldCenter('roof')
      const at: Vec3 = [x + HALF_WIDTH + 3, 1, z]
      const directions = evenDirections(100_000)
      const qualify = pieces * shareOfSpheres(at, d.describe().parts, directions)
      const land = pieces * shareOfShapes(at, d.describe().parts, directions)
      world.explode(at, M67.energy, M67.radius, 'test', { charge: M67.charge })
      expect(qualify).toBeLessThan(256)
      expect(hits.length, `seed ${seed}`).toBeLessThanOrEqual(qualify + 4 * Math.sqrt(qualify))
      // the pieces whose line meets a part's shape land, as many as a binomial draw of the case gives (4 sigma)
      expect(Math.abs(hits.length - land), `seed ${seed}: ${hits.length} landed, ${land.toFixed(1)} expected`).toBeLessThan(4 * Math.sqrt(land * (1 - land / pieces)))
    }
  })
})
