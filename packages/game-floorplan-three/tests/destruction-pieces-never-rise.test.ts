import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionWorld } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import type { HouseDestruction } from '../src/destruction/types'
import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

/** No piece the three `destruction` goldens loosen ends up higher than where it stood (a drawer thrown off a night stand falls: 0.4 m, never up). */
const MAX_RISE = 0.5
type Hit = (s: { world: DestructionWorld; d: HouseDestruction; centre: (id: string) => [number, number, number] }) => void
const scenes: Array<[string, Hit]> = [
  ['breach', ({ world, d, centre }) => world.hitPart(d.id!, 'wall_0_0', { type: 'blunt', point: centre('wall_0_0'), energy: 3e4, radius: 0.35, source: 'test' })],
  ['spall', ({ world, d }) => world.hitPart(d.id!, 'slab_1_p0', { type: 'explosive', point: d.spec!.parts.find((p) => p.id === 'slab_1_p0')!.position, energy: 4e5, radius: 1.5 })],
  ['fracture', ({ world, d, centre }) => world.hitPart(d.id!, 'wall_0_0', { type: 'explosive', point: centre('wall_0_0'), energy: 2e6, radius: 2.5, source: 'test' })],
]

describe('pieces of a destroyed house never rise', () => {
  it.each(scenes)('%s', (_name, hit) => {
    const world = createDestruction({ seed: 5 })
    const scene = new THREE.Scene()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
    const { house: built } = houseOf(planOf('sobrado', 3), { destruction: world, destructionRenderer: renderer })
    scene.add(built.group)
    const d = built.destruction
    d.activate()
    const centre = (id: string): [number, number, number] => {
      const p = built.structure.byId.get(id)!
      return [(p.aabb[0] + p.aabb[2]) / 2, (p.y0 + p.y1) / 2, (p.aabb[1] + p.aabb[3]) / 2]
    }
    hit({ world, d, centre })
    const first = new Map<string, number>()
    const highest = new Map<string, number>()
    const at = new THREE.Vector3()
    for (let t = 0; t < 1; t += 0.05) {
      world.update(0.05)
      renderer.update(0.05)
      for (const piece of renderer.pieces()) {
        // the piece's root is the house's origin and its centre is metres away: a turn swings `root.position` by that lever, so the height is read at the centre
        piece.root.updateMatrixWorld(true)
        at.set(piece.localCenter[0], piece.localCenter[1], piece.localCenter[2])
        piece.root.localToWorld(at)
        if (!first.has(piece.objectId)) first.set(piece.objectId, at.y)
        highest.set(piece.objectId, Math.max(highest.get(piece.objectId) ?? at.y, at.y))
      }
    }
    expect(first.size).toBeGreaterThanOrEqual(9)
    const rises = [...highest].map(([id, y]) => y - (first.get(id) ?? y))
    expect(Math.max(...rises)).toBeLessThan(MAX_RISE)
  })
})
