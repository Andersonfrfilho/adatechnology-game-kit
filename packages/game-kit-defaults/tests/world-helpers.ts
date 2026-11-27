import * as THREE from 'three'
import { afterEach } from 'vitest'

import { createKitWorld } from '../src/world'
import type { KitWorld, KitWorldOptions } from '../src/world'

/** A WebGLRenderer stand-in: the host only needs these members, and happy-dom cannot make a real GL context. */
export function stubRenderer(): THREE.WebGLRenderer {
  return {
    domElement: document.createElement('canvas'),
    shadowMap: { enabled: false, type: 0 },
    setSize: () => undefined,
    setPixelRatio: () => undefined,
    render: () => undefined,
    dispose: () => undefined,
  } as unknown as THREE.WebGLRenderer
}

const made: KitWorld[] = []
// a world a failed test left standing is freed here (`dispose` runs once)
afterEach(() => {
  for (const world of made.splice(0)) world.dispose()
})

/** A world with no GPU: Jolt, no workers and no recorded sounds (nothing to fetch). */
export async function makeWorld(extra: Partial<KitWorldOptions> = {}): Promise<KitWorld> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const world = await createKitWorld(THREE, {
    container,
    renderer: stubRenderer(),
    bounds: [-8, -8, 8, 8],
    workers: 0,
    audio: { samplesBaseUrl: null, userSamplesBaseUrl: null },
    ...extra,
  })
  made.push(world)
  return world
}
