import { checkSpec } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { wallPiece, wallPlan } from '../src'
import { THREE } from './helpers/houses'
import { fakeDocument } from './helpers/fake-document'

const make = () => wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } })

describe('wallPiece', () => {
  it('stands as a house wall: the wall on the strip footing and the bond beam on it, no roof', () => {
    const plan = wallPlan({ w: 10, h: 3 })
    expect(plan.construction.system).toBe('masonry')
    expect(plan.construction.foundation.type).toBe('strip_footing')
    const parts = plan.structure.parts.map((p: any) => `${p.id}:${p.role}:${p.material}`)
    expect(parts).toEqual(['wall_0_0:wall:brick', 'plate_0_0:beam:concrete'])
    expect(plan.structure.supports.map((s: any) => `${s.part}>${s.on}:${s.joint}`)).toEqual(['wall_0_0>ground:mortar', 'plate_0_0>wall_0_0:mortar'])
  })

  it('gives the spec a house gives: the plastered brick wall with its units and breach, the bond beam with rebar', () => {
    const { spec } = make()
    const wall = spec.parts.find((p: any) => p.id === 'wall_0_0')
    expect(wall.layers.some((l: any) => l.material === 'plaster')).toBe(true)
    expect(wall.units).toBeTruthy()
    expect(wall.breach).toBeTruthy()
    expect(spec.parts.find((p: any) => p.id === 'plate_0_0').reinforcement).toBeTruthy()
    expect(spec.joints.map((j: any) => j.id)).toEqual(expect.arrayContaining(['wall_0_0~ground', 'plate_0_0~wall_0_0']))
    const report = checkSpec(spec, { materials: createDestruction({ seed: 1 }).materials.keys() })
    expect(report.problems).toEqual([])
  })

  it('draws nothing outside the wall when shots knock the bricks out of its corners and ends', () => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const root = piece.build(THREE)
    const follower = piece.follow(root, world, id)!
    // the drawn wall: 10 m along x centred on the origin, 3 m high, 15 cm thick (the structure's part reaches past its ends by half the thickness)
    const wall = new THREE.Box3(new THREE.Vector3(-5, 0, -0.075), new THREE.Vector3(5, 3, 0.075))
    const rifle = (x: number, y: number) => world.shoot([x, y, 5], [0, 0, -1], 2100, 7.62, 'test')
    for (const [x, y] of [[-4.97, 2.97], [-4.9, 2.85], [-4.97, 1.5], [-4.85, 1.5], [4.97, 2.97], [4.95, 0.6]]) for (let i = 0; i < 4; i++) rifle(x!, y!)
    follower.update()
    const units = root.getObjectByName('breach:wall_0_0') as any
    expect(units.count).toBeGreaterThan(0)
    root.updateMatrixWorld(true)
    const drawn = new THREE.Box3(), cell = new THREE.Box3(), m = new THREE.Matrix4()
    units.geometry.computeBoundingBox()
    for (let i = 0; i < units.count; i++) {
      units.getMatrixAt(i, m)
      drawn.union(cell.copy(units.geometry.boundingBox).applyMatrix4(m).applyMatrix4(units.matrixWorld))
    }
    expect(drawn.min.x).toBeGreaterThanOrEqual(wall.min.x - 1e-6)
    expect(drawn.max.x).toBeLessThanOrEqual(wall.max.x + 1e-6)
    expect(drawn.max.y).toBeLessThanOrEqual(wall.max.y + 1e-6)
    expect(drawn.min.z).toBeGreaterThanOrEqual(wall.min.z - 1e-6)
    expect(drawn.max.z).toBeLessThanOrEqual(wall.max.z + 1e-6)
    follower.dispose()
  })

  // the frag grenade of the room (M67 of game-weapons: 200 kJ, out to 15 m) going off 40 cm in front of the wall, 30 cm over the floor
  const grenade = (world: ReturnType<typeof createDestruction>, x: number) => world.explode([x, 0.3, 0.4], 200000, 15, 'test')
  const blown = (events: DestructionEvent[]) => events.flatMap((e) => (e.type === 'chip' && e.units ? e.units : []))

  it.each([['at the end', 4.55], ['in the middle', 0]])('a grenade %s of the wall knocks out a ragged hole around it and the rest of the wall stands', (_where, x) => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    grenade(world, x)
    for (let i = 0; i < 20; i++) world.update(0.1)
    expect(events.filter((e) => e.type === 'collapse' || e.type === 'detach' || e.type === 'fracture')).toEqual([])
    const wall = world.part(id, 'wall_0_0')!
    expect(wall.status).toBe('damaged')
    const units = blown(events)
    const area = units.reduce((sum, unit) => sum + unit.size[0] * unit.size[1], 0)
    // about a square metre of a 28 m² wall, around the grenade
    expect(area).toBeGreaterThan(0.6)
    expect(area / (10.15 * 2.8)).toBeLessThan(0.08)
    for (const unit of units) expect(Math.abs(unit.center[0] - x)).toBeLessThan(1.4)
    // the edge follows the bricks and is not a smooth outline: the courses end at different places
    const ends = new Map<number, number>()
    for (const unit of units) {
      const row = Math.round(unit.center[1] / 0.075)
      // the side of the hole toward the middle of the wall (at its end, the other side is the end of the wall)
      ends.set(row, Math.min(ends.get(row) ?? Infinity, unit.center[0]))
    }
    expect(new Set([...ends.values()].map((v) => v.toFixed(2))).size).toBeGreaterThan(3)
  })

  it('a second grenade somewhere else on the wall cuts a second hole, and shots still knock bricks out beside them', () => {
    const piece = make()
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    grenade(world, -3)
    const first = blown(events).length
    grenade(world, 3)
    expect(blown(events).length).toBeGreaterThan(first * 1.5)
    const chipped = world.part(id, 'wall_0_0')!.chipped!.length
    for (let i = 0; i < 4; i++) world.shoot([0, 2, 5], [0, 0, -1], 3500, 7.62, 'test')
    expect(world.part(id, 'wall_0_0')!.chipped!.length).toBeGreaterThan(chipped)
    expect(world.part(id, 'wall_0_0')!.status).toBe('damaged')
  })

  it('is drawn by the house renderer, centred on the origin, with the wall meshes labelled by part', () => {
    const root = make().build(THREE)
    const labelled: string[] = []
    root.traverse((o: any) => { if (o.isMesh && o.userData.destructionPart) labelled.push(o.userData.destructionPart) })
    expect(labelled).toContain('wall_0_0')
    const box = new THREE.Box3().setFromObject(root)
    expect(box.min.x).toBeLessThan(-4.9)
    expect(box.max.x).toBeGreaterThan(4.9)
    expect(box.max.y).toBeCloseTo(3, 1)
  })
})
