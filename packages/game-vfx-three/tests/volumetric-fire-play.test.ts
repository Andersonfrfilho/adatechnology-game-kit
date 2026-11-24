import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createVfxRenderer } from '../src'

describe('volumetric_fire via EffectSink.play', () => {
  it('starts a 3D volumetric fire in world.fire (vfx-puffs) and stops it via stop(handle)', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(0, 2, 6)
    const renderer = createVfxRenderer(THREE, { scene, camera })

    const handle = renderer.play({
      effect: 'volumetric_fire',
      point: [1, 0.5, -2],
      values: { radius: 0.6, life: 15 },
    })

    expect(handle).not.toBeNull()
    renderer.update(0.25)
    expect(renderer.world.stats().fires).toBe(1)
    expect(renderer.world.pools().puffs.count).toBeGreaterThan(0)

    renderer.stop(handle!)
    expect(renderer.world.stats().fires).toBe(0)
    renderer.dispose()
  })
})
