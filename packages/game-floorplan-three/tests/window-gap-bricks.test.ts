import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import type { InstancedMesh } from 'three'
import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

type Gap = { kind: string; wall: string; from: number; to: number; y0: number; y1: number }

/**
 * The bricks a wall draws where it was cut (`breach:<wall>`) that stand in one of its window gaps, after a grenade 70 cm in front of each window of the ground floor:
 * a wall is not laid in its window gap, so a brick drawn there is a brick behind the glass (what the room showed before the gap was taken out of the courses).
 */
function bricksInGaps(template: string, seed: number): { windows: number; units: number; inGaps: string[] } {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const { house } = houseOf(planOf(template, seed), { destruction: world, destructionRenderer: renderer })
  scene.add(house.group)
  house.destruction.activate()
  const gaps = ((house.structure.openings ?? []) as Gap[]).filter((o) => o.kind === 'window')
  for (const gap of gaps.filter((o) => o.y0 < 1.5)) {
    const wall = house.structure.byId.get(gap.wall)
    if (!wall) continue
    const alongU = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1], cross = alongU ? (wall.aabb[1] + wall.aabb[3]) / 2 : (wall.aabb[0] + wall.aabb[2]) / 2, mid = (gap.from + gap.to) / 2
    for (const side of [-0.7, 0.7]) {
      const p = alongU ? [mid, (gap.y0 + gap.y1) / 2, cross + side] : [cross + side, (gap.y0 + gap.y1) / 2, mid]
      const w = house.group.localToWorld(new THREE.Vector3(p[0], p[1], p[2]))
      world.explode([w.x, w.y, w.z], 200000, 15, 'test', { charge: { tnt: 0.24 } })
      for (let k = 0; k < 4; k++) { world.update(0.05); renderer.update(0.05) }
    }
  }
  house.group.updateMatrixWorld(true)
  const inGaps: string[] = []
  let units = 0
  const m = new THREE.Matrix4(), at = new THREE.Vector3()
  house.group.traverse((o) => {
    if (!o.name.startsWith('breach:')) return
    const mesh = o as InstancedMesh, wallId = o.name.slice('breach:'.length), wall = house.structure.byId.get(wallId)
    if (!wall) return
    const alongU = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1]
    for (let i = 0; i < mesh.count; i++) {
      units++
      mesh.getMatrixAt(i, m)
      at.setFromMatrixPosition(m)
      const s = alongU ? at.x : at.z
      const gap = gaps.find((g) => g.wall === wallId && s > Math.min(g.from, g.to) + 0.01 && s < Math.max(g.from, g.to) - 0.01 && at.y > g.y0 + 0.01 && at.y < g.y1 - 0.01)
      if (gap) inGaps.push(`${wallId} ${gap.from.toFixed(2)}..${gap.to.toFixed(2)} at ${s.toFixed(2)}, ${at.y.toFixed(2)}`)
    }
  })
  return { windows: gaps.length, units, inGaps }
}

describe('no brick is drawn in a window gap', () => {
  for (const [template, seed] of [['single_storey_a', 1], ['townhouse', 3]] as const) {
    it(`${template} seed ${seed}: a grenade by each window opens the walls round it and lays no brick behind its glass`, () => {
      const { windows, units, inGaps } = bricksInGaps(template, seed)
      expect(windows).toBeGreaterThan(0)
      expect(units).toBeGreaterThan(0)
      expect(inGaps).toEqual([])
    }, 600000)
  }
})
