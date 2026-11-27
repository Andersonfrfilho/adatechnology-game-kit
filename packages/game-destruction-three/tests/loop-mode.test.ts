import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'
import { PhysicsOptionError } from '../src/physics-option'
import { IS_JOLT, physicsLoop, physicsOption, tick } from './setup-physics'

const DT = 1 / 60

/** What the seam reports in the loop's mode and in the one-system mode: the same drops, one sounds the landing and the knock, and both come to rest. */
const run = (mode: 'one system' | 'loop'): { landings: number; knocks: number; restY: number; asleep: boolean } => {
  const physics = mode === 'loop' ? physicsLoop() : physicsOption()
  let landings = 0
  let knocks = 0
  const system = new PieceSystem(THREE, {
    physics,
    groundAt: () => 0,
    gravity: 9.81,
    onHardLanding: () => void landings++,
    onKnock: () => void knocks++,
    scene: new THREE.Scene(),
  })
  const lower = new THREE.Object3D()
  lower.position.set(0, 0.5, 0)
  const falling = system.create('lower', lower, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
  const thrown = new THREE.Object3D()
  thrown.position.set(-0.6, 0.12, 0)
  system.create('thrown', thrown, [0.1, 0.1, 0.1], new THREE.Vector3(), 2, [4, 0, 0])
  for (let i = 0; i < 180; i++) tick(physics, system, DT)
  return { landings, knocks, restY: lower.position.y, asleep: falling.sleeping }
}

describe.skipIf(!IS_JOLT)('the pieces step the same under a host loop and in one system', () => {
  it('both land the dropped piece, sound the landing and the knock, and bring it to rest', () => {
    const one = run('one system')
    const loop = run('loop')
    expect(loop.landings).toBe(one.landings)
    expect(loop.knocks).toBeGreaterThan(0)
    expect(loop.knocks).toBe(one.knocks)
    expect(loop.restY).toBeCloseTo(one.restY, 1)
    expect(loop.asleep).toBe(one.asleep)
  })
})

describe('the physics option is required', () => {
  it('left out, it throws a typed error that says what to pass', () => {
    const options = { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() }
    // a plain-JS host can leave the option out: the type forbids it, the runtime still refuses
    expect(() => new PieceSystem(THREE, options as unknown as ConstructorParameters<typeof PieceSystem>[1])).toThrow(PhysicsOptionError)
    expect(() => new PieceSystem(THREE, options as unknown as ConstructorParameters<typeof PieceSystem>[1])).toThrow(/'own'/)
  })
})
