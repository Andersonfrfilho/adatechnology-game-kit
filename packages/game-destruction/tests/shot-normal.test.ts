import { describe, expect, it } from 'vitest'
import type { SurfaceRay, SurfaceRayHit } from '@adatechnology/game-contracts'
import { createDestruction } from '../src'
import type { DestructibleImpl, DestructibleSpec, DestructionEvent, ObjectState } from '../src'
import { chair } from './helpers'

/**
 * A hosted body whose drawn surface is a flat steel panel: it answers `surfaceRay` so the world's `shoot` traces the real surface, not the
 * box. The normal it hands back is what a host uses to push the body — the host must never re-raycast the whole body to get it.
 */
function surfacedPanel(id = 'door_a'): DestructibleImpl {
  const spec: DestructibleSpec = { name: 'door', parts: [{ id: 'panel', material: 'steel', shape: { kind: 'box', size: [1, 0.02, 1] }, position: [0, 0.1, 0] }] }
  return {
    id,
    describe: () => spec,
    hit(): DestructionEvent[] {
      return [{ type: 'hole', object: id, time: 0, part: 'panel', hole: { point: [0, 0.1, 0], normal: [0, 1, 0], diameter: 0.009, through: true }, worldPoint: [0, 0.1, 0], energyLeft: 200 }]
    },
    update: () => [] as DestructionEvent[],
    state(): ObjectState {
      return {
        id, position: [0, 0, 0], rotation: [0, 0, 0, 1], groups: [['panel']], destroyed: false, joints: [],
        parts: [{ id: 'panel', material: 'steel', status: 'damaged', hp: 99, maxHp: 100, mass: 10, temperature: 20, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 }],
      }
    },
    surfaceRay(ray: SurfaceRay): SurfaceRayHit | null {
      // the drawn surface is the top face of the panel (y = 0.11): answer where the ray crosses it
      if (Math.abs(ray.direction[1]) < 1e-6) return null
      const t = (0.11 - ray.origin[1]) / ray.direction[1]
      if (t < 0 || t > ray.maxDistance) return null
      return { part: 'panel', point: [ray.origin[0] + ray.direction[0] * t, 0.11, ray.origin[2] + ray.direction[2] * t], normal: [0, 1, 0], distance: t, pathLen: 0.02 }
    },
  }
}

describe('world.shoot hands the traced surface normal back', () => {
  it('a round on a hosted body returns the surfaceRay normal, so the host never re-raycasts the whole body', () => {
    const w = createDestruction()
    w.register(surfacedPanel())
    const res = w.shoot([0, 2, 0], [0, -1, 0], 500, 9)
    expect(res).toHaveLength(1)
    expect(res[0].part).toBe('panel')
    expect(res[0].point).toEqual([0, 0.11, 0])
    expect(res[0].normal).toEqual([0, 1, 0])
  })

  it('a body without a traced surface (box-only) still answers a normal: the world always traces one for a hosted body', () => {
    const w = createDestruction()
    // the same part but no surfaceRay: the world answers its box, and the result still carries a normal (the box normal)
    const boxed = surfacedPanel()
    delete (boxed as { surfaceRay?: unknown }).surfaceRay
    w.register(boxed)
    const res = w.shoot([0, 2, 0], [0, -1, 0], 500, 9)
    expect(res[0].normal).toBeDefined()
  })

  it('a plain object (not hosted) carries no normal, so the host knows to trace its drawn surface itself', () => {
    const w = createDestruction()
    const id = w.add(chair())
    const res = w.shoot([0, 2, 0], [0, -1, 0], 500, 9)
    expect(res.find((r) => r.object === id)?.normal).toBeUndefined()
  })
})
