import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import * as GameVegetation from '@adatechnology/game-vegetation'
import * as GameVegetationThree from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import type { CordPath, ItemBounds } from '../src/furniture/item-bounds'
import { houseOf, planOf, THREE } from './helpers/houses'
import { overlapOf, pieceBoxes } from './helpers/piece-boxes'

/**
 * What the house draws for its plan's items stays out of its walls, with the interactables kit and the vegetation package the rooms of the game draw with:
 * a potted plant's crown and leaves (spheres and leaf faces, never cut by the walls as the furniture's boxes are), every piece of furniture, and every
 * appliance cord, which runs from its device to a socket on the same face of the wall and never through one. A plant's crown spreads only as far as the
 * room round it leaves, and a plant with no room is left out (a palm 2 m across stood in a 0.4 m slot: its fronds came out on the other side of the wall).
 */

/** Depth (m) an item's box may lie in a wall's on all three axes at once: a contact, not a crossing. */
const WALL_TOLERANCE = 0.01
/** Depth (m) a cord's centre line may go into a wall: under its radius it only grazes the face. */
const CORD_TOLERANCE = 0.004
/** Distance (m) from a cord's last point to its socket's: the cord ends at the socket. */
const AT_SOCKET = 0.05

/**
 * Items whose drawing goes into a wall by design: the ground covers of the lot (concrete, lawn, dirt, tiles) run under the foot of the walls they meet,
 * and an air conditioner's outdoor unit sends its refrigerant line through the wall to its split, in a sleeve.
 */
const crossesByDesign = (item: ItemBounds): boolean => item.category === 'ground_cover' || item.type === 'ac_condenser'

const vegetation = { GameVegetation: { ...GameVegetation, ...GameVegetationThree }, GameVegetationSpecies }
const interactives = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree }

const SEEDS = [1, 2, 3, 4, 5, 6]
const TEMPLATES = ['single_storey_a', 'townhouse', 'mid_modern_single_storey', 'apartment_basic', 'apartment_modern']
const CASES = TEMPLATES.flatMap((template) => SEEDS.map((seed) => [template, seed] as const))

const wallBoxes = (house: House): InstanceType<typeof THREE.Box3>[] =>
  house.structure.parts.filter((part) => /^wall_/.test(part.id)).flatMap((part) => pieceBoxes(house, part.id))

const boxOf = (b: ItemBounds['box']): InstanceType<typeof THREE.Box3> => new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]))

/** How deep a point lies inside a box (m), on its shallowest axis: positive inside, negative outside. */
const depthIn = (box: InstanceType<typeof THREE.Box3>, p: readonly number[]): number =>
  Math.min(p[0]! - box.min.x, box.max.x - p[0]!, p[1]! - box.min.y, box.max.y - p[1]!, p[2]! - box.min.z, box.max.z - p[2]!)

/** The points of a cord every 1 cm along its segments. */
function samplesOf(cord: CordPath): number[][] {
  const out: number[][] = []
  for (let i = 1; i < cord.points.length; i++) {
    const a = cord.points[i - 1]!, b = cord.points[i]!, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.01))
    for (let k = 0; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n])
  }
  return out
}

function socketOf(house: House, cord: CordPath): readonly number[] | null {
  const iv = house.interactives
  const sid = iv?.world.power.pluggedInto(cord.object, cord.device)
  if (!iv || !sid) return null
  const cut = sid.indexOf(':'), object = iv.world.get(sid.slice(0, cut)), socket = object?.spec.sockets?.find((s) => s.id === sid.slice(cut + 1))
  return object && socket ? GameInteractables.localToWorld(object.transform, socket.pos) : null
}

describe('the items of a house stay out of its walls', () => {
  it.each(CASES)('%s, seed %i: no plant, piece of furniture or appliance cord goes into a wall', (template, seed) => {
    const { house } = houseOf(planOf(template, seed), { vegetation, interactives }, { itemBounds: true })
    const walls = wallBoxes(house)
    const ctx = house.internal.ctx
    expect(walls.length).toBeGreaterThan(0)
    const found: string[] = []
    for (const item of ctx.itemBounds ?? []) {
      if (crossesByDesign(item)) continue
      const box = boxOf(item.box)
      let deepest = -1
      for (const wall of walls) deepest = Math.max(deepest, overlapOf(box, wall))
      if (deepest > WALL_TOLERANCE) found.push(`${item.by} ${item.type} ${item.id}: ${deepest.toFixed(3)} m into a wall`)
    }
    for (const cord of ctx.cordPaths ?? []) {
      let deepest = -1
      for (const p of samplesOf(cord)) for (const wall of walls) deepest = Math.max(deepest, depthIn(wall, p))
      if (deepest > CORD_TOLERANCE) found.push(`cord of ${cord.object}:${cord.device}: ${deepest.toFixed(3)} m into a wall`)
      const socket = socketOf(house, cord), end = cord.points[cord.points.length - 1]!
      if (!socket || Math.hypot(end[0] - socket[0]!, end[1] - socket[1]!, end[2] - socket[2]!) > AT_SOCKET) found.push(`cord of ${cord.object}:${cord.device}: does not end at a socket`)
    }
    expect(found).toEqual([])
    expect(ctx.itemBounds?.length).toBeGreaterThan(10)
  }, 120_000)

  it('records the plants drawn by the vegetation package and the cords of the appliances', () => {
    const { house } = houseOf(planOf('single_storey_a', 1), { vegetation, interactives }, { itemBounds: true })
    expect(house.internal.ctx.cordPaths?.length).toBeGreaterThan(0)
    expect(house.internal.ctx.itemBounds?.some((item) => item.by === 'furniture')).toBe(true)
  })

  it('never draws a toilet as a potted plant', () => {
    for (const seed of SEEDS) {
      const { house } = houseOf(planOf('single_storey_a', seed), { vegetation, interactives }, { itemBounds: true })
      expect((house.internal.ctx.itemBounds ?? []).filter((item) => item.type === 'toilet' && item.by === 'vegetation')).toEqual([])
    }
  }, 120_000)
})
