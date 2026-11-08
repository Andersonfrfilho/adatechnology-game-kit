import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

function blastOnRoof() {
  const world = createDestruction({ seed: 3 })
  const { house } = houseOf(planOf('casaA', 1), { destruction: world })
  const d = house.destruction
  d.activate()
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  const bays = house.structure.parts.filter((p) => p.role === 'roof' && p.id.startsWith('roof_a_'))
  const first = bays[0]!
  const point: [number, number, number] = [(first.aabb[0] + first.aabb[2]) / 2, first.y1 + 0.3, (first.aabb[1] + first.aabb[3]) / 2]
  for (let i = 0; i < 6 && world.part(d.id!, first.id)?.status !== 'broken'; i++) world.explode(point, 2e6, 4, 'test') // about 2 kg of TNT: tiles break within 2-4 m
  return { world, d, events, bays, point, house }
}

describe('a roof of clay tiles', () => {
  it('is cut into bays between the trusses, each resting on the trusses at its ends', () => {
    const { bays } = blastOnRoof()
    expect(bays.length).toBeGreaterThan(3)
    for (const bay of bays) expect(Math.min(bay.aabb[2] - bay.aabb[0], bay.aabb[3] - bay.aabb[1])).toBeLessThan(2)
  })

  it('a blast breaks only the bays within its reach; the far ones stay on the roof', () => {
    const { world, d, bays, point } = blastOnRoof()
    const distance = (b: (typeof bays)[number]) => Math.hypot(Math.max(b.aabb[0] - point[0], 0, point[0] - b.aabb[2]), Math.max(b.aabb[1] - point[2], 0, point[2] - b.aabb[3]))
    expect(world.part(d.id!, bays[0]!.id)?.status).toBe('broken')
    const far = bays.filter((b) => distance(b) > 4)
    expect(far.length).toBeGreaterThan(0)
    for (const bay of far) expect(world.part(d.id!, bay.id)?.status).not.toBe('broken')
  })

  it('a broken bay throws its tiles in handfuls, not in a few plates', () => {
    const { events, bays } = blastOnRoof()
    const broke = events.find((e) => e.type === 'fracture' && e.part === bays[0]!.id)
    expect(broke?.type).toBe('fracture')
    const tiles = broke?.type === 'fracture' ? broke.fragments : []
    expect(tiles.length).toBeGreaterThan(20)
    for (const f of tiles.filter((t) => t.material === 'ceramic')) expect(f.size[0] * f.size[1]).toBeLessThan(0.5)
  })

  it('each bay is drawn with its own tiles: the roof seen from above over a bay is that bay', () => {
    const world = createDestruction({ seed: 3 })
    const { house } = houseOf(planOf('casaA', 1), { destruction: world })
    house.group.updateMatrixWorld(true)
    const bays = house.structure.parts.filter((p) => p.role === 'roof')
    const ray = new THREE.Raycaster()
    for (const bay of bays) {
      const x = (bay.aabb[0] + bay.aabb[2]) / 2, z = (bay.aabb[1] + bay.aabb[3]) / 2
      ray.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0))
      const hit = ray.intersectObject(house.group, true).find((h) => house.structure.pieceId(h.object, h.faceIndex ?? null)?.startsWith('roof_'))
      expect(hit && house.structure.pieceId(hit.object, hit.faceIndex ?? null), bay.id).toBe(bay.id)
    }
  })
})
