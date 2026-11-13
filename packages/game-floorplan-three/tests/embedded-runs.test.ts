import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'

import { houseOf, planOf, THREE } from './helpers/houses'

/** Vertices per box of a `BoxBatch`. */
const BOX_VERTICES = 24

/** The plumb stretches of the conduits and pipes in the walls, in the house's frame: x, z, y range, radius. */
function runsOf(root: THREE.Object3D): { readonly x: number; readonly z: number; readonly y0: number; readonly y1: number; readonly r: number }[] {
  const out: { x: number; z: number; y0: number; y1: number; r: number }[] = []
  root.traverse((o) => {
    const part = o.userData.part as string | undefined
    if (part !== 'wall_conduit' && part !== 'wall_pipe') return
    const routes = part === 'wall_conduit' ? [((o.userData.points ?? []) as number[][]).map((p) => [p[0]!, p[2]!, p[1]!])] : ((o.userData.routes ?? []) as number[][][])
    for (const route of routes) for (let i = 0; i + 1 < route.length; i++) {
      const a = route[i]!, b = route[i + 1]!
      if (Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!) > 1e-3 || Math.abs(a[1]! - b[1]!) < 0.3 || Math.max(a[1]!, b[1]!) < 0.2) continue
      out.push({ x: a[0]!, z: a[2]!, y0: Math.min(a[1]!, b[1]!), y1: Math.max(a[1]!, b[1]!), r: part === 'wall_conduit' ? 0.01 : 0.0125 })
    }
  })
  return out
}

const shown = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true }

describe('the runs in the walls lie in chases cut in the masonry, and stay there under the render', () => {
  for (const template of ['single_storey_a', 'townhouse']) {
    it(`${template}: no brick or block shares the volume of a conduit or a pipe going up or down its wall (level 4)`, () => {
      const { house } = houseOf(planOf(template, 1), {}, { quality: 'game', constructionStages: true, constructionLevel: 4 })
      house.setConstructionLevel?.(4)
      house.group.updateMatrixWorld(true)
      const runs = runsOf(house.group)
      expect(runs.length).toBeGreaterThan(0)
      const clashes: string[] = []
      ;(house.groups as Record<string, THREE.Object3D>)['stage:3:masonry']?.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh || !/^masonry:(brick|block)/.test(mesh.name)) return
        const position = mesh.geometry.getAttribute('position')
        for (let i = 0; i + BOX_VERTICES <= position.count; i += BOX_VERTICES) {
          const box = new THREE.Box3()
          for (let k = i; k < i + BOX_VERTICES; k++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, k).applyMatrix4(mesh.matrixWorld))
          for (const r of runs) {
            // the run's square section round its axis, against the unit, with half a millimetre of slack
            const into = Math.min(box.max.x, r.x + r.r) - Math.max(box.min.x, r.x - r.r), across = Math.min(box.max.z, r.z + r.r) - Math.max(box.min.z, r.z - r.r)
            const high = Math.min(box.max.y, r.y1) - Math.max(box.min.y, r.y0)
            if (into > 0.0005 && across > 0.0005 && high > 0.0005) clashes.push(`${r.x.toFixed(3)},${r.z.toFixed(3)} y ${box.min.y.toFixed(2)}`)
          }
        }
      })
      expect([...new Set(clashes)]).toEqual([])
    })
  }

  it('they are there from the rough-in on, at every level: nothing hides them by level, the render covers them', () => {
    const { house } = houseOf(planOf('single_storey_a', 1), {}, { quality: 'game', constructionStages: true, constructionLevel: 8 })
    const parts: THREE.Object3D[] = []
    house.group.traverse((o) => { if (o.userData.part === 'wall_conduit' || o.userData.part === 'wall_pipe' || o.userData.part === 'electrical_box') parts.push(o) })
    expect(parts.length).toBeGreaterThan(0)
    for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      house.setConstructionLevel?.(level)
      expect(parts.every(shown), `level ${level}`).toBe(level >= 4)
    }
  })

  it('a wall broken open keeps the runs in it where they are: they do not go with the wall', () => {
    const world = createDestruction({ seed: 3 })
    const { house } = houseOf(planOf('single_storey_a', 1), { destruction: world }, { quality: 'game', constructionStages: true, constructionLevel: 8 })
    house.setConstructionLevel?.(8)
    house.destruction.activate()
    const conduits: THREE.Object3D[] = []
    house.group.traverse((o) => { if (o.userData.part === 'wall_conduit') conduits.push(o) })
    const before = conduits.map((o) => new THREE.Box3().setFromObject(o))
    const wall = house.structure.byId.get('wall_0_0')!
    world.hitPart(house.destruction.id!, 'wall_0_0', { type: 'explosive', point: [(wall.aabb[0] + wall.aabb[2]) / 2, 1.2, (wall.aabb[1] + wall.aabb[3]) / 2], energy: 2e6, radius: 2.5, source: 'test' })
    for (let t = 0; t < 1; t += 0.05) world.update(0.05)
    expect(conduits.every(shown)).toBe(true)
    conduits.forEach((o, k) => expect(new THREE.Box3().setFromObject(o).equals(before[k]!)).toBe(true))
  })
})
