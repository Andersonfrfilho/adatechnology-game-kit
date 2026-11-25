import { NAV_OBSTACLE_KIND } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { createHouseNavObstacles } from '../src'
import type { House, HouseBoxCollider, HouseNavObstacles } from '../src'
import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

// What a house puts on the ground for the horde's grid: its ground-floor walls, its lot walls, its doors and gates, in the world; a door that opens, a wall a burst cuts.

const PLACE = { x: 40, z: -20, ry: Math.PI / 2 } as const

function setup(): { house: House; source: HouseNavObstacles; world: ReturnType<typeof createDestruction> } {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const destructionRenderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const route: { source?: HouseNavObstacles } = {}
  const { house } = houseOf(planOf('casaA', 3), { destruction: world, destructionRenderer, onCollider: (collider) => route.source?.colliderChanged(collider) })
  house.group.rotation.y = PLACE.ry
  house.group.position.set(PLACE.x, 0, PLACE.z)
  house.group.updateMatrixWorld(true)
  scene.add(house.group)
  house.destruction.activate()
  const source = createHouseNavObstacles([house])
  route.source = source
  return { house, source, world }
}

const isBox = (collider: House['colliders'][number]): collider is HouseBoxCollider => 'x0' in collider
/** The id the source gives a collider of the first house: its place among the ground-floor and lot boxes. */
const idOf = (house: House, collider: HouseBoxCollider): string => `0:${house.colliders.filter(isBox).filter((c) => c.f === 0 || c.f === -1).indexOf(collider)}`

describe('createHouseNavObstacles', () => {
  it('publishes every ground-floor wall, lot wall and door of the house, in the world', () => {
    const { house, source } = setup()
    const boxes = house.colliders.filter(isBox)
    const obstacles = source.obstacles()
    const walls = boxes.filter((collider) => collider.type === 'wall' && collider.f === 0)
    const doors = boxes.filter((collider) => (collider.type === 'door' && collider.f === 0) || collider.type === 'gate')
    expect(walls.length).toBeGreaterThan(4)
    expect(doors.length).toBeGreaterThan(0)
    expect(obstacles.filter((obstacle) => obstacle.kind === NAV_OBSTACLE_KIND.DOOR)).toHaveLength(doors.length)
    expect(obstacles.filter((obstacle) => obstacle.kind === NAV_OBSTACLE_KIND.SOLID).length).toBeGreaterThanOrEqual(walls.length + boxes.filter((collider) => collider.type === 'lot_wall').length)
    // turned a quarter and moved: every box lies round the placed house, none round the origin
    const limits = boxes.reduce((range, c) => [Math.min(range[0], c.x0), Math.min(range[1], c.z0), Math.max(range[2], c.x1), Math.max(range[3], c.z1)], [Infinity, Infinity, -Infinity, -Infinity])
    const reach = Math.max(Math.abs(limits[0]), Math.abs(limits[1]), Math.abs(limits[2]), Math.abs(limits[3])) + 0.01
    for (const obstacle of obstacles) for (const box of obstacle.boxes) {
      expect(Math.abs(box.rect[0] - PLACE.x)).toBeLessThanOrEqual(reach)
      expect(Math.abs(box.rect[1] - PLACE.z)).toBeLessThanOrEqual(reach)
      expect(box.rect[2]).toBeGreaterThan(box.rect[0])
      expect(box.rect[3]).toBeGreaterThan(box.rect[1])
    }
    expect(source.changes()).toHaveLength(0)
  })

  it('a door that opens and closes comes out of changes(), and a broken one swings open', () => {
    const { house, source } = setup()
    const leaf = house.doors.find((door) => door.floor === 0 && door.col && !door.open)!
    expect(leaf).toBeTruthy()
    const id = idOf(house, leaf.col!)
    expect(source.obstacles().find((obstacle) => obstacle.id === id)).toMatchObject({ kind: NAV_OBSTACLE_KIND.DOOR, open: false })
    house.parts[`door:${leaf.id}`]!.opens(1)
    const opened = source.changes()
    expect(opened.map((obstacle) => [obstacle.id, obstacle.open])).toEqual([[id, true]])
    house.parts[`door:${leaf.id}`]!.opens(0)
    expect(source.changes().map((obstacle) => obstacle.open)).toEqual([false])
    source.breakDoor(id)
    expect(leaf.open).toBe(true)
    expect(source.changes().map((obstacle) => [obstacle.id, obstacle.open])).toEqual([[id, true]])
  })

  it('a wall a burst cuts stands in the pieces that are left', () => {
    const { house, source, world } = setup()
    const wall = house.colliders.filter(isBox).find((collider) => collider.type === 'wall' && collider.f === 0 && collider.piece === 'wall_0_0')!
    expect(wall).toBeTruthy()
    const before = source.obstacles().find((obstacle) => obstacle.id === idOf(house, wall))!
    expect(before).toMatchObject({ kind: NAV_OBSTACLE_KIND.SOLID })
    expect(before.boxes).toHaveLength(1)
    const part = house.structure.byId.get('wall_0_0')!
    const alongU = part.aabb[2] - part.aabb[0] > part.aabb[3] - part.aabb[1]
    for (let round = 0; round < 24; round++) {
      const u = alongU ? part.aabb[0] + 0.6 + (round % 6) * 0.2 : (part.aabb[0] + part.aabb[2]) / 2
      const v = alongU ? (part.aabb[1] + part.aabb[3]) / 2 : part.aabb[1] + 0.6 + (round % 6) * 0.2
      const at = house.house.localToWorld(new THREE.Vector3(u, part.y0 + 0.4 + Math.floor(round / 6) * 0.3, v))
      world.hitPart(house.destruction.id!, 'wall_0_0', { type: 'blunt', point: [at.x, at.y, at.z], energy: 9000, radius: 0.5 })
    }
    world.update(0.05)
    const changed = source.changes().find((obstacle) => obstacle.id === before.id)
    expect(changed).toBeTruthy()
    const length = (boxes: typeof before.boxes): number => boxes.reduce((sum, box) => sum + Math.max(box.rect[2] - box.rect[0], box.rect[3] - box.rect[1]), 0)
    expect(length(changed!.boxes.filter((box) => box.height >= 1.5))).toBeLessThan(length(before.boxes) - 0.4)
  })
})
