import { checkSpec } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
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
