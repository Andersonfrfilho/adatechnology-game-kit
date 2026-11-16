import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'
import { IS_JOLT, physicsOption } from './setup-physics'

/** What the test reads of the system's private list of torn pairs. */
interface Tethers {
  readonly tethered: ReadonlySet<string>
}

describe.skipIf(!IS_JOLT)('pairs torn apart by a joint (CLAUDE.md §8)', () => {
  it('a pair is forgotten when one of its pieces is gone', () => {
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
    for (const [id, x] of [['pole', 0], ['wire', 1]] as const) {
      const root = new THREE.Object3D()
      root.position.set(x, 0.1, 0)
      system.create(id, root, [0.1, 0.1, 0.1], new THREE.Vector3(), 1)
    }
    system.tether('wire', 'pole')
    system.update(1 / 60)
    expect((system as unknown as Tethers).tethered.size).toBe(1)
    system.remove('wire')
    system.update(1 / 60)
    expect((system as unknown as Tethers).tethered.size).toBe(0)
  })
})
