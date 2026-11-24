import * as THREE from 'three'

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

/** A world with no GPU: the kit's own solver, no workers and no recorded sounds (nothing to fetch). */
export function makeWorld(extra: Partial<KitWorldOptions> = {}): Promise<KitWorld> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createKitWorld(THREE, {
    container,
    renderer: stubRenderer(),
    bounds: [-8, -8, 8, 8],
    physics: 'own',
    workers: 0,
    audio: { samplesBaseUrl: null, userSamplesBaseUrl: null },
    ...extra,
  })
}
