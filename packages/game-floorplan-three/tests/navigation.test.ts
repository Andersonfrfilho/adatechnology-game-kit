import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { bindNavigator, createFloorNavigator, navigationDefOf } from '../src'
import { THREE, houseOf, planOf } from './helpers/houses'

// The floor navigator (the team's AndaresSDK, a 10 cm grid per floor) and its binding to the house and to its destruction.
const FLAT = { id: 'flat', floors: [{ y: 0, h: 2.8, solids: [[0, 0, 6, 0.15], [0, 4.85, 6, 5]] as [number, number, number, number][] }, { y: 2.8, h: 2.8, solids: [[2, 0, 2.2, 5]] as [number, number, number, number][] }], stairs: [[3, 1, 4, 3, 0, 1, 'z']] as [number, number, number, number, number, number, 'z'][], own: true }

describe('the grid', () => {
  it('blocks the cells of the solids and leaves the rest free, on a 10 cm grid', () => {
    const nav = createFloorNavigator()
    nav.register(FLAT)
    expect(nav.blocked(2.1, 3, 1)).toBe(1)
    expect(nav.blocked(2.5, 3, 1)).toBe(0)
    expect(nav.blocked(1.94, 3, 1)).toBe(0)
    expect(nav.blocked(2.18, 3, 1)).toBe(1)
    expect(nav.blocked(2.26, 3, 1)).toBe(0)
  })

  it('answers -1 (use the ground grid) outside a house or on a ground floor it does not own', () => {
    const nav = createFloorNavigator()
    nav.register({ ...FLAT, id: 'shared', own: false })
    expect(nav.blocked(-40, -40, 0)).toBe(-1)
    expect(nav.blocked(-40, -40, 1)).toBe(1)
    expect(nav.blocked(3, 0.05, 0)).toBe(1)
    expect(nav.blocked(5, 2.5, 0)).toBe(-1)
    const own = createFloorNavigator()
    own.register(FLAT)
    expect(own.blocked(5, 2.5, 0)).toBe(0)
  })

  it('links the floors by the flights of the stairs', () => {
    const nav = createFloorNavigator()
    const house = nav.register(FLAT)
    const flight = nav.stairTo(house, 0, 1)
    expect(flight).toBeTruthy()
    expect(flight!.yFrom).toBe(0)
    expect(flight!.yTo).toBe(2.8)
    expect(nav.stairTo(house, 1, 0)).toBeTruthy()
    expect(nav.ceilingOf(house, 0)).toBeGreaterThan(2.4)
    expect(nav.ceilingOf(house, 0)).toBeLessThanOrEqual(2.8)
  })
})

describe('run-time changes of the grid', () => {
  it('opens the cells of a shape, closes them again and undoes everything', () => {
    const nav = createFloorNavigator()
    nav.register(FLAT)
    expect(nav.blocked(3, 0.05, 0)).toBe(1)
    expect(nav.openCells('flat', 0, { rect: [2.5, 0, 3.5, 0.15] })).toBeGreaterThan(0)
    expect(nav.blocked(3, 0.05, 0)).toBe(0)
    expect(nav.blocked(1, 0.05, 0)).toBe(1)
    expect(nav.openCells('flat', 0, { circle: [5, 0.05, 0.3] })).toBeGreaterThan(0)
    expect(nav.blocked(5, 0.05, 0)).toBe(0)
    expect(nav.closeCells('flat', 1, { rect: [3, 3.5, 5, 4.5] })).toBeGreaterThan(0)
    expect(nav.blocked(4, 4, 1)).toBe(1)
    nav.undoChanges('flat')
    expect(nav.blocked(3, 0.05, 0)).toBe(1)
    expect(nav.blocked(5, 0.05, 0)).toBe(1)
    expect(nav.blocked(4, 4, 1)).toBe(0)
  })

  it('changes nothing for a house it does not know', () => {
    const nav = createFloorNavigator()
    expect(nav.openCells('nobody', 0, { rect: [0, 0, 1, 1] })).toBe(0)
    expect(nav.closeCells('nobody', 0, { rect: [0, 0, 1, 1] })).toBe(0)
  })
})

describe('a built house', () => {
  const plan = planOf('sobrado', 3)
  const { house } = houseOf(plan)
  const def = navigationDefOf(house as any, { own: true })

  it('takes the heights, the wall colliders and the flights from the house', () => {
    expect(def.floors.map((f) => f.y)).toEqual(house.r.floors.map((f: any) => f.y0))
    expect(def.floors.map((f) => f.h)).toEqual(house.r.floors.map((f: any) => f.ceiling))
    const walls = house.colliders.filter((c: any) => c.type === 'wall' && c.f === 0)
    expect(def.floors[0]!.solids).toHaveLength(walls.length)
    expect(def.stairs).toHaveLength(house.stairs.length)
    expect(def.stairs![0]!.slice(4, 6)).toEqual([house.stairs[0].f, house.stairs[0].to])
    expect(def.groups).toBe(house.floors)
    expect(def.roof).toBe(house.roof)
  })

  it('leaves the gaps of the doors free and the wall cells solid', () => {
    const nav = createFloorNavigator()
    nav.register(def)
    const wall = house.colliders.find((c: any) => c.type === 'wall' && c.f === 0)
    expect(nav.blocked((wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2, 0)).toBe(1)
    const door = house.doors.find((d: any) => d.floor === 0)
    expect(nav.blocked(door.cx, door.cz, 0)).toBe(0)
  })

  it('lets a person climb to the floor above', () => {
    const nav = createFloorNavigator()
    const nh = nav.register(def)
    expect(nav.stairTo(nh, 0, 1)).toBeTruthy()
    expect(nav.blocked(-40, -40, 1)).toBe(1)
  })

  it('uses the name of the house as its id unless told otherwise', () => {
    expect(def.id).toBe(house.name)
    expect(navigationDefOf(house as any, { id: 'mine' }).id).toBe('mine')
  })
})

describe('bound to the destruction', () => {
  /** A house whose destruction events the test sends by hand, and the navigator that listens to them. */
  function fixture() {
    const { house } = houseOf(planOf('sobrado', 3))
    const nav = createFloorNavigator()
    nav.register(navigationDefOf(house as any, { id: 'h', own: true }))
    const listeners: ((e: any) => void)[] = []
    const fake = { r: house.r, structure: house.structure, destruction: { onEvent: (fn: (e: any) => void) => { listeners.push(fn); return () => { listeners.splice(listeners.indexOf(fn), 1) } } } }
    const binding = bindNavigator(nav, 'h', fake as any)
    const send = (e: any): void => listeners.slice().forEach((fn) => fn(e))
    return { house, nav, binding, send, listeners }
  }
  const middle = (house: any, id: string): [number, number] => { const p = house.structure.byId.get(id); return [(p.aabb[0] + p.aabb[2]) / 2, (p.aabb[1] + p.aabb[3]) / 2] }

  it('opens the cells inside the opening of a wall that reaches stage 2', () => {
    const { house, nav, send } = fixture()
    const [x, z] = middle(house, 'wall_0_0')
    expect(nav.blocked(x, z, 0)).toBe(1)
    send({ type: 'stage', part: 'wall_0_0', stage: 1, opening: { center: [x, 1, z], radius: 0.4 } })
    expect(nav.blocked(x, z, 0)).toBe(1)
    send({ type: 'stage', part: 'wall_0_0', stage: 2, opening: { center: [x, 1, z], radius: 0.4 } })
    expect(nav.blocked(x, z, 0)).toBe(0)
    expect(nav.blocked(x + 1.2, z, 0)).toBe(1)
  })

  it('opens the whole footprint of a wall that fractures or collapses', () => {
    const { house, nav, send } = fixture()
    const [x, z] = middle(house, 'wall_0_0')
    send({ type: 'fracture', part: 'wall_0_0' })
    expect(nav.blocked(x, z, 0)).toBe(0)
    expect(nav.blocked(x + 1.2, z, 0)).toBe(0)
    const [x2, z2] = middle(house, 'wall_0_1')
    expect(nav.blocked(x2, z2, 0)).toBe(1)
    send({ type: 'collapse', parts: ['wall_0_1'] })
    expect(nav.blocked(x2, z2, 0)).toBe(0)
  })

  it('removes the floor cells under a slab that fractures or collapses', () => {
    const { house, nav, send } = fixture()
    const slab = house.structure.byId.get('slab_1')
    const x = (slab.aabb[0] + slab.aabb[2]) / 2, z = (slab.aabb[1] + slab.aabb[3]) / 2
    expect(nav.blocked(x, z, 1)).toBe(0)
    send({ type: 'fracture', part: 'slab_1' })
    expect(nav.blocked(x, z, 1)).toBe(1)
  })

  it('ignores a slab that is not a floor (the one under the roof)', () => {
    const { house, nav, send } = fixture()
    const ceiling = house.structure.byId.get('slab_ceiling')
    const x = (ceiling.aabb[0] + ceiling.aabb[2]) / 2, z = (ceiling.aabb[1] + ceiling.aabb[3]) / 2
    const before = [0, 1].map((f) => nav.blocked(x, z, f))
    send({ type: 'collapse', parts: ['slab_ceiling'] })
    expect([0, 1].map((f) => nav.blocked(x, z, f))).toEqual(before)
  })

  it('ignores parts it does not know and events of other kinds', () => {
    const { send, nav, house } = fixture()
    const [x, z] = middle(house, 'wall_0_0')
    send({ type: 'fracture', part: 'nothing' })
    send({ type: 'damage', part: 'wall_0_0' })
    expect(nav.blocked(x, z, 0)).toBe(1)
  })

  it('puts the grid back on reset and stops listening on off', () => {
    const { house, nav, send, binding, listeners } = fixture()
    const [x, z] = middle(house, 'wall_0_0')
    send({ type: 'fracture', part: 'wall_0_0' })
    expect(nav.blocked(x, z, 0)).toBe(0)
    binding.reset()
    expect(nav.blocked(x, z, 0)).toBe(1)
    binding.off()
    expect(listeners).toHaveLength(0)
    send({ type: 'fracture', part: 'wall_0_0' })
    expect(nav.blocked(x, z, 0)).toBe(1)
  })

  it('follows a real world: the wall that falls leaves a way through', () => {
    const plan = planOf('sobrado', 3)
    const world = createDestruction({ seed: 5 })
    const scene = new THREE.Scene()
    const renderer = createDestructionRenderer(THREE, { scene, world })
    const { house } = houseOf(plan, { destruction: world, destructionRenderer: renderer })
    scene.add(house.group)
    const nav = createFloorNavigator()
    nav.register(navigationDefOf(house as any, { id: 'real', own: true }))
    house.destruction.activate()
    bindNavigator(nav, 'real', house as any)
    const [x, z] = middle(house, 'wall_0_0')
    expect(nav.blocked(x, z, 0)).toBe(1)
    world.hitPart(house.destruction.id, 'wall_0_0', { type: 'blunt', point: [x, 1.3, z], energy: 3e6, radius: 0.35, source: 'test' })
    for (let t = 0; t < 1; t += 0.05) { world.update(0.05); renderer.update(0.05) }
    expect(nav.blocked(x, z, 0)).toBe(0)
    house.destruction.reset()
  })
})
